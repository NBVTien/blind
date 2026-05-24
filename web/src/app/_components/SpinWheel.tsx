/**
 * SpinWheel — physical spinning wheel component.
 *
 * Design:
 * - Uses requestAnimationFrame with a custom easing curve (fast start, long
 *   exponential deceleration) so it feels physically convincing.
 * - Winner is picked BEFORE animation starts (weighted random).
 * - Needle is fixed at top; wheel rotates to bring the winner slice to the needle.
 * - Needle "bounces" slightly as the wheel crosses it during deceleration.
 * - Exposes `spin()` imperative handle via ref.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { WheelEntry } from '@blind/shared'

// ─── Colours ─────────────────────────────────────────────────────────────────

export const WHEEL_COLORS = [
  'oklch(0.62 0.18 62)',  // amber — primary
  'oklch(0.45 0.16 300)', // deep violet — boss
  'oklch(0.52 0.20 200)', // teal — chance
  'oklch(0.48 0.20 25)',  // blood — trap
  'oklch(0.55 0.18 120)', // forest green — start
  'oklch(0.40 0.12 250)', // slate blue — jail
  'oklch(0.58 0.16 90)',  // gold-olive — loot
  'oklch(0.50 0.16 340)', // rose
  'oklch(0.35 0.10 60)',  // dark amber
  'oklch(0.44 0.14 170)', // sea green
  'oklch(0.42 0.18 280)', // indigo
  'oklch(0.55 0.14 30)',  // rust
]

export function wheelColor(i: number) {
  return WHEEL_COLORS[i % WHEEL_COLORS.length]
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

// ─── Physics ──────────────────────────────────────────────────────────────────

// Total spin duration ms. Feel: fast burst, long tail.
const SPIN_MS = 4200

// Easing: cubic-like but with a very long tail.
// t in [0,1] → eased t in [0,1]
function easeOut(t: number): number {
  // Combination: fast initial punch, then cubic deceleration
  return 1 - Math.pow(1 - t, 3.5)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpinWheelHandle {
  /**
   * Spin the wheel. If forcedEntry provided, lands on that entry.
   * Otherwise picks weighted-random winner.
   */
  spin: (forcedEntry?: WheelEntry) => void
}

