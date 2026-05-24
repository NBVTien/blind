import React, { useState } from 'react'
import { Handle, type Node, type NodeProps } from '@xyflow/react'
import {
  NODE_W, NODE_H,
  CELL_COLOR_VARS, CELL_LABELS,
  HANDLE_POSITIONS, CORNER_STYLE,
} from '../constants'
import type { CellNodeData, PortalStub } from '../types'

const STUB_LEN = 14  // px length of stub line
const STUB_AW = 6
const STUB_AH = 5

// Maps source handle id → unit direction vector (dx, dy) pointing outward from cell
const HANDLE_DIR: Record<string, [number, number]> = {
  st: [0, -1], sb: [0, 1], sl: [-1, 0], sr: [1, 0],
  stl: [-1, -1], str: [1, -1], sbl: [-1, 1], sbr: [1, 1],
}

// Anchor point (x, y) relative to node top-left for each source handle
function handleAnchor(handle: string): [number, number] {
  switch (handle) {
    case 'st':  return [NODE_W / 2, 0]
    case 'sb':  return [NODE_W / 2, NODE_H]
    case 'sl':  return [0, NODE_H / 2]
    case 'sr':  return [NODE_W, NODE_H / 2]
    case 'stl': return [0, 0]
    case 'str': return [NODE_W, 0]
    case 'sbl': return [0, NODE_H]
    case 'sbr': return [NODE_W, NODE_H]
    default:    return [NODE_W / 2, 0]
  }
}

function PortalStubSvg({ stub, onDelete }: { stub: PortalStub; onDelete?: () => void }) {
  const [ax, ay] = handleAnchor(stub.handle)
  const rawDir = HANDLE_DIR[stub.handle] ?? [1, 0]
  const len = Math.hypot(rawDir[0], rawDir[1])
  const dx = rawDir[0] / len
  const dy = rawDir[1] / len

  const tx = ax + dx * STUB_LEN
  const ty = ay + dy * STUB_LEN

  // Arrow: exit points outward (tip at tx,ty), entry points inward (tip at ax,ay)
  const arrowTipX = stub.kind === 'exit' ? tx : ax
  const arrowTipY = stub.kind === 'exit' ? ty : ay
  const arrowDx = stub.kind === 'exit' ? dx : -dx
  const arrowDy = stub.kind === 'exit' ? dy : -dy
  const half = STUB_AH / 2
  const abx = arrowTipX - arrowDx * STUB_AW
  const aby = arrowTipY - arrowDy * STUB_AW
  const px = -arrowDy * half
  const py = arrowDx * half
  const arrowPath = `M${abx + px},${aby + py} L${arrowTipX},${arrowTipY} L${abx - px},${aby - py} Z`

  const margin = STUB_AW + 2
  const minX = Math.min(ax, tx) - margin
  const minY = Math.min(ay, ty) - margin
  const svgW = Math.abs(tx - ax) + margin * 2
  const svgH = Math.abs(ty - ay) + margin * 2
  const ox = -minX
  const oy = -minY

  const lbx = tx + dx * 5 + ox
  const lby = ty + dy * 5 + oy

  return (
    <svg
      onClick={onDelete ? (e) => { e.stopPropagation(); onDelete() } : undefined}
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width: svgW,
        height: svgH,
        overflow: 'visible',
        pointerEvents: onDelete ? 'all' : 'none',
        cursor: onDelete ? 'pointer' : 'default',
      }}
    >
      <line
        x1={(stub.bidirectional || stub.kind === 'exit' ? ax : abx) + ox}
        y1={(stub.bidirectional || stub.kind === 'exit' ? ay : aby) + oy}
        x2={(stub.bidirectional || stub.kind === 'entry' ? tx : abx) + ox}
        y2={(stub.bidirectional || stub.kind === 'entry' ? ty : aby) + oy}
        stroke={stub.color} strokeWidth={2} strokeOpacity={0.85} strokeLinecap="round"
      />
      {!stub.bidirectional && (
        <path
          d={arrowPath.replace(/([ML])([\d.+-]+),([\d.+-]+)/g,
            (_, cmd, x, y) => `${cmd}${parseFloat(x) + ox},${parseFloat(y) + oy}`)}
          fill={stub.color} fillOpacity={0.85}
        />
      )}
      <text
        x={lbx} y={lby}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={8} fontWeight="700" fontFamily="inherit"
        fill={stub.color} fillOpacity={0.95}
        stroke="var(--map-bg)" strokeWidth={2.5} paintOrder="stroke"
      >
        {stub.label}
      </text>
    </svg>
  )
}

