"""
process_data.py — LILA Player Journey Visualization Tool
Preprocessing script: reads all parquet files and outputs clean JSON for the frontend.

Run from the lila-viz/ directory:
    python process_data.py --input ../player_data_extracted/player_data --output public/data

Outputs:
    public/data/index.json              — metadata for all 796 matches
    public/data/matches/{match_id}.json — per-match event data (796 files)
    public/data/heatmaps/{map}_{type}.json — pre-binned heatmap grids
"""

import os
import re
import json
import math
import argparse
import pyarrow.parquet as pq
import pandas as pd
from collections import defaultdict

# ---------------------------------------------------------------------------
# Map configuration — from README, validated against actual data
# ---------------------------------------------------------------------------
MAP_CONFIG = {
    "AmbroseValley": {"scale": 900,  "ox": -370.0, "oz": -473.0},
    "GrandRift":     {"scale": 581,  "ox": -290.0, "oz": -290.0},
    "Lockdown":      {"scale": 1000, "ox": -500.0, "oz": -500.0},
}

IMAGE_SIZE = 1024  # minimap images are 1024x1024


# ---------------------------------------------------------------------------
# Coordinate conversion
# ---------------------------------------------------------------------------
def world_to_pixel(x: float, z: float, map_id: str) -> tuple[float, float]:
    """Convert world (x, z) to pixel coords on the 1024x1024 minimap image."""
    cfg = MAP_CONFIG[map_id]
    u = (x - cfg["ox"]) / cfg["scale"]
    v = (z - cfg["oz"]) / cfg["scale"]
    px = u * IMAGE_SIZE
    py = (1.0 - v) * IMAGE_SIZE  # Y-axis is flipped (image origin top-left)
    return round(px, 2), round(py, 2)


# ---------------------------------------------------------------------------
# Bot detection
# ---------------------------------------------------------------------------
def is_bot(user_id: str) -> bool:
    """Numeric user_id = bot, UUID = human player."""
    return bool(re.match(r"^\d+$", user_id))


# ---------------------------------------------------------------------------
# Timestamp fix
# ---------------------------------------------------------------------------
# IMPORTANT: The ts column is typed datetime64[ms] in parquet but the raw
# int64 values are actually Unix timestamps in SECONDS (not ms).
# Pandas reads them as ~1970-01-21 which is wrong.
# Treating them as seconds gives Feb 2026 — correct.
# We extract int64 and use as epoch seconds for all relative time math.
def ts_to_seconds(ts_series: pd.Series) -> pd.Series:
    """Extract the raw int64 value which represents Unix seconds."""
    return ts_series.astype("int64")


# ---------------------------------------------------------------------------
# Heatmap binning
# ---------------------------------------------------------------------------
HEATMAP_CELL_SIZE = 16  # pixels per bin cell (64x64 grid over 1024px image)

# Event groups for heatmap layers
HEATMAP_GROUPS = {
    "kills":   ["Kill", "BotKill"],
    "deaths":  ["Killed", "BotKilled"],
    "storm":   ["KilledByStorm"],
    "loot":    ["Loot"],
    "traffic": ["Position", "BotPosition"],
}


