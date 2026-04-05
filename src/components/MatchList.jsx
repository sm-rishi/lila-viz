import { useState, useMemo } from 'react';
import { formatTime, formatDay } from '../utils/format';
import { DAYS, DAY_LABELS } from '../utils/mapConfig';

export default function MatchList({ matches, selectedId, onSelect, filterMap, filterDay }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return matches.filter(m => {
      if (filterMap && m.map_id !== filterMap) return false;
      if (filterDay && m.day  !== filterDay)  return false;
      if (search && !m.match_id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [matches, filterMap, filterDay, search]);

  // Group by day
  const grouped = useMemo(() => {
    const g = {};
    DAYS.forEach(d => { g[d] = []; });
    filtered.forEach(m => { if (g[m.day]) g[m.day].push(m); });
    return g;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search match ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 text-xs px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500 placeholder-gray-500"
        />
      </div>

      <div className="text-xs text-gray-500 px-3 py-1.5 border-b border-gray-700">
        {filtered.length} / {matches.length} matches
      </div>

      {/* Match list grouped by day */}
      <div className="flex-1 overflow-y-auto">
        {DAYS.map(day => {
          const dayMatches = grouped[day];
          if (!dayMatches || dayMatches.length === 0) return null;
          return (
            <div key={day}>
              <div className="sticky top-0 bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-400 border-b border-gray-700 z-10">
                {DAY_LABELS[day]} — {dayMatches.length} matches
              </div>
              {dayMatches.map(m => (
                <MatchRow
                  key={m.match_id}
                  match={m}
                  selected={m.match_id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-10">
            No matches found
          </div>
        )}
      </div>
    </div>
  );
}

function MatchRow({ match, selected, onSelect }) {
  const mapColor = {
    AmbroseValley: 'bg-blue-500',
    GrandRift:     'bg-amber-500',
    Lockdown:      'bg-red-500',
  }[match.map_id] || 'bg-gray-500';

  return (
    <button
      onClick={() => onSelect(match.match_id)}
      className={`w-full text-left px-3 py-2 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
        selected ? 'bg-gray-700 border-l-2 border-l-blue-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mapColor}`} />
        <span className="text-xs font-mono text-gray-300 truncate">
          {match.match_id.slice(0, 18)}…
        </span>
      </div>
      <div className="flex gap-3 text-xs text-gray-500 pl-3.5">
        <span>{match.map_id === 'AmbroseValley' ? 'Ambrose' : match.map_id}</span>
        <span className="text-blue-400">{match.n_humans}H</span>
        <span className="text-gray-500">{match.n_bots}B</span>
        <span className="ml-auto">{formatTime(match.duration_s)}</span>
      </div>
    </button>
  );
}
