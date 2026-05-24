// Shows main trunk + branches. Branch count and depth grow with value.

const C = {
  edge: 'oklch(0.72 0.16 65)',
  plain: 'oklch(0.28 0.012 60)',
  start: 'oklch(0.65 0.18 120)',
  end: 'oklch(0.55 0.2 290)',
  border: 'oklch(0.92 0.03 75 / 20%)',
}

type Pt = { x: number; y: number }

function edgeOpacity(alpha: number) {
  return `oklch(0.72 0.16 65 / ${Math.round(alpha * 100)}%)`
}

export function DensityDiagram({ value }: { value: number }) {
  const t = value / 100

  // trunk: always 5 nodes in a loose diagonal
  const trunk: Pt[] = [
    { x: 14, y: 14 },
    { x: 36, y: 30 },
    { x: 60, y: 42 },
    { x: 84, y: 54 },
    { x: 106, y: 66 },
  ]

  // branches: up to 6 off trunk nodes, fading in proportionally
  const allBranches: { from: Pt; to: Pt; sub?: { from: Pt; to: Pt } }[] = [
    { from: trunk[1], to: { x: 22, y: 52 } },
    { from: trunk[1], to: { x: 50, y: 14 } },
    { from: trunk[2], to: { x: 72, y: 22 } },
    { from: trunk[2], to: { x: 44, y: 62 } },
    {
      from: trunk[3], to: { x: 96, y: 34 },
      sub: { from: { x: 96, y: 34 }, to: { x: 110, y: 22 } },
    },
    {
      from: trunk[3], to: { x: 70, y: 70 },
      sub: { from: { x: 70, y: 70 }, to: { x: 58, y: 78 } },
    },
  ]

  // each branch appears as t crosses its threshold
  const thresholds = [0.08, 0.22, 0.38, 0.52, 0.68, 0.84]

  return (
    <svg viewBox="0 0 120 82" className="w-full h-full">
      {/* trunk edges */}
      {trunk.slice(0, -1).map((p, i) => (
        <line
          key={i}
          x1={p.x} y1={p.y}
          x2={trunk[i + 1].x} y2={trunk[i + 1].y}
          stroke={edgeOpacity(0.7)}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}

      {/* branches */}
      {allBranches.map((b, i) => {
        const thresh = thresholds[i]
        if (t < thresh) return null
        const alpha = Math.min(1, (t - thresh) / 0.18) * 0.55
        return (
          <g key={i}>
            <line
              x1={b.from.x} y1={b.from.y}
              x2={b.to.x} y2={b.to.y}
              stroke={edgeOpacity(alpha)}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeDasharray="3 2"
            />
            {b.sub && (
              <line
                x1={b.sub.from.x} y1={b.sub.from.y}
                x2={b.sub.to.x} y2={b.sub.to.y}
                stroke={edgeOpacity(alpha * 0.7)}
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeDasharray="2 2"
              />
            )}
            {/* branch tip node */}
            <circle
              cx={b.to.x} cy={b.to.y} r="3.5"
              fill={C.plain}
              stroke={`oklch(0.92 0.03 75 / ${Math.round(alpha * 50)}%)`}
              strokeWidth="1"
              opacity={Math.min(1, (t - thresh) / 0.14)}
            />
            {b.sub && (
              <circle
                cx={b.sub.to.x} cy={b.sub.to.y} r="3"
                fill={C.plain}
                stroke={`oklch(0.92 0.03 75 / ${Math.round(alpha * 40)}%)`}
                strokeWidth="1"
                opacity={Math.min(1, (t - thresh) / 0.18)}
              />
            )}
          </g>
        )
      })}

      {/* trunk nodes */}
      {trunk.slice(1, -1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill={C.plain} stroke={C.border} strokeWidth="1" />
      ))}
      <circle cx={trunk[0].x} cy={trunk[0].y} r="5" fill={C.start} />
      <circle cx={trunk[4].x} cy={trunk[4].y} r="5" fill={C.end} />
    </svg>
  )
}
