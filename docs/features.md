# Features

## Map Management (`/maps`)

### Map Library
- List all saved maps (name, grid size, created date)
- Create new map via dialog: name + grid width (4–12) + grid height (4–12)
- Delete map
- Navigate to map detail

### Map Generation (automatic on create)

Two creation modes:

- **Empty map** — blank grid with no paths or special cells; GM draws everything manually
- **Generated map** — algorithm creates paths, branches, and special cells from parameters

Five generation parameters (each 0–100) control generated output:

| Param | Effect |
|-------|--------|
| **Density** | Branch count (2–8) and branch depth (2–5). Low = sparse linear. High = dense tangled. |
| **Chaos** | Goal-bias weight (5→1) and diagonal moves. `< 40` = cardinal only. `40–100` = diagonal paths unlock proportionally. |
| **One-Way Roads** | Probability each undirected edge becomes one-directional. `0` = all bidirectional. `100` = mostly one-way. Jail cells always remain inward-only regardless. |
| **Portals** | Non-adjacent wormhole connections. `0` = none. `100` = ~30% of path cells get a portal. Portals are always bidirectional. |
| **Special Cells** | Type toggles (shop/trap/boss/loot/chance/jail) select which types appear. Rate slider (0–100) controls probability. |
| **Connectivity** | Extra cross-edges between existing path cells (shortcuts). `0` = none, `100` = ~40% extra edges. |

**Generation templates** — save the current parameter set as a named template; load a template to restore all sliders at once. Templates stored server-side, persist across sessions.

Algorithm:
1. All cells initialized as `plain`
2. `start` at (r0c0), `end` at bottom-right
3. Random walk start → end; goal-bias weight + diagonal availability driven by Chaos
4. Branch paths seeded from main path; count/depth driven by Density
5. Connectivity extra edges randomly added between neighboring path cells
6. Special cells assigned by rate probability; only enabled types used
7. Edges built: each undirected pair → one-way (random direction) at probability `oneWayRate/100`; otherwise bidirectional. Jail cells always inward-only.
8. Portal edges added between random non-adjacent path cell pairs; count scales with `portalRate`.

### Map Detail (`/maps/:id`)

Graph-style SVG renderer — cells are **labeled rounded-rect nodes** on a dot-grid background. Edges are lines between node centers. Disconnected (off-path) nodes fade to 18% opacity.

**Right-click a node** → context menu:
- Change cell type (all 9 types listed)
- "Connect edge from here…" → enters edge-edit mode
- If cell is `boss` type: **Boss Hearts** input — set the flavor HP (default 10). Stored on the cell, shown in GM Dashboard boss fight panel.

**Edge-edit mode:**
- Selected source node shown with dashed amber ring + status bar at top
- Right-click another node → "Add connection" or "Remove connection" confirm
- Cancel button or escape clears source selection

**Cell colors:**
| Type | Color |
|------|-------|
| plain | dark near-black |
| start | green |
| end | purple |
| shop | amber |
| trap | red |
| boss | dark purple |
| loot | yellow-green |
| chance | teal/cyan |
| jail | muted blue-grey |

---

## Session Management (`/sessions`)

### Session Library
- List all sessions (active first, then by date)
- Status badge: active / completed
- "Enter" button → GM Dashboard

### New Session Dialog
- Session name
- Map picker (dropdown of saved maps)
- Player builder: add up to 6 players, each with name + color (color picker)
- On create: all players placed on start cell, gold = 10, hp = 3

---

## GM Dashboard (`/sessions/:id`)

The main play screen. Split layout:

### Left 65% — Map Panel
- Full map grid with player tokens overlaid
- Player tokens: colored circles (32px) with player initial, positioned over their current cell
- Move flow:
  1. Click player token → player becomes "selected" (cell highlighted)
  2. Click destination cell → confirmation appears
  3. Confirm → adjacency validated → player moves → log entry added
  4. Invalid move (non-adjacent) shows error
- Selected player's current cell gets glow highlight

