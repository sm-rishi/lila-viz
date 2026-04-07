# Insights — What the Data Reveals About LILA BLACK

Six findings surfaced while using the visualization tool, each with concrete numbers and actionable implications for level design.

---

## Insight 1: This Game Plays Like PvE, Not PvP

**What caught my eye:**
In the heatmap's Kill Zones layer, the "kills" are almost entirely bot kills. Switching to the replay view and playing through matches on AmbroseValley confirmed it — I watched dozens of matches without seeing a single human-on-human combat encounter.

**The numbers:**
- `Kill` events (human kills human): **3 total** across 796 matches and 5 days
- `BotKill` events (human kills bot): **2,415** across the same dataset
- Ratio: **1 PvP kill per 805 bot kills**
- Only **36 out of 796 matches** (4.5%) had both a human and bot co-present in the dataset at all

**What this means for level design:**
The maps are currently functioning as PvE arenas, not extraction shooter battlegrounds. Players never encounter each other — either because match lobbies are heavily bot-padded, player counts are too low, or map routing keeps players separated.

**Actionable items:**
- *Routing:* Create deliberate funnel points — bridges, narrow corridors, single chokepoint extractions — that force human players into the same space. The current maps (especially AmbroseValley) have enough open space that players can complete full runs without crossing paths.
- *Lobby density:* Track human-per-lobby ratio as a core metric. If matches average 1 human player (which this data suggests), PvP encounter rate will be near zero regardless of map design.
- **Metrics to watch:** PvP kill rate per match, average distance between human players at match midpoint, extraction zone contest rate.

**Why level designers should care:**
An extraction shooter's core tension is the risk-reward of fighting other players for loot. If PvP never happens, the game reduces to a loot-and-escape simulator. Level designers can directly influence encounter probability through chokepoint placement, extraction zone design, and high-value loot clustering — but only if they know the current baseline is essentially zero.

---

## Insight 2: The Center of Every Map is Overloaded — Edges Are Dead

**What caught my eye:**
Loading the AmbroseValley kill zones heatmap showed an immediate, striking pattern: a hot red cluster in the center-to-center-east zone, fading to near-zero at all four edges. The same held for GrandRift and Lockdown.

**The numbers (AmbroseValley kill/death events, bucketed into 5×5 grid):**

| Zone | Kill + Death Events |
|------|-------------------|
| Center (C, M) | **523** |
| Center-East (CE, M) | **387** |
| Center-West (CW, M) | **241** |
| All edge zones combined (N, S, E, W perimeter) | **< 120** |

Center and center-adjacent zones account for **~80% of all combat** on AmbroseValley. The western and northern edges are nearly empty.

Traffic heatmap reinforces this — the position density blob covers roughly the inner 40% of the map's area, with the outer 60% showing sparse movement.

**What this means for level design:**
The map has strong gravitational pull toward its center, but the edges offer no incentive to visit. Players chart the most efficient loot-then-extract path, which doesn't require leaving the center. Edge POIs (points of interest) are being ignored.

**Actionable items:**
- *High-value loot placement:* Move 1–2 top-tier loot spawns to underutilized edge zones (northwest and southeast quadrants on AmbroseValley). Players will route toward value.
- *Storm pathing:* The storm's one-directional sweep could be adjusted to push players *through* edge zones rather than toward the center, forcing exploration.
- *Edge extraction points:* If all extraction zones cluster centrally, players have no reason to visit edges. Adding edge extractions (with higher reward or shorter timers) distributes traffic.
- **Metrics to watch:** Zone visit rate per match, loot pickup distribution by map quadrant, storm death location clustering.

**Why level designers should care:**
40% of map real estate is effectively invisible to players. That's wasted design work — environmental storytelling, set pieces, and gameplay moments that no one sees. Redistributing traffic also reduces server-side physics/collision load concentration and improves match variety across sessions.

---

## Insight 3: Players Loot 4× More Than They Fight — and Die to the Storm Trying

**What caught my eye:**
The loot density heatmap on AmbroseValley showed a much wider, more evenly spread pattern than kill zones — players are looting across the whole center zone, not just at one chokepoint. Then I noticed the storm death locations in the replay view: they're scattered across the map, not at the storm boundary edge I'd expect. Players are dying *deep inside the map* to the storm.

