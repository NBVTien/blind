import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Link2, SkipForward, Trophy, Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSessionPolling, useMovePlayer, useBuyItem, useAdjustGold, useIncrementTurn, useEndTurn } from '@/lib/sessions.queries'
import { useMap, useUpdateCell } from '@/lib/maps.queries'
import { useItems } from '@/lib/items.queries'
import { useWheels } from '@/lib/wheels.queries'
import { useGmAction } from '@/lib/gm-actions.queries'
import { useCellConfig } from '@/lib/cell-config.queries'
import { useGameConfig } from '@/lib/game-config.queries'
import { MapCanvas } from '@/app/_components/MapCanvas'
import { actionLabel } from '@/app/_components/ActionPicker'
import { buildBossWheel, WheelInPanel } from './WheelInPanel'
import { ActionsTab } from './ActionsTab'
import { PlayersTab } from './PlayersTab'
import { ShopInPanel } from './ShopInPanel'
import { LogTab } from './LogTab'
import type { WheelEntry, AttachedAction, Wheel, SpecialCellType, GmActionPayload } from '@blind/shared'

type TabId = 'players' | 'log' | 'actions'

export function SessionPage() {
  const { id: idStr } = useParams<{ id: string }>()
  const id = Number(idStr)
  const navigate = useNavigate()

  const { data: session, isLoading: sessionLoading } = useSessionPolling(id)
  const { data: map, isLoading: mapLoading } = useMap(session?.mapId ?? 0)
  const { data: items = [] } = useItems()
  const { data: wheels = [] } = useWheels()
  const { data: rawCellConfig = {} } = useCellConfig()
  const { data: gameConfig } = useGameConfig()
  // prefer game-config cellConfig (has death sequence), fall back to old cell-config
  const cellConfig = gameConfig?.cellConfig ?? rawCellConfig

  const movePlayer = useMovePlayer(id)
  const buyItem = useBuyItem(id)
  const adjustGold = useAdjustGold(id)
  const incrementTurn = useIncrementTurn(id)
  const mapGmAction = useGmAction(id)
  const updateCell = useUpdateCell()
  const endTurn = useEndTurn(id)

  const [activeTab, setActiveTab] = useState<TabId>('players')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)

  // Landing suggestion banner
  const [suggestion, setSuggestion] = useState<{ type: SpecialCellType; playerName: string; actions?: AttachedAction[] } | null>(null)

  // Wheel overlay state
  const [overlayWheel, setOverlayWheel] = useState<Wheel | null>(null)
  const [overlayResult, setOverlayResult] = useState<{ entry: WheelEntry; colorIdx: number } | null>(null)
  const [overlayForcedEntry, setOverlayForcedEntry] = useState<WheelEntry | null>(null)
  const [overlayTriggeredAction, setOverlayTriggeredAction] = useState<AttachedAction[] | null>(null)
  const [overlayWheelId, setOverlayWheelId] = useState<number | null>(null)
  const [overlayPlayerId, setOverlayPlayerId] = useState<string | null>(null)
  const [overlayIsBoss, setOverlayIsBoss] = useState(false)
  const [overlayShop, setOverlayShop] = useState(false)

  if (sessionLoading || mapLoading) {
    return <div className="p-6 text-muted-foreground">Loading session...</div>
  }
  if (!session || !map) {
    return <div className="p-6 text-muted-foreground">Session or map not found.</div>
  }

  const edgeSet = new Set(map.edges.map(e => `${e.from}->${e.to}`))
  const selectedPlayer = session.players.find(p => p.id === selectedPlayerId) ?? null

  function isAdjacent(fromId: string, toId: string) {
    return edgeSet.has(`${fromId}->${toId}`)
  }

  function resolveWheel(type: SpecialCellType, fallbackName: string) {
    const configuredId = cellConfig[type]?.defaultWheelId
    return configuredId
      ? (wheels.find(w => w.id === configuredId) ?? wheels.find(w => w.name === fallbackName) ?? wheels[0])
      : (wheels.find(w => w.name === fallbackName) ?? wheels[0])
  }

  function triggerSpaceEffect(cellId: string, playerId: string) {
    const destCell = map!.cells.find(c => c.id === cellId)
    const player = session!.players.find(p => p.id === playerId)
    if (!destCell) return

    const type = destCell.type as SpecialCellType
    const typeCfg = cellConfig[type]

    if (type === 'chance' && wheels.length > 0) {
      const chanceWheel = resolveWheel('chance', 'Chance Wheel')
      if (chanceWheel) {
        setOverlayWheel(chanceWheel)
        setOverlayPlayerId(playerId)
      }
    } else if (type === 'jail') {
      const jailWheel = resolveWheel('jail', 'Jail Wheel')
      if (jailWheel) {
        setOverlayWheel(jailWheel)
        setOverlayPlayerId(playerId)
      }
    } else if (type === 'shop') {
      setOverlayShop(true)
    } else if (type === 'boss') {
      const bossHp = destCell.bossHp ?? typeCfg?.defaultBossHp ?? 10
      const wheel = buildBossWheel(player?.hp ?? 3)
      wheel.entries[0] = { ...wheel.entries[0], weight: bossHp }
      setOverlayWheel(wheel)
      setOverlayForcedEntry(null)
      setOverlayTriggeredAction(null)
      setOverlayResult(null)
      setOverlayWheelId(null)
      setOverlayPlayerId(playerId)
      setOverlayIsBoss(true)
    } else if ((type === 'trap' || type === 'loot') && (typeCfg?.defaultActions as AttachedAction[] | undefined)?.length) {
      setSuggestion({ type, playerName: player?.name ?? playerId, actions: typeCfg?.defaultActions as AttachedAction[] })
    }
  }

  function handleCellClick(cellId: string) {
    if (!selectedPlayer) return
    if (cellId === selectedPlayer.currentCellId) {
      setSelectedPlayerId(null)
      return
    }
    if (!isAdjacent(selectedPlayer.currentCellId, cellId)) return
    movePlayer.mutate(
      { playerId: selectedPlayer.id, toCellId: cellId },
      {
        onSuccess: () => {
          setSelectedPlayerId(null)
          triggerSpaceEffect(cellId, selectedPlayer.id)
        },
      },
    )
  }

  return (
    <div className="flex flex-col lg:flex-row overflow-hidden h-screen">
      {/* Left: Map panel */}
      <div className="lg:flex-[65] border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0 p-4 pb-0 h-[45vh] lg:h-auto">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" aria-label="Back to sessions" onClick={() => navigate('/sessions')} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display font-light text-2xl leading-tight tracking-wide truncate">{session.name}</h1>
            <p className="text-muted-foreground text-xs">
              {map.name} · Turn {session.currentTurn}
            </p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/play/${session.code}`)}
            title="Copy player link"
            className="text-xs font-display tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors border border-border rounded px-2 py-1 flex items-center gap-1"
          >
            <Link2 className="h-3 w-3" />
            {session.code}
          </button>
          {session.status === 'active' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => mapGmAction.mutate({ type: 'COMPLETE_SESSION', payload: {} })}
              disabled={mapGmAction.isPending}
              className="h-8 text-xs font-display tracking-widest flex items-center gap-1 border-muted-foreground/30 text-muted-foreground hover:text-foreground"
            >
              <Flag className="h-3 w-3" />
              End Session
            </Button>
          )}
          {selectedPlayer && (
            <div className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ background: selectedPlayer.color }}
              />
              <span className="text-foreground">{selectedPlayer.name}</span>
              <span className="text-muted-foreground text-xs">selected — click a highlighted cell to move</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedPlayerId(null)} className="h-8 text-xs">
                Cancel
              </Button>
            </div>
          )}
        </div>

        {/* Turn HUD */}
        {(() => {
          const activePlayer = session.players.find(p => p.id === session.activePlayerId)
          return (
            <div className="mb-3 px-1 py-2 border-b border-border flex items-center gap-3 text-xs">
              <span className="text-muted-foreground font-display tracking-widest uppercase text-xs">Turn {session.currentTurn}</span>
              <span className="text-muted-foreground opacity-30">·</span>
              {activePlayer ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activePlayer.color }} />
                  <span className="text-foreground font-medium">{activePlayer.name}</span>
                  <span className="text-muted-foreground">active</span>
                </span>
              ) : (
                <span className="text-muted-foreground italic">no active player</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                {activePlayer && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={endTurn.isPending}
                    onClick={() => endTurn.mutate(activePlayer.id)}
                    className="h-8 text-xs font-display tracking-widest flex items-center gap-1"
                  >
                    <SkipForward className="h-3 w-3" />
                    End Turn
                  </Button>
                )}
              </div>
            </div>
          )
        })()}

        {/* Winner banner */}
        {session.status === 'completed' && (
          <div className="mb-3 px-3 py-3 border border-success/30 bg-success/5 rounded flex items-center gap-3 text-xs">
            <Trophy className="h-4 w-4 text-success shrink-0" />
            <div className="flex flex-col gap-0.5">
              {session.winnerId ? (
                <>
                  <span className="text-success font-display tracking-widest uppercase text-xs font-semibold">
                    {session.players.find(p => p.id === session.winnerId)?.name ?? 'Unknown'} wins!
                  </span>
                  {session.winTurn && (
                    <span className="text-muted-foreground">Turn {session.winTurn}</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground font-display tracking-widest uppercase text-xs">Session ended</span>
              )}
            </div>
          </div>
        )}

        {/* Landing suggestion banner */}
        {suggestion && (
          <div className="mb-3 px-1 py-2 border-b border-warning/30 bg-warning/5 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">{suggestion.playerName}</span>
              {' '}landed on <span className="font-display uppercase tracking-widest text-warning">{suggestion.type}</span>
              {suggestion.actions?.length && (
                <> — suggested: <span className="text-foreground">{actionLabel(suggestion.actions)}</span></>
              )}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSuggestion(null)}
              className="ml-auto h-8 text-xs font-display tracking-widest"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Map or overlay view */}
        <div className="flex-1 min-h-0 flex flex-col" style={{ minHeight: 0 }}>
          {overlayShop ? (
            <ShopInPanel
              session={session}
              items={items}
              shopItemIds={gameConfig?.cellConfig?.shop?.shopItemIds}
              onBuy={(playerId, itemId) => buyItem.mutate({ playerId, itemId })}
              onClose={() => setOverlayShop(false)}
            />
          ) : overlayWheel ? (
            <WheelInPanel
              wheel={overlayWheel}
              result={overlayResult}
              forcedEntry={overlayForcedEntry}
              triggeredAction={overlayTriggeredAction}
              sessionId={id}
              wheelId={overlayWheelId ?? undefined}
              playerId={overlayPlayerId ?? undefined}
              isBoss={overlayIsBoss}
              players={session.players}
              onResult={(entry, colorIdx, triggered) => {
                if (entry) {
                  setOverlayResult({ entry, colorIdx })
                  if (triggered) setOverlayTriggeredAction(triggered)
                } else {
                  setOverlayResult(null)
                  setOverlayTriggeredAction(null)
                }
              }}
              onClose={() => {
                setOverlayWheel(null)
                setOverlayResult(null)
                setOverlayForcedEntry(null)
                setOverlayTriggeredAction(null)
                setOverlayWheelId(null)
                setOverlayPlayerId(null)
                setOverlayIsBoss(false)
              }}
            />
          ) : (
            <MapCanvas
              map={map}
              mode="session"
              selectedPlayerId={selectedPlayerId}
              onCellClick={handleCellClick}
              pendingTargetId={null}
              players={session.players}
              onChangeCellType={(cellId, type) => mapGmAction.mutate({
                type: 'CHANGE_CELL_TYPE',
                payload: { cellId, cellType: type ?? undefined } as GmActionPayload,
              })}
              onCreatePath={(fromCellId, toCellId) => mapGmAction.mutate({
                type: 'CREATE_PATH',
                payload: { fromCellId, toCellId } as GmActionPayload,
              })}
              onDeletePath={(fromCellId, toCellId) => mapGmAction.mutate({
                type: 'DELETE_PATH',
                payload: { fromCellId, toCellId } as GmActionPayload,
              })}
              onSetCellAction={(cellId, actions: AttachedAction[] | null) => updateCell.mutate({ mapId: map.id, cellId, actions })}
              sessionItems={items}
              sessionWheels={wheels}
            />
          )}
        </div>
      </div>

      {/* Right: Tabbed panel */}
      <div className="lg:flex-[35] flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {([
            { id: 'players' as TabId, label: 'Players', icon: null },
            { id: 'log' as TabId, label: 'Log', icon: null },
            { id: 'actions' as TabId, label: 'Actions', icon: null },
          ] as { id: TabId; label: string; icon: null }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-display tracking-widest uppercase transition-colors ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'players' && (
            <PlayersTab
              session={session}
              map={map}
              wheels={wheels}
              cellConfig={cellConfig}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={(pid) => {
                setSelectedPlayerId(pid === selectedPlayerId ? null : pid)
                setActiveTab('players')
              }}
              onAdjustGold={(playerId, amount) => adjustGold.mutate({ playerId, amount })}
              onSetHp={(playerId, hp) => mapGmAction.mutate({ type: 'SET_PLAYER_HP', payload: { playerId, hp } })}
              onAdjustMaxHp={(playerId, delta) => mapGmAction.mutate({ type: 'ADJUST_MAX_HP', payload: { playerId, amount: delta } })}
              onOpenWheelOverlay={(w, { wheelId, playerId, isBoss } = {}) => {
                setOverlayWheel(w)
                setOverlayForcedEntry(null)
                setOverlayTriggeredAction(null)
                setOverlayResult(null)
                setOverlayWheelId(wheelId ?? null)
                setOverlayPlayerId(playerId ?? null)
                setOverlayIsBoss(isBoss ?? false)
              }}
              onEndTurn={(playerId) => endTurn.mutate(playerId)}
              onSkipTurn={(playerId) => mapGmAction.mutate({ type: 'SKIP_TURN', payload: { playerId } })}
              onReorder={(playerOrder) => mapGmAction.mutate({ type: 'REORDER_PLAYERS', payload: { playerOrder } })}
            />
          )}
          {activeTab === 'log' && (
            <LogTab
              session={session}
              onNewTurn={() => incrementTurn.mutate()}
            />
          )}
          {activeTab === 'actions' && (
            <ActionsTab
              session={session}
              map={map}
              sessionId={id}
              cellConfig={cellConfig}
              onTriggerSpaceEffect={triggerSpaceEffect}
              onOpenShop={() => setOverlayShop(true)}
              onOpenWheelOverlay={(w, { wheelId, playerId, isBoss } = {}) => {
                setOverlayWheel(w)
                setOverlayForcedEntry(null)
                setOverlayTriggeredAction(null)
                setOverlayResult(null)
                setOverlayWheelId(wheelId ?? null)
                setOverlayPlayerId(playerId ?? null)
                setOverlayIsBoss(isBoss ?? false)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
