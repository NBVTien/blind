import type React from 'react'
import { Position } from '@xyflow/react'
import type { CellType } from '@blind/shared'

export const CELL_SIZE = 90
export const NODE_W = 64
export const NODE_H = 34

export const CELL_COLOR_VARS: Record<CellType, string> = {
  plain:  'var(--cell-plain)',
  start:  'var(--cell-start)',
  end:    'var(--cell-end)',
  shop:   'var(--cell-shop)',
  trap:   'var(--cell-trap)',
  boss:   'var(--cell-boss)',
  loot:   'var(--cell-loot)',
  chance: 'var(--cell-chance)',
  jail:   'var(--cell-jail)',
}

export const CELL_COLORS: Record<CellType, string> = {
  plain:  'oklch(0.22 0.01 60)',
  start:  'oklch(0.65 0.18 120)',
  end:    'oklch(0.55 0.2 290)',
  shop:   'oklch(0.72 0.16 65)',
  trap:   'oklch(0.55 0.22 25)',
  boss:   'oklch(0.45 0.18 300)',
  loot:   'oklch(0.65 0.16 90)',
  chance: 'oklch(0.62 0.22 200)',
  jail:   'oklch(0.28 0.05 250)',
}

export const CELL_LABELS: Record<CellType, string> = {
  plain:  'Plain',
  start:  'Start',
  end:    'End',
  shop:   'Shop',
  trap:   'Trap',
  boss:   'Boss',
  loot:   'Loot',
  chance: 'Chance',
  jail:   'Jail',
}

export const ALL_TYPES: CellType[] = ['plain', 'start', 'end', 'shop', 'trap', 'boss', 'loot', 'chance', 'jail']

export const HANDLE_POSITIONS = [
  { type: 'source' as const, position: Position.Top,    id: 'st' },
  { type: 'source' as const, position: Position.Bottom, id: 'sb' },
  { type: 'source' as const, position: Position.Left,   id: 'sl' },
  { type: 'source' as const, position: Position.Right,  id: 'sr' },
  { type: 'target' as const, position: Position.Top,    id: 'tt' },
  { type: 'target' as const, position: Position.Bottom, id: 'tb' },
  { type: 'target' as const, position: Position.Left,   id: 'tl' },
  { type: 'target' as const, position: Position.Right,  id: 'tr' },
  { type: 'source' as const, position: Position.Top,    id: 'stl', corner: true },
  { type: 'source' as const, position: Position.Top,    id: 'str', corner: true },
  { type: 'source' as const, position: Position.Bottom, id: 'sbl', corner: true },
  { type: 'source' as const, position: Position.Bottom, id: 'sbr', corner: true },
  { type: 'target' as const, position: Position.Top,    id: 'ttl', corner: true },
  { type: 'target' as const, position: Position.Top,    id: 'ttr', corner: true },
  { type: 'target' as const, position: Position.Bottom, id: 'tbl', corner: true },
  { type: 'target' as const, position: Position.Bottom, id: 'tbr', corner: true },
]

// xyflow reads handle bounding rect (top-left) then applies:
//   Position.Top    → (handle.x + w/2,  handle.y)
//   Position.Bottom → (handle.x + w/2,  handle.y + h)
// CSS below ensures each corner lands on the exact node geometric corner.
export const CORNER_STYLE: Record<string, React.CSSProperties> = {
  stl: { top: 0,    left: 0,    transform: 'translateX(-50%)' },
  ttl: { top: 0,    left: 0,    transform: 'translateX(-50%)' },
  str: { top: 0,    right: 0,   left: 'unset', transform: 'translateX(50%)' },
  ttr: { top: 0,    right: 0,   left: 'unset', transform: 'translateX(50%)' },
  sbl: { bottom: 0, left: 0,    top: 'unset',  transform: 'translateX(-50%)' },
  tbl: { bottom: 0, left: 0,    top: 'unset',  transform: 'translateX(-50%)' },
  sbr: { bottom: 0, right: 0,   left: 'unset', top: 'unset', transform: 'translateX(50%)' },
  tbr: { bottom: 0, right: 0,   left: 'unset', top: 'unset', transform: 'translateX(50%)' },
}

export const HANDLE_OFFSETS: Record<string, [number, number]> = {
  st:  [NODE_W / 2, 0],        sb:  [NODE_W / 2, NODE_H],
  sl:  [0, NODE_H / 2],        sr:  [NODE_W, NODE_H / 2],
  tt:  [NODE_W / 2, 0],        tb:  [NODE_W / 2, NODE_H],
  tl:  [0, NODE_H / 2],        tr:  [NODE_W, NODE_H / 2],
  stl: [0, 0],                 str: [NODE_W, 0],
  sbl: [0, NODE_H],            sbr: [NODE_W, NODE_H],
  ttl: [0, 0],                 ttr: [NODE_W, 0],
  tbl: [0, NODE_H],            tbr: [NODE_W, NODE_H],
}

export const SOURCE_HANDLES = ['st', 'sb', 'sl', 'sr', 'stl', 'str', 'sbl', 'sbr'] as const
export const TARGET_HANDLES = ['tt', 'tb', 'tl', 'tr', 'ttl', 'ttr', 'tbl', 'tbr'] as const