**The numbers:**
- `Loot` events: **12,885** across all matches
- `BotKill` + `Kill` events: **2,418** total
- **Loot-to-combat ratio: 5.3:1** — players loot 5× more than they fight
- `KilledByStorm` events: **39** — all human players, zero bots
- Storm deaths by map: AmbroseValley (17), Lockdown (17), GrandRift (5)
- Several storm deaths occur at coordinates that are NOT near map edges — suggesting players are caught mid-loot, deep in the map, when the storm closes

**What this means for level design:**
Players are prioritizing loot acquisition so heavily that they're losing track of the storm timer. The storm is catching them in the interior, not at the boundary — meaning they aren't reading the storm's approach until it's too late. This is a readability problem, not a skill problem.

**Actionable items:**
- *Storm visual/audio cues:* Add map-edge visual indicators (ambient color shift, directional audio) that communicate storm proximity while players are focused on looting. Players in loot animation shouldn't need to watch the minimap to survive.
- *Loot density near extraction:* Cluster mid-tier loot closer to extraction zones so the "loot-then-extract" path has less distance to cover. This reduces the time players spend deep in the map as the storm closes.
- *Storm speed tuning:* If 39/796 matches (4.9%) end in storm death, that's a meaningful frustration rate. The storm may be moving faster than players' mental model expects — consider whether the final storm phase speed needs adjustment.
- **Metrics to watch:** Average distance from storm boundary at time of storm death, loot events per minute in final 60 seconds of match, extraction attempt rate vs. storm death rate.

**Why level designers should care:**
Storm deaths are the most frustrating outcome in an extraction shooter — the player did everything right (found loot, avoided enemies) and still died to an environmental system. Each storm death is a session that ends on a negative note. Reducing storm deaths by 30% through better cue design and loot placement directly improves the end-of-match sentiment that players carry into their next session.

---

## Insight 4: Match Counts Are Falling ~30% Per Day — A Retention Crisis Visible in the Heatmaps

**How it was found:**
Using the **Compare mode** with day selectors set to Feb 10 (A) and Feb 13 (B), then toggling Δ Diff, the right canvas is noticeably less dense across every layer. Blue cells (more activity in A) dominate. Switching to the Traffic layer makes the drop starkest — Feb 10 has significantly more position events than Feb 13.

**The numbers:**

| Day | Matches | Change vs prior day |
|-----|---------|---------------------|
| Feb 10 | 285 | — |
| Feb 11 | 200 | −30% |
| Feb 12 | 162 | −19% |
| Feb 13 | 112 | −31% |
| Feb 14 | 37 | partial day |

The Feb 10→13 decline averages **−27% per day** and is consistent — this is not noise. Even projecting Feb 14 forward as a half-day gives ~74 matches, still well below Feb 13's 112.

**What this means for level design:**
A 61% drop in match count over four complete days (285 → 112) within a single data window is a serious early-retention signal. Players who try the game are not returning for second sessions — or are playing fewer matches per session. The maps are likely a contributing factor: if a first match ends in a quick bot-farm loop with no memorable PvP moment, no meaningful routing decision, and a possible storm death mid-loot (see Insights 1 and 3), there is little reason to queue again.

**Actionable items:**
- *First-session audit:* Does a new player's first match on AmbroseValley give them at least one meaningful moment — a loot run, a bot fight, a close extraction? If not, the match-count decline will continue.
- *Route variety:* All three prior insights point to a repetitive loop (loot center → die or extract). Rotating high-value loot zones or varying storm direction more aggressively could extend per-player match counts by preventing the loop from feeling solved.
- *Day-over-day tracking via Compare mode:* The tool's Compare feature is directly useful for ongoing monitoring — set A to last week, B to this week, and check whether the Δ Diff overlay is trending red (growth) or blue (decline).
- **Metrics to watch:** Day-1 match count per new player cohort, average matches per player per day, D1/D3/D7 return rate.

**Why level designers should care:**
Match count is a direct proxy for map health. A map that creates memorable, varied moments generates repeat play. The day-over-day decline is a quantified signal that the current loop exhausts players quickly — a problem level designers can directly address through routing, loot placement, and encounter design.

---

## Insight 5: GrandRift Is Barely Played — But Players Who Do Stay Longer

**How it was found:**
The **map-filter** in the match list and the **heatmap map-switcher** make the disparity immediately visible. GrandRift's heatmap canvas is noticeably sparser than AmbroseValley's — fewer hot cells, lower peak intensity — despite representing the same event types. The match count confirms it: 59 matches on GrandRift vs 566 on AmbroseValley over the same 5 days.

**The numbers:**

