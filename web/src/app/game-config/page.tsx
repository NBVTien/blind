import { useState, useEffect } from 'react'
import { GripVertical, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGameConfig, useUpdateGameConfig } from '@/lib/game-config.queries'
import { useWheels } from '@/lib/wheels.queries'
import { useItems } from '@/lib/items.queries'
import { ActionPicker, actionLabel } from '@/app/_components/ActionPicker'
import type { CellTypeConfigMap, SpecialCellType, CellTypeWithStart, AttachedAction, DeathActionStep, GameConfig, WinCondition } from '@blind/shared'
import { SPECIAL_CELL_TYPES } from '@blind/shared'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'death' | 'winning' | CellTypeWithStart

interface TabDef {
  id: TabId
  label: string
  color?: string
  group: 'meta' | 'space'
}

const SPACE_COLORS: Record<CellTypeWithStart, string> = {
  start:  'oklch(0.55 0.18 145)',
  chance: 'oklch(0.55 0.15 185)',
  jail:   'oklch(0.45 0.12 250)',
  boss:   'oklch(0.35 0.15 300)',
  trap:   'oklch(0.55 0.2 20)',
  loot:   'oklch(0.65 0.18 120)',
  shop:   'oklch(0.65 0.15 75)',
}

const TABS: TabDef[] = [
  { id: 'death',   label: 'Death',   group: 'meta' },
  { id: 'winning', label: 'Winning', group: 'meta' },
  { id: 'start',   label: 'Start',   color: SPACE_COLORS.start,  group: 'space' },
  { id: 'chance',  label: 'Chance',  color: SPACE_COLORS.chance, group: 'space' },
  { id: 'jail',    label: 'Jail',    color: SPACE_COLORS.jail,   group: 'space' },
  { id: 'boss',    label: 'Boss',    color: SPACE_COLORS.boss,   group: 'space' },
  { id: 'trap',    label: 'Trap',    color: SPACE_COLORS.trap,   group: 'space' },
  { id: 'loot',    label: 'Loot',    color: SPACE_COLORS.loot,   group: 'space' },
  { id: 'shop',    label: 'Shop',    color: SPACE_COLORS.shop,   group: 'space' },
]

// ─── Win condition ────────────────────────────────────────────────────────────

const WIN_CONDITION_OPTIONS: { value: WinCondition['type']; label: string; desc: string; hasTurns: boolean }[] = [
  { value: 'FIRST_TO_END',             label: 'First to reach END',          desc: 'First player to step on the END cell wins.',                            hasTurns: false },
  { value: 'POSITIVE_GOLD',            label: 'Has positive gold',           desc: 'Player must have at least 1 gold.',                                     hasTurns: false },
  { value: 'MOST_GOLD_AFTER_TURNS',    label: 'Most gold after X turns',     desc: 'When the turn limit is reached, the player with the most gold wins.',   hasTurns: true  },
  { value: 'LEAST_DEATHS_AFTER_TURNS', label: 'Fewest deaths after X turns', desc: 'When the turn limit is reached, the player with fewest deaths wins.',   hasTurns: true  },
]

// ─── Death step sortable row ──────────────────────────────────────────────────

interface StepRowProps {
  id: string
  step: DeathActionStep
  onChange: (s: DeathActionStep) => void
  onDelete: () => void
}

