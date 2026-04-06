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
          └── public/data/heatmaps/
                ├── {map}_{type}.json            (all-time aggregate, 15 files)
                └── {map}_{day}_{type}.json      (per-day slice, 74 files)
                89 files total — pre-binned 16×16px grid: cell → event count + max_val

Browser (React SPA on Vercel CDN)
  ├── Loads index.json once on startup
  ├── Fetches one match file when user selects a match (~10 KB per request)
  ├── Fetches one heatmap file when layer or day filter changes (~5 KB per request)
  ├── OR computes heatmap client-side from a match JSON when filtered by match ID
  └── Canvas draws paths, markers, gaussian blobs, and storm overlay — zero server calls during playback
```

The browser does one piece of runtime computation: when the user filters the heatmap by a specific match ID, the `useMatchHeatmap` hook bins the already-loaded match events into a heatmap grid client-side (no extra network request). All other coordinate math, timestamp normalization, and event decoding happened at preprocessing time.

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

## UI Features

| Feature | Implementation |
|---------|---------------|
| Replay playback | `requestAnimationFrame` loop; `speed` multiplier (0.5×–4×); seek via timeline scrubber |
| Zoom / Pan | CSS `scale(zoom) translate(panX, panY)` on inner div; wheel zoom (1×–5×); drag-to-pan when zoomed; +/− buttons |
| Player alive counter | `useMemo` over events up to `currentT`; tracks dead UIDs from Killed/BotKilled/KilledByStorm; counts BotKill events for bot deaths |
| Storm overlay | Starts at 85% of match duration; direction inferred from KilledByStorm positions per match; drawn as radial gradient arc on canvas |
| Hover tooltip | Screen → canvas coord transform accounts for zoom + pan; nearest event within 16/zoom px |
| Heatmap date filter | Fetches `{map}_{day}_{layer}.json`; switching day triggers a new fetch; "all days" fetches `{map}_{layer}.json` |
| Filter heatmap by match | Paste/type a match ID → `useMatchHeatmap` bins that match's events client-side into the same grid format as server heatmaps |
| Copy match ID | Hover-revealed button on each match row; `navigator.clipboard.writeText`; ✓ feedback for 1.5 s |

## Design Decisions

### Layout
The app is split into a fixed 256 px sidebar and a fluid main canvas area. The sidebar serves double duty: in replay mode it lists matches; in heatmap mode it becomes a map/day/match switcher. This avoids a separate settings panel and keeps all controls one click away from the data.

The canvas sits inside a `flex-1` column with a Legend strip and Timeline bar docked to the bottom. Controls that are only relevant in one mode (timeline, opacity slider, player counter) are conditionally rendered — the UI never shows controls that do nothing.

### Visual Language

| Element | Visual choice | Reason |
|---------|--------------|--------|
| Human paths | Solid colored lines, unique hue per UID | Lets the analyst track one player across the full match without ambiguity |
| Bot paths | Dashed gray lines | Immediately distinguishable from humans; bots are context, not the focus |
| Kill marker | Red ✕ | Universal "eliminated" symbol; red reads as danger at a glance |
| Death marker | Orange ✕ | Same symbol family as kill but different hue — same meaning, different subject |
| Loot marker | Yellow ◆ | Warm, positive color for a rewarding action |
| Storm death | Purple ✕ | Distinct from combat deaths; purple is conventionally used for environmental hazards |
| Position trail | Faded dots | Low visual weight so they don't compete with event markers |
| Storm overlay | Semi-transparent red radial arc | Communicates both location and coverage without occluding the whole map |

### Color Scheme
Dark background (`gray-950`) was chosen so minimap images — which are dark game screenshots — blend naturally into the chrome. Bright accent colors (blue for humans, amber for bots, red for kills) stand out against the dark field without needing outlines or drop shadows.

Map color coding in the match list (blue = AmbroseValley, amber = GrandRift, red = Lockdown) is carried through to the dot on each row, giving instant spatial context before a match is opened.

### Information Hierarchy
The canvas occupies the largest area because it is the primary output. Supporting information is layered by proximity:
- **Inside the canvas**: player counter (top-right), match badge (top-left), zoom controls (bottom-left), opacity slider (bottom-right) — all overlaid at low opacity so they don't obscure events
- **Below the canvas**: Legend (always visible) and Timeline (replay mode only)
- **Sidebar**: filters and match selection — secondary, navigational

Tooltips appear on hover only, avoiding clutter while still exposing raw event data (type, bot/human, timestamp, UID prefix) for anyone who needs it.

### Heatmap Rendering
Heatmap cells are drawn as Gaussian radial gradients rather than flat rectangles. This choice was deliberate: the underlying grid is 16 px per cell, which would produce a blocky, pixelated result at 820 px canvas size. The gradient blending smooths cell boundaries into a continuous density surface that reads as a natural heat field, not a histogram.

The color ramp goes black → purple → red → orange → yellow (viridis-adjacent), which is perceptually ordered and readable by people with red-green color blindness.

### Storm Visualization
Storm direction is inferred per-match from the centroid of `KilledByStorm` positions: if most deaths are on the east side, the storm is coming from the east. The storm arc starts at 85% of match duration (validated from data: all 39 storm deaths occur in the final 15% of their respective matches) and grows to cover 70% of the map radius by match end. This matches the observed data rather than using a fixed game-rule assumption.

## Major Tradeoffs

| Decision | Chose | Over | Tradeoff |
|----------|-------|------|----------|
| Static preprocessing | Pre-computed JSON committed to repo | Live FastAPI backend reading parquet | Loses real-time data updates; gains zero hosting cost, no server cold starts, works offline |
| Per-match lazy loading | Fetch one match on demand | Bundle all matches into one file | 10 KB per fetch vs 7.9 MB upfront; tiny latency per selection, fast initial load |
| Per-day heatmap files | 89 separate JSON files fetched on demand | One large file with all days embedded | Each file is ~5 KB; filtering by day costs one fetch, not a large parse |
| Client-side match heatmap | Bin already-loaded match events in browser | Pre-generate 796×5 = 3,980 extra JSON files | Saves ~40 MB of static assets; binning 1,200 events is instant in JS |
| Canvas over SVG | `<canvas>` for all drawing | SVG elements per event | SVG DOM degrades past ~500 nodes; Canvas handles 1,200 events at 60fps smoothly |
| CSS zoom transform | `scale()` + `translate()` on a wrapper div | Re-rendering canvas at higher resolution | Zero re-render cost; zoom is instantaneous; canvas pixel coords stay stable |
| Gaussian blobs over grid squares | Radial gradient per cell | Filled rect per bin | Visually smooth heatmap at the cost of slightly more canvas fill operations; imperceptible at 64×64 grid |
| No charting library | Custom canvas drawing | deck.gl / heatmap.js | Saves ~400 KB of dependencies; full control over visual style |
| Pixel coords pre-computed | Python bakes `px`, `py` into JSON | Browser computes from world coords | JSON is ~15% larger but frontend has zero coordinate math |
