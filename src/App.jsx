import { useState, useMemo } from 'react';
import { useIndex } from './hooks/useIndex';
import { DEFAULT_FILTERS } from './utils/eventConfig';
import { DAY_LABELS } from './utils/mapConfig';
import Filters   from './components/Filters';
import MatchList  from './components/MatchList';
import MapView   from './components/MapView';
import './index.css';

const MAP_LABELS = { AmbroseValley: 'Ambrose Valley', GrandRift: 'Grand Rift', Lockdown: 'Lockdown' };

export default function App() {
  const { matches, loading, error } = useIndex();

  const [filterMap, setFilterMap] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [mode,      setMode]      = useState('replay');
  const [heatmapLayer, setHeatmapLayer] = useState('kills');
  const [eventFilters, setEventFilters] = useState(DEFAULT_FILTERS);

  const [selectedId, setSelectedId] = useState(null);
  const selectedMatch = useMemo(
    () => matches.find(m => m.match_id === selectedId) || null,
    [matches, selectedId]
  );

  const [heatmapMatchId, setHeatmapMatchId] = useState('');
  const [hmMatchInput,   setHmMatchInput]   = useState('');
  const heatmapMatchInfo = useMemo(
    () => matches.find(m => m.match_id === heatmapMatchId) || null,
    [matches, heatmapMatchId]
  );

  const applyHeatmapMatch = (val) => {
    const trimmed = val.trim();
    const found = matches.find(m => m.match_id === trimmed);
    if (found) { setHeatmapMatchId(trimmed); setHmMatchInput(trimmed); }
    else { setHmMatchInput(trimmed); }
  };
  const clearHeatmapMatch = () => { setHeatmapMatchId(''); setHmMatchInput(''); };

  const handleSetFilterMap = v => {
    setFilterMap(v);
    if (mode === 'heatmap' || mode === 'compare') setSelectedId(null);
  };

  const heatmapMapId = filterMap || selectedMatch?.map_id || 'AmbroseValley';
  const heatmapMatch = (mode === 'heatmap' || mode === 'compare')
    ? { map_id: heatmapMapId, match_id: null, day: filterDay, n_humans: '—', n_bots: '—', duration_s: 0 }
    : null;

  // Counts for heatmap sidebar — respects both map and day filters
  const heatmapMatchCount = useMemo(() => {
    return matches.filter(m =>
      m.map_id === heatmapMapId &&
      (!filterDay || m.day === filterDay)
    ).length;
  }, [matches, heatmapMapId, filterDay]);

  const mapCountsForDay = useMemo(() => {
    return ['AmbroseValley', 'GrandRift', 'Lockdown'].map(m => ({
      map_id: m,
      count: matches.filter(x => x.map_id === m && (!filterDay || x.day === filterDay)).length,
    }));
  }, [matches, filterDay]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400 text-sm">
        Failed to load data: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-200 overflow-hidden">
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-700 overflow-hidden">
          <Filters
            filterMap={filterMap}       setFilterMap={handleSetFilterMap}
            filterDay={filterDay}       setFilterDay={setFilterDay}
            mode={mode}                setMode={m => { setMode(m); setSelectedId(null); }}
            eventFilters={eventFilters} setEventFilters={setEventFilters}
            heatmapLayer={heatmapLayer} setHeatmapLayer={setHeatmapLayer}
          />

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

          {(mode === 'heatmap' || mode === 'compare') && (
            <div className="flex-1 p-3 overflow-y-auto">
              {/* Current view context */}
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Viewing</div>
              <div className="text-sm text-blue-300 font-medium">{MAP_LABELS[heatmapMapId]}</div>
              <div className="flex items-center gap-1.5 mt-1 mb-3">
                <span className="text-xs text-gray-400 font-semibold tabular-nums">{heatmapMatchCount}</span>
                <span className="text-xs text-gray-500">
                  {filterDay ? `matches on ${DAY_LABELS[filterDay]}` : 'matches (all days)'}
                </span>
              </div>

              {/* Map switcher — shows per-day counts */}
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Switch Map</div>
              {mapCountsForDay.map(({ map_id, count }) => (
                <button
                  key={map_id}
                  onClick={() => setFilterMap(map_id)}
                  className={`w-full text-left px-2 py-2 rounded text-xs mb-1 transition-colors flex justify-between items-center ${
                    heatmapMapId === map_id
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <span>{MAP_LABELS[map_id]}</span>
                  <span className={`tabular-nums font-semibold ${heatmapMapId === map_id ? 'text-blue-400' : 'text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              ))}

              {/* Date context note */}
              {filterDay && (
                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500">
                  Filtered to <span className="text-gray-300">{DAY_LABELS[filterDay]}</span>.
                  <button
                    onClick={() => setFilterDay('')}
                    className="ml-1 text-blue-400 hover:text-blue-300 underline"
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Filter by match ID */}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Filter by Match</div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Paste match ID…"
                    value={hmMatchInput}
                    onChange={e => setHmMatchInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') applyHeatmapMatch(hmMatchInput); }}
                    className="flex-1 min-w-0 bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-500"
                  />
                  <button
                    onClick={() => applyHeatmapMatch(hmMatchInput)}
                    className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 text-white flex-shrink-0"
                  >Go</button>
                </div>

                {/* Active match filter info */}
                {heatmapMatchId && heatmapMatchInfo && (
                  <div className="mt-2 bg-gray-800 rounded px-2 py-1.5 text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-blue-300 font-semibold">Match filter active</span>
                      <button onClick={clearHeatmapMatch} className="text-gray-500 hover:text-red-400 text-xs">✕</button>
                    </div>
                    <div className="text-gray-400">{heatmapMatchInfo.map_id}</div>
                    <div className="text-gray-500">{DAY_LABELS[heatmapMatchInfo.day]}</div>
                    <div className="text-gray-500">{heatmapMatchInfo.n_humans}H · {heatmapMatchInfo.n_bots}B · {Math.floor(heatmapMatchInfo.duration_s/60)}m{heatmapMatchInfo.duration_s%60}s</div>
                  </div>
                )}

                {/* Invalid ID warning */}
                {hmMatchInput && !heatmapMatchId && hmMatchInput.trim().length > 8 && (
                  <div className="mt-1 text-xs text-red-400">Match ID not found</div>
                )}
              </div>
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-hidden">
          <MapView
            selectedMatch={(mode === 'heatmap' || mode === 'compare') ? heatmapMatch : selectedMatch}
            mode={mode}
            eventFilters={eventFilters}
            heatmapLayer={heatmapLayer}
            filterDay={filterDay}
            heatmapMatchId={heatmapMatchId}
          />
        </main>
      </div>
    </div>
  );
}
