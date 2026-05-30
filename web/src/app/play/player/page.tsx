import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Heart, Coins, ShoppingBag, Swords, RefreshCw, MapPin, ArrowLeft, SkipForward, X, Trophy, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useSessionByCode, useEndTurn } from '@/lib/sessions.queries'
import { useMap } from '@/lib/maps.queries'
import { useItems } from '@/lib/items.queries'
import { usePlayerAction } from '@/lib/gm-actions.queries'
import { useGameConfig } from '@/lib/game-config.queries'
import type { Cell, WheelEntry, BossFightSpinResult } from '@blind/shared'
import { CELL_COLORS as CELL_TYPE_COLORS, CELL_LABELS as CELL_TYPE_LABELS } from '@/app/_components/MapCanvas'

// ─── Relative time ───────────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 30) return 'just now'
  if (s < 120) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ─── Compass helpers ─────────────────────────────────────────────────────────

type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

const HANDLE_TO_DIR: Record<string, Direction> = {
  st: 'N', str: 'NE', sr: 'E', sbr: 'SE',
  sb: 'S', sbl: 'SW', sl: 'W', stl: 'NW',
}

function getDirectionFromHandle(exitHandle: string | undefined, from: Cell, to: Cell): Direction {
  if (exitHandle && HANDLE_TO_DIR[exitHandle]) return HANDLE_TO_DIR[exitHandle]
  const dr = to.row - from.row
  const dc = to.col - from.col
  if (dr < 0 && dc === 0) return 'N'
  if (dr < 0 && dc > 0)  return 'NE'
  if (dr === 0 && dc > 0) return 'E'
  if (dr > 0 && dc > 0)  return 'SE'
  if (dr > 0 && dc === 0) return 'S'
  if (dr > 0 && dc < 0)  return 'SW'
  if (dr === 0 && dc < 0) return 'W'
  return 'NW'
}

const DIR_GRID: Record<Direction, [number, number]> = {
  NW: [1,1], N: [2,1], NE: [3,1],
  W:  [1,2],           E:  [3,2],
  SW: [1,3], S: [2,3], SE: [3,3],
}

// ─── Shop overlay ────────────────────────────────────────────────────────────

