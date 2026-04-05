import { useEffect, useRef } from 'react';
import { HEATMAP_LAYERS } from '../utils/eventConfig';

const CELL = 16;   // matches preprocessing cell size
const IMG  = 1024; // native image resolution

/**
 * Draws a gaussian-style heatmap overlay on the minimap.
 * Reads pre-binned grid data from the heatmap JSON.
 */
export default function HeatmapCanvas({ heatmapData, mapImage, canvasSize, layerKey, opacity }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mapImage) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = canvasSize;
    canvas.height = canvasSize;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.drawImage(mapImage, 0, 0, canvasSize, canvasSize);

    if (!heatmapData || !heatmapData.cells) return;

    const layerCfg = HEATMAP_LAYERS.find(l => l.key === layerKey);
    const [r, g, b] = layerCfg ? layerCfg.color : [96, 165, 250];

    const { cells, max_val } = heatmapData;
    const ratio = canvasSize / IMG;
    const cellPx = CELL * ratio;

    // Draw each hot cell as a radial gradient blob
    Object.entries(cells).forEach(([key, count]) => {
      const [bx, by] = key.split(',').map(Number);
      const cx = (bx * CELL + CELL / 2) * ratio;
      const cy = (by * CELL + CELL / 2) * ratio;
      const intensity = Math.sqrt(count / max_val); // sqrt gives better visual spread
      const radius = cellPx * 1.8;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0,   `rgba(${r},${g},${b},${intensity * opacity * 0.8})`);
      gradient.addColorStop(0.5, `rgba(${r},${g},${b},${intensity * opacity * 0.4})`);
      gradient.addColorStop(1,   `rgba(${r},${g},${b},0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    });

  }, [heatmapData, mapImage, canvasSize, layerKey, opacity]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: canvasSize, height: canvasSize, display: 'block' }}
    />
  );
}
