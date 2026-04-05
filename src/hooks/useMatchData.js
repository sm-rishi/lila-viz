import { useState, useEffect } from 'react';

/**
 * Fetches per-match event data when matchId changes.
 * Returns { events, loading, error, maxT }
 */
export function useMatchData(matchId) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [maxT,    setMaxT]    = useState(0);

  useEffect(() => {
    if (!matchId) { setEvents([]); setMaxT(0); return; }

    setLoading(true);
    setError(null);

    fetch(`/data/matches/${matchId}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setEvents(data);
        setMaxT(data.length > 0 ? Math.max(...data.map(e => e.t)) : 0);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [matchId]);

  return { events, loading, error, maxT };
}
