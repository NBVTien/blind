import type { GameMap, Player } from '@blind/shared'
import type { Node, Edge } from '@xyflow/react'
import { CELL_SIZE } from './constants'
import type { CellNodeData, CellEdgeData, PortalStub } from './types'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function buildPortalStubs(map: GameMap): Map<string, PortalStub[]> {
  const stubMap = new Map<string, PortalStub[]>()
  const get = (id: string) => { if (!stubMap.has(id)) stubMap.set(id, []); return stubMap.get(id)! }

  // Assign a stable letter to each unique portal pair (sorted from|to key)
  const pairIndex = new Map<string, number>()
  for (const e of map.edges) {
    if (!e.portal) continue
    const key = [e.from, e.to].sort().join('|')
    if (!pairIndex.has(key)) pairIndex.set(key, pairIndex.size)
  }
  const pairLabel = (from: string, to: string) => {
    const idx = pairIndex.get([from, to].sort().join('|')) ?? 0
    return LABELS[idx % LABELS.length]
  }

  const portalEdgeSet = new Set(map.edges.filter(e => e.portal).map(e => `${e.from}->${e.to}`))

  for (const e of map.edges) {
    if (!e.portal) continue
    const color = portalColor(e.from, e.to)
    const label = pairLabel(e.from, e.to)
    const bidirectional = portalEdgeSet.has(`${e.to}->${e.from}`)
    if (e.exitHandle) get(e.from).push({ handle: e.exitHandle, color, kind: 'exit', from: e.from, to: e.to, label, bidirectional })
    if (e.entryHandle) {
      const srcEquiv = e.entryHandle.replace(/^t/, 's')
      get(e.to).push({ handle: srcEquiv, color, kind: 'entry', from: e.from, to: e.to, label, bidirectional })
    }
  }
  return stubMap
}

export function mapToNodes(
  map: GameMap,
  connectedIds: Set<string>,
  editMode: boolean,
  reachableCells?: Set<string>,
  selectedPlayer?: Player | null,
  pendingTargetId?: string | null,
  cellPlayers?: Map<string, Player[]>,
  onToggleEdge?: (from: string, to: string) => void,
): Node<CellNodeData>[] {
  const portalStubMap = buildPortalStubs(map)
  return map.cells.map(cell => ({
    id: cell.id,
    type: 'cell',
    position: { x: cell.col * CELL_SIZE, y: cell.row * CELL_SIZE },
    draggable: false,
    selectable: false,
    data: {
      cell,
      isConnected: connectedIds.has(cell.id),
      editMode,
      isReachable: reachableCells?.has(cell.id) ?? false,
      isPlayerHere: selectedPlayer?.currentCellId === cell.id,
      isPendingTarget: pendingTargetId === cell.id,
      players: cellPlayers?.get(cell.id),
      portalStubs: portalStubMap.get(cell.id),
      onToggleEdge: editMode ? onToggleEdge : undefined,
    },
  }))
}

// Stable portal colors — deterministic by sorted edge pair id
const PORTAL_COLORS = [
  'oklch(0.65 0.22 0)',    // red
  'oklch(0.70 0.22 60)',   // orange
  'oklch(0.72 0.20 200)',  // cyan
  'oklch(0.65 0.22 280)',  // violet
  'oklch(0.70 0.22 150)',  // green
  'oklch(0.65 0.22 320)',  // pink
  'oklch(0.72 0.20 230)',  // blue
  'oklch(0.68 0.22 100)',  // yellow-green
]

function portalColor(fromId: string, toId: string): string {
  const key = [fromId, toId].sort().join('|')
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return PORTAL_COLORS[hash % PORTAL_COLORS.length]
}

export function mapToEdges(
  map: GameMap,
  reachableCells?: Set<string>,
  selectedPlayer?: Player | null,
): Edge<CellEdgeData>[] {
  const nonPortal = map.edges.filter(e => !e.portal)
  const edgeSet = new Set(nonPortal.map(e => `${e.from}->${e.to}`))

  return nonPortal.map(e => {
    const isReachable = !!(selectedPlayer &&
      e.from === selectedPlayer.currentCellId && reachableCells?.has(e.to))
    const bidirectional = edgeSet.has(`${e.to}->${e.from}`)

    return {
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      sourceHandle: e.exitHandle ?? 'sr',
      targetHandle: e.entryHandle ?? 'tl',
      type: 'cell',
      data: { isReachable, bidirectional },
    }
  })
}

export function buildCellPlayers(players: Player[]): Map<string, Player[]> {
  const m = new Map<string, Player[]>()
  for (const p of players) {
    m.set(p.currentCellId, [...(m.get(p.currentCellId) ?? []), p])
  }
  return m
}

export function buildReachableCells(currentCellId: string, edges: GameMap['edges']): Set<string> {
  const s = new Set<string>()
  for (const e of edges) {
    if (e.from === currentCellId) s.add(e.to)
  }
  return s
}
