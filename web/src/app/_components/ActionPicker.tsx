import { useState } from 'react'
import { X, ChevronsUpDown, Check, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import type { ActionType, GmActionPayload, AttachedAction, Item, Wheel, Cell } from '@blind/shared'

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'MOVE', label: 'Move' },
  { value: 'TELEPORT', label: 'Teleport' },
  { value: 'TELEPORT_TO_START', label: 'Teleport to Start' },
  { value: 'RESET_MOVE', label: 'Reset Move' },
  { value: 'SWAP_PLAYERS', label: 'Swap Players' },
  { value: 'GIVE_GOLD', label: 'Give Gold' },
  { value: 'TAKE_GOLD', label: 'Take Gold' },
  { value: 'STEAL_GOLD', label: 'Steal Gold' },
  { value: 'GIVE_ITEM', label: 'Give Item' },
  { value: 'USE_ITEM', label: 'Use Item' },
  { value: 'BUY_ITEM', label: 'Buy Item' },
  { value: 'CHANGE_CELL_TYPE', label: 'Change Cell Type' },
  { value: 'CREATE_PATH', label: 'Create Path' },
  { value: 'DELETE_PATH', label: 'Delete Path' },
  { value: 'SET_PLAYER_HP', label: 'Set HP' },
  { value: 'ADJUST_HP', label: 'Adjust HP' },
  { value: 'ADJUST_MAX_HP', label: 'Adjust Max HP' },
  { value: 'BOSS_FIGHT_SPIN', label: 'Boss Fight Spin' },
  { value: 'SPIN_WHEEL', label: 'Spin Wheel' },
  { value: 'DISTANCE_TO_END', label: 'Distance to End' },
  { value: 'REVEAL_ADJACENT', label: 'Reveal Adjacent' },
  { value: 'NOTIFY_GM', label: 'Notify GM' },
  { value: 'BROADCAST', label: 'Broadcast' },
  { value: 'END_TURN', label: 'End Turn' },
  { value: 'SKIP_TURN', label: 'Skip Turn' },
  { value: 'REORDER_PLAYERS', label: 'Reorder Players' },
  { value: 'COMPLETE_SESSION', label: 'Complete Session' },
]

interface StepProps {
  value: AttachedAction
  onChange: (a: AttachedAction) => void
  onRemove: () => void
  index: number
  items?: Item[]
  wheels?: Wheel[]
  cells?: Cell[]
}

