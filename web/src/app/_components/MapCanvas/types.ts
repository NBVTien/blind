import type { AttachedAction, Cell, CellType, Player, GameMap, Item, Wheel } from '@blind/shared'

export type PortalStub = {
  handle: string        // e.g. 'sr', 'stl' — which handle slot
  color: string         // oklch portal color
  kind: 'exit' | 'entry'
  from: string          // edge from cell id
  to: string            // edge to cell id
  label: string         // A, B, C… — same for both ends of a portal pair
  bidirectional: boolean
}

export type CellNodeData = {
  cell: Cell
  isConnected: boolean
  editMode: boolean
  isReachable?: boolean
  isPlayerHere?: boolean
  isPendingTarget?: boolean
  players?: Player[]
  portalStubs?: PortalStub[]
  onToggleEdge?: (from: string, to: string) => void
}

export type CellEdgeData = { isReachable?: boolean; bidirectional?: boolean }

export type CtxMenu = { kind: 'cell'; cell: Cell; x: number; y: number }

export type EditProps = {
  mode: 'edit'
  onChangeType: (cellId: string, type: CellType) => void
  onToggleEdge: (from: string, to: string) => void
  onSetBossHp?: (cellId: string, hp: number) => void
}

export type SessionProps = {
  mode: 'session'
  selectedPlayerId: string | null
  onCellClick: (cellId: string) => void
  pendingTargetId?: string | null
  players: Player[]
  onChangeCellType?: (cellId: string, type: CellType | null, label?: string) => void
  onCreatePath?: (fromCellId: string, toCellId: string) => void
  onDeletePath?: (fromCellId: string, toCellId: string) => void
  onSetCellAction?: (cellId: string, actions: AttachedAction[] | null) => void
  sessionItems?: Item[]
  sessionWheels?: Wheel[]
}

export type MapCanvasProps = { map: GameMap } & (EditProps | SessionProps)
