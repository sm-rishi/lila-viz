import { useEffect, useRef, useCallback } from 'react';
import { scalePixel } from '../utils/mapConfig';
import { EVENT_CONFIG, FILTER_EVENT_MAP } from '../utils/eventConfig';

export default function ReplayCanvas({ events, currentT, maxT, mapImage, canvasSize, eventFilters }) {
  const canvasRef = useRef(null);

  const allowedEvents = useCallback(() => {
    const allowed = new Set();
    Object.entries(FILTER_EVENT_MAP).forEach(([filterKey, evtTypes]) => {
      if (eventFilters[filterKey]) evtTypes.forEach(e => allowed.add(e));
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

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(mapImage, 0, 0, size, size);

    if (!events || events.length === 0) return;

    // ── Storm overlay ────────────────────────────────────────────────────────
    // DATA INSIGHT: All 39 KilledByStorm events in the dataset occur at 99–100%
    // of their match duration. The storm only becomes lethal in the final ~10–15%
    // of a match. Storm direction varies per match (E:13, W:11, N:9, S:6 in data).
    // We infer direction from the storm death position in THIS match; if no storm
    // deaths exist, we use a deterministic direction from the match ID hash so it
    // looks different per match rather than always defaulting to south.
    const stormDeaths = events.filter(e => e.e === 'KilledByStorm');
    let stormDirection = 'south';

    if (stormDeaths.length > 0) {
      // Infer from actual death position — whichever edge it's closest to
      const avgPx = stormDeaths.reduce((s, e) => s + e.px, 0) / stormDeaths.length;
      const avgPy = stormDeaths.reduce((s, e) => s + e.py, 0) / stormDeaths.length;
      const dists = { north: avgPy, south: 1024 - avgPy, west: avgPx, east: 1024 - avgPx };
      stormDirection = Object.entries(dists).sort((a, b) => a[1] - b[1])[0][0];
    } else {
      // No storm death in this match — pick a direction from the first uid char
      // so different matches get different directions rather than all defaulting to south
      const uid = events[0]?.uid || '';
      const code = uid.charCodeAt(0) || 0;
      stormDirection = ['north', 'south', 'east', 'west'][code % 4];
    }

    // Storm sweeps in during the LAST 15% of the match (data-validated).
    // Before that threshold, no storm is visible.
    const stormStart    = maxT * 0.85;
    const stormProgress = maxT > 0
      ? Math.max(0, Math.min(1, (currentT - stormStart) / (maxT - stormStart)))
      : 0;

    if (stormProgress > 0) {
      // In 15% of remaining match time the storm can cross ~70% of the map
      const coverage = stormProgress * size * 0.70;

      // Linear gradient from map edge inward
      let gx0, gy0, gx1, gy1;
      let bx0, by0, bx1, by1; // boundary line coords
      if (stormDirection === 'south') {
        gx0 = size / 2; gy0 = size;     gx1 = size / 2; gy1 = size - coverage;
        bx0 = 0; by0 = size - coverage; bx1 = size; by1 = size - coverage;
      } else if (stormDirection === 'north') {
        gx0 = size / 2; gy0 = 0;        gx1 = size / 2; gy1 = coverage;
        bx0 = 0; by0 = coverage;        bx1 = size; by1 = coverage;
      } else if (stormDirection === 'west') {
        gx0 = 0;        gy0 = size / 2; gx1 = coverage;        gy1 = size / 2;
        bx0 = coverage; by0 = 0;        bx1 = coverage; by1 = size;
      } else { // east
        gx0 = size;             gy0 = size / 2; gx1 = size - coverage; gy1 = size / 2;
        bx0 = size - coverage;  by0 = 0;        bx1 = size - coverage; by1 = size;
      }

      // Purple storm fog
      const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0,    `rgba(109, 40, 217, ${0.65 * stormProgress})`);
      grad.addColorStop(0.55, `rgba(139, 92, 246, ${0.35 * stormProgress})`);
      grad.addColorStop(1,    'rgba(139, 92, 246, 0)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      ctx.restore();

      // Dashed boundary line
      ctx.save();
      ctx.strokeStyle = `rgba(196, 181, 253, ${0.7 + stormProgress * 0.3})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([10, 5]);
      ctx.shadowColor = 'rgba(167, 139, 250, 0.8)';
      ctx.shadowBlur  = 6;
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(bx1, by1);
      ctx.stroke();
      ctx.restore();
    }
    // ── End storm ────────────────────────────────────────────────────────────

    const allowed = allowedEvents();
    const visible = events.filter(e => e.t <= currentT && allowed.has(e.e));

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

    const humanColors = ['#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#38bdf8','#fb923c'];
    const humanColorMap = {};
    let colorIdx = 0;

    // Bot paths — dashed, subtle gray
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
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.stroke();
      });
      ctx.restore();
    }

    // Human paths — solid, colored per player
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
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Head dot at current position
        const last = path[path.length - 1];
        const [lpx, lpy] = scalePixel(last.px, last.py, size);
        ctx.fillStyle = humanColorMap[uid];
        ctx.beginPath();
        ctx.arc(lpx, lpy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Event markers
    const markerEvents = visible.filter(e => e.e !== 'Position' && e.e !== 'BotPosition');
    markerEvents.forEach(evt => {
      const cfg = EVENT_CONFIG[evt.e];
      if (!cfg) return;

      const [px, py] = scalePixel(evt.px, evt.py, size);
      const isStorm = evt.e === 'KilledByStorm';

      // Glow — larger and brighter for storm deaths
      ctx.save();
      ctx.globalAlpha = isStorm ? 0.5 : 0.25;
      ctx.fillStyle = cfg.color;
      if (isStorm) {
        ctx.shadowColor = cfg.color;
        ctx.shadowBlur  = 12;
      }
      ctx.beginPath();
      ctx.arc(px, py, cfg.markerSize * (isStorm ? 2 : 1.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Symbol
      ctx.save();
      ctx.font = `${cfg.markerSize + (isStorm ? 8 : 4)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = 0.95;
      if (isStorm) { ctx.shadowColor = cfg.color; ctx.shadowBlur = 8; }
      ctx.fillText(cfg.symbol, px, py);
      ctx.restore();
    });

  }, [events, currentT, maxT, mapImage, canvasSize, eventFilters, allowedEvents]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasSize, height: canvasSize, display: 'block' }}
    />
  );
}
