// Shows a fixed path; each non-start/end node transitions from plain → colored special
// as the value increases. Each node "unlocks" at a different threshold.

const COLORS = {
  plain: 'oklch(0.28 0.012 60)',
  start: 'oklch(0.65 0.18 120)',
  end: 'oklch(0.55 0.2 290)',
  shop: 'oklch(0.72 0.16 65)',
  trap: 'oklch(0.55 0.22 25)',
  boss: 'oklch(0.45 0.18 300)',
  loot: 'oklch(0.65 0.16 90)',
}

type NodeDef = {
  cx: number; cy: number
  special: keyof typeof COLORS
  threshold: number
  r?: number
}

const NODES: NodeDef[] = [
  { cx: 10,  cy: 41, special: 'start', threshold: 0,    r: 5.5 },
  { cx: 30,  cy: 22, special: 'shop',  threshold: 0.15       },
  { cx: 50,  cy: 55, special: 'trap',  threshold: 0.30       },
  { cx: 67,  cy: 22, special: 'loot',  threshold: 0.45       },
  { cx: 84,  cy: 55, special: 'boss',  threshold: 0.60       },
  { cx: 100, cy: 30, special: 'shop',  threshold: 0.75       },
  { cx: 110, cy: 41, special: 'end',   threshold: 0,    r: 5.5 },
]

const EDGES = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]]

export function SpecialDiagram({ value }: { value: number }) {
  const t = value / 100

  return (
    <svg viewBox="0 0 120 82" className="w-full h-full">
      {/* edges */}
      {EDGES.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={NODES[a].cx} y1={NODES[a].cy}
          x2={NODES[b].cx} y2={NODES[b].cy}
          stroke="oklch(0.72 0.16 65 / 55%)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}

      {/* nodes */}
      {NODES.map((n, i) => {
        const isFixed = n.special === 'start' || n.special === 'end'
        const unlocked = isFixed || t >= n.threshold
        const progress = isFixed ? 1 : Math.min(1, (t - n.threshold) / 0.18)
        const color = unlocked ? COLORS[n.special] : COLORS.plain
        const r = n.r ?? 4.5

        return (
          <g key={i}>
            {/* glow ring for unlocked specials */}
            {!isFixed && unlocked && progress > 0.5 && (
              <circle
                cx={n.cx} cy={n.cy}
                r={r + 3.5}
                fill="none"
                stroke={COLORS[n.special]}
                strokeWidth="1"
                opacity={progress * 0.35}
              />
            )}
            <circle
              cx={n.cx} cy={n.cy} r={r}
              fill={color}
              stroke="oklch(0.92 0.03 75 / 18%)"
              strokeWidth="1"
              opacity={isFixed ? 1 : Math.max(0.25, progress)}
            />
            {/* label for unlocked specials */}
            {!isFixed && unlocked && progress > 0.7 && (
              <text
                x={n.cx}
                y={n.cy + r + 9}
                textAnchor="middle"
                fill={COLORS[n.special]}
                fontSize="6"
                fontFamily="inherit"
                opacity={Math.min(1, (progress - 0.7) / 0.3)}
                style={{ userSelect: 'none' }}
              >
                {n.special}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
