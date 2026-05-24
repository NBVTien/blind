// Shows path shape: straight cardinal at 0 → winding + diagonals at 100.
// Interpolates waypoint positions so the path visibly bends as value grows.

const C = {
  start: 'oklch(0.65 0.18 120)',
  end: 'oklch(0.55 0.2 290)',
  plain: 'oklch(0.28 0.012 60)',
  border: 'oklch(0.92 0.03 75 / 20%)',
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function ChaosDiagram({ value }: { value: number }) {
  const t = value / 100

  // 4 middle waypoints: at t=0 all on y=41 (flat cardinal line),
  // at t=1 they diverge into a winding path
  const straight = [
    { x: 28, y: 41 },
    { x: 50, y: 41 },
    { x: 72, y: 41 },
    { x: 94, y: 41 },
  ]
  const winding = [
    { x: 28, y: 18 },
    { x: 50, y: 62 },
    { x: 72, y: 18 },
    { x: 94, y: 58 },
  ]

  const pts = straight.map((s, i) => ({
    x: lerp(s.x, winding[i].x, t),
    y: lerp(s.y, winding[i].y, t),
  }))

  const all = [{ x: 10, y: 41 }, ...pts, { x: 110, y: 41 }]
  const pointsStr = all.map(p => `${p.x},${p.y}`).join(' ')

  // diagonal shortcut line fades in above chaos=40
  const diagAlpha = t < 0.4 ? 0 : Math.min(1, (t - 0.4) / 0.3) * 0.35

  return (
    <svg viewBox="0 0 120 82" className="w-full h-full">
      {/* diagonal shortcut hint */}
      {diagAlpha > 0 && (
        <line
          x1={pts[0].x} y1={pts[0].y}
          x2={pts[3].x} y2={pts[3].y}
          stroke={`oklch(0.72 0.16 65 / ${Math.round(diagAlpha * 100)}%)`}
          strokeWidth="1"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
      )}

      {/* main path */}
      <polyline
        points={pointsStr}
        fill="none"
        stroke="oklch(0.72 0.16 65 / 70%)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* intermediate nodes */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.8" fill={C.plain} stroke={C.border} strokeWidth="1" />
      ))}

      <circle cx={all[0].x} cy={all[0].y} r="5" fill={C.start} />
      <circle cx={all[all.length - 1].x} cy={all[all.length - 1].y} r="5" fill={C.end} />
    </svg>
  )
}
