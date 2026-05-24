# API Reference

Base URL: `http://localhost:36001/api`

All bodies are JSON. Global `ValidationPipe` (whitelist + transform).

---

## Maps

| Method | Path | Description |
|--------|------|-------------|
| GET | `/maps` | List all maps |
| POST | `/maps` | Generate + save new map |
| GET | `/maps/templates` | List all generation templates |
| POST | `/maps/templates` | Create generation template |
| DELETE | `/maps/templates/:id` | Delete generation template |
| GET | `/maps/:id` | Get map by ID |
| DELETE | `/maps/:id` | Delete map |
| PATCH | `/maps/:id/cell/:cellId` | Update cell type/label |
| PATCH | `/maps/:id/edge` | Toggle edge (add or remove bidirectional connection) |

**POST /maps body:**
```json
{
  "name": "string",
  "gridW": 4–12,
  "gridH": 4–12,
  "emptyMap": false,
  "density": 0–100,
  "chaos": 0–100,
  "specialRate": 0–100,
  "specialTypes": ["shop","trap","boss","loot","chance","jail"],
  "connectivity": 0–100,
  "oneWayRate": 0–100,
  "portalRate": 0–100,
  "randomStartEnd": false
}
```
All gen params optional — defaults: density=40, chaos=30, specialRate=30, specialTypes=all, connectivity=20, oneWayRate=0. Set `emptyMap: true` to skip generation and create a blank grid.

**POST /maps/templates body:**
```json
{
  "name": "string",
  "density": 0–100,
  "chaos": 0–100,
  "specialRate": 0–100,
  "connectivity": 0–100,
  "oneWayRate": 0–100,
  "portalRate": 0–100,
  "specialTypes": ["shop","trap","boss","loot","chance","jail"],
  "randomStartEnd": false
}
```
All params optional. Returns `MapTemplate`: `{ id, name, params, createdAt }`.

**PATCH /maps/:id/cell/:cellId body:**
```json
{ "type": "CellType", "label": "string" }
```

**PATCH /maps/:id/edge body:**
```json
{ "from": "r0c0", "to": "r1c1" }
```
Toggles: if edge exists → removes both directions. If absent → adds both directions.

---

## Sessions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/sessions` | List all sessions |
| POST | `/sessions` | Create session |
| GET | `/sessions/:id` | Get session |
| DELETE | `/sessions/:id` | Delete session |
| POST | `/sessions/:id/move` | Move player |
| POST | `/sessions/:id/buy` | Player buys item |
| POST | `/sessions/:id/gold` | Adjust player gold |
| POST | `/sessions/:id/turn` | Increment turn counter |
| POST | `/sessions/:id/action` | Dispatch a GM action |
| POST | `/sessions/:id/player-action` | Dispatch a player action |
| POST | `/sessions/:id/end-turn` | End a specific player's turn |

**POST /sessions body:**
```json
{
  "name": "string",
  "mapId": number,
  "players": [{ "name": "string", "color": "#hex" }]
}
```

**POST /sessions/:id/move body:**
```json
{ "playerId": "string", "toCellId": "string" }
```
Validates adjacency via edge lookup. Returns 400 if not adjacent.

**POST /sessions/:id/buy body:**
```json
{ "playerId": "string", "itemId": number }
```
Returns 400 if insufficient gold.

**POST /sessions/:id/gold body:**
```json
{ "playerId": "string", "amount": number }
```
Negative = deduct. Gold floor is 0.

**POST /sessions/:id/end-turn body:**
```json
{ "playerId": "string" }
```
Marks that player's turn done and advances `activePlayerId`. If all non-skipping players are done, increments `currentTurn` and resets `turnDoneIds`.

**POST /sessions/:id/player-action body:**
```json
{ "type": "PlayerActionType", "playerId": "string", "payload": {} }
```
See PlayerActionType table below.

---

## GM Actions

Single dispatch endpoint: `POST /sessions/:id/action`

**Body:**
```json
{ "type": "ActionType", "payload": { ...GmActionPayload } }
```

**Response:** `GmActionResult` — `{ session?: Session; spunEntry?: WheelEntry; bossFight?: BossFightSpinResult }`

| `type` | Required payload fields | Notes |
|--------|------------------------|-------|
| `MOVE` | `playerId`, `toCellId` | Adjacency-validated. 400 if not adjacent. |
| `USE_ITEM` | `playerId`, `itemId` | Removes item from player inventory. |
| `TELEPORT` | `playerId` | `toCellId` optional — omit for random path cell. |
| `GIVE_GOLD` | `playerId`, `amount` | Adds gold; no floor concern. |
| `TAKE_GOLD` | `playerId`, `amount` | Deducts gold; floors at 0. |
| `GIVE_ITEM` | `playerId`, `itemId` | Adds catalog item free (no gold cost). |
| `BUY_ITEM` | `playerId`, `itemId` | Deducts item cost from player gold. |
| `SPIN_WHEEL` | `wheelId` | Returns weighted random `WheelEntry` in `spunEntry`. Does NOT mutate session. |
| `CHANGE_CELL_TYPE` | `cellId` | `type` optional (random if absent); `label` + no `type` = plain with custom label. |
| `CREATE_PATH` | `fromCellId`, `toCellId` | Adds bidirectional edge. |
| `DELETE_PATH` | `fromCellId`, `toCellId` | Removes bidirectional edge. |
| `BOSS_FIGHT_SPIN` | `playerId` | One-spin boss fight. Win (3/8): player +10g. Lose (5/8): player −1 heart. Returns `bossFight: { outcome, goldGained?, hpLost? }`. Reaching 0 HP triggers death sequence. |
| `SET_PLAYER_HP` | `playerId`, `hp` | Set player HP to 0–maxHp. Triggers death sequence if set to 0. |
| `ADJUST_HP` | `playerId`, `amount` | Delta HP (positive or negative). Triggers death sequence at 0. |
| `ADJUST_MAX_HP` | `playerId`, `amount` | +1 or −1 to maxHp (floor 1). If max decreases, hp clamps to new max. |
| `END_TURN` | `playerId` | Marks player turn done; advances `activePlayerId`. |
| `SKIP_TURN` | `playerId` | Skips the specified player's turn this round. |
| `REORDER_PLAYERS` | `playerOrder` | Sets new `turnOrder` array (array of player IDs). |
| `COMPLETE_SESSION` | — | Ends the session. Optional `winnerId` (player ID). |

