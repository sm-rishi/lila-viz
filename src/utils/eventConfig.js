/**
 * Visual configuration for all 8 event types.
 * Used consistently across replay markers and legend.
 */

export const EVENT_CONFIG = {
  // Movement — drawn as paths, not individual markers
  Position:    { label: 'Human Path',    color: '#60a5fa', markerSize: 3,  isMovement: true  },
  BotPosition: { label: 'Bot Path',      color: '#94a3b8', markerSize: 2,  isMovement: true  },

  // Combat
  Kill:        { label: 'Kill (PvP)',     color: '#f87171', markerSize: 10, symbol: '☠',  isMovement: false },
  Killed:      { label: 'Death (PvP)',    color: '#fb923c', markerSize: 10, symbol: '✝',  isMovement: false },
  BotKill:     { label: 'Bot Kill',       color: '#ef4444', markerSize: 7,  symbol: '⚔',  isMovement: false },
  BotKilled:   { label: 'Killed by Bot',  color: '#f97316', markerSize: 7,  symbol: '💀', isMovement: false },

  // Storm
  KilledByStorm: { label: 'Storm Death', color: '#a78bfa', markerSize: 9, symbol: '⚡', isMovement: false },

  // Loot
  Loot:        { label: 'Loot',           color: '#34d399', markerSize: 6,  symbol: '★',  isMovement: false },
};

// Heatmap layer definitions
export const HEATMAP_LAYERS = [
  { key: 'kills',   label: 'Kill Zones',   color: [239, 68,  68],  description: 'BotKill + Kill events' },
  { key: 'deaths',  label: 'Death Zones',  color: [249, 115, 22],  description: 'BotKilled + Killed events' },
  { key: 'loot',    label: 'Loot Density', color: [52,  211, 153], description: 'Loot pickup events' },
  { key: 'storm',   label: 'Storm Deaths', color: [167, 139, 250], description: 'KilledByStorm events' },
  { key: 'traffic', label: 'Traffic',      color: [96,  165, 250], description: 'All position events' },
];

// Default filter state — which events to show
export const DEFAULT_FILTERS = {
  showHumanPaths: true,
  showBotPaths:   true,
  showKills:      true,
  showDeaths:     true,
  showLoot:       true,
  showStorm:      true,
};

// Which event types are included per filter key
export const FILTER_EVENT_MAP = {
  showHumanPaths: ['Position'],
  showBotPaths:   ['BotPosition'],
  showKills:      ['Kill', 'BotKill'],
  showDeaths:     ['Killed', 'BotKilled'],
  showLoot:       ['Loot'],
  showStorm:      ['KilledByStorm'],
};