function StepRow({ id, step, onChange, onDelete }: StepRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-2 border-b border-border last:border-0"
    >
      <button {...attributes} {...listeners} aria-label="Drag to reorder step" className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>

      <Select
        value={step.type}
        onValueChange={(t) => {
          if (t === 'SKIP_TURNS') onChange({ type: 'SKIP_TURNS', count: (step as any).count ?? 3 })
          else if (t === 'RESPAWN_AT_START') onChange({ type: 'RESPAWN_AT_START', hp: (step as any).hp ?? 1 })
          else onChange({ type: 'GIVE_HP', amount: (step as any).amount ?? 1 })
        }}
      >
        <SelectTrigger className="h-8 text-xs w-44 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SKIP_TURNS">Skip Turns</SelectItem>
          <SelectItem value="RESPAWN_AT_START">Respawn at Start</SelectItem>
          <SelectItem value="GIVE_HP">Give HP</SelectItem>
        </SelectContent>
      </Select>

      {step.type === 'SKIP_TURNS' && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">count:</span>
          <Input
            type="number" min={1} max={20}
            value={step.count}
            onChange={e => onChange({ type: 'SKIP_TURNS', count: Math.max(1, Number(e.target.value)) })}
            className="h-8 text-xs w-16"
          />
        </div>
      )}

      {step.type === 'RESPAWN_AT_START' && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">HP:</span>
          <Input
            type="number" min={1} max={20}
            value={step.hp}
            onChange={e => onChange({ type: 'RESPAWN_AT_START', hp: Math.max(1, Number(e.target.value)) })}
            className="h-8 text-xs w-16"
          />
        </div>
      )}

      {step.type === 'GIVE_HP' && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">amount:</span>
          <Input
            type="number" min={1} max={20}
            value={step.amount}
            onChange={e => onChange({ type: 'GIVE_HP', amount: Math.max(1, Number(e.target.value)) })}
            className="h-8 text-xs w-16"
          />
        </div>
      )}

      <button onClick={onDelete} aria-label="Delete step" className="ml-auto text-muted-foreground/40 hover:text-accent transition-colors shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GameConfigPage() {
  const { state: sidebarState } = useSidebar()
  const sidebarLeft = sidebarState === 'collapsed' ? '3rem' : '16rem'

  const { data: remote, isLoading } = useGameConfig()
  const { data: wheels = [] } = useWheels()
  const { data: items = [] } = useItems()
  const updateConfig = useUpdateGameConfig()

  const [tab, setTab] = useState<TabId>('death')
  const [local, setLocal] = useState<GameConfig>({ cellConfig: {}, deathSequence: [], winConditions: [] })
  const [saved, setSaved] = useState(true)
  const [stepIds, setStepIds] = useState<string[]>([])

  useEffect(() => {
    if (remote) {
      setLocal(remote)
      setStepIds(remote.deathSequence.map((_, i) => String(i)))
    }
  }, [remote])

  const sensors = useSensors(useSensor(PointerSensor))

  function patchCell(type: CellTypeWithStart, patch: Partial<CellTypeConfigMap[CellTypeWithStart] & {}>) {
    setLocal(prev => ({ ...prev, cellConfig: { ...prev.cellConfig, [type]: { ...(prev.cellConfig[type] ?? {}), ...patch } } }))
    setSaved(false)
  }

  function addWinCondition(type: WinCondition['type']) {
    setLocal(prev => {
      if (prev.winConditions.some(c => c.type === type)) return prev
      const cond: WinCondition = type === 'MOST_GOLD_AFTER_TURNS' || type === 'LEAST_DEATHS_AFTER_TURNS'
        ? { type, turns: 10 }
        : { type } as WinCondition
      return { ...prev, winConditions: [...prev.winConditions, cond] }
    })
    setSaved(false)
  }

  function removeWinCondition(type: WinCondition['type']) {
    setLocal(prev => ({ ...prev, winConditions: prev.winConditions.filter(c => c.type !== type) }))
    setSaved(false)
  }

  function updateWinConditionTurns(type: 'MOST_GOLD_AFTER_TURNS' | 'LEAST_DEATHS_AFTER_TURNS', turns: number) {
    setLocal(prev => ({
      ...prev,
      winConditions: prev.winConditions.map(c => c.type === type ? { type, turns } : c),
    }))
    setSaved(false)
  }

  function updateStep(idx: number, step: DeathActionStep) {
    setLocal(prev => {
      const seq = [...prev.deathSequence]
      seq[idx] = step
      return { ...prev, deathSequence: seq }
    })
    setSaved(false)
  }

  function deleteStep(idx: number) {
    setLocal(prev => {
      const seq = prev.deathSequence.filter((_, i) => i !== idx)
      return { ...prev, deathSequence: seq }
    })
    setStepIds(prev => prev.filter((_, i) => i !== idx))
    setSaved(false)
  }

  function addStep() {
    const newStep: DeathActionStep = { type: 'SKIP_TURNS', count: 1 }
    setLocal(prev => ({ ...prev, deathSequence: [...prev.deathSequence, newStep] }))
    setStepIds(prev => [...prev, String(Date.now())])
    setSaved(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = stepIds.indexOf(String(active.id))
    const newIdx = stepIds.indexOf(String(over.id))
    setStepIds(prev => arrayMove(prev, oldIdx, newIdx))
    setLocal(prev => ({ ...prev, deathSequence: arrayMove(prev.deathSequence, oldIdx, newIdx) }))
    setSaved(false)
  }

  function save() {
    updateConfig.mutate(local, { onSuccess: () => setSaved(true) })
  }

  useEffect(() => {
    if (!saved) {
      const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [saved])

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>

  const labelClass = 'text-xs uppercase tracking-widest text-muted-foreground font-display mb-2'

  return (
    <div className="max-w-3xl pb-20">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-10 pt-10 mb-8">
        <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">Config</p>
        <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>Game Config</h1>
      </div>

      {/* ── Tab bar ────────────────────────────────────────── */}
      <div className="border-b border-border mb-10 overflow-x-auto scrollbar-none">
        <div className="flex items-end px-10 min-w-max">
          {TABS.map((t, i) => {
            const active = tab === t.id
            const isFirstSpace = t.group === 'space' && TABS[i - 1]?.group === 'meta'
            const activeColor = active && t.color ? t.color : active ? 'oklch(0.74 0.19 62)' : undefined

            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'relative pb-3 text-xs font-display tracking-widest uppercase transition-colors duration-150 shrink-0',
                  isFirstSpace ? 'ml-6 mr-5' : 'mr-5',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/70',
                ].join(' ')}
                style={active && t.color ? { color: t.color } : undefined}
              >
                {isFirstSpace && (
                  <span
                    className="absolute left-[-13px] top-0 bottom-3 w-px"
                    style={{ background: 'oklch(0.92 0.03 75 / 16%)' }}
                  />
                )}
                {t.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-px"
                    style={{ background: activeColor }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <div className="px-10">

        {/* Death Sequence */}
        {tab === 'death' && (
          <section>
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="text-xs font-display tracking-widest uppercase text-muted-foreground">Death Sequence</h2>
              <a href="/steps-docs" className="text-xs font-display tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors">
                step reference →
              </a>
            </div>
            <p className="text-muted-foreground text-xs mb-6">
              Steps executed in order when a player reaches 0 HP. Drag to reorder.
              SKIP_TURNS defers remaining steps until skips are exhausted.
            </p>

            <div className="mb-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
                  {local.deathSequence.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-3 border-b border-border">No steps. Add one below.</p>
                  )}
                  {local.deathSequence.map((step, idx) => (
                    <StepRow
                      key={stepIds[idx] ?? idx}
                      id={stepIds[idx] ?? String(idx)}
                      step={step}
                      onChange={s => updateStep(idx, s)}
                      onDelete={() => deleteStep(idx)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            <Button size="sm" variant="outline" onClick={addStep} className="text-xs font-display tracking-widest flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Step
            </Button>
          </section>
        )}

        {/* Win Conditions */}
        {tab === 'winning' && (
          <section>
            <h2 className="text-xs font-display tracking-widest uppercase text-muted-foreground mb-1">Win Conditions</h2>
            <p className="text-muted-foreground text-xs mb-6">
              All active conditions must be satisfied simultaneously for a player to win.
              Leave empty — GM ends session manually via "End Session".
            </p>

            <div className="flex flex-col gap-2 mb-4">
              {local.winConditions.length === 0 && (
                <p className="text-xs text-muted-foreground italic py-2 border-b border-border">No conditions. GM decides when to end.</p>
              )}
              {local.winConditions.map(cond => {
                const opt = WIN_CONDITION_OPTIONS.find(o => o.value === cond.type)
                return (
                  <div key={cond.type} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{opt?.label ?? cond.type}</span>
                      <p className="text-xs text-muted-foreground">{opt?.desc}</p>
                    </div>
                    {(cond.type === 'MOST_GOLD_AFTER_TURNS' || cond.type === 'LEAST_DEATHS_AFTER_TURNS') && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">turns:</span>
                        <Input
                          type="number" min={1} max={999}
                          value={cond.turns}
                          onChange={e => updateWinConditionTurns(cond.type as 'MOST_GOLD_AFTER_TURNS' | 'LEAST_DEATHS_AFTER_TURNS', Math.max(1, Number(e.target.value)))}
                          className="h-7 text-xs w-20"
                        />
                      </div>
                    )}
                    <button onClick={() => removeWinCondition(cond.type)} aria-label="Remove condition" className="text-muted-foreground/40 hover:text-accent transition-colors shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            <Select
              value=""
              onValueChange={v => addWinCondition(v as WinCondition['type'])}
            >
              <SelectTrigger className="h-8 text-xs w-64">
                <SelectValue placeholder="+ Add condition…" />
              </SelectTrigger>
              <SelectContent>
                {WIN_CONDITION_OPTIONS.filter(o => !local.winConditions.some(c => c.type === o.value)).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        )}

        {/* Start space */}
        {tab === 'start' && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: SPACE_COLORS.start }} />
              <span className="font-display tracking-widest text-sm uppercase font-semibold" style={{ color: SPACE_COLORS.start }}>Start</span>
              <span className="text-xs text-muted-foreground">Action fired automatically when a player lands on the START cell (including revisits).</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Default action</span>
              <ActionPicker
                value={(local.cellConfig['start']?.defaultActions as AttachedAction[]) ?? null}
                onChange={actions => patchCell('start', { defaultActions: actions ?? undefined })}
                items={items}
                wheels={wheels}
              />
              {(local.cellConfig['start']?.defaultActions as AttachedAction[] | undefined)?.length && (
                <p className="text-xs text-muted-foreground mt-1">
                  On landing: <span className="text-foreground">{actionLabel(local.cellConfig['start']?.defaultActions as AttachedAction[])}</span>
                </p>
              )}
            </div>
          </section>
        )}

        {/* Special space tabs */}
        {(SPECIAL_CELL_TYPES as string[]).includes(tab) && (() => {
          const type = tab as SpecialCellType
          const cfg = local.cellConfig[type] ?? {}
          const needsWheel = type === 'chance' || type === 'jail'
          const needsBossHp = type === 'boss'
          const needsAction = type === 'trap' || type === 'loot'
          const color = SPACE_COLORS[type]
          const desc = TABS.find(t => t.id === type)!

          const SPACE_DESCS: Record<SpecialCellType, string> = {
            chance: 'Triggers a wheel spin when a player lands here.',
            jail:   'Traps a player; spin to escape.',
            boss:   'Combat encounter. Set default HP.',
            trap:   'Negative event on entry. Attach a default action.',
            loot:   'Free reward on entry. Attach a default action.',
            shop:   'Players can buy items here.',
          }

          return (
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} />
                <span className="font-display tracking-widest text-sm uppercase font-semibold" style={{ color }}>{desc.label}</span>
                <span className="text-xs text-muted-foreground">{SPACE_DESCS[type]}</span>
              </div>

              {needsWheel && (
                <div className="flex flex-col gap-1 mb-6">
                  <span className={labelClass}>Default wheel</span>
                  {wheels.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No wheels yet.</p>
                  ) : (
                    <Select
                      value={cfg.defaultWheelId != null ? String(cfg.defaultWheelId) : '__none__'}
                      onValueChange={v => patchCell(type, { defaultWheelId: v === '__none__' ? undefined : Number(v) })}
                    >
                      <SelectTrigger className="h-8 text-xs w-64"><SelectValue placeholder="Pick wheel…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (first available)</SelectItem>
                        {wheels.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {needsBossHp && (
                <div className="flex flex-col gap-1 mb-6">
                  <span className={labelClass}>Default boss HP</span>
                  <Input
                    type="number" min={1} max={99}
                    value={cfg.defaultBossHp ?? 10}
                    onChange={e => patchCell(type, { defaultBossHp: Math.max(1, Number(e.target.value)) || 10 })}
                    className="h-8 text-xs w-24"
                  />
                </div>
              )}

              {needsAction && (
                <div className="flex flex-col gap-1">
                  <span className={labelClass}>Default action</span>
                  <ActionPicker
                    value={(cfg.defaultActions as AttachedAction[]) ?? null}
                    onChange={actions => patchCell(type, { defaultActions: actions ?? undefined })}
                    items={items}
                    wheels={wheels}
                  />
                  {(cfg.defaultActions as AttachedAction[] | undefined)?.length && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Suggested to GM on landing: <span className="text-foreground">{actionLabel(cfg.defaultActions as AttachedAction[])}</span>
                    </p>
                  )}
                </div>
              )}

              {type === 'shop' && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={labelClass}>Visible items</span>
                    {items.length > 0 && (
                      <span className={[
                        'text-xs font-display tracking-widest',
                        cfg.shopItemIds != null && cfg.shopItemIds.length === 0
                          ? 'text-accent'
                          : 'text-muted-foreground',
                      ].join(' ')}>
                        {cfg.shopItemIds == null
                          ? `all ${items.length}`
                          : cfg.shopItemIds.length === 0
                            ? 'none visible'
                            : `${cfg.shopItemIds.length} of ${items.length}`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Toggle which items appear when a player enters the shop. All shown by default.
                  </p>
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No items in catalog yet.</p>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        {items.map(item => {
                          const visible = cfg.shopItemIds == null || cfg.shopItemIds.includes(item.id)
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                const current = cfg.shopItemIds ?? items.map(i => i.id)
                                const next = visible
                                  ? current.filter(id => id !== item.id)
                                  : [...current, item.id]
                                patchCell('shop', { shopItemIds: next.length === items.length ? undefined : next })
                              }}
                              className={[
                                'flex items-center gap-3 py-2.5 border-b border-border last:border-0 text-left transition-colors',
                                visible ? 'hover:bg-muted/30' : 'opacity-40 hover:opacity-70 hover:bg-muted/20',
                              ].join(' ')}
                            >
                              {visible
                                ? <Eye className="h-3.5 w-3.5 text-primary shrink-0" />
                                : <EyeOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              }
                              <span className={['text-xs flex-1 min-w-0 truncate', visible ? 'text-foreground' : 'text-muted-foreground'].join(' ')}>
                                {item.name}
                              </span>
                              <span className="text-xs text-muted-foreground font-display tracking-widest shrink-0">
                                {item.cost}g
                              </span>
                            </button>
                          )
                        })}
                      </div>
                      {cfg.shopItemIds != null && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => patchCell('shop', { shopItemIds: undefined })}
                          className="mt-2 h-7 text-xs font-display tracking-widest text-muted-foreground hover:text-foreground self-start px-0"
                        >
                          Show all
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          )
        })()}

      </div>

      {/* ── Unsaved bar ────────────────────────────────────── */}
      {!saved && (
        <div className="fixed bottom-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-10 py-3 flex items-center justify-between transition-[left] duration-200 ease-linear" style={{ left: sidebarLeft }}>
          <span className="text-xs text-muted-foreground font-display tracking-widest">Unsaved changes</span>
          <Button onClick={save} disabled={updateConfig.isPending} className="font-display tracking-widest text-xs">
            {updateConfig.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  )
}
