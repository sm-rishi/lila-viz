/**
 * POIOverlay — SVG layer rendered inside the zoom-transform div (same coordinate
 * space as the canvas). Purely presentational: mouse events are handled upstream
 * in MapView and passed in as `pois` + `drawingShape`.
 *
 * Also renders the metrics panel as a floating card (positioned in screen space
 * via a portal-like absolute div that lives outside the zoom div).
 */
import { useMemo } from 'react';
import { HEATMAP_LAYERS } from '../utils/eventConfig';

const CELL    = 16;
const IMG     = 1024;
const COLORS  = ['#60a5fa','#34d399','#fbbf24','#f472b6','#a78bfa','#38bdf8','#fb923c'];

// Count events in allHeatmaps cells that fall inside a POI shape.
// Coordinates stored in canvas-px space (0..canvasSize).
function computeMetrics(poi, allHeatmapsData, canvasSize) {
  if (!allHeatmapsData) return null;
  const ratio = IMG / canvasSize; // canvas px → 1024-img px
  const metrics = {};
  HEATMAP_LAYERS.forEach(layer => {
    const cells = allHeatmapsData[layer.key]?.cells;
    if (!cells) { metrics[layer.key] = 0; return; }
    let total = 0;
    Object.entries(cells).forEach(([key, count]) => {
      const [bx, by] = key.split(',').map(Number);
      // Cell centre in 1024-space → canvas-px space
      const imgCx = (bx + 0.5) * CELL;
      const imgCy = (by + 0.5) * CELL;
      const cx = imgCx / ratio;
      const cy = imgCy / ratio;
      if (poi.type === 'circle') {
        if (Math.hypot(cx - poi.cx, cy - poi.cy) <= poi.r) total += count;
      } else {
        if (cx >= poi.x1 && cx <= poi.x2 && cy >= poi.y1 && cy <= poi.y2) total += count;
      }
    });
    metrics[layer.key] = total;
  });
  return metrics;
}

// Render an SVG shape (circle or rect) in canvas-px coordinates
function PoiShape({ poi, color, selected, zoom }) {
  const dash  = `${5 / zoom},${3 / zoom}`;
  const sw    = 1.5 / zoom;
  const fO    = selected ? 0.18 : 0.08;
  const sO    = selected ? 1    : 0.75;
  if (poi.type === 'circle') {
    return (
      <circle
        cx={poi.cx} cy={poi.cy} r={poi.r}
        fill={color} fillOpacity={fO}
        stroke={color} strokeOpacity={sO} strokeWidth={sw} strokeDasharray={dash}
      />
    );
  }
  return (
    <rect
      x={poi.x1} y={poi.y1} width={poi.x2 - poi.x1} height={poi.y2 - poi.y1}
      fill={color} fillOpacity={fO}
      stroke={color} strokeOpacity={sO} strokeWidth={sw} strokeDasharray={dash}
    />
  );
}

