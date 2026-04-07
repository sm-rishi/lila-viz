import { useState, useEffect } from 'react';
import { HEATMAP_LAYERS } from '../utils/eventConfig';

/**
 * Fetches all 5 heatmap layers for a given map + optional day in parallel.
 * Returns { kills, deaths, loot, storm, traffic } — same cell format as useHeatmap.
 * Used by POI zone metrics and grid-cell hover tooltips.
 */
export function useAllHeatmaps(mapId, day = '') {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mapId) { setData(null); return; }
    setLoading(true);

    Promise.all(
      HEATMAP_LAYERS.map(layer => {
        const fname = day
          ? `${mapId}_${day}_${layer.key}.json`
          : `${mapId}_${layer.key}.json`;
        return fetch(`/data/heatmaps/${fname}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => ({ key: layer.key, d }))
          .catch(() => ({ key: layer.key, d: null }));
      })
    ).then(results => {
      const obj = {};
      results.forEach(({ key, d }) => { obj[key] = d; });
      setData(obj);
      setLoading(false);
    });
  }, [mapId, day]);

  return { data, loading };
}
