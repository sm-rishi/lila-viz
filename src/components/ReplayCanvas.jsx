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
    // DATA INSIGHT: All 39 KilledByStorm events occur at 99–100% of their
    // match duration, so the storm only becomes lethal in the final ~15%.
    // Storm direction varies per match (E:13, W:11, N:9, S:6 in the dataset).
    //
    // ASSUMPTION (approximation — actual safe-zone boundary is not in the data):
    //   • Safe zone is modelled as a shrinking circle centred near the map centre.
    //   • At storm start (85% of match) radius = 45% of canvas.
    //   • At match end (100%) radius = 6% of canvas.
    //   • Centre drifts 15% of canvas toward the side opposite the storm direction
    //     as the storm closes, mimicking typical BR shrink behaviour.
    //   • Player dots are ringed green/amber/red to show safe-zone proximity.
    const stormDeaths = events.filter(e => e.e === 'KilledByStorm');
    let stormDirection = 'south';

    if (stormDeaths.length > 0) {
      const avgPx = stormDeaths.reduce((s, e) => s + e.px, 0) / stormDeaths.length;
      const avgPy = stormDeaths.reduce((s, e) => s + e.py, 0) / stormDeaths.length;
      const dists = { north: avgPy, south: 1024 - avgPy, west: avgPx, east: 1024 - avgPx };
      stormDirection = Object.entries(dists).sort((a, b) => a[1] - b[1])[0][0];
    } else {
      const uid = events[0]?.uid || '';
      stormDirection = ['north', 'south', 'east', 'west'][(uid.charCodeAt(0) || 0) % 4];
    }

    const stormStart    = maxT * 0.85;
    const stormProgress = maxT > 0
      ? Math.max(0, Math.min(1, (currentT - stormStart) / (maxT - stormStart)))
      : 0;

    // Safe zone geometry (in canvas px)
    let safeZone = null;
    if (stormProgress > 0) {
      const safeRadius = size * (0.45 - 0.39 * stormProgress); // 45% → 6%
      const drift      = size * 0.15 * stormProgress;
      let safeCx = size / 2;
      let safeCy = size / 2;
      if (stormDirection === 'east')  safeCx -= drift;
      if (stormDirection === 'west')  safeCx += drift;
      if (stormDirection === 'south') safeCy -= drift;
      if (stormDirection === 'north') safeCy += drift;
      safeZone = { cx: safeCx, cy: safeCy, r: safeRadius };

      // Storm fog — purple outside safe circle, transparent inside
      // Uses an offscreen canvas so the safe zone is cleanly cut out.
      const off = document.createElement('canvas');
      off.width  = size;
      off.height = size;
      const offCtx = off.getContext('2d');

      offCtx.fillStyle = `rgba(80, 15, 180, ${0.62 * stormProgress})`;
      offCtx.fillRect(0, 0, size, size);

      offCtx.globalCompositeOperation = 'destination-out';
      // Soft inner edge: slightly smaller clear circle + gradient fade
      const fadeR = safeRadius * 0.92;
      offCtx.beginPath();
      offCtx.arc(safeCx, safeCy, fadeR, 0, Math.PI * 2);
      offCtx.fill();

      // Add a soft edge transition
      const edgeGrad = offCtx.createRadialGradient(safeCx, safeCy, fadeR, safeCx, safeCy, safeRadius * 1.05);
      edgeGrad.addColorStop(0, 'rgba(0,0,0,1)');
      edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
      offCtx.fillStyle = edgeGrad;
      offCtx.beginPath();
      offCtx.arc(safeCx, safeCy, safeRadius * 1.05, 0, Math.PI * 2);
      offCtx.fill();

      ctx.drawImage(off, 0, 0);

      // Safe-zone boundary ring
      ctx.save();
      ctx.strokeStyle = `rgba(196, 181, 253, ${0.65 + stormProgress * 0.35})`;
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([10, 5]);
      ctx.shadowColor = 'rgba(167, 139, 250, 0.85)';
      ctx.shadowBlur  = 7;
      ctx.beginPath();
      ctx.arc(safeCx, safeCy, safeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // ── End storm ────────────────────────────────────────────────────────────

    const allowed = allowedEvents();
    const visible  = events.filter(e => e.t <= currentT && allowed.has(e.e));

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

    const humanColors   = ['#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#38bdf8','#fb923c'];
    const humanColorMap = {};
    let colorIdx = 0;

    // Bot paths — dashed, subtle gray
    if (eventFilters.showBotPaths) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth   = 1;
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

    // Human paths — solid, per-player colour
    if (eventFilters.showHumanPaths) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth   = 2;
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
        const last        = path[path.length - 1];
        const [lpx, lpy]  = scalePixel(last.px, last.py, size);
        ctx.fillStyle = humanColorMap[uid];
        ctx.beginPath();
        ctx.arc(lpx, lpy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // ── Storm proximity ring around each human player ──────────────────────
    // Green = safely inside, Amber = within 15% of radius to boundary, Red = outside
    if (safeZone && stormProgress > 0) {
      const { cx: scx, cy: scy, r: sr } = safeZone;
      Object.entries(humanPaths).forEach(([uid, path]) => {
        const last       = path[path.length - 1];
        const [lpx, lpy] = scalePixel(last.px, last.py, size);
        const dist       = Math.hypot(lpx - scx, lpy - scy);
        const margin     = sr * 0.15;

        let ringColor;
        if (dist <= sr - margin)  ringColor = '#22c55e'; // safe
        else if (dist <= sr)      ringColor = '#f59e0b'; // near boundary
        else                      ringColor = '#ef4444'; // outside

        ctx.save();
        ctx.strokeStyle = ringColor;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(lpx, lpy, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }
    // ── End storm proximity ────────────────────────────────────────────────

    // Event markers
    const markerEvents = visible.filter(e => e.e !== 'Position' && e.e !== 'BotPosition');
    markerEvents.forEach(evt => {
      const cfg = EVENT_CONFIG[evt.e];
      if (!cfg) return;

      const [px, py] = scalePixel(evt.px, evt.py, size);
      const isStorm  = evt.e === 'KilledByStorm';

      ctx.save();
      ctx.globalAlpha = isStorm ? 0.5 : 0.25;
      ctx.fillStyle   = cfg.color;
      if (isStorm) { ctx.shadowColor = cfg.color; ctx.shadowBlur = 12; }
      ctx.beginPath();
      ctx.arc(px, py, cfg.markerSize * (isStorm ? 2 : 1.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.font          = `${cfg.markerSize + (isStorm ? 8 : 4)}px serif`;
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.fillStyle     = cfg.color;
      ctx.globalAlpha   = 0.95;
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
