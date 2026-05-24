# Data Model

All types live in `shared/src/index.ts` and are imported as `import type { ... } from '@blind/shared'`.

## CellType

```
'plain' | 'start' | 'end' | 'shop' | 'trap' | 'boss' | 'loot' | 'chance' | 'jail'
```

- `start` — entry point, top-left region. Players begin here.
- `end` — goal cell, bottom-right region. Reaching it ends the run.
- `plain` — unremarkable corridor/room.
- `shop` — players can buy items here.
- `trap` — negative event on entry (GM describes).
- `boss` — combat encounter (GM describes).
- `loot` — free item or currency pickup (GM describes).
- `chance` — triggers the wheel overlay automatically when a player moves onto it (uses configured default wheel).
- `jail` — traps a player; player must spin the default wheel each turn to escape.

`SpecialCellType = 'chance' | 'jail' | 'boss' | 'trap' | 'loot' | 'shop'` (excludes plain/start/end).

## Cell

```ts
{ id: string; row: number; col: number; type: CellType; label?: string; bossHp?: number; }
```

- `id` format: `r{row}c{col}` (e.g. `r0c0`, `r3c5`)
- `label` — optional GM note shown on the map view
- `bossHp` — flavor-only heart count for boss cells (default 10). Set via map detail right-click menu. Never mutates during gameplay.

## Edge

```ts
{ from: string; to: string; }
```

- Bidirectional: every connection stored as two edges (A→B and B→A)
- Edges represent drawn paths, NOT full 8-directional adjacency
- Movement validity checked by edge lookup
- Edges can be diagonal (non-adjacent rows/cols) when generated with chaos ≥ 40 or added manually

## GameMap

```ts
{
  id: number; name: string;
  gridW: number; gridH: number;
  cells: Cell[]; edges: Edge[];
  createdAt: string; // ISO
}
```

## Item

```ts
{ id: number; name: string; description: string; cost: number; }
```

- Global catalog. Not per-shop. Any player can buy from any shop cell.
- Pre-seeded: Health Potion (50g), Iron Sword (100g), Shield (80g), Torch (20g), Rope (15g)

## Player

```ts
{
  id: string; name: string; gold: number; hp: number; maxHp: number;
  currentCellId: string;
  inventory: Item[];
  color: string; // hex, used for map token
  skippedTurnsRemaining: number;
  hasMoved?: boolean;
  deathCount: number;
}
```

- Players start at the `start` cell with 30 gold, `hp: 3`, `maxHp: 3`, `skippedTurnsRemaining: 0`, `deathCount: 0`.
- `hp` — current hearts (0–maxHp). 0 = dead; death sequence fires automatically.
- `maxHp` — max heart slots (min 1). Adjusted via `ADJUST_MAX_HP`; decreasing clamps `hp` to new max.
- `skippedTurnsRemaining` — turns left to skip after a `SKIP_TURNS` death step. Auto-decremented by `advanceTurn`; when it hits 0 the deferred death steps resume.
- `hasMoved` — whether the player has moved this turn. Set to `true` after `PLAYER_MOVE` or a successful `PLAYER_SPIN_JAIL` escape. Reset to `false` for all players when a new round begins. Players must move before buying, spinning chance, fighting a boss, or ending their turn.
- `deathCount` — total times this player has died. Incremented at the start of each death sequence. Used by `LEAST_DEATHS_AFTER_TURNS` win condition.
- Up to 6 players per session.

## LogEntry

```ts
{
  id: string; turn: number;
  playerId: string; playerName: string;
  action: string; timestamp: string; // ISO
}
```

- Stored newest-first (unshift on write).
- Actions: "moved from X to Y", "bought Item for Ng", "gained Ng", "spent Ng"

## Session

```ts
{
  id: number; name: string;
  mapId: number; mapName: string;
  players: Player[];
  log: LogEntry[];
  currentTurn: number;
  turnOrder: string[];       // player IDs in rotation order
  activePlayerId: string | null;
  turnDoneIds: string[];     // IDs who have ended their turn this round
  createdAt: string; // ISO
  status: 'active' | 'completed';
  winnerId?: string;         // player ID who won (set when status becomes completed)
  winTurn?: number;          // turn on which the win condition was met
}
```

