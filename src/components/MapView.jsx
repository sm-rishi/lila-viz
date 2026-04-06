import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MINIMAP_IMAGES } from '../utils/mapConfig';
import { useMatchData } from '../hooks/useMatchData';
import { useHeatmap }   from '../hooks/useHeatmap';
import ReplayCanvas  from './ReplayCanvas';
import HeatmapCanvas from './HeatmapCanvas';
import Timeline from './Timeline';
import Legend   from './Legend';

const CANVAS_BASE = 600;

export default function MapView({ selectedMatch, mode, eventFilters, heatmapLayer, filterDay }) {
  const mapId   = selectedMatch?.map_id;
  const matchId = selectedMatch?.match_id;

  const { events, loading: evtLoading, maxT } = useMatchData(mode === 'replay' ? matchId : null);
  const { data: heatmapData, loading: hmLoading } = useHeatmap(
    mode === 'heatmap' ? mapId : null,
    mode === 'heatmap' ? heatmapLayer : null,
    mode === 'heatmap' ? filterDay : ''
  );

  // Minimap image
  const [mapImage, setMapImage] = useState(null);
  useEffect(() => {
    if (!mapId) { setMapImage(null); return; }
    const img = new Image();
    img.src = MINIMAP_IMAGES[mapId];
    img.onload = () => setMapImage(img);
  }, [mapId]);

  // Playback
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

  // ── Zoom / Pan ─────────────────────────────────────────────────────────────
  const [zoom, setZoom]   = useState(1);
  const [pan,  setPan]    = useState({ x: 0, y: 0 });
  const dragging   = useRef(false);
  const dragOrigin = useRef(null);
  const panOrigin  = useRef(null);
  const outerRef   = useRef(null); // the overflow:hidden wrapper

  // Reset zoom/pan when match changes
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [matchId, mapId]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(prev => {
      const next = prev * (1 - e.deltaY * 0.001);
      return Math.min(5, Math.max(1, next));
    });
  }, []);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e) => {
    if (zoom <= 1) return;
    dragging.current = true;
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    panOrigin.current  = { ...pan };
    e.currentTarget.style.cursor = 'grabbing';
  }, [zoom, pan]);

  const handleMouseMovePan = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    setPan({
      x: panOrigin.current.x + dx / zoom,
      y: panOrigin.current.y + dy / zoom,
    });
  }, [zoom]);

  const handleMouseUp = useCallback((e) => {
    dragging.current = false;
    if (e.currentTarget) e.currentTarget.style.cursor = zoom > 1 ? 'grab' : 'default';
  }, [zoom]);

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const [tooltip, setTooltip] = useState(null);

  const handleMouseMove = useCallback((e) => {
    handleMouseMovePan(e);
    if (mode !== 'replay' || !events.length) return;

    const rect = outerRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Convert screen coords → canvas coords (accounting for zoom + pan)
    const half = CANVAS_BASE / 2;
    const cx = (sx - half) / zoom - pan.x + half;
    const cy = (sy - half) / zoom - pan.y + half;

    const ratio = CANVAS_BASE / 1024;
    const threshold = 16 / zoom;

    let nearest = null, nearestDist = threshold;
    events
      .filter(ev => ev.t <= currentT && ev.e !== 'Position' && ev.e !== 'BotPosition')
      .forEach(ev => {
        const dx = ev.px * ratio - cx;
        const dy = ev.py * ratio - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) { nearest = ev; nearestDist = dist; }
      });

    setTooltip(nearest ? { evt: nearest, x: sx, y: sy } : null);
  }, [events, currentT, mode, zoom, pan, handleMouseMovePan]);

  // ── Player Counter ─────────────────────────────────────────────────────────
  const { aliveHumans, aliveBots, totalHumans, totalBots } = useMemo(() => {
    if (!events.length) return { aliveHumans: 0, aliveBots: 0, totalHumans: 0, totalBots: 0 };

    const totalHumans = new Set(events.filter(e => !e.bot).map(e => e.uid)).size;
    const totalBots   = new Set(events.filter(e =>  e.bot).map(e => e.uid)).size;

    // A human uid is "dead" if it has a Killed/BotKilled/KilledByStorm event at t <= currentT
    const deadHumanUids = new Set(
      events
        .filter(e => e.t <= currentT && ['Killed', 'BotKilled', 'KilledByStorm'].includes(e.e))
        .map(e => e.uid)
    );

    // Each BotKill event = one bot eliminated
    const botDeaths = events.filter(e => e.t <= currentT && e.e === 'BotKill').length;

    return {
      aliveHumans: Math.max(0, totalHumans - deadHumanUids.size),
      aliveBots:   Math.max(0, totalBots   - botDeaths),
      totalHumans,
      totalBots,
    };
  }, [events, currentT]);

  const [hmOpacity, setHmOpacity] = useState(0.75);
  const loading = evtLoading || hmLoading;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden relative">

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

        {mapId && (
          /* Outer clip — fixed size, clips zoomed content */
          <div
            ref={outerRef}
            className="relative shadow-2xl"
            style={{
              width: CANVAS_BASE,
              height: CANVAS_BASE,
              overflow: 'hidden',
              cursor: zoom > 1 ? 'grab' : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={(e) => { dragging.current = false; setTooltip(null); }}
          >
            {/* Inner div — receives the CSS transform */}
            <div
              style={{
                width: CANVAS_BASE,
                height: CANVAS_BASE,
                transformOrigin: 'center center',
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              {mode === 'replay' ? (
                <ReplayCanvas
                  events={events}
                  currentT={currentT}
                  maxT={maxT}
                  mapImage={mapImage}
                  canvasSize={CANVAS_BASE}
                  eventFilters={eventFilters}
                />
              ) : (
                <HeatmapCanvas
                  heatmapData={heatmapData}
                  mapImage={mapImage}
                  canvasSize={CANVAS_BASE}
                  layerKey={heatmapLayer}
                  opacity={hmOpacity}
                />
              )}
            </div>

            {/* Tooltip — positioned in screen space (outside the zoom transform) */}
            {tooltip && (
              <div
                className="absolute z-20 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs pointer-events-none shadow-lg"
                style={{ left: tooltip.x + 12, top: Math.min(tooltip.y - 8, CANVAS_BASE - 80) }}
              >
                <div className="font-semibold text-gray-200">{tooltip.evt.e}</div>
                <div className="text-gray-400">{tooltip.evt.bot ? '🤖 Bot' : '👤 Human'}</div>
                <div className="text-gray-500">t = {Math.round(tooltip.evt.t)}s</div>
                <div className="text-gray-500 font-mono">{tooltip.evt.uid.slice(0, 16)}…</div>
              </div>
            )}
          </div>
        )}

        {/* ── Player Counter (top-right) ─────────────────────────────── */}
        {mode === 'replay' && matchId && !loading && (
          <div className="absolute top-3 right-3 bg-gray-900 bg-opacity-95 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-lg">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">Alive</div>

            {/* Humans */}
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

            {/* Bots */}
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

            {/* Deaths so far */}
            {(totalHumans - aliveHumans + totalBots - aliveBots) > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700 text-gray-500 text-xs">
                {totalHumans - aliveHumans + totalBots - aliveBots} eliminated
              </div>
            )}
          </div>
        )}

        {/* ── Zoom Controls ──────────────────────────────────────────── */}
        {mapId && (
          <div className="absolute bottom-4 left-3 flex flex-col gap-1">
            <button
              onClick={() => setZoom(z => Math.min(5, +(z + 0.5).toFixed(1)))}
              className="w-7 h-7 rounded bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 text-base flex items-center justify-center font-bold"
              title="Zoom in"
            >+</button>
            <button
              onClick={() => setZoom(z => { const n = Math.max(1, +(z - 0.5).toFixed(1)); if (n === 1) setPan({ x: 0, y: 0 }); return n; })}
              className="w-7 h-7 rounded bg-gray-800 border border-gray-600 text-gray-300 hover:bg-gray-700 text-base flex items-center justify-center font-bold"
              title="Zoom out"
            >−</button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="w-7 h-7 rounded bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700 text-xs flex items-center justify-center"
              title="Reset zoom"
            >⊠</button>
            {zoom !== 1 && (
              <div className="text-center text-xs text-gray-500 mt-0.5">{zoom.toFixed(1)}×</div>
            )}
          </div>
        )}

        {/* Heatmap opacity */}
        {mode === 'heatmap' && mapId && (
          <div className="absolute bottom-4 right-4 bg-gray-900 border border-gray-700 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Opacity</div>
            <input type="range" min="0.1" max="1" step="0.05"
              value={hmOpacity} onChange={e => setHmOpacity(Number(e.target.value))}
              className="w-24 accent-blue-500"
            />
          </div>
        )}

        {/* Match stats badge (top-left) */}
        {selectedMatch && selectedMatch.match_id && (
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
        <Timeline
          currentT={Math.round(currentT)}
          maxT={maxT}
          playing={playing}
          onSeek={t => setCurrentT(t)}
          onPlayPause={() => {
            if (currentT >= maxT) setCurrentT(0);
            setPlaying(p => !p);
          }}
          speed={speed}
          onSpeedChange={setSpeed}
        />
      )}
    </div>
  );
}
