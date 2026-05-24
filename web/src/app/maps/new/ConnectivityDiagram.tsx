// Shows two branches of a path. Extra cross-edges appear and brighten as value grows.

const C = {
  edge: 'oklch(0.72 0.16 65)',
  cross: 'oklch(0.72 0.16 65)',
  plain: 'oklch(0.28 0.012 60)',
  start: 'oklch(0.65 0.18 120)',
  end: 'oklch(0.55 0.2 290)',
  border: 'oklch(0.92 0.03 75 / 20%)',
}

type Pt = { x: number; y: number }

const TOP: Pt[]    = [{ x: 10, y: 41 }, { x: 34, y: 18 }, { x: 60, y: 18 }, { x: 86, y: 18 }, { x: 110, y: 41 }]
const BOTTOM: Pt[] = [{ x: 10, y: 41 }, { x: 34, y: 64 }, { x: 60, y: 64 }, { x: 86, y: 64 }, { x: 110, y: 41 }]

// cross-edges between top and bottom branches at the same x-column
const CROSS_EDGES: { a: Pt; b: Pt; threshold: number }[] = [
  { a: TOP[1], b: BOTTOM[1], threshold: 0.10 },
  { a: TOP[2], b: BOTTOM[2], threshold: 0.25 },
  { a: TOP[3], b: BOTTOM[3], threshold: 0.40 },
  { a: TOP[1], b: BOTTOM[2], threshold: 0.55 },
  { a: TOP[2], b: BOTTOM[3], threshold: 0.68 },
  { a: TOP[1], b: BOTTOM[3], threshold: 0.80 },
]

function edge(alpha: number) {
  return `oklch(0.72 0.16 65 / ${Math.round(alpha * 100)}%)`
}

export function ConnectivityDiagram({ value }: { value: number }) {
  const t = value / 100

  const topNodes    = TOP.slice(1, -1)
  const bottomNodes = BOTTOM.slice(1, -1)

  return (
    <svg viewBox="0 0 120 82" className="w-full h-full">
      {/* top branch */}
      {TOP.slice(0, -1).map((p, i) => (
        <line
          key={`t${i}`}
          x1={p.x} y1={p.y} x2={TOP[i + 1].x} y2={TOP[i + 1].y}
          stroke={edge(0.65)} strokeWidth="1.8" strokeLinecap="round"
        />
      ))}

      {/* bottom branch */}
      {BOTTOM.slice(0, -1).map((p, i) => (
        <line
          key={`b${i}`}
          x1={p.x} y1={p.y} x2={BOTTOM[i + 1].x} y2={BOTTOM[i + 1].y}
          stroke={edge(0.65)} strokeWidth="1.8" strokeLinecap="round"
        />
      ))}

      {/* cross-edges */}
      {CROSS_EDGES.map((ce, i) => {
        if (t < ce.threshold) return null
        const progress = Math.min(1, (t - ce.threshold) / 0.16)
        return (
          <line
            key={`x${i}`}
            x1={ce.a.x} y1={ce.a.y} x2={ce.b.x} y2={ce.b.y}
            stroke={edge(progress * 0.5)}
            strokeWidth={1 + progress * 0.6}
            strokeLinecap="round"
            strokeDasharray={progress > 0.85 ? undefined : '3 2'}
          />
        )
      })}

      {/* nodes */}
      {topNodes.map((p, i) => (
        <circle key={`tn${i}`} cx={p.x} cy={p.y} r="4" fill={C.plain} stroke={C.border} strokeWidth="1" />
      ))}
      {bottomNodes.map((p, i) => (
        <circle key={`bn${i}`} cx={p.x} cy={p.y} r="4" fill={C.plain} stroke={C.border} strokeWidth="1" />
      ))}
      {/* start/end */}
      <circle cx={TOP[0].x} cy={TOP[0].y} r="5" fill={C.start} />
      <circle cx={TOP[4].x} cy={TOP[4].y} r="5" fill={C.end} />
    </svg>
  )
}
