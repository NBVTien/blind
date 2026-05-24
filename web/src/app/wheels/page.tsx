import { Trash2, Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useWheels, useDeleteWheel } from '@/lib/wheels.queries'
import { toast } from '@/lib/toast'

export function WheelsPage() {
  const navigate = useNavigate()
  const { data: wheels = [], isLoading } = useWheels()
  const deleteWheel = useDeleteWheel()

  return (
    <div className="p-10 max-w-xl">
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">
            Build
          </p>
          <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>
            Wheels
          </h1>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/wheels/new')}
          className="font-display tracking-widest flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          New Wheel
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}
      {!isLoading && wheels.length === 0 && (
        <p className="text-muted-foreground text-sm italic font-display">No wheels yet.</p>
      )}

      {wheels.map((wheel, idx) => (
        <div key={wheel.id}>
          {idx > 0 && <div className="border-t border-border" />}
          <div className="group py-3.5 flex items-center gap-3 transition-colors hover:border-primary/40">
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{wheel.name}</span>
              <span className="text-muted-foreground text-xs ml-2 tabular-nums">
                {wheel.entries.length} {wheel.entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <button
              onClick={() => navigate(`/wheels/${wheel.id}`)}
              className="text-xs text-primary/70 hover:text-primary flex items-center gap-1 font-display tracking-wider shrink-0 transition-colors"
            >
              Edit <ArrowRight className="h-3 w-3" />
            </button>
            <button
              aria-label="Delete wheel"
              onClick={() => {
                let timeout: ReturnType<typeof setTimeout>
                toast('Wheel deleted', {
                  action: { label: 'Undo', onClick: () => clearTimeout(timeout) },
                })
                timeout = setTimeout(() => deleteWheel.mutate(wheel.id), 4000)
              }}
              className="text-muted-foreground/40 hover:text-accent transition-colors p-1 shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