function ShopOverlay({
  items,
  playerGold,
  isPending,
  onBuy,
  onClose,
}: {
  items: { id: number; name: string; description: string; cost: number }[]
  playerGold: number
  isPending: boolean
  onBuy: (itemId: number) => void
  onClose: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 py-3 border-b border-border flex items-center gap-3">
        <button aria-label="Close shop" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-display tracking-widest uppercase text-sm text-foreground flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Shop
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-sm">
          <Coins className="w-4 h-4 text-primary/70" />
          <span className="text-primary font-medium">{playerGold}g</span>
        </span>
      </header>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {items.length === 0 && (
          <p className="px-6 py-8 text-muted-foreground text-sm italic">No items available</p>
        )}
        {items.map(item => (
          <div key={item.id} className="px-6 py-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.description}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-primary font-medium">{item.cost}g</span>
              <button
                onClick={() => onBuy(item.id)}
                disabled={playerGold < item.cost || isPending}
                className="px-4 py-2 min-h-10 rounded-lg text-sm font-medium tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: `${CELL_TYPE_COLORS.shop}22`,
                  color: CELL_TYPE_COLORS.shop,
                  border: `1px solid ${CELL_TYPE_COLORS.shop}55`,
                }}
              >
                {isPending ? '…' : 'Buy'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function PlayerViewPage() {
  const { code = '', playerId = '' } = useParams<{ code: string; playerId: string }>()
  const { data: session, isLoading, isError } = useSessionByCode(code)
  const { data: map } = useMap(session?.mapId ?? 0)
  const { data: allItems = [] } = useItems()
  const { data: gameConfig } = useGameConfig()
  const shopItemIds = gameConfig?.cellConfig?.shop?.shopItemIds
  const items = shopItemIds != null ? allItems.filter(i => shopItemIds.includes(i.id)) : allItems
  const playerAction = usePlayerAction(session?.id ?? 0)
  const endTurn = useEndTurn(session?.id ?? 0)

  const { theme, toggle: toggleTheme } = useTheme()

  const [spinResult, setSpinResult] = useState<{ entry: WheelEntry; label: string } | null>(null)
  const [bossFight, setBossFight] = useState<BossFightSpinResult | null>(null)
  const [shopOpen, setShopOpen] = useState(false)
  const [passiveEvent, setPassiveEvent] = useState<{ type: 'trap' | 'loot'; goldDelta: number } | null>(null)
  const [distanceResult, setDistanceResult] = useState<number | null | undefined>(undefined)

  const [, forceUpdate] = useState(0)
  const turnKey = `${session?.currentTurn}-${session?.activePlayerId}`
  const jailSpinKey = `jail-spin:${session?.id ?? ''}:${playerId}:${turnKey}`
  const jailSpinResult = session ? (sessionStorage.getItem(jailSpinKey) ?? null) : null

  function setJailSpinResult(label: string | null) {
    if (label === null) sessionStorage.removeItem(jailSpinKey)
    else sessionStorage.setItem(jailSpinKey, label)
    forceUpdate(n => n + 1)
  }

  useEffect(() => {
    if (!passiveEvent) return
    const timer = setTimeout(() => setPassiveEvent(null), 4000)
    return () => clearTimeout(timer)
  }, [passiveEvent])

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground tracking-widest uppercase text-sm">Loading…</p>
    </div>
  )

  if (isError || !session) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground tracking-widest uppercase text-sm">Session not found</p>
    </div>
  )

  const player = session.players.find(p => p.id === playerId)
  if (!player) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground tracking-widest uppercase text-sm">Player not found</p>
    </div>
  )

  if (shopOpen) return (
    <ShopOverlay
      items={items}
      playerGold={player.gold}
      isPending={playerAction.isPending}
      onBuy={(itemId) => playerAction.mutate({ type: 'PLAYER_BUY', payload: { playerId, itemId } })}
      onClose={() => setShopOpen(false)}
    />
  )

  const currentCell = map?.cells.find(c => c.id === player.currentCellId)
  const currentCellType = currentCell?.type ?? null
  const isJailed = currentCellType === 'jail'
  const cellLabel = currentCellType ? (CELL_TYPE_LABELS[currentCellType] ?? currentCellType) : 'Unknown'

  const adjacentEdges = map
    ? map.edges.filter(e => e.from === player.currentCellId)
    : []

  const dirMap = new Map<Direction, Cell>()
  if (currentCell && map) {
    for (const edge of adjacentEdges) {
      const cell = map.cells.find(c => c.id === edge.to)
      if (!cell) continue
      const dir = getDirectionFromHandle(edge.exitHandle, currentCell, cell)
      if (!dirMap.has(dir)) dirMap.set(dir, cell)
    }
  }

  const DIRS: Direction[] = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE']

  const isMyTurn = session.activePlayerId === playerId
  const isDone = session.turnDoneIds?.includes(playerId)
  const isSkipping = (player.skippedTurnsRemaining ?? 0) > 0
  const activePlayer = session.players.find(p => p.id === session.activePlayerId)

  // ── Game over — full-screen lock ──────────────────────────────────────────
  if (session.status === 'completed') {
    const isWinner = session.winnerId === playerId
    const winner = session.players.find(p => p.id === session.winnerId)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-8 py-12 text-center">
        <Trophy
          className="mb-8"
          style={{
            width: 56, height: 56,
            color: isWinner ? 'oklch(0.74 0.19 62)' : 'oklch(0.6 0.04 70)',
          }}
        />
        {session.winnerId ? (
          <>
            <h1
              className="font-display tracking-widest uppercase leading-none mb-3"
              style={{
                fontSize: '2.8rem',
                fontWeight: 300,
                color: isWinner ? 'oklch(0.74 0.19 62)' : 'oklch(0.92 0.03 75)',
              }}
            >
              {isWinner ? 'You Win' : `${winner?.name ?? 'Unknown'} Wins`}
            </h1>
            {session.winTurn && (
              <p className="text-sm text-muted-foreground tracking-widest uppercase font-display mb-10">
                Turn {session.winTurn}
              </p>
            )}
          </>
        ) : (
          <h1
            className="font-display tracking-widest uppercase leading-none mb-10"
            style={{ fontSize: '2.8rem', fontWeight: 300, color: 'oklch(0.6 0.04 70)' }}
          >
            Game Over
          </h1>
        )}

        <div className="w-full max-w-xs border-t border-border pt-8 flex flex-col gap-4">
          {session.players.map(p => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full shrink-0" style={{ background: p.color }} />
              <span className={`font-display text-lg tracking-wide flex-1 text-left ${p.id === playerId ? 'text-foreground' : 'text-muted-foreground'}`}>
                {p.name}
              </span>
              <span className="flex items-center gap-1 text-sm tabular-nums text-primary/80">
                <Coins className="w-3.5 h-3.5 text-primary/50" />{p.gold}g
              </span>
              {p.id === session.winnerId && (
                <Trophy className="w-3.5 h-3.5 shrink-0" style={{ color: 'oklch(0.74 0.19 62)' }} />
              )}
            </div>
          ))}
        </div>

        {session.playerBroadcast && (
          <div
            className="mt-10 w-full max-w-xs px-5 py-4 rounded-xl text-left"
            style={{ background: 'oklch(0.74 0.19 62 / 0.07)', border: '1px solid oklch(0.74 0.19 62 / 0.2)' }}
          >
            <p className="text-xs tracking-widest font-display text-primary/60 uppercase mb-1.5">GM</p>
            <p className="text-sm text-foreground leading-relaxed">{session.playerBroadcast.message}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 shrink-0">
        <span className="font-display text-lg tracking-widest text-primary uppercase">BLIND</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
            <span>{session.name}</span>
            <span className="opacity-30">·</span>
            <span>T{session.currentTurn}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* ── GM Broadcast — sticky below header when present ─── */}
      {session.playerBroadcast && (
        <div className="px-5 py-3 border-b flex items-start gap-3 shrink-0"
          style={{ background: 'oklch(0.74 0.19 62 / 0.08)', borderColor: 'oklch(0.74 0.19 62 / 0.3)' }}>
          <span className="text-xs tracking-widest font-display text-primary/70 uppercase mt-0.5 shrink-0">GM</span>
          <p className="text-sm text-foreground leading-relaxed flex-1">{session.playerBroadcast.message}</p>
          <span className="text-xs text-muted-foreground/50 shrink-0 mt-0.5">{relativeTime(session.playerBroadcast.timestamp)}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* ── Identity ────────────────────────────────────────── */}
        <section className="px-6 pt-6 pb-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-full shrink-0 ring-1 ring-white/10" style={{ background: player.color }} />
            <span className="font-display text-3xl tracking-wide text-foreground flex-1 leading-none truncate">{player.name}</span>
          </div>
          <div className="flex items-center gap-5 pl-11">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-primary/60" />
              <span className="font-display text-xl text-primary tabular-nums leading-none">{player.gold}</span>
            </span>
            <span className="flex items-center gap-0.5">
              {Array.from({ length: player.maxHp }).map((_, i) => (
                <Heart key={i} className={`w-4 h-4 ${i < player.hp ? 'text-accent fill-accent' : 'text-muted-foreground/25'}`} />
              ))}
            </span>
          </div>
        </section>

        {/* ── Turn status ─────────────────────────────────────── */}
        <section
          className="px-6 py-3 border-b shrink-0 flex items-center gap-3"
          style={isMyTurn && !isDone
            ? { borderColor: 'oklch(0.74 0.19 62 / 0.25)', background: 'oklch(0.74 0.19 62 / 0.06)' }
            : { borderColor: 'oklch(0.92 0.03 75 / 16%)' }
          }
        >
          <span className="text-xs tracking-widest uppercase text-muted-foreground font-display">Turn {session.currentTurn}</span>
          {isSkipping ? (
            <span className="text-xs text-accent font-medium">Skipping ({player.skippedTurnsRemaining} left)</span>
          ) : isMyTurn && !isDone ? (
            <span className="text-xs text-primary font-medium tracking-wide">Your turn</span>
          ) : isDone ? (
            <span className="text-xs text-muted-foreground">Waiting…</span>
          ) : activePlayer ? (
            <span className="text-xs text-muted-foreground">{activePlayer.name}'s turn</span>
          ) : null}
          {isMyTurn && !isDone && (
            <button
              onClick={() => endTurn.mutate(playerId)}
              disabled={endTurn.isPending || !player.hasMoved}
              title={!player.hasMoved ? (isJailed ? 'Spin first' : 'Move first') : undefined}
              className="ml-auto flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl text-sm font-medium tracking-wide border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {endTurn.isPending ? '…' : 'End Turn'}
            </button>
          )}
        </section>

        {/* ── Current space ───────────────────────────────────── */}
        <section className="px-6 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-display italic text-xl text-muted-foreground leading-none">
              {cellLabel}
            </span>
            {currentCell?.label && (
              <span className="text-sm text-foreground/50 truncate">{currentCell.label}</span>
            )}
            {currentCellType === 'shop' && (
              <button
                onClick={() => setShopOpen(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-colors shrink-0"
                style={{ background: `${CELL_TYPE_COLORS.shop}20`, color: CELL_TYPE_COLORS.shop, border: `1px solid ${CELL_TYPE_COLORS.shop}50` }}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Enter Shop
              </button>
            )}
          </div>
        </section>

        {/* ── Move / Compass ──────────────────────────────────── */}
        <section className="px-6 pt-6 pb-8 border-b border-border shrink-0">
          <p className="text-xs tracking-widest uppercase text-muted-foreground/60 mb-6 flex items-center gap-2">
            <MapPin className="w-3 h-3" /> Move
          </p>

          {isJailed ? (
            <div className="flex flex-col gap-4">
              {jailSpinResult !== null ? (
                <span className="text-2xl font-display tracking-wide" style={{ color: CELL_TYPE_COLORS.jail }}>{jailSpinResult}</span>
              ) : player.hasMoved ? (
                <span className="text-sm text-muted-foreground italic">Spun — end your turn</span>
              ) : (
                <button
                  onClick={() => playerAction.mutate(
                    { type: 'PLAYER_SPIN_JAIL', payload: { playerId } },
                    { onSuccess: (d) => d.spunEntry && setJailSpinResult(d.spunEntry.label) }
                  )}
                  disabled={playerAction.isPending}
                  className="w-full py-4 rounded-xl text-sm font-medium tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: `${CELL_TYPE_COLORS.jail}18`, color: CELL_TYPE_COLORS.jail, border: `1px solid ${CELL_TYPE_COLORS.jail}55` }}
                >
                  {playerAction.isPending ? '…' : 'Spin to Escape'}
                </button>
              )}
            </div>
          ) : adjacentEdges.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No moves available</p>
          ) : (
            <div className="flex justify-center">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 80px)', gridTemplateRows: 'repeat(3, 80px)', gap: '6px' }}>
                {DIRS.map(dir => {
                  const [gc, gr] = DIR_GRID[dir]
                  const cell = dirMap.get(dir)
                  if (!cell) return <div key={dir} style={{ gridColumn: gc, gridRow: gr }} />
                  return (
                    <button
                      key={dir}
                      onClick={() => playerAction.mutate(
                        { type: 'PLAYER_MOVE', payload: { playerId, toCellId: cell.id } },
                        { onSuccess: (d) => d.passiveEvent && setPassiveEvent(d.passiveEvent) }
                      )}
                      disabled={playerAction.isPending}
                      style={{ gridColumn: gc, gridRow: gr }}
                      className="flex flex-col items-center justify-center rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                    >
                      <span className="text-xl font-display leading-none">?</span>
                      <span className="text-[8px] tracking-widest uppercase mt-1.5 opacity-50 font-display">{dir}</span>
                    </button>
                  )
                })}
                {/* Center: player token */}
                <div style={{ gridColumn: 2, gridRow: 2 }} className="flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center ring-2 ring-background" style={{ background: player.color }}>
                    <div className="w-2 h-2 rounded-full bg-black/30" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Chance ──────────────────────────────────────────── */}
        {currentCellType === 'chance' && (
          <section className="px-6 pt-5 pb-6 border-b border-border shrink-0">
            <p className="text-xs tracking-widest uppercase text-muted-foreground/60 mb-5 flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> Chance
            </p>
            {spinResult === null ? (
              <button
                onClick={() => playerAction.mutate(
                  { type: 'PLAYER_SPIN_CHANCE', payload: { playerId } },
                  { onSuccess: (d) => d.spunEntry && setSpinResult({ entry: d.spunEntry, label: d.spunEntry.label }) }
                )}
                disabled={playerAction.isPending}
                className="w-full py-4 rounded-xl text-sm font-medium tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `${CELL_TYPE_COLORS.chance}18`, color: CELL_TYPE_COLORS.chance, border: `1px solid ${CELL_TYPE_COLORS.chance}55` }}
              >
                {playerAction.isPending ? '…' : 'Spin'}
              </button>
            ) : (
              <span className="text-2xl font-display tracking-wide" style={{ color: CELL_TYPE_COLORS.chance }}>{spinResult.label}</span>
            )}
          </section>
        )}

        {/* ── Boss Fight ───────────────────────────────────────── */}
        {currentCellType === 'boss' && (
          <section className="px-6 pt-5 pb-6 border-b border-border shrink-0">
            <p className="text-xs tracking-widest uppercase text-muted-foreground/60 mb-5 flex items-center gap-2">
              <Swords className="w-3 h-3" /> Boss Fight
            </p>
            {bossFight === null ? (
              <button
                onClick={() => playerAction.mutate(
                  { type: 'PLAYER_BOSS_FIGHT', payload: { playerId } },
                  { onSuccess: (d) => d.bossFight && setBossFight(d.bossFight) }
                )}
                disabled={playerAction.isPending}
                className="w-full py-4 rounded-xl text-sm font-medium tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `${CELL_TYPE_COLORS.boss}18`, color: CELL_TYPE_COLORS.boss, border: `1px solid ${CELL_TYPE_COLORS.boss}55` }}
              >
                {playerAction.isPending ? '…' : 'Fight!'}
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <span className="text-2xl font-display tracking-wide flex-1"
                  style={{ color: bossFight.outcome === 'win' ? 'var(--success)' : 'var(--accent)' }}>
                  {bossFight.outcome === 'win' ? '+10g gained!' : '−1 heart lost!'}
                </span>
                <button
                  onClick={() => setBossFight(null)}
                  className="px-4 py-2 min-h-10 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Inventory ───────────────────────────────────────── */}
        {player.inventory.length > 0 && (
          <section className="px-6 pt-5 pb-6 border-b border-border shrink-0">
            <p className="text-xs tracking-widest uppercase text-muted-foreground/60 mb-5">Inventory</p>
            <div className="flex flex-col gap-4">
              {player.inventory.map(item => {
                const needsTarget = item.actions?.[0]?.type === 'SWAP_PLAYERS'
                const otherPlayers = session.players.filter(p => p.id !== playerId)
                return (
                  <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground">{item.name}</span>
                      {!needsTarget && (
                        <button
                          onClick={() => playerAction.mutate(
                            { type: 'PLAYER_USE_ITEM', payload: { playerId, itemId: item.id } },
                            { onSuccess: (d) => { if (d.distanceToEnd !== undefined) setDistanceResult(d.distanceToEnd ?? null) } },
                          )}
                          disabled={playerAction.isPending}
                          className="px-3 py-1.5 min-h-8 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {playerAction.isPending ? '…' : 'Use'}
                        </button>
                      )}
                    </div>
                    {needsTarget && otherPlayers.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {otherPlayers.map(target => (
                          <button
                            key={target.id}
                            onClick={() => playerAction.mutate({ type: 'PLAYER_USE_ITEM', payload: { playerId, itemId: item.id, targetPlayerId: target.id } })}
                            disabled={playerAction.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: target.color }} />
                            Swap with {target.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Passive event (trap/loot) ────────────────────────── */}
        {passiveEvent && (
          <div
            className="px-6 py-3 shrink-0 flex items-center justify-between gap-3 border-b"
            style={passiveEvent.type === 'trap'
              ? { background: 'color-mix(in oklch, var(--accent) 12%, transparent)', borderColor: 'color-mix(in oklch, var(--accent) 40%, transparent)', color: 'var(--accent)' }
              : { background: 'color-mix(in oklch, var(--success) 12%, transparent)', borderColor: 'color-mix(in oklch, var(--success) 40%, transparent)', color: 'var(--success)' }
            }
          >
            <span className="text-sm font-medium">
              {passiveEvent.type === 'trap'
                ? `Trap! Lost ${Math.abs(passiveEvent.goldDelta)}g`
                : `Loot! Gained ${passiveEvent.goldDelta}g`}
            </span>
            <button onClick={() => setPassiveEvent(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Distance to End result ──────────────────────────── */}
        {distanceResult !== undefined && (
          <div
            className="px-6 py-3 shrink-0 flex items-center justify-between gap-3 border-b"
            style={{ background: 'color-mix(in oklch, var(--primary) 8%, transparent)', borderColor: 'color-mix(in oklch, var(--primary) 25%, transparent)', color: 'var(--primary)' }}
          >
            <span className="text-sm font-medium">
              {distanceResult === null
                ? `Oracle's Eye: no path to end found`
                : `Oracle's Eye: ${distanceResult} step${distanceResult !== 1 ? 's' : ''} to the end`}
            </span>
            <button onClick={() => setDistanceResult(undefined)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────── */}
        {playerAction.isError && (
          <p className="px-6 py-3 text-xs text-destructive shrink-0 border-b border-destructive/20">
            {(playerAction.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed'}
          </p>
        )}

      </div>
    </div>
  )
}
