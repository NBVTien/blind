import { useState, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGmAction } from '@/lib/gm-actions.queries'
import { SpinWheel, wheelColor, type SpinWheelHandle } from '@/app/_components/SpinWheel'
import type { WheelEntry, AttachedAction, Wheel, Player } from '@blind/shared'
import { BOSS_WHEEL_WIN_LABEL, BOSS_WHEEL_LOSE_LABEL } from '@blind/shared'

export function buildBossWheel(playerHp: number): Wheel {
  return {
    id: -1,
    name: 'Boss Battle',
    createdAt: '',
    entries: [
      { id: 'win', label: BOSS_WHEEL_WIN_LABEL, weight: playerHp },
      { id: 'lose', label: BOSS_WHEEL_LOSE_LABEL, weight: 5 },
    ],
  }
}

function buildBroadcastMessage(
  entry: WheelEntry,
  triggered: AttachedAction[] | null | undefined,
  players: Player[],
  playerId: string | undefined,
  isBoss: boolean | undefined,
): string {
  const playerName = players.find(p => p.id === playerId)?.name
  const prefix = playerName ? `${playerName}: ` : ''
  if (isBoss) return `${prefix}Boss Battle — ${entry.label}`
  if (!triggered?.length) return `${prefix}Wheel result: ${entry.label}`
  const first = triggered[0]
  const { type, payload } = first
  switch (type) {
    case 'GIVE_GOLD': return `${prefix}+${payload.amount ?? '?'}g (${entry.label})`
    case 'TAKE_GOLD': return `${prefix}−${payload.amount ?? '?'}g (${entry.label})`
    case 'GIVE_ITEM': return `${prefix}received item (${entry.label})`
    case 'ADJUST_HP': return `${prefix}HP ${(payload.amount ?? 0) >= 0 ? '+' : ''}${payload.amount} (${entry.label})`
    case 'TELEPORT': return `${prefix}teleported! (${entry.label})`
    case 'TELEPORT_TO_START': return `${prefix}sent back to start! (${entry.label})`
    default: return `${prefix}${entry.label}`
  }
}

export function WheelInPanel({
  wheel,
  result,
  forcedEntry,
  triggeredAction,
  sessionId,
  wheelId,
  playerId,
  isBoss,
  players,
  onResult,
  onClose,
}: {
  wheel: Wheel
  result: { entry: WheelEntry; colorIdx: number } | null
  forcedEntry?: WheelEntry | null
  triggeredAction?: AttachedAction[] | null
  sessionId: number
  wheelId?: number
  playerId?: string
  isBoss?: boolean
  players: Player[]
  onResult: (entry: WheelEntry, colorIdx: number, triggered?: AttachedAction[]) => void
  onClose: () => void
}) {
  const wheelRef = useRef<SpinWheelHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const pendingEntryRef = useRef<WheelEntry | null>(null)
  const gmAction = useGmAction(sessionId)

  function handleResult(entry: WheelEntry, colorIdx: number) {
    setSpinning(false)
    const triggered = (pendingEntryRef.current?.actions ?? entry.actions) as AttachedAction[] | undefined
    pendingEntryRef.current = null
    onResult(entry, colorIdx, triggered)
  }

  function doSpin() {
    if (isBoss && playerId) {
      gmAction.mutate(
        { type: 'BOSS_FIGHT_SPIN', payload: { playerId } },
        {
          onSuccess: (data) => {
            const bossFight = data.bossFight
            if (!bossFight) return
            const forced = bossFight.outcome === 'win'
              ? wheel.entries.find(e => e.id === 'win')!
              : wheel.entries.find(e => e.id === 'lose')!
            pendingEntryRef.current = forced
            setSpinning(true)
            wheelRef.current?.spin(forced)
          },
        }
      )
    } else if (wheelId) {
      gmAction.mutate(
        { type: 'SPIN_WHEEL', payload: { wheelId, playerId: playerId || undefined } },
        {
          onSuccess: (data) => {
            const entry = data.spunEntry
            if (!entry) return
            pendingEntryRef.current = entry
            setSpinning(true)
            wheelRef.current?.spin(entry)
          },
        }
      )
    } else {
      setSpinning(true)
      wheelRef.current?.spin(forcedEntry ?? undefined)
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 py-4">
      <p className="font-display text-xs tracking-[0.25em] uppercase text-muted-foreground">
        {wheel.name}
      </p>

      <SpinWheel
        ref={wheelRef}
        entries={wheel.entries}
        size={380}
        onSpinStart={() => setSpinning(true)}
        onResult={handleResult}
      />

      {/* Result + controls */}
      <div className="flex flex-col items-center gap-3 min-h-[80px] justify-center">
        {spinning && (
          <p className="text-muted-foreground text-sm font-display tracking-widest animate-pulse">
            Spinning…
          </p>
        )}
        {!spinning && result && result.entry && (
          <>
            <p
              className="font-display tracking-wide text-2xl font-bold"
              style={{ color: wheelColor(result.colorIdx) }}
            >
              {result.entry.label}
            </p>
            {triggeredAction?.length && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground font-display tracking-widest">
                  {triggeredAction.map(a => a.type.replace(/_/g, ' ')).join(' → ')}
                </p>
                <Button
                  size="sm"
                  disabled={gmAction.isPending}
                  onClick={async () => {
                    for (const act of triggeredAction) {
                      await gmAction.mutateAsync({
                        type: act.type,
                        payload: { ...act.payload, ...(playerId ? { playerId } : {}) },
                      })
                    }
                    const msg = buildBroadcastMessage(result!.entry, triggeredAction, players, playerId, isBoss)
                    gmAction.mutate({ type: 'BROADCAST', payload: { broadcastMessage: msg } })
                  }}
                  className="font-display tracking-widest text-xs"
                >
                  {gmAction.isPending ? 'Applying…' : 'Apply & Announce'}
                </Button>
              </div>
            )}
            {isBoss && !triggeredAction && (
              <Button
                size="sm"
                variant="outline"
                disabled={gmAction.isPending}
                onClick={() => {
                  const msg = buildBroadcastMessage(result!.entry, null, players, playerId, true)
                  gmAction.mutate({ type: 'BROADCAST', payload: { broadcastMessage: msg } })
                }}
                className="font-display tracking-widest text-xs"
              >
                {gmAction.isPending ? 'Sending…' : 'Announce Result'}
              </Button>
            )}
            <div className="flex items-center gap-2">
              {!isBoss && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={gmAction.isPending}
                  onClick={() => {
                    onResult(null as never, -1)
                    doSpin()
                  }}
                  className="font-display tracking-widest text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Spin Again
                </Button>
              )}
              <Button
                size="sm"
                onClick={onClose}
                className="font-display tracking-widest text-xs"
              >
                Back to Map
              </Button>
            </div>
          </>
        )}
        {!spinning && !result && (
          <Button
            size="sm"
            disabled={gmAction.isPending}
            onClick={doSpin}
            className="font-display tracking-widest"
          >
            {gmAction.isPending ? 'Loading…' : 'Spin'}
          </Button>
        )}
      </div>
    </div>
  )
}