const handleBase: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  border: '1.5px solid var(--map-bg)',
  background: 'var(--map-edge)',
  transition: 'opacity 0.15s',
}

export function CellNode({ data }: NodeProps<Node<CellNodeData>>) {
  const { cell, isConnected, editMode, isReachable, isPlayerHere, isPendingTarget, players, portalStubs, onToggleEdge } = data
  const [hovered, setHovered] = useState(false)
  const opacity = isConnected || cell.type === 'start' || cell.type === 'end' || cell.type === 'jail' ? 1 : 0.22

  let borderColor = 'var(--border)'
  let borderWidth = 1
  if (isPendingTarget)      { borderColor = 'var(--foreground)'; borderWidth = 2 }
  else if (isPlayerHere)    { borderColor = 'var(--map-edge)';   borderWidth = 2 }
  else if (isReachable)     { borderColor = 'var(--map-edge)';   borderWidth = 1.5 }

  const handleStyle: React.CSSProperties = {
    ...handleBase,
    opacity: editMode && hovered ? 0.9 : 0,
    pointerEvents: editMode ? 'all' : 'none',
  }

  const ariaLabel = [
    CELL_LABELS[cell.type],
    cell.label ? `(${cell.label})` : null,
    isReachable ? '— reachable' : null,
    isPlayerHere ? '— player here' : null,
    !isConnected ? '— disconnected' : null,
  ].filter(Boolean).join(' ')

  return (
    <div
      style={{ width: NODE_W, height: NODE_H, opacity, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={ariaLabel}
    >
      {HANDLE_POSITIONS.map(h => (
        <Handle
          key={h.id}
          type={h.type}
          position={h.position}
          id={h.id}
          style={h.corner ? { ...handleStyle, ...CORNER_STYLE[h.id] } : handleStyle}
        />
      ))}

      {isReachable && (
        <div style={{
          position: 'absolute', inset: -5, borderRadius: 10,
          background: 'var(--map-edge)', opacity: 0.12, pointerEvents: 'none',
        }} />
      )}

      <div style={{
        width: NODE_W, height: NODE_H, borderRadius: 8,
        background: CELL_COLOR_VARS[cell.type],
        border: `${borderWidth}px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: editMode ? 'context-menu' : 'default',
      }}>
        <span style={{
          color: 'var(--cell-label)', fontSize: 11, fontWeight: 700,
          userSelect: 'none', letterSpacing: '0.05em',
        }}>
          {CELL_LABELS[cell.type]}
        </span>
      </div>

      {portalStubs && portalStubs.map((stub, i) => (
        <PortalStubSvg
          key={i}
          stub={stub}
          onDelete={editMode && onToggleEdge ? () => onToggleEdge(stub.from, stub.to) : undefined}
        />
      ))}

      {players && players.length > 0 && (
        <div style={{
          position: 'absolute', top: -22, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', gap: 3, pointerEvents: 'none',
        }}>
          {players.map((p, i) => (
            <div key={p.id} title={p.name} style={{
              width: 20, height: 20, borderRadius: '50%',
              background: p.color, border: '1.5px solid var(--map-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, color: '#fff', zIndex: i,
            }}>
              {p.name[0].toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
