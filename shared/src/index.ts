export type SpecialCellType = 'shop' | 'trap' | 'boss' | 'loot' | 'chance' | 'jail';
export const SPECIAL_CELL_TYPES: SpecialCellType[] = ['shop', 'trap', 'boss', 'loot', 'chance', 'jail'];

export type CellTypeWithStart = SpecialCellType | 'start';

export type WinCondition =
  | { type: 'FIRST_TO_END' }
  | { type: 'POSITIVE_GOLD' }
  | { type: 'MOST_GOLD_AFTER_TURNS'; turns: number }
  | { type: 'LEAST_DEATHS_AFTER_TURNS'; turns: number };

export interface CellTypeConfig {
  defaultWheelId?: number;
  defaultBossHp?: number;
  defaultActions?: AttachedAction[];
  /** When set, only these item IDs appear in the shop. Undefined = show all. */
  shopItemIds?: number[];
}

export type CellTypeConfigMap = Partial<Record<CellTypeWithStart, CellTypeConfig>>;

export type CellType = 'plain' | 'start' | 'end' | SpecialCellType;

export interface Cell {
  id: string;
  row: number;
  col: number;
  type: CellType;
  label?: string;
  revealed?: boolean;
  actions?: AttachedAction[];
  bossHp?: number;
}

export interface Edge {
  from: string;
  to: string;
  portal?: boolean;
  exitHandle?: string;   // source handle id on `from` cell (e.g. 'sr')
  entryHandle?: string;  // target handle id on `to` cell (e.g. 'tl')
}

export interface GameMap {
  id: number;
  name: string;
  gridW: number;
  gridH: number;
  cells: Cell[];
  edges: Edge[];
  createdAt: string;
}

export interface Item {
  id: number;
  name: string;
  description: string;
  cost: number;
  actions?: AttachedAction[];
}

export interface Player {
  id: string;
  name: string;
  gold: number;
  hp: number;
  maxHp: number;
  currentCellId: string;
  inventory: Item[];
  color: string;
  /** Turns remaining to skip (death penalty) */
  skippedTurnsRemaining: number;
  /** Whether the player has moved this turn */
  hasMoved?: boolean;
  /** Total times this player has died */
  deathCount: number;
}

export interface LogEntry {
  id: string;
  turn: number;
  playerId: string;
  playerName: string;
  action: string;
  timestamp: string;
}

export interface PlayerBroadcast {
  message: string;
  timestamp: string;
}

export interface Session {
  id: number;
  code: string;
  mapId: number;
  mapName: string;
  name: string;
  players: Player[];
  log: LogEntry[];
  currentTurn: number;
  createdAt: string;
  status: 'active' | 'completed';
  playerBroadcast?: PlayerBroadcast;
  /** Ordered list of player IDs for turn rotation */
  turnOrder: string[];
  /** ID of the player whose turn it currently is */
  activePlayerId: string | null;
  /** Players who have ended their turn this round (reset each round) */
  turnDoneIds: string[];
  /** ID of the player who won (set when status becomes completed) */
  winnerId?: string;
  /** Turn on which the win condition was met */
  winTurn?: number;
}

export interface WheelEntry {
  id: string;
  label: string;
  weight: number;
  actions?: AttachedAction[];
}

export interface Wheel {
  id: number;
  name: string;
  entries: WheelEntry[];
  createdAt: string;
}

export type ActionType =
  | 'MOVE'
  | 'USE_ITEM'
  | 'TELEPORT'
  | 'TELEPORT_TO_START'
  | 'GIVE_GOLD'
  | 'TAKE_GOLD'
  | 'STEAL_GOLD'
  | 'GIVE_ITEM'
  | 'BUY_ITEM'
  | 'SPIN_WHEEL'
  | 'CHANGE_CELL_TYPE'
  | 'CREATE_PATH'
  | 'DELETE_PATH'
  | 'BOSS_FIGHT_SPIN'
  | 'SET_PLAYER_HP'
  | 'ADJUST_MAX_HP'
  | 'ADJUST_HP'
  | 'SWAP_PLAYERS'
  | 'RESET_MOVE'
  | 'NOTIFY_GM'
  | 'DISTANCE_TO_END'
  | 'BROADCAST'
  | 'END_TURN'
  | 'SKIP_TURN'
  | 'REORDER_PLAYERS'
  | 'COMPLETE_SESSION';

export interface GmActionPayload {
  playerId?: string;
  targetPlayerId?: string;
  toCellId?: string;
  itemId?: number;
  amount?: number;
  wheelId?: number;
  cellId?: string;
  cellType?: string;
  label?: string;
  fromCellId?: string;
  hp?: number;
  message?: string;
  broadcastMessage?: string;
  /** REORDER_PLAYERS: new ordered array of player IDs */
  playerOrder?: string[];
  /** COMPLETE_SESSION: optional winner player ID */
  winnerId?: string;
}

export interface BossFightSpinResult {
  outcome: 'win' | 'lose';
  goldGained?: number;
  hpLost?: number;
}

export const BOSS_WHEEL_WIN_LABEL = 'WIN +10g';
export const BOSS_WHEEL_LOSE_LABEL = 'LOSE −1 ♥';

/**
 * A single step in the death resolution sequence.
 * Steps execute in order when a player's HP reaches 0.
 */
export type DeathActionStep =
  | { type: 'SKIP_TURNS'; count: number }
  | { type: 'RESPAWN_AT_START'; hp: number }
  | { type: 'GIVE_HP'; amount: number };

export interface GameConfig {
  /** Space-type configs (formerly cell-config) */
  cellConfig: CellTypeConfigMap;
  /** Ordered steps that run when a player reaches 0 HP */
  deathSequence: DeathActionStep[];
  /** All conditions must be met simultaneously for a player to win */
  winConditions: WinCondition[];
}

/** A GM action attached to a wheel entry, item, or cell that auto-fires on trigger. */
export interface AttachedAction {
  type: ActionType;
  payload: GmActionPayload;
}

export interface GmActionResult {
  session?: Session;
  spunEntry?: WheelEntry;
  triggeredAction?: AttachedAction;
  bossFight?: BossFightSpinResult;
  distanceToEnd?: number | null;
}

export type PlayerActionType =
  | 'PLAYER_MOVE'
  | 'PLAYER_BUY'
  | 'PLAYER_USE_ITEM'
  | 'PLAYER_SPIN_CHANCE'
  | 'PLAYER_BOSS_FIGHT'
  | 'PLAYER_END_TURN'
  | 'PLAYER_SPIN_JAIL';

export interface PlayerActionPayload {
  playerId: string;
  toCellId?: string;        // PLAYER_MOVE
  itemId?: number;          // PLAYER_BUY, PLAYER_USE_ITEM
  targetPlayerId?: string;  // PLAYER_USE_ITEM with SWAP_PLAYERS action
}

export interface PlayerActionResult {
  session: Session;
  spunEntry?: WheelEntry;
  bossFight?: BossFightSpinResult;
  passiveEvent?: { type: 'trap' | 'loot'; goldDelta: number };
  distanceToEnd?: number | null;
}
