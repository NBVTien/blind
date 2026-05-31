import { useState } from 'react'
import { Coins, Lock, GripVertical, Heart, SkipForward, MapPin, UserPlus } from 'lucide-react'
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
import type { Session, GameMap, Wheel, Player, CellType } from '@blind/shared'
import { CELL_COLORS as CELL_TYPE_COLORS, CELL_LABELS as CELL_TYPE_LABELS } from '@/app/_components/MapCanvas'

function HeartsDisplay({ hp, max = 3, onSetHp, playerId }: {
  hp: number
  max?: number
  onSetHp: (playerId: string, hp: number) => void
  playerId: string
}) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSetHp(playerId, i < hp ? i : i + 1)}
          className="transition-opacity hover:opacity-70"
          aria-label={`Set HP to ${i + 1}`}
        >
          <Heart
            className={`h-3.5 w-3.5 ${i < hp ? 'text-accent fill-accent' : 'text-muted-foreground/25'}`}
          />
        </button>
      ))}
    </span>
  )
}

function SortablePlayerRow({
  player,
  session,
  map,
  wheels,
  cellConfig,
  selectedPlayerId,
  onSelectPlayer,
  onAdjustGold,
  onSetHp,
  onAdjustMaxHp,
  onOpenWheelOverlay,
  onEndTurn,
  onSkipTurn,
  onClearSkip,
}: {
  player: Player
  session: Session
  map: GameMap
  wheels: Wheel[]
  cellConfig: Partial<Record<string, { defaultWheelId?: number; defaultBossHp?: number; defaultActions?: unknown }>>
  selectedPlayerId: string | null
  onSelectPlayer: (id: string) => void
  onAdjustGold: (playerId: string, amount: number) => void
  onSetHp: (playerId: string, hp: number) => void
  onAdjustMaxHp: (playerId: string, delta: number) => void
  onOpenWheelOverlay: (wheel: Wheel, opts?: { wheelId?: number; playerId?: string; isBoss?: boolean }) => void
  onEndTurn: (playerId: string) => void
  onSkipTurn: (playerId: string) => void
  onClearSkip: (playerId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  const maxHp = player.maxHp ?? 3
  const hp = Math.min(player.hp ?? maxHp, maxHp)
  const playerCell = map.cells.find(c => c.id === player.currentCellId)
  const cellType = playerCell?.type ?? 'plain'
  const cellColor = CELL_TYPE_COLORS[cellType as CellType] ?? CELL_TYPE_COLORS.plain
  const cellLabel = CELL_TYPE_LABELS[cellType as CellType] ?? cellType
  const isInJail = cellType === 'jail'
  const jailWheelId = cellConfig['jail']?.defaultWheelId
  const jailWheel = (jailWheelId ? wheels.find(w => w.id === jailWheelId) : null) ?? wheels.find(w => w.name === 'Jail Wheel') ?? wheels[0]
  const isActive = session.activePlayerId === player.id
  const isDone = session.turnDoneIds.includes(player.id)
  const isSkipping = (player.skippedTurnsRemaining ?? 0) > 0

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`relative py-5 transition-colors ${isActive ? 'bg-primary/[0.04]' : ''}`}>
        {/* Active accent line */}
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary/60 rounded-r" />
        )}

        {/* ── Identity row ── */}
        <div className="flex items-center gap-2.5 px-4 mb-3">
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="text-muted-foreground/25 hover:text-muted-foreground/60 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <div className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: player.color }} />

          <span className="font-display text-base tracking-wide text-foreground flex-1 leading-none">{player.name}</span>

          {/* Status badges */}
          <div className="flex items-center gap-1.5">
            {isSkipping && (
              <button
                onClick={() => onClearSkip(player.id)}
                title="Clear skip penalty"
                className="text-[9px] font-display tracking-widest text-accent border border-accent/40 rounded px-1.5 py-0.5 leading-none hover:bg-accent/10 transition-colors"
              >
                SKIP ×{player.skippedTurnsRemaining}
              </button>
            )}
            {isActive && (
              <span className="text-[9px] font-display tracking-widest text-primary border border-primary/50 rounded px-1.5 py-0.5 leading-none bg-primary/10">ACTIVE</span>
            )}
            {isDone && !isActive && (
              <span className="text-[9px] font-display tracking-widest text-muted-foreground/50 border border-border/50 rounded px-1.5 py-0.5 leading-none">DONE</span>
            )}
          </div>

          {/* Primary action */}
          {isInJail ? (
            <button
              disabled={!jailWheel}
              onClick={() => { if (jailWheel) onOpenWheelOverlay(jailWheel, { wheelId: jailWheel.id, playerId: player.id }) }}
              className="text-xs px-2.5 min-h-[36px] rounded font-display tracking-widest transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: `${cellColor}18`, color: cellColor, border: `1px solid ${cellColor}50` }}
            >
              <Lock className="h-3 w-3" /> Spin Jail
            </button>
          ) : (
            <button
              onClick={() => onSelectPlayer(player.id)}
              className={`text-xs px-2.5 min-h-[36px] rounded font-display tracking-widest transition-colors shrink-0 ${
                selectedPlayerId === player.id
                  ? 'bg-primary/20 text-primary border border-primary/50'
                  : 'text-muted-foreground/60 border border-border/50 hover:text-foreground hover:border-border'
              }`}
            >
              {selectedPlayerId === player.id ? 'Selected' : 'Move'}
            </button>
          )}
        </div>

        {/* ── Stat strip ── */}
        <div className="flex items-center gap-4 px-4 mb-4">
          {/* Cell type badge */}
          <span
            className="text-xs font-display tracking-widest px-1.5 py-0.5 rounded leading-none flex items-center gap-1"
            style={{ background: `${cellColor}18`, color: cellColor, border: `1px solid ${cellColor}35` }}
          >
            <MapPin className="h-2.5 w-2.5" />
            {cellLabel}
          </span>

          {/* Gold */}
          <span className="flex items-center gap-1 text-sm">
            <Coins className="h-3.5 w-3.5 text-primary/70" />
            <span className="font-display text-primary font-semibold tabular-nums">{player.gold}</span>
          </span>

          {/* Hearts (clickable) */}
          <HeartsDisplay hp={hp} max={maxHp} onSetHp={onSetHp} playerId={player.id} />
        </div>

        {/* ── Controls ── */}
        <div className="px-4 flex flex-col gap-3">

          {/* Gold + HP row */}
          <div className="flex items-center gap-6">
            {/* Gold adjustments */}
            <div className="flex items-center gap-1">
              {[-10, -1, 1, 10].map(amt => (
                <button
                  key={amt}
                  onClick={() => onAdjustGold(player.id, amt)}
                  className={`text-xs w-8 min-h-[36px] rounded border font-display tabular-nums transition-colors ${
                    amt > 0
                      ? 'border-primary/30 text-primary hover:bg-primary/15'
                      : 'border-border/60 text-muted-foreground/70 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {amt > 0 ? `+${amt}` : amt}
                </button>
              ))}
              <span className="text-[9px] text-muted-foreground/40 ml-0.5 font-display tracking-widest">GOLD</span>
            </div>

            {/* Max HP */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAdjustMaxHp(player.id, -1)}
                disabled={maxHp <= 1}
                className="text-xs w-7 min-h-[36px] rounded border border-border/60 text-muted-foreground/70 hover:bg-muted font-display transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              >
                −
              </button>
              <span className="text-xs font-display text-muted-foreground/60 w-3 text-center tabular-nums">{maxHp}</span>
              <button
                onClick={() => onAdjustMaxHp(player.id, 1)}
                className="text-xs w-7 min-h-[36px] rounded border border-primary/30 text-primary hover:bg-primary/15 font-display transition-colors"
              >
                +
              </button>
              <span className="text-[9px] text-muted-foreground/40 ml-0.5 font-display tracking-widest flex items-center gap-0.5">MAX <Heart className="h-2.5 w-2.5" /></span>
            </div>
          </div>

          {/* Turn actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEndTurn(player.id)}
              className={`text-xs px-3 min-h-[36px] rounded font-display tracking-widest transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'border border-primary/50 text-primary hover:bg-primary/15'
                  : 'border border-border/50 text-muted-foreground/50 hover:bg-muted hover:text-foreground'
              }`}
            >
              <SkipForward className="h-3 w-3" /> End Turn
            </button>
            <button
              onClick={() => onSkipTurn(player.id)}
              className="text-xs px-3 min-h-[36px] rounded border border-accent/30 text-accent/70 hover:bg-accent/10 hover:text-accent font-display tracking-widest transition-colors"
            >
              Skip Turn
            </button>
          </div>

          {/* Inventory */}
          {player.inventory.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {player.inventory.map((item, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 font-display tracking-wide border border-border/30">{item.name}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const PRESET_COLORS = ['#e05252', '#e09a52', '#d4c94a', '#52c97a', '#527fe0', '#a552e0', '#e052b8', '#52d4d4']

function AddPlayerRow({ onAdd }: { onAdd: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed, color)
    setName('')
    setColor(PRESET_COLORS[0])
    setOpen(false)
  }

  if (!open) {
    return (
      <div className="border-t border-border/40 mx-4">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 w-full px-4 py-3 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add player
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-border/40 mx-4">
      <div className="px-4 py-3 flex flex-col gap-3">
        <p className="text-[10px] tracking-widest uppercase text-muted-foreground/50">New Player</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false) }}
            placeholder="Name"
            className="flex-1 bg-input border border-border rounded-md px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40"
          >
            Add
          </button>
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded-full transition-transform"
              style={{
                background: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function PlayersTab({
  session,
  map,
  wheels,
  cellConfig,
  selectedPlayerId,
  onSelectPlayer,
  onAdjustGold,
  onSetHp,
  onAdjustMaxHp,
  onOpenWheelOverlay,
  onEndTurn,
  onSkipTurn,
  onClearSkip,
  onReorder,
  onAddPlayer,
}: {
  session: Session
  map: GameMap
  wheels: Wheel[]
  cellConfig: Partial<Record<string, { defaultWheelId?: number; defaultBossHp?: number; defaultActions?: unknown }>>
  selectedPlayerId: string | null
  onSelectPlayer: (id: string) => void
  onAdjustGold: (playerId: string, amount: number) => void
  onSetHp: (playerId: string, hp: number) => void
  onAdjustMaxHp: (playerId: string, delta: number) => void
  onOpenWheelOverlay: (wheel: Wheel, opts?: { wheelId?: number; playerId?: string; isBoss?: boolean }) => void
  onEndTurn: (playerId: string) => void
  onSkipTurn: (playerId: string) => void
  onClearSkip: (playerId: string) => void
  onReorder: (playerOrder: string[]) => void
  onAddPlayer: (name: string, color: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = session.players.map(p => p.id)
    const oldIdx = ids.indexOf(String(active.id))
    const newIdx = ids.indexOf(String(over.id))
    onReorder(arrayMove(ids, oldIdx, newIdx))
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={session.players.map(p => p.id)} strategy={verticalListSortingStrategy}>
          {session.players.map((player, idx) => (
            <div key={player.id}>
              {idx > 0 && <div className="border-t border-border/40 mx-4" />}
              <SortablePlayerRow
                player={player}
                session={session}
                map={map}
                wheels={wheels}
                cellConfig={cellConfig}
                selectedPlayerId={selectedPlayerId}
                onSelectPlayer={onSelectPlayer}
                onAdjustGold={onAdjustGold}
                onSetHp={onSetHp}
                onAdjustMaxHp={onAdjustMaxHp}
                onOpenWheelOverlay={onOpenWheelOverlay}
                onEndTurn={onEndTurn}
                onSkipTurn={onSkipTurn}
                onClearSkip={onClearSkip}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>
      <AddPlayerRow onAdd={onAddPlayer} />
    </>
  )
}
