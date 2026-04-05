import { EVENT_CONFIG } from '../utils/eventConfig';

export default function Legend({ mode, heatmapLayer }) {
  if (mode === 'heatmap') {
    const layerColors = {
      kills:   'from-transparent to-red-500',
      deaths:  'from-transparent to-orange-500',
      loot:    'from-transparent to-green-400',
      storm:   'from-transparent to-purple-400',
      traffic: 'from-transparent to-blue-400',
    };
    const layerLabels = {
      kills:   'Kill Zones',
      deaths:  'Death Zones',
      loot:    'Loot Density',
      storm:   'Storm Deaths',
      traffic: 'Player Traffic',
    };
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900 border-t border-gray-700">
        <span className="text-xs text-gray-400 font-semibold">Heatmap:</span>
        <span className="text-xs text-gray-300">{layerLabels[heatmapLayer]}</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-500">Low</span>
          <div className={`w-24 h-2.5 rounded bg-gradient-to-r ${layerColors[heatmapLayer] || 'from-transparent to-blue-400'}`} />
          <span className="text-xs text-gray-500">High</span>
        </div>
      </div>
    );
  }

  const markers = Object.entries(EVENT_CONFIG).filter(([, cfg]) => !cfg.isMovement);
  const paths   = Object.entries(EVENT_CONFIG).filter(([, cfg]) => cfg.isMovement);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 bg-gray-900 border-t border-gray-700">
      {paths.map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <svg width="20" height="6">
            <line
              x1="0" y1="3" x2="20" y2="3"
              stroke={cfg.color}
              strokeWidth="2"
              strokeDasharray={key === 'BotPosition' ? '4,3' : ''}
            />
          </svg>
          <span className="text-xs text-gray-400">{cfg.label}</span>
        </div>
      ))}
      {markers.map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span style={{ color: cfg.color, fontSize: '12px' }}>{cfg.symbol}</span>
          <span className="text-xs text-gray-400">{cfg.label}</span>
        </div>
      ))}
    </div>
  );
}
