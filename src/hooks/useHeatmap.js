import { useState, useEffect } from 'react';

/**
 * Fetches a heatmap file for a given map + layer.
 * Returns { data, loading, error }
 * data = { cells: { "bx,by": count }, max_val, cell_size, image_size, total_events }
 */
export function useHeatmap(mapId, layerKey) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!mapId || !layerKey) { setData(null); return; }

    setLoading(true);
    setError(null);

    fetch(`/data/heatmaps/${mapId}_${layerKey}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [mapId, layerKey]);

  return { data, loading, error };
}
