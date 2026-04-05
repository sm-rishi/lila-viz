import { useState, useMemo } from 'react';
import { useIndex } from './hooks/useIndex';
import { DEFAULT_FILTERS } from './utils/eventConfig';
import Filters  from './components/Filters';
import MatchList from './components/MatchList';
import MapView  from './components/MapView';
import './index.css';

export default function App() {
  const { matches, loading, error } = useIndex();

  // Filter state
  const [filterMap, setFilterMap] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [mode,      setMode]      = useState('replay');
  const [heatmapLayer, setHeatmapLayer] = useState('kills');
  const [eventFilters, setEventFilters] = useState(DEFAULT_FILTERS);

  // Selected match
  const [selectedId, setSelectedId] = useState(null);
  const selectedMatch = useMemo(
    () => matches.find(m => m.match_id === selectedId) || null,
    [matches, selectedId]
  );

  // When map filter changes in heatmap mode, clear selected match
  const handleSetFilterMap = v => {
    setFilterMap(v);
    if (mode === 'heatmap') setSelectedId(null);
  };

  // Pick the map for heatmap: either from filter or from selected match
  const heatmapMapId = filterMap || selectedMatch?.map_id || 'AmbroseValley';
  const heatmapMatch = mode === 'heatmap'
    ? { map_id: heatmapMapId, match_id: null, day: filterDay, n_humans: '—', n_bots: '—', duration_s: 0 }
    : null;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400 text-sm">
        Failed to load data: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold text-sm tracking-wide text-white">LILA BLACK</span>
          <span className="text-gray-500 text-sm">/ Player Journey Tool</span>
        </div>
        <div className="text-xs text-gray-500">
          {loading ? 'Loading…' : `${matches.length} matches · Feb 10–14, 2026`}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-700 overflow-hidden">
          <Filters
            filterMap={filterMap}      setFilterMap={handleSetFilterMap}
            filterDay={filterDay}      setFilterDay={setFilterDay}
            mode={mode}               setMode={m => { setMode(m); setSelectedId(null); }}
            eventFilters={eventFilters} setEventFilters={setEventFilters}
            heatmapLayer={heatmapLayer} setHeatmapLayer={setHeatmapLayer}
          />

          {/* Match list (only shown in replay mode) */}
          {mode === 'replay' && (
            <div className="flex-1 overflow-hidden">
              {loading ? (
                <div className="p-4 text-center text-gray-500 text-sm">Loading matches…</div>
              ) : (
                <MatchList
                  matches={matches}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  filterMap={filterMap}
                  filterDay={filterDay}
                />
              )}
            </div>
          )}

          {/* In heatmap mode, show which map is displayed */}
          {mode === 'heatmap' && (
            <div className="flex-1 p-3">
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Viewing Map</div>
              <div className="text-sm text-blue-300 font-medium">{heatmapMapId}</div>
              <div className="text-xs text-gray-500 mt-1">
                Showing aggregated data across all {matches.filter(m => m.map_id === heatmapMapId).length} matches
              </div>

              <div className="mt-4 text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Quick Stats</div>
              {['AmbroseValley','GrandRift','Lockdown'].map(m => (
                <button
                  key={m}
                  onClick={() => setFilterMap(m)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs mb-1 transition-colors ${
                    heatmapMapId === m ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {m === 'AmbroseValley' ? 'Ambrose Valley' : m} — {matches.filter(x => x.map_id === m).length} matches
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* Main canvas panel */}
        <main className="flex-1 overflow-hidden">
          <MapView
            selectedMatch={mode === 'heatmap' ? heatmapMatch : selectedMatch}
            mode={mode}
            eventFilters={eventFilters}
            heatmapLayer={heatmapLayer}
          />
        </main>
      </div>
    </div>
  );
}
