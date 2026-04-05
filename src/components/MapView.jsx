import { useState, useEffect, useRef, useCallback } from 'react';
import { MINIMAP_IMAGES } from '../utils/mapConfig';
import { useMatchData } from '../hooks/useMatchData';
import { useHeatmap }   from '../hooks/useHeatmap';
import ReplayCanvas  from './ReplayCanvas';
import HeatmapCanvas from './HeatmapCanvas';
import Timeline from './Timeline';
import Legend   from './Legend';

const CANVAS_BASE = 600; // px, square

export default function MapView({ selectedMatch, mode, eventFilters, heatmapLayer }) {
  const mapId   = selectedMatch?.map_id;
  const matchId = selectedMatch?.match_id;

  // Fetch data
  const { events, loading: evtLoading, maxT } = useMatchData(mode === 'replay' ? matchId : null);
  const { data: heatmapData, loading: hmLoading } = useHeatmap(
    mode === 'heatmap' ? mapId : null,
    mode === 'heatmap' ? heatmapLayer : null
  );

  // Minimap image
  const [mapImage, setMapImage] = useState(null);
  useEffect(() => {
    if (!mapId) { setMapImage(null); return; }
    const img = new Image();
    img.src = MINIMAP_IMAGES[mapId];
    img.onload = () => setMapImage(img);
  }, [mapId]);

  // Playback state
  const [currentT, setCurrentT] = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [speed,    setSpeed]    = useState(1);
  const rafRef    = useRef(null);
  const lastRef   = useRef(null);

  // Reset on match change
  useEffect(() => { setCurrentT(0); setPlaying(false); }, [matchId]);

  // Animation loop
  const tick = useCallback((timestamp) => {
    if (lastRef.current === null) lastRef.current = timestamp;
    const delta = (timestamp - lastRef.current) / 1000; // real seconds elapsed
    lastRef.current = timestamp;
    setCurrentT(prev => {
      const next = prev + delta * speed;
      if (next >= maxT) { setPlaying(false); return maxT; }
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [speed, maxT]);

  useEffect(() => {
    if (playing) {
      lastRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  // Opacity for heatmap
  const [hmOpacity, setHmOpacity] = useState(0.75);

  // Tooltip state
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (mode !== 'replay' || !events.length) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ratio = CANVAS_BASE / 1024;
    const threshold = 14;

    // Find nearest non-movement event within threshold
    let nearest = null;
    let nearestDist = threshold;
    events.filter(ev => ev.t <= currentT && ev.e !== 'Position' && ev.e !== 'BotPosition').forEach(ev => {
      const dx = ev.px * ratio - mx;
      const dy = ev.py * ratio - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) { nearest = ev; nearestDist = dist; }
    });
    setTooltip(nearest ? { evt: nearest, x: mx, y: my } : null);
  }, [events, currentT, mode]);

  const loading = evtLoading || hmLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-hidden relative">

        {/* Empty state */}
        {!mapId && (
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-3">🗺️</div>
            <div className="text-sm">Select a match from the list</div>
          </div>
        )}

        {/* Loading */}
        {mapId && loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950 bg-opacity-80 z-10">
            <div className="text-gray-400 text-sm">Loading…</div>
          </div>
        )}

        {/* Canvas */}
        {mapId && (
          <div
            ref={containerRef}
            className="relative shadow-2xl"
            style={{ width: CANVAS_BASE, height: CANVAS_BASE }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            {mode === 'replay' ? (
              <ReplayCanvas
                events={events}
                currentT={currentT}
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

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute z-20 bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-xs pointer-events-none shadow-lg"
                style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
              >
                <div className="font-semibold text-gray-200">{tooltip.evt.e}</div>
                <div className="text-gray-400">{tooltip.evt.bot ? 'Bot' : 'Human'}</div>
                <div className="text-gray-500">t={Math.round(tooltip.evt.t)}s</div>
                <div className="text-gray-500 font-mono text-xs">{tooltip.evt.uid.slice(0, 16)}…</div>
              </div>
            )}
          </div>
        )}

        {/* Heatmap opacity control */}
        {mode === 'heatmap' && mapId && (
          <div className="absolute bottom-4 right-4 bg-gray-900 border border-gray-700 rounded px-3 py-2">
            <div className="text-xs text-gray-400 mb-1">Opacity</div>
            <input
              type="range" min="0.1" max="1" step="0.05"
              value={hmOpacity}
              onChange={e => setHmOpacity(Number(e.target.value))}
              className="w-24 accent-blue-500"
            />
          </div>
        )}

        {/* Match stats badge */}
        {selectedMatch && (
          <div className="absolute top-3 left-3 bg-gray-900 bg-opacity-90 border border-gray-700 rounded px-3 py-2 text-xs">
            <div className="text-gray-300 font-semibold mb-0.5">{selectedMatch.map_id}</div>
            <div className="text-gray-500">{selectedMatch.day.replace('_', ' ')}</div>
            <div className="text-blue-400 mt-0.5">
              {selectedMatch.n_humans}H · {selectedMatch.n_bots}B · {Math.floor(selectedMatch.duration_s / 60)}m{selectedMatch.duration_s % 60}s
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <Legend mode={mode} heatmapLayer={heatmapLayer} />

      {/* Timeline (replay mode only) */}
      {mode === 'replay' && (
        <Timeline
          currentT={Math.round(currentT)}
          maxT={maxT}
          playing={playing}
          onSeek={t => { setCurrentT(t); }}
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
