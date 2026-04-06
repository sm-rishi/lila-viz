import { useMemo } from 'react';
import { useMatchData } from './useMatchData';

const CELL = 16;
const IMG  = 1024;

const HEATMAP_GROUPS = {
  kills:   ['Kill', 'BotKill'],
  deaths:  ['Killed', 'BotKilled'],
  loot:    ['Loot'],
  storm:   ['KilledByStorm'],
  traffic: ['Position', 'BotPosition'],
};

/**
 * Computes heatmap data client-side from a single match's event JSON.
 * Used when the user filters the heatmap by a specific match ID.
 * Returns the same shape as useHeatmap so HeatmapCanvas needs no changes.
 */
export function useMatchHeatmap(matchId, layerKey) {
  const { events, loading } = useMatchData(matchId || null);

  const data = useMemo(() => {
    if (!events.length || !layerKey) return null;
    const types = HEATMAP_GROUPS[layerKey] || [];
    const filtered = events.filter(e => types.includes(e.e));

    const cells = {};
    filtered.forEach(e => {
      // px/py are already in 1024-basis from preprocessing
      const bx = Math.floor(e.px / CELL);
      const by = Math.floor(e.py / CELL);
      const key = `${bx},${by}`;
      cells[key] = (cells[key] || 0) + 1;
    });

    const max_val = Object.values(cells).length ? Math.max(...Object.values(cells)) : 1;
    return {
      cells,
      max_val,
      total_events: filtered.length,
      cell_size: CELL,
      image_size: IMG,
    };
  }, [events, layerKey]);

  return { data, loading };
}
