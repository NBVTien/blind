import { ScrollText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Session } from '@blind/shared'

export function LogTab({
  session,
  onNewTurn,
}: {
  session: Session
  onNewTurn: () => void
}) {
  // Group entries by turn, descending
  const byTurn = new Map<number, typeof session.log>()
  for (const entry of session.log) {
    if (!byTurn.has(entry.turn)) byTurn.set(entry.turn, [])
    byTurn.get(entry.turn)!.push(entry)
  }
  const turns = Array.from(byTurn.keys()).sort((a, b) => b - a)

  return (
    <div className="p-3 flex flex-col gap-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
            Turn {session.currentTurn}
          </span>
        </div>
        <Button size="sm" onClick={onNewTurn} className="h-7 text-xs font-display tracking-widest">
          New Turn
        </Button>
      </div>

      {session.log.length === 0 && (
        <p className="text-muted-foreground text-sm">No actions yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {turns.map(turn => (
          <div key={turn}>
            <div className="text-xs font-display tracking-widest text-muted-foreground/50 uppercase mb-1.5">
              Turn {turn}
            </div>
            <div className="flex flex-col gap-0">
              {byTurn.get(turn)!.map(entry => (
                <div key={entry.id} className="py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-primary">{entry.playerName}</span>
                    <span className="text-xs text-foreground">{entry.action}</span>
                  </div>
                  <div className="text-xs text-muted-foreground/50 mt-0.5">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
