import { SPECIAL_CELL_TYPES, type SpecialCellType } from '@blind/shared'
import { ParamSlider } from './ParamSlider'

type SpecialType = SpecialCellType

const TYPE_META: Record<SpecialType, { label: string; color: string }> = {
  shop:   { label: 'Shop',   color: 'oklch(0.72 0.16 65)' },
  trap:   { label: 'Trap',   color: 'oklch(0.55 0.22 25)' },
  boss:   { label: 'Boss',   color: 'oklch(0.45 0.18 300)' },
  loot:   { label: 'Loot',   color: 'oklch(0.65 0.16 90)' },
  chance: { label: 'Chance', color: 'oklch(0.62 0.22 200)' },
  jail:   { label: 'Jail',   color: 'oklch(0.28 0.05 250)' },
}

interface Props {
  rate: number
  onRateChange: (v: number) => void
  types: string[]
  onTypesChange: (v: string[]) => void
}

export function SpecialTypesPicker({ rate, onRateChange, types, onTypesChange }: Props) {
  function toggle(t: SpecialType) {
    if (types.includes(t)) {
      if (types.length === 1) return // keep at least one
      onTypesChange(types.filter(x => x !== t))
    } else {
      onTypesChange([...types, t])
    }
  }

  const activeTypes = types.filter((t): t is SpecialType => (SPECIAL_CELL_TYPES as string[]).includes(t))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
          Special Cells
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {types.length} type{types.length !== 1 ? 's' : ''} enabled
        </span>
      </div>

      {/* type toggles */}
      <div className="flex gap-2 flex-wrap">
        {SPECIAL_CELL_TYPES.map(t => {
          const on = types.includes(t)
          const { label, color } = TYPE_META[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all"
              style={{
                borderColor: on ? color : 'oklch(0.35 0.01 0)',
                background: on ? `color-mix(in oklch, ${color} 15%, transparent)` : 'transparent',
                color: on ? color : 'oklch(0.55 0.01 0)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: on ? color : 'oklch(0.4 0.01 0)' }}
              />
              {label}
            </button>
          )
        })}
      </div>

      {/* rate slider */}
      <ParamSlider
        label="Rate"
        lowLabel="Rare"
        highLabel="Frequent"
        value={rate}
        onChange={onRateChange}
      >
        {/* mini preview: row of colored dots proportional to rate */}
        <svg viewBox="0 0 120 40" className="w-full h-full">
          {Array.from({ length: 9 }).map((_, i) => {
            const threshold = (i + 1) / 10
            const active = rate / 100 >= threshold
            const type = activeTypes[i % Math.max(activeTypes.length, 1)]
            const color = active && type ? TYPE_META[type].color : 'oklch(0.28 0.012 60)'
            return (
              <circle
                key={i}
                cx={10 + i * 12}
                cy={20}
                r={active ? 6 : 4}
                fill={color}
                opacity={active ? 1 : 0.35}
                style={{ transition: 'all 0.15s' }}
              />
            )
          })}
        </svg>
      </ParamSlider>
    </div>
  )
}