### Right 35% — Info Panel (tabbed)

**PLAYERS tab**
- **Turn HUD bar** at top: shows current turn number, active player name, and an "End Turn" button
- One row per player with drag handle (⠿) for reordering turn order
- Player row: color dot + name + current cell ID + gold amount + heart display (♥♥♥)
- Turn badges per player: `ACTIVE` (current turn), `DONE` (turn completed), `SKIP×N` (skipping N more turns)
- Gold controls: −10, −1, +1, +10 buttons
- Hearts (HP) controls: set to 0…maxHp — GM manual heal/damage
- Max Hearts controls: −1 / +1 buttons adjust maxHp (floor 1); decreasing clamps current hp
- Inventory list below each player (item names)
- Per-player **End Turn** and **Skip Turn** buttons
- Drag-and-drop to reorder turn order (dispatches `REORDER_PLAYERS`)

**SHOP tab**
- Lists all items from global catalog (name, description, cost)
- "Buy" button per item per player: deducts gold, adds to inventory, logs entry
- Disabled if player lacks gold

**LOG tab**
- Reverse-chronological turn log
- Each entry: turn number, player name, action, timestamp
- "New Turn" button at top: increments `currentTurn`

**ACTIONS tab**
GM-only power actions dispatched to `POST /sessions/:id/action`. Organized into four sections:

- **Movement** — Teleport: pick a player + optional destination cell ID; if no cell given, player lands on a random path cell
- **Economy** — Give Gold / Take Gold (gold floors at 0); Give Item (free, from catalog); Use Item (consume + remove from inventory)
- **Map** — Change Cell Type (pick cell + type; no type = random; label without type = plain with custom label); Create Path / Delete Path (bidirectional edge by cell ID pair)
- **Spin Wheel** — pick a saved wheel, spin returns weighted random entry displayed as result; GM clicks "Confirm & Apply Manually" to acknowledge and then uses other actions to carry out the outcome (spin does NOT mutate session state)
- **Boss Fight** — appears only when one or more players are on a `boss` cell. Shows boss flavor HP (`cell.bossHp`, default 10 ♥). "Spin Battle" button fires `BOSS_FIGHT_SPIN`: Win (weight 3) = player +10g; Lose (weight 5) = player −1 heart. One spin per encounter. Result shown inline. Reaching 0 HP triggers death sequence.

---

## Turn System

Each session has an ordered player list (`turnOrder`), an active player (`activePlayerId`), and a set of players who have acted this round (`turnDoneIds`).

- **Active player** is highlighted in the PLAYERS tab with an `ACTIVE` badge.
- **End Turn**: GM clicks "End Turn" in the HUD or per-player button, or player clicks "End Turn" in their own view. Marks that player done, advances `activePlayerId` to the next non-skipping player.
- **Skip Turn**: GM can skip the active player's turn.
- **Round completion**: When all non-skipping players have ended their turn, `currentTurn` increments and the round resets.
- **Skipping players**: Players with `skippedTurnsRemaining > 0` are auto-skipped each round (turn advances past them). Their counter decrements; deferred death steps resume when it reaches 0.
- **Reorder**: GM drags player rows to reorder; dispatches `REORDER_PLAYERS`.

---

## Death Sequence

When a player's HP reaches 0, the configured death sequence fires step-by-step:

- `SKIP_TURNS` — sets skip counter on the player and **stops** the sequence. Remaining steps resume automatically once all skips are spent.
- `RESPAWN_AT_START` — teleports to start cell, sets HP.
- `GIVE_HP` — restores HP in place (no teleport).

Default sequence: skip 3 turns → respawn at start with 1 HP.

Configured in Game Config (`/game-config`). Step reference at `/steps-docs`.

---

## Item Catalog (`/items`)

- Global item list (not per-shop, not per-session)
- List: name, description, cost
- Add item inline form (name, description, cost)
- Delete item

---

## Wheel Management (`/wheels`)

