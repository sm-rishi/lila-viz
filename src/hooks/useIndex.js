import { useState, useEffect } from 'react';

/**
 * Loads index.json once on mount.
 * Returns { matches, loading, error }
 */
export function useIndex() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    fetch('/data/index.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => { setMatches(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, []);

  return { matches, loading, error };
}
