import { MAPS, DAYS, DAY_LABELS } from '../utils/mapConfig';
import { DEFAULT_FILTERS } from '../utils/eventConfig';

const MAP_LABELS = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift:     'Grand Rift',
  Lockdown:      'Lockdown',
};

export default function Filters({
  filterMap, setFilterMap,
  filterDay, setFilterDay,
  mode, setMode,
  eventFilters, setEventFilters,
  heatmapLayer, setHeatmapLayer,
}) {
  const toggleEvent = key => {
    setEventFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-3 space-y-4 border-b border-gray-700">
      {/* Mode toggle */}
      <div>
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">View Mode</label>
        <div className="flex rounded overflow-hidden border border-gray-600">
          {['replay', 'heatmap'].map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-1.5 text-xs font-medium capitalize transition-colors ${
                mode === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {m === 'replay' ? '▶ Replay' : '🌡 Heatmap'}
            </button>
          ))}
        </div>
      </div>

      {/* Map filter */}
      <div>
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">Map</label>
        <select
          value={filterMap}
          onChange={e => setFilterMap(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Maps</option>
          {MAPS.map(m => (
            <option key={m} value={m}>{MAP_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {/* Date filter */}
      <div>
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">Date</label>
        <select
          value={filterDay}
          onChange={e => setFilterDay(e.target.value)}
          className="w-full bg-gray-800 text-gray-200 text-xs px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Dates</option>
          {DAYS.map(d => (
            <option key={d} value={d}>{DAY_LABELS[d]}</option>
          ))}
        </select>
      </div>

      {/* Heatmap layer selector (only in heatmap mode) */}
      {mode === 'heatmap' && (
        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">Heatmap Layer</label>
          {[
            { key: 'kills',   label: '⚔ Kill Zones',   color: 'text-red-400'    },
            { key: 'deaths',  label: '💀 Death Zones',  color: 'text-orange-400' },
            { key: 'loot',    label: '★ Loot Density',  color: 'text-green-400'  },
            { key: 'storm',   label: '⚡ Storm Deaths',  color: 'text-purple-400' },
            { key: 'traffic', label: '● Traffic',        color: 'text-blue-400'   },
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setHeatmapLayer(key)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs mb-1 transition-colors ${
                heatmapLayer === key
                  ? 'bg-gray-700 ' + color
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Event layer toggles (only in replay mode) */}
      {mode === 'replay' && (
        <div>
          <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide block mb-1.5">Show Layers</label>
          <div className="space-y-1">
            {[
              { key: 'showHumanPaths', label: 'Human Paths',  color: 'bg-blue-400'   },
              { key: 'showBotPaths',   label: 'Bot Paths',    color: 'bg-gray-400'   },
              { key: 'showKills',      label: 'Kills',        color: 'bg-red-400'    },
              { key: 'showDeaths',     label: 'Deaths',       color: 'bg-orange-400' },
              { key: 'showLoot',       label: 'Loot',         color: 'bg-green-400'  },
              { key: 'showStorm',      label: 'Storm Deaths', color: 'bg-purple-400' },
            ].map(({ key, label, color }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer group">
                <div
                  onClick={() => toggleEvent(key)}
                  className={`w-3.5 h-3.5 rounded flex-shrink-0 border cursor-pointer ${
                    eventFilters[key]
                      ? color + ' border-transparent'
                      : 'bg-transparent border-gray-600'
                  }`}
                />
                <span
                  onClick={() => toggleEvent(key)}
                  className={`text-xs select-none ${eventFilters[key] ? 'text-gray-200' : 'text-gray-500'}`}
                >
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