- Sessions reference a map by ID but the map is fetched live — cell/edge changes on the map reflect in the session.
- `turnOrder` — ordered list of player IDs. GM can reorder via drag-and-drop (`REORDER_PLAYERS`).
- `activePlayerId` — which player's turn it currently is. Advances on `END_TURN` / `SKIP_TURN`.
- `turnDoneIds` — players who have acted this round. When all non-skipping players are done, `currentTurn` increments and the round resets.
- `currentTurn` — round counter, increments when all players complete a round.
- `winnerId` / `winTurn` — set when a win condition is triggered or GM calls `COMPLETE_SESSION`.

## WheelEntry

```ts
{ label: string; weight: number; }
```

- `weight` — positive integer. Probability ∝ weight / sum(all weights).

## Wheel

```ts
{ id: number; name: string; entries: WheelEntry[]; createdAt: string; // ISO }
```

- Wheels are global (not per-session).
- Spin logic: weighted random selection across all entries.

## DeathActionStep

Discriminated union of steps executed in sequence when a player reaches 0 HP:

```ts
type DeathActionStep =
  | { type: 'SKIP_TURNS'; count: number }
  | { type: 'RESPAWN_AT_START'; hp: number }
  | { type: 'GIVE_HP'; amount: number }
```

- `SKIP_TURNS` — sets `skippedTurnsRemaining` on the player and **stops** execution. Remaining steps resume after skips are exhausted.
- `RESPAWN_AT_START` — teleports player to the start cell and sets `hp` to the given value (clamped to `maxHp`).
- `GIVE_HP` — adds HP in place, no teleport.

## WinCondition

Discriminated union; stored as an array in `GameConfig.winConditions`. All conditions must be satisfied simultaneously (AND logic) for a player to win.

```ts
type WinCondition =
  | { type: 'FIRST_TO_END' }
  | { type: 'POSITIVE_GOLD' }
  | { type: 'MOST_GOLD_AFTER_TURNS'; turns: number }
  | { type: 'LEAST_DEATHS_AFTER_TURNS'; turns: number }
```

- `FIRST_TO_END` — player must be on an `end` cell.
- `POSITIVE_GOLD` — player must have > 0 gold.
- `MOST_GOLD_AFTER_TURNS` — checked each round end once `currentTurn >= turns`; player must have the most gold.
- `LEAST_DEATHS_AFTER_TURNS` — same timing; player must have the fewest `deathCount`.

Empty array = no automatic win. GM ends session manually via "End Session" button (`COMPLETE_SESSION`).

Example — "first to reach END with positive gold": `[{ type: 'FIRST_TO_END' }, { type: 'POSITIVE_GOLD' }]`.

## GameConfig

```ts
interface GameConfig {
  cellConfig: CellTypeConfigMap;
  deathSequence: DeathActionStep[];
  winConditions: WinCondition[];
}
```

- Global singleton stored in `game_config` table (`id = 'global'`).
- `deathSequence` — ordered steps fired on player death. Default: `[{ type:'SKIP_TURNS', count:3 }, { type:'RESPAWN_AT_START', hp:1 }]`.
- `cellConfig` — per-type defaults (see below). Includes `start` cell config.
- `winConditions` — all conditions must be met simultaneously. Default: `[]` (GM decides).
- Configured at `/game-config`. See also `/steps-docs` for step reference.

## CellTypeConfig

```ts
interface CellTypeConfig {
  defaultWheelId?: number;
  defaultBossHp?: number;
  defaultActions?: AttachedAction[];
  shopItemIds?: number[];
}

type CellTypeConfigMap = Partial<Record<SpecialCellType | 'start', CellTypeConfig>>;
```

- `defaultWheelId` — used by `chance` and `jail` to resolve the default spin wheel.
- `defaultBossHp` — fallback when a boss cell has no explicit `bossHp`.
- `defaultActions` — array of actions executed in sequence when player lands on `trap`, `loot`, or `start`; suggested to GM via banner for trap/loot.
- `shopItemIds` — (`shop` only) when set, only these item IDs appear in the shop. Omit or `undefined` = show all items.

## ActionType (GM)

