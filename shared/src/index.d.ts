export type SpecialCellType = 'shop' | 'trap' | 'boss' | 'loot';
export declare const SPECIAL_CELL_TYPES: SpecialCellType[];
export type CellType = 'plain' | 'start' | 'end' | SpecialCellType;
export interface Cell {
    id: string;
    row: number;
    col: number;
    type: CellType;
    label?: string;
    revealed?: boolean;
}
export interface Edge {
    from: string;
    to: string;
}
export interface GameMap {
    id: string;
    name: string;
    gridW: number;
    gridH: number;
    cells: Cell[];
    edges: Edge[];
    createdAt: string;
}
export interface Item {
    id: string;
    name: string;
    description: string;
    cost: number;
}
export interface Player {
    id: string;
    name: string;
    gold: number;
    currentCellId: string;
    inventory: Item[];
    color: string;
}
export interface LogEntry {
    id: string;
    turn: number;
    playerId: string;
    playerName: string;
    action: string;
    timestamp: string;
}
export interface Session {
    id: string;
    mapId: string;
    mapName: string;
    name: string;
    players: Player[];
    log: LogEntry[];
    currentTurn: number;
    createdAt: string;
    status: 'active' | 'completed';
}
export interface WheelEntry {
    id: string;
    label: string;
    weight: number;
}
export interface Wheel {
    id: string;
    name: string;
    entries: WheelEntry[];
    createdAt: string;
}
export type ActionType = 'MOVE' | 'USE_ITEM' | 'TELEPORT' | 'GIVE_GOLD' | 'TAKE_GOLD' | 'GIVE_ITEM' | 'BUY_ITEM' | 'SPIN_WHEEL' | 'CHANGE_CELL_TYPE' | 'CREATE_PATH' | 'DELETE_PATH';
export interface GmActionPayload {
    playerId?: string;
    toCellId?: string;
    itemId?: string;
    amount?: number;
    wheelId?: string;
    cellId?: string;
    cellType?: string;
    label?: string;
    fromCellId?: string;
}
export interface GmActionResult {
    session?: Session;
    spunEntry?: WheelEntry;
}