- List all saved wheels (name, entry count)
- Create wheel via dialog: name only
- Delete wheel
- Wheel detail: add/edit/delete entries; each entry has a label and a weight (integer ≥ 1)
- Higher weight = proportionally higher chance of being spun
- Wheels are spun from the GM Dashboard Actions tab — spin does not mutate session state

---

## Game Config (`/game-config`)

Global configuration page covering both cell type defaults and death behavior. Replaces the old "Space Config" page.

### Death Sequence section
- Ordered list of death steps; drag to reorder
- Add / remove steps
- Step types: Skip Turns (count), Respawn at Start (hp), Give HP (amount)
- Link to `/steps-docs` for step reference

### Space Config section
Defaults per special cell type:

| Type | Configurable |
|------|-------------|
| start | Default actions — array of steps executed in sequence automatically when any player lands on start, including revisits |
| chance | Default wheel (which wheel spins on landing) |
| jail | Default wheel (which wheel spins on landing) |
| boss | Default boss HP (used when cell has no explicit `bossHp`) |
| trap | Default actions — array of steps suggested to GM when player lands (executed in sequence) |
| loot | Default actions — array of steps suggested to GM when player lands (executed in sequence) |
| shop | **Visible items** — optional checklist of item IDs to show in the shop; leave all unchecked = show all items |

When a player lands on `trap` or `loot` and default actions are configured, a **suggestion banner** appears in the GM Dashboard map panel showing the action steps. GM dismisses it manually after acting.

---

## Death Steps Reference (`/steps-docs`)

Documentation page for the death sequence step types. Same layout as Actions Docs. Covers:
- Step type table (name, type key, fields, behavior notes)
- Sequencing explanation (SKIP_TURNS as a gate)
- Examples: default, instant soft revive, heavy penalty, skip + partial heal

---

## Actions Docs (`/actions-docs`)

Reference page for all GM action types. Lists each `ActionType` with required payload fields and behavior notes.

---

## Player View (`/play/:code` → `/play/:code/:playerId`)

Player-facing screen on a separate device. Players see only their own state — no map.

- Enter via a session join code
- Pick your player name from the list
- View: current cell type and label, gold, HP hearts, inventory
- **Turn status row**: shows current turn number + whether it's your turn, waiting, or how many turns you're skipping
- **End Turn** button (active only when it's your turn)
- **Spin** button appears when on a `chance` cell (player-initiated wheel spin)

---

## Dashboard (`/`)

- App title "BLIND" in display font
- Stat rows: active session count, total maps, total items
- Recent sessions list (last 3, with "Enter" links)

---

## Sidebar

Navigation grouped into four sections:

| Group | Items |
|-------|-------|
| Play | Dashboard, Sessions |
| Build | Maps, Items, Wheels |
| Config | Game Config, Actions, Death Steps |

- Collapsible icon-only mode (PanelLeft toggle)
- Search (⌘K) opens command palette with same grouped nav
- Theme toggle (dark/light)

---

## Win Condition & Session Completion

Configured in Game Config (`/game-config`) under the **Win Condition** section.

Available conditions:
- **None (GM decides)** — no automatic win. GM clicks "End Session" in the GM Dashboard header.
- **First to reach END** — first player to step on an `end` cell wins. Session auto-completes immediately.
- **First to END with gold** — same, but player must have > 0 gold.
- **Most gold after X turns** — checked at end of each round; once `currentTurn >= X`, player with most gold wins.
- **Fewest deaths after X turns** — same timing; player with fewest `deathCount` wins.

When the condition is met (or GM ends manually), the session status becomes `completed`. The GM Dashboard shows a winner banner with the player name and turn number.

For manual end: "End Session" button in GM Dashboard header. The `COMPLETE_SESSION` GM action accepts an optional `winnerId`.

---

## Planned / Not Yet Built

- Per-shop inventory (currently global catalog)
- Map export/import
- Multi-round boss fights, shared party HP
- Trap effects (currently just a label)
- Multiple save slots / map versioning
- Wheel spin auto-apply (currently GM applies outcome manually via other actions)
