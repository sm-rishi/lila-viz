/** Format seconds as MM:SS */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format a day key as a readable label */
export function formatDay(day) {
  return day.replace('_', ' ');
}

/** Group match list by day */
export function groupByDay(matches) {
  return matches.reduce((acc, m) => {
    if (!acc[m.day]) acc[m.day] = [];
    acc[m.day].push(m);
    return acc;
  }, {});
}
