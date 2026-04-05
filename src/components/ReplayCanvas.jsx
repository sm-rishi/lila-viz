import { useEffect, useRef, useCallback } from 'react';
import { scalePixel } from '../utils/mapConfig';
import { EVENT_CONFIG, FILTER_EVENT_MAP } from '../utils/eventConfig';

/**
 * Draws player journeys on the minimap canvas up to currentT seconds.
 * - Human paths: solid colored lines
 * - Bot paths: dashed gray lines
 * - Event markers: symbols drawn at event positions
 */
export default function ReplayCanvas({ events, currentT, mapImage, canvasSize, eventFilters }) {
  const canvasRef = useRef(null);

  // Build a set of allowed event types from the filter state
  const allowedEvents = useCallback(() => {
    const allowed = new Set();
    Object.entries(FILTER_EVENT_MAP).forEach(([filterKey, evtTypes]) => {
      if (eventFilters[filterKey]) {
        evtTypes.forEach(e => allowed.add(e));
      }
    });
    return allowed;
  }, [eventFilters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;

    const ctx = canvas.getContext('2d');
    const size = canvasSize;
    canvas.width  = size;
    canvas.height = size;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw minimap image as background
    ctx.drawImage(mapImage, 0, 0, size, size);

    if (!events || events.length === 0) return;

    const allowed = allowedEvents();

    // Split events into visible (t <= currentT) set
    const visible = events.filter(e => e.t <= currentT && allowed.has(e.e));

    // Group Position/BotPosition by uid to draw as paths
    const humanPaths = {};
    const botPaths   = {};

    visible.forEach(e => {
      if (e.e === 'Position') {
        if (!humanPaths[e.uid]) humanPaths[e.uid] = [];
        humanPaths[e.uid].push(e);
      } else if (e.e === 'BotPosition') {
        if (!botPaths[e.uid]) botPaths[e.uid] = [];
        botPaths[e.uid].push(e);
      }
    });

    // Assign stable colors per human uid (cycle through palette)
    const humanColors = ['#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#38bdf8','#fb923c'];
    const humanColorMap = {};
    let colorIdx = 0;

    // Draw bot paths (behind human paths, dashed, subtle)
    if (eventFilters.showBotPaths) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      Object.values(botPaths).forEach(path => {
        if (path.length < 2) return;
        ctx.beginPath();
        path.forEach((pt, i) => {
          const [px, py] = scalePixel(pt.px, pt.py, size);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    // Draw human paths (solid, colored per player)
    if (eventFilters.showHumanPaths) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      Object.entries(humanPaths).forEach(([uid, path]) => {
        if (path.length < 2) return;
        if (!humanColorMap[uid]) {
          humanColorMap[uid] = humanColors[colorIdx % humanColors.length];
          colorIdx++;
        }
        ctx.strokeStyle = humanColorMap[uid];
        ctx.beginPath();
        path.forEach((pt, i) => {
          const [px, py] = scalePixel(pt.px, pt.py, size);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Draw head dot at current position
        const last = path[path.length - 1];
        const [lpx, lpy] = scalePixel(last.px, last.py, size);
        ctx.fillStyle = humanColorMap[uid];
        ctx.beginPath();
        ctx.arc(lpx, lpy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Draw event markers (non-movement events)
    const markerEvents = visible.filter(e => e.e !== 'Position' && e.e !== 'BotPosition');
    markerEvents.forEach(evt => {
      const cfg = EVENT_CONFIG[evt.e];
      if (!cfg) return;

      const [px, py] = scalePixel(evt.px, evt.py, size);

      // Glow circle behind symbol
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.arc(px, py, cfg.markerSize * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Symbol
      ctx.save();
      ctx.font = `${cfg.markerSize + 4}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = 0.95;
      ctx.fillText(cfg.symbol, px, py);
      ctx.restore();
    });

  }, [events, currentT, mapImage, canvasSize, eventFilters, allowedEvents]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasSize, height: canvasSize, display: 'block' }}
    />
  );
}