function ActionStep({ value, onChange, onRemove, index, items = [], wheels = [], cells = [] }: StepProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false)

  function patchPayload(patch: Partial<GmActionPayload>) {
    onChange({ ...value, payload: { ...value.payload, ...patch } })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-display uppercase tracking-widest">Step {index + 1}</span>
        <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-accent transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      <Popover open={typePickerOpen} onOpenChange={setTypePickerOpen}>
        <PopoverTrigger asChild>
          <button className="flex h-7 w-full items-center justify-between rounded-md border border-input bg-transparent px-2 text-xs shadow-xs hover:bg-accent/50 transition-colors">
            <span className={cn(!value?.type && 'text-muted-foreground')}>
              {value?.type ? (ACTION_TYPES.find(a => a.value === value.type)?.label ?? value.type) : 'Pick action…'}
            </span>
            <ChevronsUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search…" className="h-7 text-xs" />
            <CommandList className="max-h-52">
              <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No match</CommandEmpty>
              {ACTION_TYPES.map(a => (
                <CommandItem
                  key={a.value}
                  value={a.label}
                  onSelect={() => { onChange({ type: a.value, payload: {} }); setTypePickerOpen(false) }}
                  className="text-xs gap-2"
                >
                  <Check className={cn('h-3 w-3 shrink-0', value?.type === a.value ? 'opacity-100' : 'opacity-0')} />
                  {a.label}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {(value?.type === 'GIVE_GOLD' || value?.type === 'TAKE_GOLD') && (
        <Input
          type="number"
          min={1}
          placeholder="Amount (g)"
          value={value.payload.amount ?? ''}
          onChange={e => patchPayload({ amount: Number(e.target.value) || undefined })}
          className="h-7 text-xs"
        />
      )}

      {(value?.type === 'USE_ITEM' || value?.type === 'BUY_ITEM') && (
        items.length > 0 ? (
          <Select
            value={value.payload.itemId != null ? String(value.payload.itemId) : ''}
            onValueChange={v => patchPayload({ itemId: Number(v) })}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pick item…" /></SelectTrigger>
            <SelectContent>
              {items.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground italic">No items in catalog</span>
        )
      )}

      {value?.type === 'GIVE_ITEM' && (
        items.length > 0 ? (
          <Select
            value={value.payload.itemId != null ? String(value.payload.itemId) : ''}
            onValueChange={v => patchPayload({ itemId: Number(v) })}
          >
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pick item…" /></SelectTrigger>
            <SelectContent>
              {items.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground italic">No items in catalog</span>
        )
      )}

      {value?.type === 'TELEPORT' && cells.length > 0 && (
        <Select
          value={value.payload.toCellId ?? '__random__'}
          onValueChange={v => patchPayload({ toCellId: v === '__random__' ? undefined : v })}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__random__">Random cell</SelectItem>
            {cells.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.label ?? c.type} ({c.id})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {value?.type === 'CHANGE_CELL_TYPE' && (
        <Select
          value={value.payload.cellType ?? '__random__'}
          onValueChange={v => patchPayload({ cellType: v === '__random__' ? undefined : v })}
        >
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__random__">Random type</SelectItem>
            {(['plain', 'shop', 'trap', 'boss', 'loot', 'chance'] as const).map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {(value?.type === 'CREATE_PATH' || value?.type === 'DELETE_PATH') && (
        cells.length > 0 ? (
          <div className="flex gap-1.5">
            <Select value={value.payload.fromCellId ?? ''} onValueChange={v => patchPayload({ fromCellId: v || undefined })}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="From cell…" /></SelectTrigger>
              <SelectContent>
                {cells.map(c => <SelectItem key={c.id} value={c.id}>{c.label ?? c.type} — {c.id}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={value.payload.toCellId ?? ''} onValueChange={v => patchPayload({ toCellId: v || undefined })}>
              <SelectTrigger className="h-7 text-xs flex-1"><SelectValue placeholder="To cell…" /></SelectTrigger>
              <SelectContent>
                {cells.map(c => <SelectItem key={c.id} value={c.id}>{c.label ?? c.type} — {c.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <Input placeholder="From cell ID" value={value.payload.fromCellId ?? ''} onChange={e => patchPayload({ fromCellId: e.target.value || undefined })} className="h-7 text-xs flex-1" />
            <Input placeholder="To cell ID" value={value.payload.toCellId ?? ''} onChange={e => patchPayload({ toCellId: e.target.value || undefined })} className="h-7 text-xs flex-1" />
          </div>
        )
      )}

      {value?.type === 'SET_PLAYER_HP' && (
        <Input type="number" min={0} placeholder="HP value" value={value.payload.hp ?? ''} onChange={e => patchPayload({ hp: Number(e.target.value) || undefined })} className="h-7 text-xs" />
      )}

      {value?.type === 'ADJUST_HP' && (
        <Input type="number" placeholder="Amount (negative = damage)" value={value.payload.amount ?? ''} onChange={e => patchPayload({ amount: Number(e.target.value) || undefined })} className="h-7 text-xs" />
      )}

      {value?.type === 'ADJUST_MAX_HP' && (
        <Select value={String(value.payload.amount ?? '')} onValueChange={v => patchPayload({ amount: Number(v) })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Direction…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">+1 (increase)</SelectItem>
            <SelectItem value="-1">−1 (decrease)</SelectItem>
          </SelectContent>
        </Select>
      )}

      {value?.type === 'SPIN_WHEEL' && (
        wheels.length > 0 ? (
          <Select value={value.payload.wheelId != null ? String(value.payload.wheelId) : ''} onValueChange={v => patchPayload({ wheelId: Number(v) })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Pick wheel…" /></SelectTrigger>
            <SelectContent>
              {wheels.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground italic">No wheels yet</span>
        )
      )}

      {value?.type === 'SWAP_PLAYERS' && (
        <Input placeholder="Target player ID" value={value.payload.targetPlayerId ?? ''} onChange={e => patchPayload({ targetPlayerId: e.target.value || undefined })} className="h-7 text-xs" />
      )}

      {value?.type === 'MOVE' && cells.length > 0 && (
        <Select value={value.payload.toCellId ?? ''} onValueChange={v => patchPayload({ toCellId: v || undefined })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="To cell…" /></SelectTrigger>
          <SelectContent>
            {cells.map(c => <SelectItem key={c.id} value={c.id}>{c.label ?? c.type} ({c.id})</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {value?.type === 'STEAL_GOLD' && (
        <div className="flex flex-col gap-1.5">
          <Input placeholder="Target player ID (victim)" value={value.payload.targetPlayerId ?? ''} onChange={e => patchPayload({ targetPlayerId: e.target.value || undefined })} className="h-7 text-xs" />
          <Input type="number" min={1} placeholder="Amount (g)" value={value.payload.amount ?? ''} onChange={e => patchPayload({ amount: Number(e.target.value) || undefined })} className="h-7 text-xs" />
        </div>
      )}

      {value?.type === 'NOTIFY_GM' && (
        <Input placeholder="Message" value={value.payload.message ?? ''} onChange={e => patchPayload({ message: e.target.value || undefined })} className="h-7 text-xs" />
      )}

      {value?.type === 'BROADCAST' && (
        <Input placeholder="Broadcast message" value={value.payload.broadcastMessage ?? ''} onChange={e => patchPayload({ broadcastMessage: e.target.value || undefined })} className="h-7 text-xs" />
      )}
    </div>
  )
}

interface Props {
  value: AttachedAction[] | null
  onChange: (actions: AttachedAction[] | null) => void
  items?: Item[]
  wheels?: Wheel[]
  cells?: Cell[]
}

export function ActionPicker({ value, onChange, items = [], wheels = [], cells = [] }: Props) {
  const [open, setOpen] = useState(false)

  const steps = value ?? []

  function addStep() {
    onChange([...steps, { type: 'GIVE_GOLD' as ActionType, payload: {} }])
    setOpen(true)
  }

  function updateStep(i: number, a: AttachedAction) {
    const next = [...steps]
    next[i] = a
    onChange(next)
  }

  function removeStep(i: number) {
    const next = steps.filter((_, idx) => idx !== i)
    onChange(next.length ? next : null)
  }

  if (!open && steps.length === 0) {
    return (
      <button
        onClick={() => { addStep() }}
        className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-display"
      >
        + Add action
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="flex items-center gap-1.5 pb-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">Actions</span>
        {steps.length > 0 && (
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className="ml-auto text-muted-foreground hover:text-accent transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {steps.map((step, i) => (
        <div key={i} className={i > 0 ? 'border-t border-border/50 pt-3 mt-1' : undefined}>
          <ActionStep
            index={i}
            value={step}
            onChange={a => updateStep(i, a)}
            onRemove={() => removeStep(i)}
            items={items}
            wheels={wheels}
            cells={cells}
          />
        </div>
      ))}

      <button
        onClick={addStep}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-display uppercase tracking-widest self-start mt-3"
      >
        <Plus className="h-3 w-3" /> Add step
      </button>

      {steps.length === 0 && (
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-6 text-xs self-end">
          Cancel
        </Button>
      )}
    </div>
  )
}

export function actionLabel(actions: AttachedAction | AttachedAction[]): string {
  const arr = Array.isArray(actions) ? actions : [actions]
  return arr.map(action => {
    const p = action.payload
    switch (action.type) {
      case 'GIVE_GOLD': return `Give ${p.amount ?? '?'}g`
      case 'TAKE_GOLD': return `Take ${p.amount ?? '?'}g`
      case 'GIVE_ITEM': return `Give item`
      case 'USE_ITEM': return `Use item`
      case 'BUY_ITEM': return `Buy item`
      case 'TELEPORT': return p.toCellId ? `Teleport → ${p.toCellId}` : `Teleport (random)`
      case 'CHANGE_CELL_TYPE': return `Change cell → ${p.cellType ?? 'random'}`
      case 'CREATE_PATH': return `Create path ${p.fromCellId ?? '?'} → ${p.toCellId ?? '?'}`
      case 'DELETE_PATH': return `Delete path ${p.fromCellId ?? '?'} → ${p.toCellId ?? '?'}`
      case 'SET_PLAYER_HP': return `Set HP → ${p.hp ?? '?'}`
      case 'ADJUST_HP': return p.amount != null ? (p.amount >= 0 ? `Heal +${p.amount} HP` : `Damage ${p.amount} HP`) : `Adjust HP`
      case 'ADJUST_MAX_HP': return p.amount === 1 ? `Max HP +1` : `Max HP −1`
      case 'BOSS_FIGHT_SPIN': return `Boss fight spin`
      case 'SPIN_WHEEL': return `Spin wheel`
      case 'MOVE': return p.toCellId ? `Move → ${p.toCellId}` : `Move`
      case 'TELEPORT_TO_START': return `Teleport to start`
      case 'RESET_MOVE': return `Reset move`
      case 'STEAL_GOLD': return `Steal ${p.amount ?? '?'}g`
      case 'DISTANCE_TO_END': return `Distance to end`
      case 'REVEAL_ADJACENT': return `Reveal adjacent`
      case 'NOTIFY_GM': return p.message ? `Notify GM: ${p.message}` : `Notify GM`
      case 'BROADCAST': return p.broadcastMessage ? `Broadcast: ${p.broadcastMessage}` : `Broadcast`
      case 'END_TURN': return `End turn`
      case 'SKIP_TURN': return `Skip turn`
      case 'REORDER_PLAYERS': return `Reorder players`
      case 'COMPLETE_SESSION': return p.winnerId ? `Complete session (winner: ${p.winnerId})` : `Complete session`
      default: return action.type
    }
  }).join(' → ')
}
