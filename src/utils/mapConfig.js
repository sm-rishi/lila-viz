/**
 * Map configuration matching the README spec.
 * Coordinate conversion is intentionally kept here (not in preprocessing)
 * so the frontend can re-derive pixel positions at any canvas resolution.
 *
 * ts column nuance: stored as datetime64[ms] in parquet but raw int64 values
 * are Unix timestamps in SECONDS. The preprocessing script already converts
 * to relative seconds (t=0 at match start), so the frontend just uses t directly.
 */

export const MAP_CONFIG = {
  AmbroseValley: { scale: 900,  ox: -370, oz: -473 },
  GrandRift:     { scale: 581,  ox: -290, oz: -290 },
  Lockdown:      { scale: 1000, ox: -500, oz: -500 },
};

export const MAPS = Object.keys(MAP_CONFIG);

// Minimap images (placed in public/minimaps/)
export const MINIMAP_IMAGES = {
  AmbroseValley: '/minimaps/AmbroseValley_Minimap.png',
  GrandRift:     '/minimaps/GrandRift_Minimap.png',
  Lockdown:      '/minimaps/Lockdown_Minimap.jpg',
};

// IMAGE_SIZE is the native resolution of the minimap PNGs
const IMAGE_SIZE = 1024;

/**
 * Convert pre-computed pixel coords (from JSON, based on 1024px) to
 * actual canvas pixel coords at the current canvas display size.
 */
export function scalePixel(px, py, canvasSize) {
  const ratio = canvasSize / IMAGE_SIZE;
  return [px * ratio, py * ratio];
}

export const DAYS = [
  'February_10',
  'February_11',
  'February_12',
  'February_13',
  'February_14',
];

export const DAY_LABELS = {
  February_10: 'Feb 10',
  February_11: 'Feb 11',
  February_12: 'Feb 12',
  February_13: 'Feb 13',
  February_14: 'Feb 14',
};