export default function POIOverlay({
  canvasSize,
  zoom,
  pois,
  setPois,
  drawingShape,    // { type, startX, startY, endX, endY } | null
  selectedPoiId,
  setSelectedPoiId,
  allHeatmapsData,
}) {
  const metrics = useMemo(() => {
    const m = {};
    pois.forEach(poi => { m[poi.id] = computeMetrics(poi, allHeatmapsData, canvasSize); });
    return m;
  }, [pois, allHeatmapsData, canvasSize]);

  // Preview shape while the user is dragging to create a new zone
  const preview = drawingShape ? (() => {
    const { type, startX: sx, startY: sy, endX: ex, endY: ey } = drawingShape;
    const dash = `${5/zoom},${3/zoom}`;
    const sw   = 1.5 / zoom;
    if (type === 'circle') {
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
      const r  = Math.hypot(ex - sx, ey - sy) / 2;
      return <circle cx={cx} cy={cy} r={r} fill="#60a5fa" fillOpacity={0.15}
               stroke="#60a5fa" strokeOpacity={0.8} strokeWidth={sw} strokeDasharray={dash} />;
    }
    const x = Math.min(sx, ex), y = Math.min(sy, ey);
    const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
    return <rect x={x} y={y} width={w} height={h} fill="#60a5fa" fillOpacity={0.15}
             stroke="#60a5fa" strokeOpacity={0.8} strokeWidth={sw} strokeDasharray={dash} />;
  })() : null;

  return (
    <>
      {/* SVG shapes drawn in canvas coordinate space (inside zoom div) */}
      <svg
        style={{
          position: 'absolute', inset: 0,
          width: canvasSize, height: canvasSize,
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {pois.map((poi, i) => (
          <g key={poi.id}>
            <PoiShape
              poi={poi}
              color={COLORS[i % COLORS.length]}
              selected={selectedPoiId === poi.id}
              zoom={zoom}
            />
            <text
              x={poi.type === 'circle' ? poi.cx : (poi.x1 + poi.x2) / 2}
              y={poi.type === 'circle' ? poi.cy - poi.r - 6/zoom : poi.y1 - 6/zoom}
              fill={COLORS[i % COLORS.length]}
              fontSize={11 / zoom}
              textAnchor="middle"
              style={{ userSelect: 'none' }}
            >
              {poi.label}
            </text>
          </g>
        ))}
        {preview && <g style={{ pointerEvents: 'none' }}>{preview}</g>}
      </svg>

      {/* Metrics panel — positioned in the outer (non-zoomed) div via absolute.
          Rendered here but physically should be placed in the outer wrapper.
          MapView renders this component, which returns the panel via a Fragment —
          MapView must place the panel div outside the zoom transform. */}
    </>
  );
}

/** Separate component for the metrics panel (rendered outside the zoom div). */
export function POIMetricsPanel({ pois, setPois, selectedPoiId, setSelectedPoiId, allHeatmapsData, canvasSize }) {
  const metrics = useMemo(() => {
    const m = {};
    pois.forEach(poi => { m[poi.id] = computeMetrics(poi, allHeatmapsData, canvasSize); });
    return m;
  }, [pois, allHeatmapsData, canvasSize]);

  if (pois.length === 0) return null;

  return (
    <div
      className="absolute top-12 right-3 bg-gray-900 bg-opacity-97 border border-gray-700 rounded-lg text-xs shadow-xl z-30"
      style={{ width: 210, pointerEvents: 'all' }}
    >
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <span className="font-semibold text-gray-200 text-xs uppercase tracking-wide">POI Zones</span>
        <button
          onClick={() => { setPois([]); setSelectedPoiId(null); }}
          className="text-gray-500 hover:text-red-400 text-xs"
        >
          Clear all
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
        {pois.map((poi, i) => {
          const color    = COLORS[i % COLORS.length];
          const m        = metrics[poi.id];
          const selected = selectedPoiId === poi.id;
          return (
            <div
              key={poi.id}
              className={`px-3 py-2 border-b border-gray-800 cursor-pointer transition-colors ${selected ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
              onClick={() => setSelectedPoiId(selected ? null : poi.id)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-gray-200 font-medium">{poi.label}</span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setPois(prev => prev.filter(p => p.id !== poi.id));
                    if (selectedPoiId === poi.id) setSelectedPoiId(null);
                  }}
                  className="text-gray-600 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
              {m && (
                <div className="space-y-0.5 pl-3.5">
                  <div className="flex justify-between text-gray-500"><span>Kills</span>   <span className="text-red-400    font-mono">{m.kills}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Deaths</span>  <span className="text-orange-400 font-mono">{m.deaths}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Loot</span>    <span className="text-green-400  font-mono">{m.loot}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Traffic</span> <span className="text-blue-400   font-mono">{m.traffic}</span></div>
                  <div className="flex justify-between text-gray-500"><span>Storm</span>   <span className="text-purple-400 font-mono">{m.storm}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
