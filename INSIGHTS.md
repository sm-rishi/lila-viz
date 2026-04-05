# Insights — What the Data Reveals About LILA BLACK

Three findings surfaced while using the visualization tool, each with concrete numbers and actionable implications for level design.

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