| Map | Matches | Median duration | Loot events | Loot-to-combat ratio |
|-----|---------|-----------------|-------------|----------------------|
| AmbroseValley | 566 | 362s | 9,955 | 4.4:1 |
| Lockdown | 171 | 448s | 2,050 | 3.5:1 |
| GrandRift | 59 | 422s | 880 | 3.7:1 |

GrandRift has **10× fewer matches** than AmbroseValley yet players who do reach it survive **60 seconds longer** (median 422s vs 362s). They also face a slightly lower loot-to-combat ratio, suggesting the loop feels less rewarding per encounter.

**What this means for level design:**
GrandRift is not a design failure from the inside — longer survival suggests the pacing is actually better. The problem is that almost nobody is choosing it. This points to a matchmaking or lobby surfacing problem rather than a map design problem. Players who happen to play GrandRift have a calmer, longer session, but the map is caught in a negative feedback loop: fewer players → less familiarity → fewer players choosing it next time.

**Actionable items:**
- *Matchmaking exposure:* Temporarily up-weight GrandRift in the match queue to break the discovery cycle. A forced exposure campaign (e.g., daily challenge on GrandRift) would generate meaningful comparison data.
- *Loot density audit:* Use the **POI zone tool** to draw equivalent zones on AmbroseValley and GrandRift and compare kill/loot counts. If GrandRift's loot density per playable area is lower, targeted spawn boosts in under-visited zones would raise the perceived reward.
- *Leverage longer survival:* GrandRift's longer match duration is an asset — it means players have time for more encounters and decisions. Lean into it with higher-tier loot or more complex extraction routing to reward the players who are already enjoying it.
- **Metrics to watch:** Map selection rate at queue, first-match-on-map retention, loot-per-minute by map.

**Why level designers should care:**
A map that sits at 10% of another map's play volume is effectively wasted content investment. The data suggests the gameplay experience inside GrandRift is not the problem — discovery and perceived reward are. Those are solvable without a map redesign.

---

## Insight 6: 75% of Combat Cells Overlap With Loot Cells — Bots Are Guarding the Loot, Not Patrolling Independently

**How it was found:**
Using the **Grid Metrics overlay** in heatmap mode on AmbroseValley, hovering cells in high-kill-density areas consistently shows non-zero loot counts in the same cells. Switching the heatmap layer between Kill Zones and Loot Density, the hot regions are nearly identical. A cell-level analysis of all grid cells confirmed the overlap precisely.

**The numbers (AmbroseValley, all-time aggregate):**
- Grid cells with kill events: **488**
- Grid cells with loot events: **569**
- Cells containing **both** kills and loot: **364 (75% of all kill cells)**
- Loot-only cells (no combat): **205** — free loot pockets with no bot presence
- Kill-only cells (no nearby loot): **124** — pure bot patrol or transit deaths

**What this means for level design:**
Bots are not patrolling the map as independent threats — they are clustering at loot points. The practical effect is a predictable **"clear the room, take the loot"** mechanic: arrive at a loot zone, kill the bots guarding it, collect the items, move on. The 205 loot-only cells represent free loot with no resistance at all — pockets that completely undercut any sense of risk-reward.

This also reframes Insight 1 (barely any PvP): if bots already occupy every contested loot zone, a second human player arriving has nothing left to fight over. The bots are dead, the loot is gone, and there's no reason to engage.

**Actionable items:**
- *Decouple bot placement from loot:* Move a portion of bot spawn points onto patrol routes between loot zones rather than directly on top of them. Danger on the path TO loot creates tension without removing the reward.
- *Create unguarded high-value drops:* A small number of high-tier loot crates with no bot spawns nearby would force human players to consciously decide whether to race for them — the first genuine PvP risk-reward moment the data shows is currently missing.
- *Audit the 124 kill-only cells with the POI tool:* Draw a zone over these areas on the heatmap and check their traffic counts. If bots are dying in high-traffic transit corridors with no loot, they are creating frustration deaths (interrupting movement) rather than meaningful encounters.
- **Metrics to watch:** Bot kills per loot pickup (how many bots does a player clear per item collected?), time-to-first-loot for new players, proportion of loot cells contested by more than one player within a 30-second window.

**Why level designers should care:**
Bot placement is level design. Where bots live determines where players feel danger, where they feel safe, and whether they ever run into each other. Right now, bot-loot co-location creates a repeatable clear-and-collect loop with no variance. Decoupling the two systems — bots as environmental threats, loot as environmental rewards — would introduce the spatial tension that makes extraction shooters compelling beyond the first few sessions.