```ts
'MOVE' | 'USE_ITEM' | 'TELEPORT' | 'GIVE_GOLD' | 'TAKE_GOLD' |
'GIVE_ITEM' | 'BUY_ITEM' | 'SPIN_WHEEL' | 'CHANGE_CELL_TYPE' |
'CREATE_PATH' | 'DELETE_PATH' | 'BOSS_FIGHT_SPIN' | 'SET_PLAYER_HP' |
'ADJUST_HP' | 'ADJUST_MAX_HP' |
'END_TURN' | 'SKIP_TURN' | 'REORDER_PLAYERS' | 'COMPLETE_SESSION'
```

- `ADJUST_HP` — delta-based HP change (positive or negative). Triggers death sequence at 0.
- `END_TURN` — marks the active player's turn done; advances to next player.
- `SKIP_TURN` — skips the active player's turn (e.g. GM overrides).
- `REORDER_PLAYERS` — sets a new `turnOrder`; payload: `{ playerOrder: string[] }`.
- `COMPLETE_SESSION` — ends session immediately. Optional `winnerId` sets the winner; omit for no winner.

## PlayerActionType

```ts
'PLAYER_MOVE' | 'PLAYER_BUY' | 'PLAYER_USE_ITEM' |
'PLAYER_SPIN_CHANCE' | 'PLAYER_BOSS_FIGHT' |
'PLAYER_END_TURN' | 'PLAYER_SPIN_JAIL'
```

- `PLAYER_MOVE` — move to an adjacent cell; sets `hasMoved = true`. Returns `passiveEvent` if destination is `trap` or `loot`.
- `PLAYER_BUY` — buy item from a shop cell; requires `hasMoved`.
- `PLAYER_USE_ITEM` — use item from inventory; no `hasMoved` requirement.
- `PLAYER_SPIN_CHANCE` — player-initiated wheel spin on a chance cell; requires `hasMoved`.
- `PLAYER_BOSS_FIGHT` — initiate boss fight on a boss cell; requires `hasMoved`.
- `PLAYER_END_TURN` — player ends their own turn; requires `hasMoved`.
- `PLAYER_SPIN_JAIL` — spin the jail wheel to attempt escape. If spin label contains "escape", "free", or "out": moves player to a random adjacent non-jail cell and sets `hasMoved = true`. Otherwise: logs "still trapped" and does not set `hasMoved`. Does not require `hasMoved` to use.

## GmActionPayload

```ts
{
  playerId?: string;
  itemId?: string;
  wheelId?: string;
  toCellId?: string;      // destination cell; optional on TELEPORT (random if absent)
  fromCellId?: string;    // used by CREATE_PATH / DELETE_PATH
  amount?: number;        // used by GIVE_GOLD / TAKE_GOLD / ADJUST_HP
  cellId?: string;        // target cell for CHANGE_CELL_TYPE
  type?: CellType;        // new type; absent = random
  label?: string;         // custom label; label + no type = plain with custom label
  playerOrder?: string[]; // used by REORDER_PLAYERS
}
```

## GmActionResult

```ts
{ session?: Session; spunEntry?: WheelEntry; }
```

- `session` — updated session returned for actions that mutate state.
- `spunEntry` — populated only for `SPIN_WHEEL`; session is NOT mutated.

## PlayerActionResult

```ts
{
  session: Session;
  spunEntry?: WheelEntry;
  bossFight?: BossFightSpinResult;
  passiveEvent?: { type: 'trap' | 'loot'; goldDelta: number };
}
```

- `session` — updated session.
- `spunEntry` — populated for `PLAYER_SPIN_CHANCE` and `PLAYER_SPIN_JAIL`.
- `bossFight` — populated for `PLAYER_BOSS_FIGHT`.
- `passiveEvent` — populated on `PLAYER_MOVE` when destination is `trap` or `loot`. `goldDelta` is negative for trap, positive for loot. The gold change is already applied; this field surfaces it to the UI for notification.

## AttachedAction

```ts
{ type: ActionType; payload: GmActionPayload; }
```

Used as elements of `defaultActions` in `CellTypeConfig`. Multiple steps are executed in sequence via `executeActions`. Suggested to the GM when a player lands on a configured trap/loot cell.
