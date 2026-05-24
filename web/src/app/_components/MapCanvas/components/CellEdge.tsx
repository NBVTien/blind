import { BaseEdge, type Edge, type EdgeProps } from '@xyflow/react'
import type { CellEdgeData } from '../types'

const AW = 7
const AH = 5.5

export function CellEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps<Edge<CellEdgeData>>) {
  const isReachable = data?.isReachable
  const bidirectional = data?.bidirectional
  const opacity = isReachable ? 0.9 : 0.55
  const sw = isReachable ? 2.5 : 1.8

  if (bidirectional) {
    return (
      <BaseEdge
        path={`M ${sourceX},${sourceY} L ${targetX},${targetY}`}
        style={{ stroke: 'var(--map-edge)', strokeOpacity: opacity, strokeWidth: sw, strokeLinecap: 'round' }}
      />
    )
  }

  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_')
  const mEnd = `ef_e_${safeId}`
  const half = AH / 2

  return (
    <>
      <defs>
        <marker id={mEnd} markerWidth={AW} markerHeight={AH}
          refX={0} refY={half} orient="auto" markerUnits="userSpaceOnUse">
          <path d={`M0,0 L0,${AH} L${AW},${half} z`} fill="var(--map-edge)" fillOpacity={opacity} />
        </marker>
      </defs>
      <BaseEdge
        path={`M ${sourceX},${sourceY} L ${targetX},${targetY}`}
        style={{ stroke: 'var(--map-edge)', strokeOpacity: opacity, strokeWidth: sw, strokeLinecap: 'butt' }}
        markerEnd={`url(#${mEnd})`}
      />
    </>
  )
}
