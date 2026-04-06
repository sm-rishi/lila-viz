import { useState, useEffect } from 'react';

/**
 * Fetches a heatmap file for a given map + layer + optional day.
 * When day is provided, fetches {mapId}_{day}_{layerKey}.json (per-day slice).
 * When day is empty, fetches {mapId}_{layerKey}.json (all-time aggregate).
 */
export function useHeatmap(mapId, layerKey, day = '') {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!mapId || !layerKey) { setData(null); return; }

    setLoading(true);
    setError(null);

    const fname = day
      ? `${mapId}_${day}_${layerKey}.json`
      : `${mapId}_${layerKey}.json`;

    fetch(`/data/heatmaps/${fname}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [mapId, layerKey, day]);

  return { data, loading, error };
}
