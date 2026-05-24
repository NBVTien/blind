import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, ChevronRight, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSessions, useCreateSession, useDeleteSession } from '@/lib/sessions.queries'
import { useMaps } from '@/lib/maps.queries'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DEFAULT_COLORS = [
  'oklch(0.62 0.20 46)',   // ember
  'oklch(0.58 0.20 245)',  // cobalt
  'oklch(0.52 0.22 300)',  // violet
  'oklch(0.68 0.18 155)',  // jade
  'oklch(0.78 0.19 88)',   // gold
  'oklch(0.52 0.22 18)',   // crimson
]

interface PlayerInput {
  name: string
  color: string
}

export function SessionListPage() {
  const navigate = useNavigate()
  const { data: sessions = [], isLoading } = useSessions()
  const { data: maps = [] } = useMaps()
  const createSession = useCreateSession()
  const deleteSession = useDeleteSession()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [mapId, setMapId] = useState<number | ''>('')
  const [players, setPlayers] = useState<PlayerInput[]>([
    { name: '', color: DEFAULT_COLORS[0] },
  ])

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  function addPlayer() {
    if (players.length >= 6) return
    setPlayers(prev => [
      ...prev,
      { name: '', color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] },
    ])
  }

  function removePlayer(idx: number) {
    setPlayers(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePlayer(idx: number, field: keyof PlayerInput, value: string) {
    setPlayers(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  function handleCreate() {
    if (!sessionName.trim() || !mapId) return
    const validPlayers = players.filter(p => p.name.trim())
    if (validPlayers.length === 0) return

    createSession.mutate(
      { name: sessionName.trim(), mapId: mapId as number, players: validPlayers.map(p => ({ name: p.name.trim(), color: p.color })) },
      {
        onSuccess: (session) => {
          setDialogOpen(false)
          setSessionName('')
          setMapId('')
          setPlayers([{ name: '', color: DEFAULT_COLORS[0] }])
          navigate(`/sessions/${session.id}`)
        },
      },
    )
  }

  return (
    <div className="p-10 max-w-3xl">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Play
          </p>
          <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>
            Sessions
          </h1>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="font-display tracking-widest text-xs"
        >
          New Session
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading sessions...</p>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_140px_80px_80px_44px] gap-4 pb-2 border-b border-border text-xs uppercase tracking-[0.2em] text-muted-foreground font-display">
            <span>Name</span>
            <span>Map</span>
            <span>Players</span>
            <span>Status</span>
            <span />
          </div>

          {sessions.length === 0 && (
            <p className="text-muted-foreground py-6 text-sm italic font-display">
              No sessions yet. Start a new adventure.
            </p>
          )}

          {sessions.map((session) => (
            <div
              key={session.id}
              className="group grid grid-cols-[1fr_140px_80px_80px_44px] gap-4 py-3.5 border-b border-border items-center transition-colors hover:border-primary/40"
            >
              <button
                className="text-left text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5"
                onClick={() => navigate(`/sessions/${session.id}`)}
              >
                {session.name}
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </button>
              <span className="text-muted-foreground text-xs truncate">{session.mapName}</span>
              <span className="text-muted-foreground text-sm tabular-nums">
                {session.players.length}
              </span>
              <span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-sm font-display tracking-wider ${
                    session.status === 'active'
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {session.status}
                </span>
              </span>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTargetId(session.id)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteTargetId !== null} onOpenChange={open => { if (!open) setDeleteTargetId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-widest">Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the session and all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTargetId) deleteSession.mutate(deleteTargetId)
                setDeleteTargetId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">New Session</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-display block mb-1.5">
                Session Name
              </label>
              <Input
                placeholder="e.g. The First Delve"
                value={sessionName}
                onChange={e => setSessionName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-display block mb-1.5">
                Map
              </label>
              <Select value={mapId === '' ? '' : String(mapId)} onValueChange={v => setMapId(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a map..." />
                </SelectTrigger>
                <SelectContent>
                  {maps.map(m => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} ({m.gridW}×{m.gridH})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase tracking-widest text-muted-foreground font-display">
                  Players ({players.length}/6)
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={addPlayer}
                  disabled={players.length >= 6}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {players.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={p.color}
                      onChange={e => updatePlayer(idx, 'color', e.target.value)}
                      className="h-8 w-8 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <Input
                      placeholder={`Player ${idx + 1} name`}
                      value={p.name}
                      onChange={e => updatePlayer(idx, 'name', e.target.value)}
                      className="flex-1"
                    />
                    {players.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => removePlayer(idx)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!sessionName.trim() || !mapId || players.every(p => !p.name.trim()) || createSession.isPending}
              className="font-display tracking-widest text-xs"
            >
              {createSession.isPending ? 'Starting...' : 'Start Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
