import { useState } from 'react'
import { ShoppingBag, RefreshCw, Lock, Swords, Heart, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useItems } from '@/lib/items.queries'
import { useWheels } from '@/lib/wheels.queries'
import { useGmAction } from '@/lib/gm-actions.queries'
import { actionLabel } from '@/app/_components/ActionPicker'
import { buildBossWheel } from './WheelInPanel'
import type { Session, GameMap, ActionType, AttachedAction, Wheel, CellTypeConfigMap, GmActionPayload } from '@blind/shared'

export function ActionsTab({
  session,
  map,
  sessionId,
  cellConfig,
  onTriggerSpaceEffect,
  onOpenShop,
  onOpenWheelOverlay,
}: {
  session: Session
  map: GameMap
  sessionId: number
  cellConfig: CellTypeConfigMap
  onTriggerSpaceEffect: (cellId: string, playerId: string) => void
  onOpenShop: () => void
  onOpenWheelOverlay: (wheel: Wheel, opts?: { wheelId?: number; playerId?: string; isBoss?: boolean }) => void
}) {
  const gmAction = useGmAction(sessionId)
  const { data: items = [] } = useItems()
  const { data: wheels = [] } = useWheels()

  // Shared selectors
  const [selectedPlayer, setSelectedPlayer] = useState(session.players[0]?.id ?? '')
  const currentPlayer = session.players.find(p => p.id === selectedPlayer)

  // Per-action state
  const [teleportCell, setTeleportCell] = useState('')
  const [goldAmount, setGoldAmount] = useState('10')
  const [giveItemId, setGiveItemId] = useState<number | ''>(items[0]?.id ?? '')
  const [useItemId, setUseItemId] = useState<number | ''>('')
  const [wheelId, setWheelId] = useState<number | ''>(wheels[0]?.id ?? '')
  const [changeCellId, setChangeCellId] = useState(map.cells[0]?.id ?? '')
  const [changeCellType, setChangeCellType] = useState('')
  const [changeCellLabel, setChangeCellLabel] = useState('')
  const [pathFrom, setPathFrom] = useState(map.cells[0]?.id ?? '')
  const [pathTo, setPathTo] = useState(map.cells[1]?.id ?? '')
  const [distanceResult, setDistanceResult] = useState<{ playerName: string; dist: number | null } | null>(null)
  const [endWinnerId, setEndWinnerId] = useState<string>('__none__')

  const allCells = map.cells
  const pathCells = allCells.filter(c => {
    const connected = new Set(map.edges.map(e => e.from))
    return connected.has(c.id)
  })

  function cellLabel(cellId: string) {
    const c = allCells.find(c => c.id === cellId)
    if (!c) return cellId
    return c.label ? `${c.label} (${cellId})` : `${c.type} — ${cellId}`
  }

  function run(type: ActionType, payload: Record<string, unknown>) {
    gmAction.mutate({ type, payload: payload as GmActionPayload })
  }

  const sectionClass = 'mb-6'
  const labelClass = 'text-xs uppercase tracking-widest text-muted-foreground font-display mb-2'
  const rowClass = 'flex flex-wrap items-end gap-2'

  return (
    <div className="p-3 overflow-y-auto">

      {/* ── Player selector (shared) ───────────────────────── */}
      <div className="mb-5 pb-4 border-b border-border">
        <p className={labelClass}>Active player</p>
        <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger className="text-xs h-8 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {session.players.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Movement ───────────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Movement</p>

        {/* Teleport */}
        <div className={rowClass + ' mb-2'}>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Teleport to</span>
            <Select
              value={teleportCell || '__random__'}
              onValueChange={v => setTeleportCell(v === '__random__' ? '' : v)}
            >
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__random__">Random cell</SelectItem>
                {pathCells.map(c => (
                  <SelectItem key={c.id} value={c.id}>{cellLabel(c.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedPlayer || gmAction.isPending}
            onClick={() => gmAction.mutate(
              { type: 'TELEPORT', payload: { playerId: selectedPlayer, toCellId: teleportCell || undefined } as GmActionPayload },
              {
                onSuccess: (data) => {
                  const player = data.session?.players.find(p => p.id === selectedPlayer)
                  if (player) onTriggerSpaceEffect(player.currentCellId, player.id)
                },
              },
            )}
            className="text-xs font-display tracking-widest"
          >
            Teleport
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedPlayer || gmAction.isPending}
            onClick={() => run('TELEPORT_TO_START', { playerId: selectedPlayer })}
            className="text-xs font-display tracking-widest"
          >
            To Start
          </Button>
        </div>
      </div>

      {/* ── Economy ───────────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Economy</p>

        <div className={rowClass + ' mb-2'}>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Amount (g)</span>
            <Input
              type="number"
              min={1}
              value={goldAmount}
              onChange={e => setGoldAmount(e.target.value)}
              className="w-20 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedPlayer || gmAction.isPending}
            onClick={() => run('GIVE_GOLD', { playerId: selectedPlayer, amount: Number(goldAmount) })}
            className="text-xs font-display tracking-widest"
          >
            Give Gold
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedPlayer || gmAction.isPending}
            onClick={() => run('TAKE_GOLD', { playerId: selectedPlayer, amount: Number(goldAmount) })}
            className="text-xs font-display tracking-widest border-accent/40 text-accent hover:bg-accent/10"
          >
            Take Gold
          </Button>
        </div>

        {/* Give item */}
        <div className={rowClass + ' mb-2'}>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Give item (free)</span>
            <Select value={giveItemId === '' ? '' : String(giveItemId)} onValueChange={v => setGiveItemId(Number(v))}>
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedPlayer || !giveItemId || gmAction.isPending}
            onClick={() => run('GIVE_ITEM', { playerId: selectedPlayer, itemId: giveItemId })}
            className="text-xs font-display tracking-widest"
          >
            Give
          </Button>
        </div>

        {/* Use item from inventory */}
        {currentPlayer && currentPlayer.inventory.length > 0 && (
          <div className={rowClass + ' mb-2'}>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Use item from inventory</span>
              <Select
                value={String(useItemId || currentPlayer.inventory[0]?.id || '')}
                onValueChange={v => setUseItemId(Number(v))}
              >
                <SelectTrigger className="text-xs h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentPlayer.inventory.map((item, i) => {
                    const nameCount = currentPlayer.inventory.filter(x => x.name === item.name).length
                    const nameIdx = currentPlayer.inventory.slice(0, i + 1).filter(x => x.name === item.name).length
                    const label = nameCount > 1 ? `${item.name} #${nameIdx}` : item.name
                    return <SelectItem key={`${item.id}-${i}`} value={String(item.id)}>{label}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={gmAction.isPending}
              onClick={() => gmAction.mutate(
              { type: 'USE_ITEM', payload: { playerId: selectedPlayer, itemId: useItemId || currentPlayer.inventory[0]?.id } as GmActionPayload },
              { onSuccess: (d) => { if (d.distanceToEnd !== undefined) setDistanceResult({ playerName: currentPlayer.name, dist: d.distanceToEnd ?? null }) } },
            )}
              className="text-xs font-display tracking-widest"
            >
              Use
            </Button>
          </div>
        )}
      </div>

      {/* ── Reveal ────────────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Reveal</p>
        <div className={rowClass}>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedPlayer || gmAction.isPending}
            onClick={() => gmAction.mutate(
              { type: 'DISTANCE_TO_END', payload: { playerId: selectedPlayer } as GmActionPayload },
              { onSuccess: (d) => setDistanceResult({ playerName: currentPlayer?.name ?? selectedPlayer, dist: d.distanceToEnd ?? null }) },
            )}
            className="text-xs font-display tracking-widest"
          >
            Distance to End
          </Button>
        </div>
        {distanceResult && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded border border-border px-3 py-2 text-xs text-foreground">
            <span>
              {distanceResult.dist === null
                ? `${distanceResult.playerName}: no path to end`
                : `${distanceResult.playerName}: ${distanceResult.dist} step${distanceResult.dist !== 1 ? 's' : ''} to end`}
            </span>
            <button onClick={() => setDistanceResult(null)} className="opacity-50 hover:opacity-100 transition-opacity text-xs">✕</button>
          </div>
        )}
      </div>

      {/* ── Map ───────────────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Map</p>

        {/* Change cell type */}
        <div className={rowClass + ' mb-2'}>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Cell</span>
            <Select value={changeCellId} onValueChange={setChangeCellId}>
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCells.map(c => <SelectItem key={c.id} value={c.id}>{cellLabel(c.id)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">New type</span>
            <Select
              value={changeCellType || '__random__'}
              onValueChange={v => setChangeCellType(v === '__random__' ? '' : v)}
            >
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__random__">Random</SelectItem>
                {(['plain','shop','trap','boss','loot','chance','jail','start','end'] as const).map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Custom label</span>
            <Input
              placeholder="optional"
              value={changeCellLabel}
              onChange={e => setChangeCellLabel(e.target.value)}
              className="w-28 h-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!changeCellId || gmAction.isPending}
            onClick={() => run('CHANGE_CELL_TYPE', {
              cellId: changeCellId,
              cellType: changeCellType || undefined,
              label: changeCellLabel || undefined,
            })}
            className="text-xs font-display tracking-widest"
          >
            Change
          </Button>
        </div>

        {/* Create / Delete path */}
        <div className={rowClass + ' mb-2'}>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <Select value={pathFrom} onValueChange={setPathFrom}>
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCells.map(c => <SelectItem key={c.id} value={c.id}>{cellLabel(c.id)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Select value={pathTo} onValueChange={setPathTo}>
              <SelectTrigger className="text-xs h-8 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCells.map(c => <SelectItem key={c.id} value={c.id}>{cellLabel(c.id)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!pathFrom || !pathTo || pathFrom === pathTo || gmAction.isPending}
            onClick={() => run('CREATE_PATH', { fromCellId: pathFrom, toCellId: pathTo })}
            className="text-xs font-display tracking-widest"
          >
            Add Path
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!pathFrom || !pathTo || pathFrom === pathTo || gmAction.isPending}
            onClick={() => run('DELETE_PATH', { fromCellId: pathFrom, toCellId: pathTo })}
            className="text-xs font-display tracking-widest border-accent/40 text-accent hover:bg-accent/10"
          >
            Del Path
          </Button>
        </div>
      </div>

      {/* ── Shop ──────────────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Shop</p>
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenShop}
          className="text-xs font-display tracking-widest flex items-center gap-1.5"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          Open Shop
        </Button>
      </div>

      {/* ── Space Config ──────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Space Config</p>
        <div className="flex flex-col gap-1">
          {(['start', 'trap', 'loot'] as const).map(type => {
            const acts = cellConfig[type]?.defaultActions as AttachedAction[] | undefined
            return (
              <p key={type} className="text-xs text-muted-foreground">
                <span className="font-display uppercase tracking-widest text-foreground">{type}</span>
                {' → '}{acts?.length ? actionLabel(acts) : <span className="italic">no default action</span>}
              </p>
            )
          })}
          {(['chance', 'jail'] as const).map(type => {
            const w = wheels.find(w => w.id === cellConfig[type]?.defaultWheelId)
              ?? wheels.find(w => w.name === (type === 'chance' ? 'Chance Wheel' : 'Jail Wheel'))
              ?? wheels[0]
            return (
              <p key={type} className="text-xs text-muted-foreground">
                <span className="font-display uppercase tracking-widest text-foreground">{type}</span>
                {' → '}{w ? w.name : <span className="italic">no wheel</span>}
              </p>
            )
          })}
          <p className="text-xs text-muted-foreground">
            <span className="font-display uppercase tracking-widest text-foreground">boss</span>
            {' → '}{cellConfig['boss']?.defaultBossHp ?? 10} <Heart className="h-3 w-3 inline" /> default
          </p>
        </div>
        <a
          href="/game-config"
          className="text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors font-display mt-2 block"
        >
          Edit in Game Config →
        </a>
      </div>

      {/* ── Wheel ─────────────────────────────────────────── */}
      <div className={sectionClass}>
        <p className={labelClass}>Spin Wheel</p>
        {wheels.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No wheels yet. Create one at <span className="font-display">/wheels</span>.
          </p>
        ) : (
          <div className={rowClass}>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Wheel</span>
              <Select value={wheelId === '' ? '' : String(wheelId)} onValueChange={v => setWheelId(Number(v))}>
                <SelectTrigger className="text-xs h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wheels.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!wheelId}
              onClick={() => {
                const w = wheels.find(w => w.id === wheelId)
                if (!w) return
                onOpenWheelOverlay(w, { wheelId: wheelId || undefined, playerId: selectedPlayer || undefined })
              }}
              className="text-xs font-display tracking-widest flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Open
            </Button>
          </div>
        )}
      </div>

      {/* ── Jail ──────────────────────────────────────────── */}
      {(() => {
        const jailPlayers = session.players.filter(p => {
          const cell = map.cells.find(c => c.id === p.currentCellId)
          return cell?.type === 'jail'
        })
        if (jailPlayers.length === 0) return null
        const jailWheelId = cellConfig['jail']?.defaultWheelId
        const jailWheel = (jailWheelId ? wheels.find(w => w.id === jailWheelId) : null) ?? wheels.find(w => w.name === 'Jail Wheel') ?? wheels[0]
        return (
          <div className={sectionClass}>
            <p className={labelClass}>Jail</p>
            {jailPlayers.map(p => (
              <div key={p.id} className="mb-3 p-2 rounded border border-[oklch(0.45_0.12_250/0.4)] bg-[oklch(0.28_0.05_250/0.12)]">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-xs font-medium text-foreground">{p.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">in jail — spin to escape</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!jailWheel}
                  onClick={() => {
                    if (!jailWheel) return
                    onOpenWheelOverlay(jailWheel, { wheelId: jailWheel.id, playerId: p.id })
                  }}
                  className="text-xs font-display tracking-widest border-[oklch(0.45_0.12_250/0.5)] text-[oklch(0.65_0.1_250)] hover:bg-[oklch(0.28_0.05_250/0.15)] flex items-center gap-1.5"
                >
                  <Lock className="h-3.5 w-3.5" /> Spin Jail Wheel
                </Button>
              </div>
            ))}
          </div>
        )
      })()}

      {/* ── Boss Fight ────────────────────────────────────── */}
      {(() => {
        const playersOnBoss = session.players.filter(p => {
          const cell = map.cells.find(c => c.id === p.currentCellId)
          return cell?.type === 'boss'
        })
        if (playersOnBoss.length === 0) return null
        return (
          <div className={sectionClass}>
            <p className={labelClass}>Boss Fight</p>
            {playersOnBoss.map(p => {
              const cell = map.cells.find(c => c.id === p.currentCellId)!
              return (
                <div key={p.id} className="mb-3 p-2 rounded border border-[oklch(0.55_0.2_30/0.4)] bg-[oklch(0.55_0.2_30/0.06)]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="text-xs font-medium text-foreground">{p.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
                      <span>Boss: <span className="font-display text-[oklch(0.7_0.15_30)] flex items-center gap-0.5">{cell.bossHp ?? cellConfig['boss']?.defaultBossHp ?? 10} <Heart className="h-3 w-3" /></span></span>
                      <span className="opacity-60">Win {p.hp ?? 3}:{5} Lose</span>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const wheel = buildBossWheel(p.hp ?? 3)
                      onOpenWheelOverlay(wheel, { playerId: p.id, isBoss: true })
                    }}
                    className="text-xs font-display tracking-widest border-[oklch(0.55_0.2_30/0.5)] text-[oklch(0.7_0.15_30)] hover:bg-[oklch(0.55_0.2_30/0.1)] flex items-center gap-1.5"
                  >
                    <Swords className="h-3.5 w-3.5" /> Open Battle
                  </Button>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── End Session ───────────────────────────────────── */}
      {session.status === 'active' && (
        <div className={sectionClass}>
          <p className={labelClass}>End Session</p>
          <div className={rowClass}>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Winner (optional)</span>
              <Select value={endWinnerId} onValueChange={setEndWinnerId}>
                <SelectTrigger className="text-xs h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No winner</SelectItem>
                  {session.players.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={gmAction.isPending}
              onClick={() => run('COMPLETE_SESSION', {
                ...(endWinnerId !== '__none__' ? { winnerId: endWinnerId } : {}),
              })}
              className="text-xs font-display tracking-widest flex items-center gap-1.5 border-muted-foreground/30 text-muted-foreground hover:text-foreground"
            >
              <Flag className="h-3.5 w-3.5" />
              End Session
            </Button>
          </div>
        </div>
      )}

      {/* Error */}
      {gmAction.isError && (
        <p className="text-xs text-accent mt-2">
          {(gmAction.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed'}
        </p>
      )}
    </div>
  )
}
