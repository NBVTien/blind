import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMaps, useDeleteMap } from '@/lib/maps.queries'
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

export function MapListPage() {
  const navigate = useNavigate()
  const { data: maps = [], isLoading } = useMaps()
  const deleteMap = useDeleteMap()

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)

  return (
    <div className="p-10 max-w-3xl">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Build
          </p>
          <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>
            Maps
          </h1>
        </div>
        <Button onClick={() => navigate('/maps/new')} className="font-display tracking-widest text-xs">
          New Map
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading maps...</p>
      ) : (
        <div>
          <div className="grid grid-cols-[1fr_100px_140px_44px] gap-4 pb-2 border-b border-border text-xs uppercase tracking-[0.2em] text-muted-foreground font-display">
            <span>Name</span>
            <span>Size</span>
            <span>Created</span>
            <span />
          </div>

          {maps.length === 0 && (
            <p className="text-muted-foreground py-6 text-sm italic font-display">
              No maps yet. Create your first dungeon.
            </p>
          )}

          {maps.map((map) => (
            <div
              key={map.id}
              className="group grid grid-cols-[1fr_100px_140px_44px] gap-4 py-3.5 border-b border-border items-center transition-colors hover:border-primary/40"
            >
              <button
                className="text-left text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-2"
                onClick={() => navigate(`/maps/${map.id}`)}
              >
                <MapPin className="h-3 w-3 text-primary/60 group-hover:text-primary shrink-0 transition-colors" />
                {map.name}
              </button>
              <span className="text-muted-foreground text-sm font-display tabular-nums">
                {map.gridW}×{map.gridH}
              </span>
              <span className="text-muted-foreground text-xs">
                {new Date(map.createdAt).toLocaleDateString()}
              </span>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTargetId(map.id)
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
            <AlertDialogTitle className="font-display tracking-widest">Delete map?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the map and all its cells. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTargetId) deleteMap.mutate(deleteTargetId)
                setDeleteTargetId(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
