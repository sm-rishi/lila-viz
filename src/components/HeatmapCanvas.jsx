import { useEffect, useRef } from 'react';
import { HEATMAP_LAYERS } from '../utils/eventConfig';

const CELL = 16;
const IMG  = 1024;

/**
 * Draws a gaussian-style heatmap overlay on the minimap.
 * Supports:
 *   showGrid   — overlay a 16px-cell grid with highlighted hover cell
 *   hoveredCell — [bx, by] grid cell to highlight
 *   diffData   — when present, renders a diverging diff heatmap instead of the
 *                normal density layer (positive = more in B, negative = more in A)
 */
export default function HeatmapCanvas({
  heatmapData,
  mapImage,
  canvasSize,
  layerKey,
  opacity,
  showGrid   = false,
  hoveredCell = null,
  diffData   = null,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = canvasSize;
    canvas.height = canvasSize;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.drawImage(mapImage, 0, 0, canvasSize, canvasSize);

    const ratio  = canvasSize / IMG;
    const cellPx = CELL * ratio;

    // ── Diff mode ──────────────────────────────────────────────────────────
    if (diffData?.cells) {
      Object.entries(diffData.cells).forEach(([key, delta]) => {
        const [bx, by] = key.split(',').map(Number);
        const cx = (bx * CELL + CELL / 2) * ratio;
        const cy = (by * CELL + CELL / 2) * ratio;
        const intensity = Math.min(1, Math.abs(delta) / (diffData.max_val || 1));
        const radius    = cellPx * 1.8;

        // Positive delta (more in right/B) → red; negative → blue
        const [r, g, b] = delta > 0 ? [239, 68, 68] : [96, 165, 250];

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0,   `rgba(${r},${g},${b},${Math.sqrt(intensity) * opacity * 0.85})`);
        gradient.addColorStop(0.5, `rgba(${r},${g},${b},${Math.sqrt(intensity) * opacity * 0.4})`);
        gradient.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      });
    }

    // ── Normal density mode ────────────────────────────────────────────────
    else if (heatmapData?.cells) {
      const layerCfg = HEATMAP_LAYERS.find(l => l.key === layerKey);
      const [r, g, b] = layerCfg ? layerCfg.color : [96, 165, 250];
      const { cells, max_val } = heatmapData;

      Object.entries(cells).forEach(([key, count]) => {
        const [bx, by] = key.split(',').map(Number);
        const cx = (bx * CELL + CELL / 2) * ratio;
        const cy = (by * CELL + CELL / 2) * ratio;
        const intensity = Math.sqrt(count / max_val);
        const radius    = cellPx * 1.8;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0,   `rgba(${r},${g},${b},${intensity * opacity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(${r},${g},${b},${intensity * opacity * 0.4})`);
        gradient.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      });
    }

    // ── Grid overlay ───────────────────────────────────────────────────────
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth   = 0.5;
      for (let x = 0; x <= canvasSize; x += cellPx) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasSize); ctx.stroke();
      }
      for (let y = 0; y <= canvasSize; y += cellPx) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasSize, y); ctx.stroke();
      }

      if (hoveredCell) {
        const [hbx, hby] = hoveredCell;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(hbx * cellPx, hby * cellPx, cellPx, cellPx);
        ctx.fillStyle   = 'rgba(255,255,255,0.1)';
        ctx.fillRect(hbx * cellPx, hby * cellPx, cellPx, cellPx);
      }
      ctx.restore();
    }

  }, [heatmapData, mapImage, canvasSize, layerKey, opacity, showGrid, hoveredCell, diffData]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasSize, height: canvasSize, display: 'block' }}
    />
  );
}
