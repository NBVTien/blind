import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCellConfig, useUpdateCellConfig } from '@/lib/cell-config.queries'
import { useWheels } from '@/lib/wheels.queries'
import { useItems } from '@/lib/items.queries'
import { ActionPicker, actionLabel } from '@/app/_components/ActionPicker'
import type { CellTypeConfigMap, SpecialCellType, AttachedAction } from '@blind/shared'
import { SPECIAL_CELL_TYPES } from '@blind/shared'

const TYPE_META: Record<SpecialCellType, { label: string; color: string; desc: string }> = {
  chance: { label: 'Chance',  color: 'oklch(0.55 0.15 185)', desc: 'Triggers a wheel spin when a player lands here.' },
  jail:   { label: 'Jail',    color: 'oklch(0.45 0.12 250)', desc: 'Traps a player; spin to escape.' },
  boss:   { label: 'Boss',    color: 'oklch(0.35 0.15 300)', desc: 'Combat encounter. Set default HP.' },
  trap:   { label: 'Trap',    color: 'oklch(0.55 0.2 20)',   desc: 'Negative event on entry. Attach a default action.' },
  loot:   { label: 'Loot',    color: 'oklch(0.65 0.18 120)', desc: 'Free reward on entry. Attach a default action.' },
  shop:   { label: 'Shop',    color: 'oklch(0.65 0.15 75)',  desc: 'Players can buy items here.' },
}

export function CellConfigPage() {
  const { data: remote, isLoading } = useCellConfig()
  const { data: wheels = [] } = useWheels()
  const { data: items = [] } = useItems()
  const updateConfig = useUpdateCellConfig()

  const [local, setLocal] = useState<CellTypeConfigMap>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (remote) setLocal(remote)
  }, [remote])

  function patch(type: SpecialCellType, patch: Partial<CellTypeConfigMap[SpecialCellType] & {}>) {
    setLocal(prev => ({
      ...prev,
      [type]: { ...(prev[type] ?? {}), ...patch },
    }))
    setSaved(false)
  }

  function save() {
    updateConfig.mutate(local, { onSuccess: () => setSaved(true) })
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>

  return (
    <div className="p-10 max-w-3xl">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">Config</p>
          <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>Space Config</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={updateConfig.isPending} className="font-display tracking-widest">
            {updateConfig.isPending ? 'Saving…' : 'Save Config'}
          </Button>
          {saved && (
            <span className="text-xs text-success font-display tracking-widest">Saved</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {SPECIAL_CELL_TYPES.map(type => {
          const meta = TYPE_META[type]
          const cfg = local[type] ?? {}
          const needsWheel = type === 'chance' || type === 'jail'
          const needsBossHp = type === 'boss'
          const needsAction = type === 'trap' || type === 'loot'

          return (
            <div
              key={type}
              className="rounded-lg border border-border p-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: meta.color }}
                />
                <span
                  className="font-display tracking-widest text-sm uppercase font-semibold"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span className="text-xs text-muted-foreground">{meta.desc}</span>
              </div>

              {/* Wheel picker */}
              {needsWheel && (
                <div className="flex flex-col gap-1 mb-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
                    Default wheel
                  </span>
                  {wheels.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No wheels yet. Create one at /wheels.</p>
                  ) : (
                    <Select
                      value={cfg.defaultWheelId != null ? String(cfg.defaultWheelId) : '__none__'}
                      onValueChange={v => patch(type, { defaultWheelId: v === '__none__' ? undefined : Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs w-64">
                        <SelectValue placeholder="Pick wheel…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (first available)</SelectItem>
                        {wheels.map(w => (
                          <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Boss HP */}
              {needsBossHp && (
                <div className="flex flex-col gap-1 mb-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
                    Default boss HP
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={cfg.defaultBossHp ?? 10}
                    onChange={e => patch(type, { defaultBossHp: Math.max(1, Number(e.target.value)) || 10 })}
                    className="h-8 text-xs w-24"
                  />
                </div>
              )}

              {/* Default action */}
              {needsAction && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
                    Default action
                  </span>
                  <ActionPicker
                    value={(cfg.defaultActions as AttachedAction[]) ?? null}
                    onChange={actions => patch(type, { defaultActions: actions ?? undefined })}
                    items={items}
                    wheels={wheels}
                  />
                  {(cfg.defaultActions as AttachedAction[] | undefined)?.length && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Suggested to GM when a player lands on this space: <span className="text-foreground">{actionLabel(cfg.defaultActions as AttachedAction[])}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Shop: no extra config needed */}
              {type === 'shop' && (
                <p className="text-xs text-muted-foreground italic">
                  Shop opens the item catalog overlay automatically. No additional config needed.
                </p>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
