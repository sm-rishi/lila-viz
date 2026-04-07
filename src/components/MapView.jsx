import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MINIMAP_IMAGES, DAY_LABELS, DAYS }  from '../utils/mapConfig';
import { useMatchData }    from '../hooks/useMatchData';
import { useHeatmap }      from '../hooks/useHeatmap';
import { useMatchHeatmap } from '../hooks/useMatchHeatmap';
import { useAllHeatmaps }  from '../hooks/useAllHeatmaps';
import ReplayCanvas  from './ReplayCanvas';
import HeatmapCanvas from './HeatmapCanvas';
import Timeline from './Timeline';
import Legend   from './Legend';
import POIOverlay, { POIMetricsPanel } from './POIOverlay';

const CANVAS_BASE  = 820;
const COMPARE_SIZE = Math.floor((CANVAS_BASE - 20) / 2);

export default function MapView({
  selectedMatch, mode, eventFilters, heatmapLayer, filterDay, heatmapMatchId,
}) {
  const mapId   = selectedMatch?.map_id;
  const matchId = selectedMatch?.match_id;

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { events, loading: evtLoading, maxT } = useMatchData(mode === 'replay' ? matchId : null);

  const { data: aggHeatmapData, loading: aggHmLoading } = useHeatmap(
    mode === 'heatmap' && !heatmapMatchId ? mapId : null,
    mode === 'heatmap' && !heatmapMatchId ? heatmapLayer : null,
    mode === 'heatmap' && !heatmapMatchId ? filterDay : ''
  );
  const { data: matchHeatmapData, loading: matchHmLoading } = useMatchHeatmap(
    mode === 'heatmap' && heatmapMatchId ? heatmapMatchId : null,
    heatmapLayer
  );
  const heatmapData = heatmapMatchId ? matchHeatmapData : aggHeatmapData;
  const hmLoading   = heatmapMatchId ? matchHmLoading   : aggHmLoading;

  const needAllLayers = (mode === 'heatmap' || mode === 'compare') && mapId;
  const { data: allHeatmapsData } = useAllHeatmaps(needAllLayers ? mapId : null, filterDay);

  // ── Minimap image ──────────────────────────────────────────────────────────
  const [mapImage, setMapImage] = useState(null);
  useEffect(() => {
    if (!mapId) { setMapImage(null); return; }
    const img = new Image();
    img.src = MINIMAP_IMAGES[mapId];
    img.onload = () => setMapImage(img);
  }, [mapId]);

  // ── Playback ───────────────────────────────────────────────────────────────
  const [currentT, setCurrentT] = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [speed,    setSpeed]    = useState(1);
  const rafRef  = useRef(null);
  const lastRef = useRef(null);

  useEffect(() => { setCurrentT(0); setPlaying(false); }, [matchId]);

  const tick = useCallback((ts) => {
    if (lastRef.current === null) lastRef.current = ts;
    const delta = (ts - lastRef.current) / 1000;
    lastRef.current = ts;
    setCurrentT(prev => {
      const next = prev + delta * speed;
      if (next >= maxT) { setPlaying(false); return maxT; }
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [speed, maxT]);

  useEffect(() => {
    if (playing) { lastRef.current = null; rafRef.current = requestAnimationFrame(tick); }
    else cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  // ── Zoom / Pan state ───────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const dragging   = useRef(false);
  const dragOrigin = useRef(null);
  const panOrigin  = useRef(null);
  const outerRef   = useRef(null);

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [matchId, mapId]);

  // ── Feature 1 — POI state (declared BEFORE mouse callbacks that use it) ────
  const [pois,           setPois]           = useState([]);
  const [poiTool,        setPoiTool]        = useState(null); // 'circle' | 'rect' | null
  const [poiDrawStart,   setPoiDrawStart]   = useState(null);
  const [poiDrawCurrent, setPoiDrawCurrent] = useState(null);
  const [selectedPoiId,  setSelectedPoiId]  = useState(null);

  // ── Feature 4 — Grid state (declared BEFORE mouse callbacks that use it) ───
  const [showGrid,    setShowGrid]    = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltip,     setTooltip]     = useState(null);

  // ── Heatmap opacity ────────────────────────────────────────────────────────
  const [hmOpacity, setHmOpacity] = useState(0.75);

  // ── Feature 2 — Compare state ──────────────────────────────────────────────
  const [compareLeftDay,  setCompareLeftDay]  = useState('');
  const [compareRightDay, setCompareRightDay] = useState('');
  const [compareDiff,     setCompareDiff]     = useState(false);

  const { data: leftData  } = useHeatmap(mode === 'compare' ? mapId : null, heatmapLayer, compareLeftDay);
  const { data: rightData } = useHeatmap(mode === 'compare' ? mapId : null, heatmapLayer, compareRightDay);

  const diffData = useMemo(() => {
    if (!compareDiff || !leftData?.cells || !rightData?.cells) return null;
    const allKeys = new Set([...Object.keys(leftData.cells), ...Object.keys(rightData.cells)]);
    const cells   = {};
    const lMax    = leftData.max_val  || 1;
    const rMax    = rightData.max_val || 1;
    allKeys.forEach(key => {
      const delta = (rightData.cells[key] || 0) / rMax - (leftData.cells[key] || 0) / lMax;
      if (Math.abs(delta) > 0.02) cells[key] = delta;
    });
    const maxD = Object.values(cells).reduce((m, v) => Math.max(m, Math.abs(v)), 0.01);
    return { cells, max_val: maxD, is_diff: true };
  }, [compareDiff, leftData, rightData]);

  // ── Mouse handlers (all state used here is declared above) ────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(prev => Math.min(5, Math.max(1, prev * (1 - e.deltaY * 0.001))));
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const screenToCanvas = useCallback((clientX, clientY) => {
    const rect = outerRef.current.getBoundingClientRect();
    const half = CANVAS_BASE / 2;
    const sx   = clientX - rect.left;
    const sy   = clientY - rect.top;
    return {
      sx, sy,
      cx: (sx - half) / zoom - pan.x + half,
      cy: (sy - half) / zoom - pan.y + half,
    };
  }, [zoom, pan]);

  const handleMouseDown = useCallback((e) => {
    if (poiTool) {
      const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
      setPoiDrawStart({ x: cx, y: cy });
      setPoiDrawCurrent({ x: cx, y: cy });
      return;
    }
    if (zoom <= 1) return;
    dragging.current   = true;
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    panOrigin.current  = { ...pan };
    e.currentTarget.style.cursor = 'grabbing';
  }, [poiTool, zoom, pan, screenToCanvas]);

  const handleMouseMovePan = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    setPan({ x: panOrigin.current.x + dx / zoom, y: panOrigin.current.y + dy / zoom });
  }, [zoom]);

  const handleMouseUp = useCallback((e) => {
    if (poiTool && poiDrawStart) {
      const { cx, cy } = screenToCanvas(e.clientX, e.clientY);
      const dx   = cx - poiDrawStart.x;
      const dy   = cy - poiDrawStart.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        const newPoi = {
          id: Date.now(),
          type: poiTool,
          label: `Zone ${pois.length + 1}`,
          ...(poiTool === 'circle'
            ? { cx: (poiDrawStart.x + cx) / 2, cy: (poiDrawStart.y + cy) / 2, r: dist / 2 }
            : { x1: Math.min(poiDrawStart.x, cx), y1: Math.min(poiDrawStart.y, cy),
                x2: Math.max(poiDrawStart.x, cx), y2: Math.max(poiDrawStart.y, cy) }),
        };
        setPois(prev => [...prev, newPoi]);
      }
      setPoiDrawStart(null);
      setPoiDrawCurrent(null);
      return;
    }
    dragging.current = false;
    if (e.currentTarget) e.currentTarget.style.cursor = zoom > 1 ? 'grab' : 'default';
  }, [poiTool, poiDrawStart, pois.length, zoom, screenToCanvas]);

  const handleMouseMove = useCallback((e) => {
    if (!poiTool) handleMouseMovePan(e);

    if (!outerRef.current) return;
    const { sx, sy, cx, cy } = screenToCanvas(e.clientX, e.clientY);

    if (poiTool && poiDrawStart) {
      setPoiDrawCurrent({ x: cx, y: cy });
    }

    if (mode === 'heatmap' && showGrid) {
      const CELL_PX = CANVAS_BASE * 16 / 1024;
      const bx = Math.floor(cx / CELL_PX);
      const by = Math.floor(cy / CELL_PX);
      if (bx >= 0 && bx < 64 && by >= 0 && by < 64) {
        setHoveredCell([bx, by]);
        const m = getGridCellMetrics(bx, by, allHeatmapsData);
        setTooltip(m ? { type: 'grid', x: sx, y: sy, bx, by, metrics: m } : null);
      } else {
        setHoveredCell(null);
        setTooltip(null);
      }
      return;
    }

    if (mode === 'replay' && events.length) {
      const ratio     = CANVAS_BASE / 1024;
      const threshold = 16 / zoom;
      let nearest = null, nearestDist = threshold;
      events
        .filter(ev => ev.t <= currentT && ev.e !== 'Position' && ev.e !== 'BotPosition')
        .forEach(ev => {
          const dist = Math.hypot(ev.px * ratio - cx, ev.py * ratio - cy);
          if (dist < nearestDist) { nearest = ev; nearestDist = dist; }
        });
      setHoveredCell(null);
      setTooltip(nearest ? { type: 'event', evt: nearest, x: sx, y: sy } : null);
    } else if (mode === 'heatmap') {
      setHoveredCell(null);
      setTooltip(null);
    }
  }, [poiTool, poiDrawStart, mode, showGrid, allHeatmapsData, events, currentT, zoom,
      handleMouseMovePan, screenToCanvas]);

  // ── Player Counter ─────────────────────────────────────────────────────────
  const { aliveHumans, aliveBots, totalHumans, totalBots } = useMemo(() => {
    if (!events.length) return { aliveHumans: 0, aliveBots: 0, totalHumans: 0, totalBots: 0 };
    const totalHumans   = new Set(events.filter(e => !e.bot).map(e => e.uid)).size;
    const totalBots     = new Set(events.filter(e =>  e.bot).map(e => e.uid)).size;
    const deadHumanUids = new Set(
      events.filter(e => e.t <= currentT && ['Killed','BotKilled','KilledByStorm'].includes(e.e)).map(e => e.uid)
    );
    const botDeaths = events.filter(e => e.t <= currentT && e.e === 'BotKill').length;
    return {
      aliveHumans: Math.max(0, totalHumans - deadHumanUids.size),
      aliveBots:   Math.max(0, totalBots   - botDeaths),
      totalHumans, totalBots,
    };
  }, [events, currentT]);

  const drawingShape = poiDrawStart && poiDrawCurrent ? {
    type: poiTool, startX: poiDrawStart.x, startY: poiDrawStart.y,
    endX: poiDrawCurrent.x, endY: poiDrawCurrent.y,
  } : null;

  const loading = evtLoading || hmLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-auto relative">

        {!mapId && (
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">🗺️</div>
            <div className="text-sm">Select a match from the list</div>
          </div>
        )}

        {mapId && loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 bg-opacity-80 z-10">
            <div className="text-gray-400 text-sm">Loading…</div>
          </div>
        )}

        {/* ── COMPARE MODE ──────────────────────────────────────────────── */}
        {mapId && mode === 'compare' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded px-3 py-1.5">
                <span className="text-xs text-gray-400 font-semibold">A:</span>
                <select value={compareLeftDay} onChange={e => setCompareLeftDay(e.target.value)}
                  className="bg-transparent text-gray-200 text-xs border-none outline-none pr-1">
                  <option value="">All Dates</option>
                  {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
              </div>
              <button onClick={() => setCompareDiff(p => !p)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  compareDiff ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
                }`}>Δ Diff</button>
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded px-3 py-1.5">
                <span className="text-xs text-gray-400 font-semibold">B:</span>
                <select value={compareRightDay} onChange={e => setCompareRightDay(e.target.value)}
                  className="bg-transparent text-gray-200 text-xs border-none outline-none pr-1">
                  <option value="">All Dates</option>
                  {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div>
                <div className="text-xs text-center text-gray-400 mb-1 font-semibold">
                  A — {compareLeftDay ? DAY_LABELS[compareLeftDay] : 'All Dates'}
                </div>
                <HeatmapCanvas heatmapData={leftData} mapImage={mapImage} canvasSize={COMPARE_SIZE}
                  layerKey={heatmapLayer} opacity={hmOpacity} />
              </div>
              <div className="flex items-center justify-center w-5">
                <div className="h-full w-px bg-gray-700" />
              </div>
              <div>
                <div className="text-xs text-center text-gray-400 mb-1 font-semibold">
                  B — {compareRightDay ? DAY_LABELS[compareRightDay] : 'All Dates'}
                  {compareDiff && <span className="ml-1 text-blue-400">(diff)</span>}
                </div>
                <HeatmapCanvas heatmapData={rightData} diffData={compareDiff ? diffData : null}
                  mapImage={mapImage} canvasSize={COMPARE_SIZE} layerKey={heatmapLayer} opacity={hmOpacity} />
              </div>
            </div>

            {compareDiff && (
              <div className="flex items-center gap-3 text-xs text-gray-400 bg-gray-900 border border-gray-700 rounded px-4 py-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-400 opacity-80" /><span>More in A</span>
                <div className="w-3 h-3 rounded-sm bg-gray-600" /><span>No change</span>
                <div className="w-3 h-3 rounded-sm bg-red-500 opacity-80" /><span>More in B</span>
              </div>
            )}
          </div>
        )}

        {/* ── REPLAY / HEATMAP MODE ──────────────────────────────────────── */}
        {mapId && mode !== 'compare' && (
          <div
            ref={outerRef}
            className="relative shadow-2xl"
            style={{
              width: CANVAS_BASE, height: CANVAS_BASE,
              overflow: 'hidden',
              cursor: poiTool ? 'crosshair' : zoom > 1 ? 'grab' : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              dragging.current = false;
              setTooltip(null);
              setHoveredCell(null);
              setPoiDrawCurrent(null);
            }}
          >
            <div style={{
              width: CANVAS_BASE, height: CANVAS_BASE,
              transformOrigin: 'center center',
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            }}>
              {mode === 'replay' ? (
                <ReplayCanvas events={events} currentT={currentT} maxT={maxT}
                  mapImage={mapImage} canvasSize={CANVAS_BASE} eventFilters={eventFilters} />
              ) : (
                <HeatmapCanvas heatmapData={heatmapData} mapImage={mapImage} canvasSize={CANVAS_BASE}
                  layerKey={heatmapLayer} opacity={hmOpacity} showGrid={showGrid} hoveredCell={hoveredCell} />
              )}

              {mode === 'heatmap' && (
                <POIOverlay canvasSize={CANVAS_BASE} zoom={zoom} pois={pois} setPois={setPois}
                  drawingShape={drawingShape} selectedPoiId={selectedPoiId}
                  setSelectedPoiId={setSelectedPoiId} allHeatmapsData={allHeatmapsData} />
              )}
            </div>

            {/* Event tooltip */}
            {tooltip?.type === 'event' && (
              <div className="absolute z-20 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs pointer-events-none shadow-lg"
                style={{ left: tooltip.x + 12, top: Math.min(tooltip.y - 8, CANVAS_BASE - 80) }}>
                <div className="font-semibold text-gray-200">{tooltip.evt.e}</div>
                <div className="text-gray-400">{tooltip.evt.bot ? '🤖 Bot' : '👤 Human'}</div>
                <div className="text-gray-500">t = {Math.round(tooltip.evt.t)}s</div>
                <div className="text-gray-500 font-mono">{tooltip.evt.uid.slice(0, 16)}…</div>
              </div>
            )}

            {/* Grid cell tooltip */}
            {tooltip?.type === 'grid' && (
              <div className="absolute z-20 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs pointer-events-none shadow-lg"
                style={{ left: Math.min(tooltip.x + 12, CANVAS_BASE - 130), top: Math.min(tooltip.y - 8, CANVAS_BASE - 110) }}>
                <div className="font-semibold text-gray-300 mb-1">Cell [{tooltip.bx},{tooltip.by}]</div>
                <div className="flex justify-between gap-4 text-gray-400"><span>Kills</span>   <span className="text-red-400    font-mono">{tooltip.metrics.kills}</span></div>
                <div className="flex justify-between gap-4 text-gray-400"><span>Deaths</span>  <span className="text-orange-400 font-mono">{tooltip.metrics.deaths}</span></div>
                <div className="flex justify-between gap-4 text-gray-400"><span>Loot</span>    <span className="text-green-400  font-mono">{tooltip.metrics.loot}</span></div>
                <div className="flex justify-between gap-4 text-gray-400"><span>Traffic</span> <span className="text-blue-400   font-mono">{tooltip.metrics.traffic}</span></div>
                <div className="flex justify-between gap-4 text-gray-400"><span>Storm</span>   <span className="text-purple-400 font-mono">{tooltip.metrics.storm}</span></div>
              </div>
            )}
          </div>
        )}

        {/* POI metrics panel (outside zoom div) */}
        {mode === 'heatmap' && mapId && (
          <POIMetricsPanel pois={pois} setPois={setPois} selectedPoiId={selectedPoiId}
            setSelectedPoiId={setSelectedPoiId} allHeatmapsData={allHeatmapsData} canvasSize={CANVAS_BASE} />
        )}

        {/* Player Counter */}
        {mode === 'replay' && matchId && !loading && (
          <div className="absolute top-3 right-3 bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Alive</div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-blue-400 text-base leading-none">👤</span>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-blue-400 font-bold text-lg leading-none">{aliveHumans}</span>
                  <span className="text-gray-500">/ {totalHumans}</span>
                </div>
                <div className="text-gray-500 text-xs">Human{totalHumans !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-base leading-none">🤖</span>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-gray-300 font-bold text-lg leading-none">{aliveBots}</span>
                  <span className="text-gray-500">/ {totalBots}</span>
                </div>
                <div className="text-gray-500 text-xs">Bot{totalBots !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {(totalHumans - aliveHumans + totalBots - aliveBots) > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700 text-gray-500 text-xs">
                {totalHumans - aliveHumans + totalBots - aliveBots} eliminated
              </div>
            )}
          </div>
        )}

        {/* Storm approximation badge */}
        {mode === 'replay' && matchId && !loading && (
          <div className="absolute bottom-14 right-3 bg-gray-900 bg-opacity-80 border border-purple-800 rounded px-2 py-1 text-xs text-purple-400 flex items-center gap-1.5">
            <span>⚠</span><span>Storm: approx.</span>
          </div>
        )}

        {/* Zoom Controls */}
        {mapId && mode !== 'compare' && (
          <div className="absolute bottom-4 left-3 flex flex-col gap-1">
            <button onClick={() => setZoom(z => Math.min(5, +(z + 0.5).toFixed(1)))}
              className="w-7 h-7 rounded bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 text-base flex items-center justify-center font-bold" title="Zoom in">+</button>
            <button onClick={() => setZoom(z => { const n = Math.max(1, +(z - 0.5).toFixed(1)); if (n === 1) setPan({ x: 0, y: 0 }); return n; })}
              className="w-7 h-7 rounded bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 text-base flex items-center justify-center font-bold" title="Zoom out">−</button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="w-7 h-7 rounded bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700 text-xs flex items-center justify-center" title="Reset zoom">⊠</button>
            {zoom !== 1 && <div className="text-center text-xs text-gray-500 mt-0.5">{zoom.toFixed(1)}×</div>}
          </div>
        )}

        {/* Heatmap tools */}
        {mode === 'heatmap' && mapId && (
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 items-end">
            <div className="bg-gray-900 border border-gray-700 rounded px-3 py-2">
              <div className="text-xs text-gray-400 mb-1">Opacity</div>
              <input type="range" min="0.1" max="1" step="0.05" value={hmOpacity}
                onChange={e => setHmOpacity(Number(e.target.value))} className="w-24 accent-blue-500" />
            </div>
            <button
              onClick={() => { setShowGrid(p => !p); if (showGrid) { setHoveredCell(null); setTooltip(null); } }}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                showGrid ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:bg-gray-800'
              }`} title="Toggle grid metrics">⊞ Grid</button>
            <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 flex gap-1.5 items-center">
              <span className="text-xs text-gray-500 mr-1">POI</span>
              {[{ key: 'circle', label: '◯', title: 'Draw circle zone' },
                { key: 'rect',   label: '▭', title: 'Draw rect zone'   }].map(({ key, label, title }) => (
                <button key={key} onClick={() => setPoiTool(prev => prev === key ? null : key)} title={title}
                  className={`w-7 h-7 rounded text-sm font-medium transition-colors ${
                    poiTool === key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-600'
                  }`}>{label}</button>
              ))}
              {pois.length > 0 && (
                <button onClick={() => { setPois([]); setSelectedPoiId(null); }}
                  className="text-xs text-gray-500 hover:text-red-400 ml-1">✕</button>
              )}
            </div>
          </div>
        )}

        {/* Match stats badge */}
        {selectedMatch?.match_id && mode !== 'compare' && (
          <div className="absolute top-3 left-3 bg-gray-900 bg-opacity-90 border border-gray-700 rounded px-3 py-2 text-xs">
            <div className="text-gray-300 font-semibold mb-0.5">{selectedMatch.map_id}</div>
            <div className="text-gray-500">{selectedMatch.day?.replace('_', ' ')}</div>
            <div className="text-blue-400 mt-0.5">
              {Math.floor(selectedMatch.duration_s / 60)}m {selectedMatch.duration_s % 60}s
            </div>
          </div>
        )}
      </div>

      <Legend mode={mode} heatmapLayer={heatmapLayer} />

      {mode === 'replay' && (
        <Timeline currentT={Math.round(currentT)} maxT={maxT} playing={playing}
          onSeek={t => setCurrentT(t)}
          onPlayPause={() => { if (currentT >= maxT) setCurrentT(0); setPlaying(p => !p); }}
          speed={speed} onSpeedChange={setSpeed} />
      )}
    </div>
  );
}

function getGridCellMetrics(bx, by, allHeatmapsData) {
  if (!allHeatmapsData) return null;
  const key = `${bx},${by}`;
  const m = {};
  let hasAny = false;
  ['kills','deaths','loot','traffic','storm'].forEach(layer => {
    const count = allHeatmapsData[layer]?.cells?.[key] || 0;
    m[layer] = count;
    if (count > 0) hasAny = true;
  });
  return hasAny ? m : null;
}