def bin_to_heatmap(px: float, py: float) -> str:
    bx = int(px // HEATMAP_CELL_SIZE)
    by = int(py // HEATMAP_CELL_SIZE)
    return f"{bx},{by}"


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------
def load_all_files(data_root: str) -> pd.DataFrame:
    """Read every parquet file across all day folders into a single DataFrame."""
    day_dirs = sorted([
        d for d in os.listdir(data_root)
        if os.path.isdir(os.path.join(data_root, d)) and d.startswith("February")
    ])

    frames = []
    total = 0
    for day in day_dirs:
        day_path = os.path.join(data_root, day)
        files = [f for f in os.listdir(day_path) if not f.startswith(".")]
        for fname in files:
            fpath = os.path.join(day_path, fname)
            try:
                df = pq.read_table(fpath).to_pandas()
                df["day"] = day
                df["filename"] = fname
                frames.append(df)
                total += 1
            except Exception as e:
                print(f"  [WARN] Could not read {fpath}: {e}")

        print(f"  Loaded {day}: {len(files)} files")

    print(f"\nTotal files loaded: {total}")
    full = pd.concat(frames, ignore_index=True)
    return full


def clean(full: pd.DataFrame) -> pd.DataFrame:
    """Apply all fixes: decode events, fix timestamps, add derived columns."""
    # Decode event bytes → string
    full["event"] = full["event"].apply(
        lambda x: x.decode("utf-8") if isinstance(x, bytes) else str(x)
    )

    # Bot detection
    full["is_bot"] = full["user_id"].apply(is_bot)

    # Timestamp: raw int64 = Unix seconds (not ms as the type suggests)
    full["ts_s"] = ts_to_seconds(full["ts"])

    # Strip .nakama-0 suffix from match_id for cleaner keys
    full["match_id_clean"] = full["match_id"].str.replace(r"\.nakama-0$", "", regex=True)

    return full


def build_index(full: pd.DataFrame) -> list[dict]:
    """Build the match index — one entry per match with metadata."""
    # Per-match aggregation
    def match_meta(group):
        ts = group["ts_s"]
        duration = int(ts.max() - ts.min())
        humans = int((~group["is_bot"]).sum() > 0)  # has any human events
        n_humans = int(group.loc[~group["is_bot"], "user_id"].nunique())
        n_bots = int(group.loc[group["is_bot"], "user_id"].nunique())
        event_counts = group["event"].value_counts().to_dict()
        return {
            "match_id": group["match_id_clean"].iloc[0],
            "map_id": group["map_id"].iloc[0],
            "day": group["day"].iloc[0],
            "duration_s": duration,
            "n_humans": n_humans,
            "n_bots": n_bots,
            "n_events": len(group),
            "events": event_counts,
            "ts_start": int(ts.min()),
        }

    index = []
    for mid, group in full.groupby("match_id_clean"):
        index.append(match_meta(group))

    # Sort by date then match start
    index.sort(key=lambda m: (m["day"], m["ts_start"]))
    return index


def build_match_files(full: pd.DataFrame, out_dir: str):
    """Write one JSON file per match containing all events with pixel coords."""
    os.makedirs(out_dir, exist_ok=True)

    written = 0
    for mid, group in full.groupby("match_id_clean"):
        map_id = group["map_id"].iloc[0]
        ts_min = int(group["ts_s"].min())

        events = []
        for _, row in group.sort_values("ts_s").iterrows():
            px, py = world_to_pixel(float(row["x"]), float(row["z"]), map_id)
            events.append({
                "uid": row["user_id"],
                "bot": int(row["is_bot"]),
                "px": px,
                "py": py,
                "t": int(row["ts_s"]) - ts_min,   # seconds relative to match start
                "e": row["event"],
            })

        out_path = os.path.join(out_dir, f"{mid}.json")
        with open(out_path, "w") as f:
            json.dump(events, f, separators=(",", ":"))  # compact JSON
        written += 1

    print(f"  Wrote {written} match files to {out_dir}/")


def _write_heatmap(events_df, map_id: str, group_name: str, out_dir: str, fname: str, day: str = "all"):
    """Bin and write a single heatmap JSON file."""
    if events_df.empty:
        return False
    grid: dict[str, int] = defaultdict(int)
    for _, row in events_df.iterrows():
        px, py = world_to_pixel(float(row["x"]), float(row["z"]), map_id)
        grid[bin_to_heatmap(px, py)] += 1

    max_val = max(grid.values()) if grid else 1
    payload = {
        "map_id": map_id,
        "group": group_name,
        "day": day,
        "cell_size": HEATMAP_CELL_SIZE,
        "image_size": IMAGE_SIZE,
        "max_val": max_val,
        "total_events": int(len(events_df)),
        "cells": dict(grid),
    }
    with open(os.path.join(out_dir, fname), "w") as f:
        json.dump(payload, f, separators=(",", ":"))
    return True


def build_heatmaps(full: pd.DataFrame, out_dir: str):
    """Write pre-binned heatmap JSON files per map per event group.

    Generates two sets:
      {map}_{group}.json           — all days combined (for "no date filter" view)
      {map}_{day}_{group}.json     — per-day slice (for filtered view)
    """
    os.makedirs(out_dir, exist_ok=True)

    days = sorted(full["day"].unique())
    written = 0

    for map_id in MAP_CONFIG:
        sub = full[full["map_id"] == map_id]

        for group_name, event_types in HEATMAP_GROUPS.items():
            # All-days aggregate (existing behaviour)
            all_events = sub[sub["event"].isin(event_types)]
            if _write_heatmap(all_events, map_id, group_name, out_dir,
                              f"{map_id}_{group_name}.json", day="all"):
                written += 1

            # Per-day slices
            for day in days:
                day_events = sub[(sub["day"] == day) & sub["event"].isin(event_types)]
                fname = f"{map_id}_{day}_{group_name}.json"
                if _write_heatmap(day_events, map_id, group_name, out_dir, fname, day=day):
                    written += 1

    print(f"  Wrote {written} heatmap files to {out_dir}/")


def validate_output(index: list[dict], match_out: str, heatmap_out: str):
    """Quick sanity checks on the output."""
    print("\n=== VALIDATION ===")
    print(f"  Matches in index: {len(index)}")

    # Check a few match files exist and are non-empty
    sample = index[:3] + index[-3:]
    for m in sample:
        path = os.path.join(match_out, f"{m['match_id']}.json")
        if os.path.exists(path):
            size = os.path.getsize(path)
            print(f"  [{m['map_id']}] {m['match_id'][:16]}... — {size} bytes, {m['n_events']} events, {m['duration_s']}s")
        else:
            print(f"  [MISSING] {m['match_id']}")

    # Check heatmap files
    hmap_files = os.listdir(heatmap_out) if os.path.exists(heatmap_out) else []
    print(f"  Heatmap files: {len(hmap_files)} — {sorted(hmap_files)}")

    # Per-map event totals
    print("\n  Event totals from index:")
    from collections import Counter
    totals = Counter()
    per_map = defaultdict(Counter)
    for m in index:
        for evt, cnt in m.get("events", {}).items():
            totals[evt] += cnt
            per_map[m["map_id"]][evt] += cnt
    for evt, cnt in sorted(totals.items(), key=lambda x: -x[1]):
        print(f"    {evt}: {cnt:,}")

    # Map breakdown
    print("\n  Matches per map:")
    map_counts = Counter(m["map_id"] for m in index)
    for map_id, cnt in map_counts.most_common():
        print(f"    {map_id}: {cnt}")

    # Duration stats
    durations = [m["duration_s"] for m in index if m["duration_s"] > 0]
    if durations:
        print(f"\n  Match duration — min: {min(durations)}s, max: {max(durations)}s, avg: {sum(durations)/len(durations):.0f}s")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="LILA player data preprocessor")
    parser.add_argument(
        "--input",
        default="../player_data_extracted/player_data",
        help="Path to the player_data folder (containing February_* subdirs)",
    )
    parser.add_argument(
        "--output",
        default="public/data",
        help="Output directory for JSON files",
    )
    args = parser.parse_args()

    data_root = os.path.abspath(args.input)
    out_root  = os.path.abspath(args.output)
    match_out  = os.path.join(out_root, "matches")
    heatmap_out = os.path.join(out_root, "heatmaps")

    print(f"Input:  {data_root}")
    print(f"Output: {out_root}\n")

    # 1. Load all parquet files
    print("=== LOADING FILES ===")
    full = load_all_files(data_root)
    print(f"Total rows: {len(full):,}\n")

    # 2. Clean + enrich
    print("=== CLEANING DATA ===")
    full = clean(full)
    print(f"  Events decoded, timestamps fixed, bot flags set.\n")

    # 3. Build match index
    print("=== BUILDING INDEX ===")
    index = build_index(full)
    os.makedirs(out_root, exist_ok=True)
    with open(os.path.join(out_root, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    print(f"  index.json written — {len(index)} matches ({os.path.getsize(os.path.join(out_root,'index.json'))//1024} KB)\n")

    # 4. Build per-match JSON files
    print("=== BUILDING MATCH FILES ===")
    build_match_files(full, match_out)
    print()

    # 5. Build heatmap files
    print("=== BUILDING HEATMAPS ===")
    build_heatmaps(full, heatmap_out)
    print()

    # 6. Validate
    validate_output(index, match_out, heatmap_out)
    print("\nDone.")


if __name__ == "__main__":
    main()
