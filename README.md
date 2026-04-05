# LILA BLACK — Player Journey Visualization Tool

A browser-based tool for LILA Games' Level Design team to explore player behavior across maps in LILA BLACK, an extraction shooter. Built as part of the APM Written Test assignment.

**Live tool:** https://lila-viz-six.vercel.app

---

## What It Does

**Replay Mode**
- Select any of 796 matches (Feb 10–14, 2026) from the sidebar
- Watch the match unfold on the minimap with animated player paths
- Human paths are solid colored lines; bot paths are dashed gray
- Event markers appear at the right timestamp: ⚔ kills, 💀 deaths, ★ loot, ⚡ storm deaths
- Scrub the timeline or play at 1×, 2×, 4×, 8× speed
- Hover any marker for a tooltip (event type, player type, timestamp)
- Toggle individual layers on/off (human paths, bot paths, kills, deaths, loot, storm)

**Heatmap Mode**
- Aggregate view across all matches on a selected map
- Five layers: Kill Zones, Death Zones, Loot Density, Storm Deaths, Traffic
- Gaussian blob rendering with adjustable opacity
- Switch maps via the sidebar

**Filters**
- Filter match list by map (Ambrose Valley / Grand Rift / Lockdown) and date (Feb 10–14)
- Search matches by ID

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Preprocessing | Python 3.11, PyArrow, pandas |
| Frontend | React 18, Vite 8 |
| Rendering | HTML5 Canvas API |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel |

---

## Running Locally

**Prerequisites:** Node.js 18+, Python 3.11+

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
# Install Python dependencies
pip install pyarrow pandas

# Place the player_data folder (with February_* subdirs) adjacent to lila-viz/
# Then run:
python process_data.py --input ../player_data --output public/data
```

Output goes to `public/data/` — commit and push to update the deployed tool.

**No environment variables required.** The tool is fully static.

---

## Project Structure

```
lila-viz/
├── process_data.py           # Preprocessing: parquet → JSON
├── public/
│   ├── minimaps/             # 3 minimap images (1024×1024)
│   └── data/
│       ├── index.json        # All 796 match metadata (175 KB)
│       ├── matches/          # 796 per-match event files (avg 10 KB)
│       └── heatmaps/         # 15 pre-binned heatmap grids (64 KB total)
├── src/
│   ├── App.jsx               # Root layout and state
│   ├── components/
│   │   ├── MapView.jsx       # Canvas orchestration + tooltip + playback logic
│   │   ├── ReplayCanvas.jsx  # Draws paths and event markers
│   │   ├── HeatmapCanvas.jsx # Draws gaussian heatmap overlay
│   │   ├── Timeline.jsx      # Scrubber + play/pause + speed controls
│   │   ├── MatchList.jsx     # Grouped, searchable match browser
│   │   ├── Filters.jsx       # Map/date/layer filter controls
│   │   └── Legend.jsx        # Contextual legend (replay vs heatmap)
│   ├── hooks/
│   │   ├── useIndex.js       # Loads index.json
│   │   ├── useMatchData.js   # Fetches per-match JSON
│   │   └── useHeatmap.js     # Fetches heatmap JSON
│   └── utils/
│       ├── mapConfig.js      # Map parameters, coordinate scaling
│       ├── eventConfig.js    # Event type colors, symbols, filter keys
│       └── format.js         # Time formatting, grouping helpers
├── ARCHITECTURE.md           # System design and decisions
└── INSIGHTS.md               # Three data insights for level designers
```

---

## Key Data Notes

- **1,243 parquet files** across 5 days, 89,104 total event rows
- **Timestamp nuance:** `ts` column stores Unix seconds (not ms) despite `datetime64[ms]` type — handled in `process_data.py`
- **Bot detection:** numeric `user_id` = bot, UUID = human player
- **Coordinate system:** world `(x, z)` → minimap pixel via `u = (x − origin) / scale`, Y-axis flipped
- **February 14** is a partial day (data collection was ongoing)
