import { useParams, useNavigate } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import { useSessionByCode } from '@/lib/sessions.queries'
import { useTheme } from '@/hooks/use-theme'

export function PlayerPickerPage() {
  const { code = '' } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { data: session, isLoading, isError } = useSessionByCode(code)
  const { theme, toggle: toggleTheme } = useTheme()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground tracking-widest uppercase text-sm">Loading…</p>
      </div>
    )
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground tracking-widest uppercase text-sm">Session not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="font-display text-6xl tracking-widest uppercase text-primary mb-2">
          BLIND
        </h1>
        <p className="text-foreground/60 tracking-widest uppercase text-xs">
          {session.name}
        </p>
      </div>

      {/* Subheading */}
      <p className="text-muted-foreground tracking-widest uppercase text-xs mb-6">
        Choose your character
      </p>

      {/* Player cards */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {session.players.map(player => (
          <button
            key={player.id}
            onClick={() => navigate(`/play/${code}/${player.id}`)}
            className="flex items-center gap-4 px-5 py-4 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-left"
          >
            {/* Color dot */}
            <span
              className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ background: player.color }}
            />
            <span className="font-display text-xl tracking-wide text-foreground">
              {player.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
