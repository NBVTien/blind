import { useNavigate } from 'react-router-dom'
import { Map, Users, Package, ChevronRight } from 'lucide-react'
import { useMaps } from '@/lib/maps.queries'
import { useSessions } from '@/lib/sessions.queries'
import { useItems } from '@/lib/items.queries'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: maps = [] } = useMaps()
  const { data: sessions = [] } = useSessions()
  const { data: items = [] } = useItems()

  const activeSessions = sessions.filter(s => s.status === 'active')
  const recentSessions = sessions.slice(0, 3)

  return (
    <div className="p-10 max-w-2xl">

      {/* Hero — Cormorant at a size that shows its character */}
      <div className="mb-14">
        <p className="text-xs font-display tracking-[0.35em] uppercase text-muted-foreground mb-3">
          Game Master Console
        </p>
        <h1
          className="font-display font-light text-primary leading-none mb-5"
          style={{ fontSize: 'clamp(3.5rem, 8vw, 5.5rem)', letterSpacing: '0.12em' }}
        >
          BLIND
        </h1>
        <div className="h-px bg-border" />
      </div>

      {/* Stats — numbers as the hero, labels subdued */}
      <div className="mb-12">
        <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-4">
          Overview
        </p>
        <div className="flex flex-col">
          {[
            { icon: Users, label: 'Active Sessions', value: activeSessions.length, href: '/sessions' },
            { icon: Map, label: 'Total Maps', value: maps.length, href: '/maps' },
            { icon: Package, label: 'Total Items', value: items.length, href: '/items' },
          ].map(({ icon: Icon, label, value, href }) => (
            <button
              key={label}
              onClick={() => navigate(href)}
              className="group flex items-center justify-between py-4 border-b border-border text-left transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-3 text-muted-foreground group-hover:text-foreground transition-colors">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-sm">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-light text-3xl text-primary leading-none">{value}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div>
          <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Recent Sessions
          </p>
          {recentSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => navigate(`/sessions/${session.id}`)}
              className="group w-full flex items-center justify-between py-4 border-b border-border text-left transition-colors hover:border-primary/40"
            >
              <div>
                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors mb-1">
                  {session.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {session.mapName} · {session.players.length} players · Turn {session.currentTurn}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <span
                  className={`text-xs font-display tracking-wider px-1.5 py-0.5 rounded-sm ${
                    session.status === 'active'
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {session.status}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}

      {sessions.length === 0 && maps.length === 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Start by creating a map, then open a session to begin play.
        </p>
      )}
    </div>
  )
}
