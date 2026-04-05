# Architecture — LILA BLACK Player Journey Tool

## What I Built With and Why

| Layer | Choice | Reason |
|-------|--------|--------|
| Preprocessing | Python + PyArrow | Native parquet support, fast pandas aggregations for heatmap binning |
| Frontend | React 18 + Vite | Component model suits complex UI; Vite's HMR made iteration fast |
| Rendering | HTML5 Canvas API | 1000+ dots/lines per frame — Canvas outperforms SVG by 10× at this scale |
| Styling | Tailwind CSS | Ships fast; no CSS context-switching during a 5-day build |
| Hosting | Vercel | Free tier, zero-config Vite deploy, instant CDN — live in 2 minutes |
| Data format | Pre-processed JSON | Eliminates any runtime dependency on Python/parquet in the browser |

## Data Flow: Parquet → Screen

```
1,243 .nakama-0 files (parquet, no extension)
          │
          ▼
  process_data.py  (runs once locally)
  ├── PyArrow reads each file
  ├── Decodes event bytes → UTF-8 strings
  ├── Fixes timestamps (see below)
  ├── Detects bot vs human from user_id pattern
  ├── Pre-computes pixel coordinates per event
  └── Writes three output types:
          │
          ├── public/data/index.json          (175 KB)
          │   796 match records: map, day, duration, player counts, event breakdown
          │
          ├── public/data/matches/{id}.json   (avg 10 KB, max 89 KB)
          │   Per-match event list: uid, bot flag, px, py, t (relative seconds), event type
          │
          └── public/data/heatmaps/{map}_{type}.json   (4–20 KB each, 15 files total)
                Pre-binned 64×64 grid: cell → event count, plus max_val for normalization

Browser (React SPA on Vercel CDN)
  ├── Loads index.json once on startup
  ├── Fetches one match file when user selects a match (~10 KB per request)
  ├── Fetches one heatmap file when switching heatmap layers (~5 KB per request)
  └── Canvas draws paths, markers, and gaussian blobs — zero server calls during playback
```

Nothing is computed at runtime in the browser beyond scaling pixel coordinates to the canvas size. All coordinate math, timestamp normalization, and event decoding happened at preprocessing time.

## Coordinate Mapping — The Tricky Part

The minimap images are 1024×1024 pixels. In-game world coordinates use a right-handed 3D system where `y` is elevation (not used for 2D mapping). Only `x` and `z` matter.

**Formula (from README, validated against all 89,104 events):**

```
u = (x - origin_x) / scale          # normalized 0→1 across map width
v = (z - origin_z) / scale          # normalized 0→1 across map height

pixel_x = u × 1024
pixel_y = (1 − v) × 1024            # Y-axis FLIPPED — image origin is top-left,
                                     # world origin is bottom-left
```

**Per-map parameters:**

| Map | Scale | Origin X | Origin Z | Validated u range | Validated v range |
|-----|-------|----------|----------|-------------------|-------------------|
| AmbroseValley | 900 | −370 | −473 | [0.05, 0.75] | [0.10, 0.93] |
| GrandRift | 581 | −290 | −290 | [0.11, 0.94] | [0.17, 0.79] |
| Lockdown | 1000 | −500 | −500 | [0.09, 0.85] | [0.22, 0.83] |

All 89,104 events fall within [0, 1] on both axes — no clipping needed. The frontend scales pre-computed 1024-basis pixel coords to the actual canvas size at render time.

## Assumptions Made

**Timestamp unit mismatch.** The `ts` column is typed `datetime64[ms]` in parquet, but the raw `int64` values (e.g., `1770681535`) are Unix timestamps in **seconds**, not milliseconds. Pandas reads them as "January 21, 1970" — which is wrong. Treating them as seconds gives "February 9–14, 2026" — correct. This was confirmed by: (a) match durations becoming 13–890 seconds (realistic for an extraction shooter) and (b) position sampling intervals becoming 5–7 seconds (typical game telemetry). Fix: `ts.astype('int64')` extracts the raw value, then subtract per-match minimum for relative time `t`.

**Bot file attribution.** Files named `{numeric_id}_{match_id}` have bot events but the `n_bots` count in `index.json` reflects only bots that share the same `match_id` as human players in the dataset (36 matches). Most bot files are standalone. The tool correctly renders bots in all cases — the index count is conservative.

**February 14 is partial.** Treated identically to other days; no special handling needed since we don't assume completeness.

**Human-on-human kills are nearly absent.** Only 3 `Kill` events exist across 796 matches. These are rendered correctly but produce minimal heatmap signal — by design, not a bug.

## Major Tradeoffs

| Decision | Chose | Over | Tradeoff |
|----------|-------|------|----------|
| Static preprocessing | Pre-computed JSON committed to repo | Live FastAPI backend reading parquet | Loses real-time data updates; gains zero hosting cost, no server cold starts, works offline |
| Per-match lazy loading | Fetch one match on demand | Bundle all matches into one file | 10 KB per fetch vs 7.9 MB upfront; tiny latency per selection, fast initial load |
| Canvas over SVG | `<canvas>` for all drawing | SVG elements per event | SVG DOM degrades past ~500 nodes; Canvas handles 1,200 events at 60fps smoothly |
| Gaussian blobs over grid squares | Radial gradient per cell | Filled rect per bin | Visually smooth heatmap at the cost of slightly more canvas fill operations; imperceptible at 64×64 grid |
| No charting library | Custom canvas drawing | deck.gl / heatmap.js | Saves ~400 KB of dependencies; full control over visual style |
| Pixel coords pre-computed | Python bakes `px`, `py` into JSON | Browser computes from world coords | JSON is ~15% larger but frontend has zero coordinate math |