export interface SpinWheelProps {
  entries: WheelEntry[]
  size?: number
  onResult?: (entry: WheelEntry, colorIdx: number) => void
  /** Called when spin animation starts */
  onSpinStart?: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SpinWheel = forwardRef<SpinWheelHandle, SpinWheelProps>(
  function SpinWheel({ entries, size = 380, onResult, onSpinStart }, ref) {
    const CX = size / 2
    const CY = size / 2
    const R = size / 2 - 16
    const HUB_R = size * 0.045

    const total = entries.reduce((s, e) => s + e.weight, 0)

    // Build slice geometry (angles start at top = -π/2)
    const slices = (() => {
      const out: {
        startAngle: number
        endAngle: number
        midAngle: number
        entry: WheelEntry
        idx: number
      }[] = []
      let angle = -Math.PI / 2
      for (let i = 0; i < entries.length; i++) {
        const sweep = (entries[i].weight / total) * 2 * Math.PI
        out.push({
          startAngle: angle,
          endAngle: angle + sweep,
          midAngle: angle + sweep / 2,
          entry: entries[i],
          idx: i,
        })
        angle += sweep
      }
      return out
    })()

    // Current wheel rotation in radians (accumulated across spins)
    const rotationRef = useRef(0)
    const rafRef = useRef<number | null>(null)
    const startTimeRef = useRef<number | null>(null)
    const spinParamsRef = useRef<{
      fromRad: number
      totalRad: number
      winnerIdx: number
    } | null>(null)

    const svgGroupRef = useRef<SVGGElement>(null)
    const needleRef = useRef<SVGPolygonElement>(null)

    // Landed state for slice highlighting
    const [landedIdx, setLandedIdx] = useState<number | null>(null)
    const [isSpinning, setIsSpinning] = useState(false)

    // Apply rotation to SVG group directly (bypasses React re-render cycle)
    // Use SVG transform attribute (rotate(deg,cx,cy)) not CSS — CSS transform-origin
    // on SVG <g> elements is unreliable cross-browser and causes off-center rotation.
    function applyRotation(rad: number) {
      const deg = rad * (180 / Math.PI)
      if (svgGroupRef.current) {
        svgGroupRef.current.setAttribute('transform', `rotate(${deg}, ${CX}, ${CY})`)
      }
    }

    // Needle bounce: oscillate needle tip based on angular velocity
    function applyNeedleBounce(progress: number) {
      if (!needleRef.current) return
      // Angular velocity peaks early and decays. Use derivative of easing.
      const t = progress
      // Rough velocity: derivative of easeOut(t) ≈ 3.5*(1-t)^2.5
      const velocity = 3.5 * Math.pow(Math.max(0, 1 - t), 2.5)
      // Needle deflects opposite to spin direction proportional to velocity
      const deflect = -velocity * 6  // px, negative = backward deflection
      needleRef.current.style.transform = `translateX(${deflect}px)`
    }

    function tick(now: number) {
      if (!startTimeRef.current || !spinParamsRef.current) return
      const elapsed = now - startTimeRef.current
      const progress = Math.min(elapsed / SPIN_MS, 1)
      const eased = easeOut(progress)

      const currentRad = spinParamsRef.current.fromRad + eased * spinParamsRef.current.totalRad
      rotationRef.current = currentRad
      applyRotation(currentRad)
      applyNeedleBounce(progress)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Done
        if (needleRef.current) needleRef.current.style.transform = ''
        setLandedIdx(spinParamsRef.current.winnerIdx)
        setIsSpinning(false)
        const winner = slices[spinParamsRef.current.winnerIdx]
        onResult?.(winner.entry, winner.idx)
      }
    }

    function spin(forcedEntry?: WheelEntry) {
      if (isSpinning || entries.length === 0) return

      // Cancel any running animation
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      // Pick winner: forced or weighted random
      let winnerIdx = slices.length - 1
      if (forcedEntry) {
        const idx = slices.findIndex(s => s.entry.id === forcedEntry.id)
        if (idx !== -1) winnerIdx = idx
      } else {
        let rng = Math.random() * total
        for (let i = 0; i < slices.length; i++) {
          rng -= slices[i].entry.weight
          if (rng <= 0) { winnerIdx = i; break }
        }
      }

      const winner = slices[winnerIdx]

      // Target: winner.midAngle lands at screen top (needle = -π/2 in unrotated coords).
      // After absolute rotation R, data angle A appears at screen angle (A + R).
      // We want: winner.midAngle + R ≡ -π/2 (mod 2π)
      //   → R = -π/2 - winner.midAngle
      // Normalise to a positive value so the wheel always spins forward,
      // then add full extra rotations for drama.
      // IMPORTANT: work in absolute rotation space. fromRad is the accumulated rotation
      // so far. We compute the next absolute target and derive totalRad = target - fromRad.
      const minExtraRotations = 5
      const extraRotations = minExtraRotations + Math.floor(Math.random() * 3)
      const baseTarget = -Math.PI / 2 - winner.midAngle
      // Offset from current accumulated rotation: how much more do we need to spin?
      const fromRad = rotationRef.current
      const delta = ((baseTarget - fromRad) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
      const totalRad = delta + extraRotations * 2 * Math.PI

      spinParamsRef.current = {
        fromRad: rotationRef.current,
        totalRad,
        winnerIdx,
      }

      setLandedIdx(null)
      setIsSpinning(true)
      onSpinStart?.()
      startTimeRef.current = performance.now()
      rafRef.current = requestAnimationFrame(tick)
    }

    useImperativeHandle(ref, () => ({ spin }), [isSpinning, entries])  // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup
    useEffect(() => {
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      }
    }, [])

    // Empty wheel
    if (entries.length === 0) {
      return (
        <svg width={size} height={size}>
          <circle cx={CX} cy={CY} r={R} fill="oklch(0.15 0.01 60)" stroke="oklch(0.92 0.03 75 / 20%)" strokeWidth={2} />
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="oklch(0.6 0.04 70)" fontFamily="Crimson Text, serif">
            No entries
          </text>
        </svg>
      )
    }

    const NEEDLE_H = size * 0.085
    const NEEDLE_W = size * 0.038

    return (
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {/* Ambient glow ring behind wheel */}
        <circle
          cx={CX} cy={CY} r={R + 4}
          fill="none"
          stroke="oklch(0.74 0.19 62 / 22%)"
          strokeWidth={10}
        />

        {/* Spinning group — SVG transform attribute, not CSS, for reliable center rotation */}
        <g ref={svgGroupRef}>
          {entries.length === 1 ? (
            <circle cx={CX} cy={CY} r={R} fill={wheelColor(0)} />
          ) : (
            slices.map(({ startAngle, endAngle, midAngle, entry, idx }) => {
              const isLanded = landedIdx === idx
              const dimmed = landedIdx !== null && !isLanded
              const slicePct = entry.weight / total
              const showLabel = slicePct > 0.05

              // Label position: 62% of radius from center
              const lx = CX + R * 0.63 * Math.cos(midAngle)
              const ly = CY + R * 0.63 * Math.sin(midAngle)

              // Lighten winner slice border
              return (
                <g key={entry.id}>
                  <path
                    d={slicePath(CX, CY, R, startAngle, endAngle)}
                    fill={wheelColor(idx)}
                    stroke="oklch(0.08 0.005 60)"
                    strokeWidth={1.5}
                    opacity={dimmed ? 0.35 : 1}
                    style={{ transition: 'opacity 0.4s' }}
                  />
                  {isLanded && (
                    <path
                      d={slicePath(CX, CY, R, startAngle, endAngle)}
                      fill="none"
                      stroke="oklch(0.96 0.04 75)"
                      strokeWidth={2.5}
                      opacity={0.7}
                    />
                  )}
                  {showLabel && (
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max(9, Math.min(13, size * 0.032))}
                      fontWeight={isLanded ? '600' : '400'}
                      fill={dimmed ? 'oklch(0.92 0.03 75 / 28%)' : 'oklch(0.96 0.02 75 / 92%)'}
                      fontFamily="Cormorant Garamond, serif"
                      style={{ pointerEvents: 'none', userSelect: 'none', transition: 'opacity 0.4s' }}
                    >
                      {entry.label.length > 11 ? entry.label.slice(0, 10) + '…' : entry.label}
                    </text>
                  )}
                </g>
              )
            })
          )}

          {/* Outer rim */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="oklch(0.92 0.03 75 / 22%)"
            strokeWidth={1.5}
          />

          {/* Spoke lines for visual texture */}
          {slices.map(({ startAngle, idx }) => (
            <line
              key={`spoke-${idx}`}
              x1={CX + HUB_R * Math.cos(startAngle)}
              y1={CY + HUB_R * Math.sin(startAngle)}
              x2={CX + R * Math.cos(startAngle)}
              y2={CY + R * Math.sin(startAngle)}
              stroke="oklch(0.08 0.005 60)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {/* Hub */}
          <circle cx={CX} cy={CY} r={HUB_R} fill="oklch(0.10 0.006 60)" stroke="oklch(0.74 0.19 62 / 35%)" strokeWidth={2} />
          <circle cx={CX} cy={CY} r={HUB_R * 0.38} fill="oklch(0.74 0.19 62 / 50%)" />
        </g>

        {/* Needle — sharp fixed pointer at top */}
        <g ref={needleRef} style={{ transformOrigin: `${CX}px ${CY - R - 2}px` }}>
          {/* Shadow */}
          <polygon
            points={`${CX},${CY - R - NEEDLE_H * 0.3} ${CX - NEEDLE_W * 0.7},${CY - R + NEEDLE_H * 0.7} ${CX + NEEDLE_W * 0.7},${CY - R + NEEDLE_H * 0.7}`}
            fill="oklch(0.05 0.005 60)"
            opacity={0.5}
            transform="translate(1.5, 2.5)"
          />
          {/* Needle body — sharp equilateral triangle pointing down */}
          <polygon
            points={`${CX},${CY - R - NEEDLE_H * 0.3} ${CX - NEEDLE_W * 0.7},${CY - R + NEEDLE_H * 0.7} ${CX + NEEDLE_W * 0.7},${CY - R + NEEDLE_H * 0.7}`}
            fill="oklch(0.74 0.19 62)"
            stroke="oklch(0.45 0.14 62)"
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* Inner highlight on needle */}
          <polygon
            points={`${CX},${CY - R - NEEDLE_H * 0.3} ${CX - NEEDLE_W * 0.25},${CY - R + NEEDLE_H * 0.35} ${CX},${CY - R + NEEDLE_H * 0.45}`}
            fill="oklch(0.88 0.12 72)"
            opacity={0.45}
          />
        </g>
      </svg>
    )
  },
)