---

## Player Actions

`POST /sessions/:id/player-action`

All actions except `PLAYER_USE_ITEM` enforce that it's the player's turn (`session.activePlayerId === playerId`). Actions marked **requires move** additionally require `player.hasMoved === true` (set after `PLAYER_MOVE` or a successful `PLAYER_SPIN_JAIL` escape).

| `type` | Required fields | Requires move | Notes |
|--------|----------------|---------------|-------|
| `PLAYER_MOVE` | `playerId`, `toCellId` | — | Adjacency-validated. Sets `hasMoved = true`. Returns `passiveEvent` if destination is `trap` or `loot`. |
| `PLAYER_BUY` | `playerId`, `itemId` | yes | Player must be on a `shop` cell. |
| `PLAYER_USE_ITEM` | `playerId`, `itemId` | — | No turn or move enforcement; usable freely on own turn. |
| `PLAYER_SPIN_CHANCE` | `playerId` | yes | Player must be on a `chance` cell. Uses configured default wheel. |
| `PLAYER_BOSS_FIGHT` | `playerId` | yes | Player must be on a `boss` cell. |
| `PLAYER_END_TURN` | `playerId` | yes | Player ends their own turn. Same effect as GM `END_TURN`. |
| `PLAYER_SPIN_JAIL` | `playerId` | — | Player must be on a `jail` cell. Spins the jail wheel. If result label contains "escape", "free", or "out": moves to random adjacent non-jail cell, sets `hasMoved = true`. Otherwise: logs "still trapped". Returns `spunEntry`. |

---

## Wheels

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wheels` | List all wheels |
| POST | `/wheels` | Create wheel |
| GET | `/wheels/:id` | Get wheel with entries |
| PATCH | `/wheels/:id` | Update wheel name or entries |
| DELETE | `/wheels/:id` | Delete wheel |

**POST /wheels body:**
```json
{ "name": "string", "entries": [{ "label": "string", "weight": number }] }
```
`entries` optional on create — can be added via PATCH.

**PATCH /wheels/:id body:**
```json
{ "name": "string", "entries": [{ "label": "string", "weight": number }] }
```
All fields optional. Providing `entries` replaces the full entry list.

---

## Items

| Method | Path | Description |
|--------|------|-------------|
| GET | `/items` | List all items |
| POST | `/items` | Create item |
| DELETE | `/items/:id` | Delete item |

**POST /items body:**
```json
{ "name": "string", "description": "string", "cost": number }
```

---

## Game Config

Replaces the old `/cell-config` endpoint. Single global config object covering both cell type defaults and death behavior.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/game-config` | Get global game config |
| PATCH | `/game-config` | Update global game config (merged) |

**GET /game-config response:**
```json
{
  "cellConfig": {
    "start":  { "defaultActions": [{ "type": "ActionType", "payload": {} }] },
    "chance": { "defaultWheelId": number },
    "jail":   { "defaultWheelId": number },
    "boss":   { "defaultBossHp": 10 },
    "trap":   { "defaultActions": [{ "type": "ActionType", "payload": {} }] },
    "loot":   { "defaultActions": [{ "type": "ActionType", "payload": {} }] }
  },
  "deathSequence": [
    { "type": "SKIP_TURNS", "count": 3 },
    { "type": "RESPAWN_AT_START", "hp": 1 }
  ],
  "winConditions": []
}
```

**PATCH /game-config body** (all fields optional, merged with current):
```json
{
  "cellConfig": { ...CellTypeConfigMap },
  "deathSequence": [ ...DeathActionStep[] ]
}
```

Stored as single `global` row in `game_config` table. On first boot, migrates existing cell config from legacy `cell_config` table if present.

---

## Storage

- SQLite file: `blind.db` (repo root)
- No ORM — raw `better-sqlite3` synchronous queries
- JSON columns: `cells`, `edges`, `players`, `log`, `turn_order`, `turn_done_ids` (stringified arrays)
- Schema version 2 (stored in SQLite `user_version` pragma). On upgrade from v1, all tables are dropped and re-created with `INTEGER PRIMARY KEY AUTOINCREMENT` IDs.
- All DB-row IDs (`maps.id`, `sessions.id`, `items.id`, `wheels.id`) are positive integers (SQLite autoincrement). Cell IDs (`r{row}c{col}`) and Player/LogEntry/WheelEntry IDs remain strings.
- Schema auto-migrates on startup via `DbService.migrate()`
- Pre-seeds: 1 map ("The Forgotten Dungeon" 8×6) + 8 items + 2 wheels on first run
