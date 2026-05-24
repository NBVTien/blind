import { useParams, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMap, useUpdateCell, useToggleEdge, useUpdateMapName } from '@/lib/maps.queries'
import type { CellType } from '@blind/shared'
import { MapCanvas } from '@/app/_components/MapCanvas'

export function MapDetailPage() {
  const { id: idStr } = useParams<{ id: string }>()
  const id = Number(idStr)
  const navigate = useNavigate()
  const { data: map, isLoading } = useMap(id)
  const updateCell = useUpdateCell()
  const toggleEdge = useToggleEdge()
  const updateName = useUpdateMapName()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function startEdit() {
    setDraft(map!.name)
    setEditing(true)
  }

  function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== map!.name) {
      updateName.mutate({ id, name: trimmed })
    }
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading map...</div>
  if (!map) return <div className="p-6 text-muted-foreground">Map not found.</div>

  const connectedIds = new Set(map.edges.map(e => e.from))

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - var(--sidebar-header-h))' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" aria-label="Back to maps" onClick={() => navigate('/maps')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                className="h-8 text-lg font-display font-light tracking-wide max-w-xs"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={commitEdit} disabled={updateName.isPending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="font-display font-light text-2xl leading-tight tracking-wide">{map.name}</h1>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={startEdit} aria-label="Rename map">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            {map.gridW}×{map.gridH} grid · {connectedIds.size} active cells · {map.edges.length / 2} connections
          </p>
        </div>
      </div>

      {/* Canvas — fills remaining height */}
      <div className="flex-1 min-h-0">
        <MapCanvas
          map={map}
          mode="edit"
          onChangeType={(cellId, type: CellType) =>
            updateCell.mutate({ mapId: id, cellId, type })
          }
          onToggleEdge={(from, to) =>
            toggleEdge.mutate({ mapId: id, from, to })
          }
          onSetBossHp={(cellId, hp) =>
            updateCell.mutate({ mapId: id, cellId, bossHp: hp })
          }
        />
      </div>

      <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border shrink-0">
        Right-click node to change type. Drag node handle to create edge. Click edge to delete. Two-finger scroll to pan. Pinch to zoom.
      </p>
    </div>
  )
}
