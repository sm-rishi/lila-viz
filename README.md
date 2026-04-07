# LILA BLACK — Player Journey Visualization Tool

A browser-based tool for LILA Games' Level Design team to explore player behavior across maps in LILA BLACK, an extraction shooter. Built as part of the APM Written Test assignment.

**Live tool:** https://lila-viz-six.vercel.app  
**GitHub:** https://github.com/sm-rishi/lila-viz

---

## What It Does

### Replay Mode
- Select any of 796 matches (Feb 10–14, 2026) from the sidebar
- Watch the match unfold on the minimap with animated player paths
- Human paths are solid colored lines (unique color per player); bot paths are dashed gray
- Event markers appear at the right timestamp: ⚔ kills, 💀 deaths, ★ loot, ⚡ storm deaths
- Scrub the timeline or play at 1×, 2×, 4×, 8× speed
- Hover any marker for a tooltip (event type, player type, timestamp, UID)
- Toggle individual layers on/off (human paths, bot paths, kills, deaths, loot, storm)
- Live **player alive counter** (humans and bots tracked separately)
- **Storm overlay** with shrinking safe-zone circle; player dots ring green/amber/red by proximity
- **Zoom** (scroll wheel or +/− buttons, up to 5×) and **drag-to-pan** when zoomed

### Heatmap Mode
- Aggregate view across all matches on a selected map
- Five layers: Kill Zones, Death Zones, Loot Density, Storm Deaths, Traffic
- Gaussian blob rendering with adjustable opacity
- Filter by date: per-day heatmaps (89 pre-built JSON files) update on day change
- Filter by match: paste any match ID to see a single-match heatmap (computed client-side)
- **Grid overlay** (⊞ Grid): draws a 16-px cell grid; hover any cell to see exact event counts for all 5 layers
- **POI Zones**: draw circle or rectangle zones on the map; metrics panel shows kills/deaths/loot/traffic/storm counts per zone

### Compare Mode
- Side-by-side heatmaps for the same map across two date selections
- **Δ Diff toggle**: highlights cells where player activity increased (red) or decreased (blue) between the two periods

### Filters
- Filter match list by map (Ambrose Valley / Grand Rift / Lockdown) and date (Feb 10–14)
- Search matches by ID; hover-revealed copy button on each row

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Preprocessing | Python 3.11, PyArrow, pandas |
| Frontend | React 18, Vite 8 |
| Rendering | HTML5 Canvas API |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel (static, free tier) |

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/sm-rishi/lila-viz
cd lila-viz
npm install
npm run dev
```

Open http://localhost:5173 — the pre-processed data in `public/data/` is already committed, so the tool works immediately without re-running the preprocessor.

---

## Re-running the Preprocessor

If you want to regenerate the JSON from the raw parquet files:

```bash
pip install pyarrow pandas

# Place the player_data folder (with February_* subdirs) adjacent to lila-viz/
python process_data.py --input ../player_data --output public/data
```

**No environment variables required.** The tool is fully static.

---

## Project Structure

```
lila-viz/
├── process_data.py           # Preprocessing: parquet → JSON (runs once locally)
├── public/
│   ├── minimaps/             # 3 minimap images (1024×1024 px)
│   └── data/
│       ├── index.json        # 796 match metadata records (175 KB)
│       ├── matches/          # 796 per-match event files (avg 10 KB each)
│       └── heatmaps/         # 89 pre-binned heatmap grids
│           ├── {map}_{layer}.json          # all-time aggregate (15 files)
│           └── {map}_{day}_{layer}.json    # per-day slices (74 files)
├── src/
│   ├── App.jsx               # Root layout, mode routing, filter state
│   ├── components/
│   │   ├── MapView.jsx       # Canvas orchestration, zoom/pan, tooltips, POI drawing
│   │   ├── ReplayCanvas.jsx  # Draws paths, event markers, storm safe-zone
│   │   ├── HeatmapCanvas.jsx # Gaussian heatmap, grid overlay, diff rendering
│   │   ├── POIOverlay.jsx    # SVG zone overlay + metrics panel
│   │   ├── Timeline.jsx      # Scrubber, play/pause, speed controls
│   │   ├── MatchList.jsx     # Grouped, searchable match browser + copy button
│   │   ├── Filters.jsx       # Map/date/mode/layer filter controls
│   │   └── Legend.jsx        # Contextual legend (replay vs heatmap)
│   ├── hooks/
│   │   ├── useIndex.js       # Loads index.json on startup
│   │   ├── useMatchData.js   # Fetches per-match event JSON
│   │   ├── useHeatmap.js     # Fetches single-layer heatmap JSON
│   │   ├── useMatchHeatmap.js# Computes heatmap client-side from match events
│   │   └── useAllHeatmaps.js # Fetches all 5 layers in parallel (POI + grid metrics)
│   └── utils/
│       ├── mapConfig.js      # Map parameters, coordinate scaling, day labels
│       ├── eventConfig.js    # Event type colors, symbols, filter keys, layer defs
│       └── format.js         # Time formatting helper
├── ARCHITECTURE.md           # System design, data pipeline, design decisions
└── INSIGHTS.md               # Three data insights for level designers
```

---

## Key Data Notes

- **1,243 parquet files** across 5 days, 89,104 total event rows
- **Timestamp nuance:** `ts` column stores Unix timestamps in **seconds** (not ms) despite `datetime64[ms]` parquet type — all handling is in `process_data.py`
- **Bot detection:** numeric `user_id` = bot, UUID format = human player
- **Coordinate system:** world `(x, z)` → minimap pixel via `u = (x − origin) / scale`, Y-axis flipped (see ARCHITECTURE.md for per-map parameters)
- **February 14** is a partial day; treated identically to complete days
- **Human-on-human PvP kills:** only 3 across all 796 matches — see INSIGHTS.md Insight 1
