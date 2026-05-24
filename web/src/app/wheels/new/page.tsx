import { useState } from 'react'
import { ArrowLeft, Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNavigate } from 'react-router-dom'
import { useCreateWheel } from '@/lib/wheels.queries'
import { SpinWheel, wheelColor } from '@/app/_components/SpinWheel'
import type { WheelEntry } from '@blind/shared'

interface EntryInput { label: string; weight: string }

export function WheelNewPage() {
  const navigate = useNavigate()
  const createWheel = useCreateWheel()

  const [name, setName] = useState('')
  const [entries, setEntries] = useState<EntryInput[]>([
    { label: '', weight: '1' },
    { label: '', weight: '1' },
  ])

  function addEntry() {
    setEntries(prev => [...prev, { label: '', weight: '1' }])
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, j) => j !== i))
  }

  function updateEntry(i: number, field: keyof EntryInput, value: string) {
    setEntries(prev => prev.map((e, j) => j === i ? { ...e, [field]: value } : e))
  }

  function handleCreate() {
    if (!name.trim()) return
    const valid = entries.filter(e => e.label.trim() && Number(e.weight) > 0)
    if (!valid.length) return
    createWheel.mutate(
      {
        name: name.trim(),
        entries: valid.map(e => ({ label: e.label.trim(), weight: Number(e.weight) })),
      },
      { onSuccess: (wheel) => navigate(`/wheels/${wheel.id}`) },
    )
  }

  // Live preview entries
  const preview: WheelEntry[] = entries
    .filter(e => e.label.trim() && Number(e.weight) > 0)
    .map((e, i) => ({ id: String(i), label: e.label, weight: Number(e.weight) }))

  const total = preview.reduce((s, e) => s + e.weight, 0)

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          aria-label="Back to wheels"
          onClick={() => navigate('/wheels')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-display text-xl tracking-widest">New Wheel</h1>
      </div>

      <div className="flex gap-10 flex-wrap">
        {/* Left: preview wheel */}
        <div className="shrink-0 flex flex-col items-center gap-4">
          <SpinWheel entries={preview} size={280} />
          {preview.length > 0 && (
            <div className="flex flex-col gap-1 w-[280px]">
              {preview.map((e, i) => (
                <div key={e.id} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: wheelColor(i) }} />
                  <span className="flex-1 truncate text-foreground">{e.label}</span>
                  <span className="text-muted-foreground shrink-0">
                    {total > 0 ? (e.weight / total * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: form */}
        <div className="flex-1 min-w-[260px] flex flex-col gap-5">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-display block mb-1.5">
              Wheel Name
            </label>
            <Input
              placeholder="e.g. Loot Table"
              value={name}
              onChange={e => setName(e.target.value)}
              className="max-w-sm"
              autoFocus
            />
          </div>

          <div>
            <div className="flex gap-2 text-xs text-muted-foreground uppercase tracking-widest mb-2">
              <span className="flex-1">Label</span>
              <span className="w-20">Weight</span>
              <span className="w-6" />
            </div>
            <div className="flex flex-col gap-2">
              {entries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`Entry ${i + 1}`}
                    value={entry.label}
                    onChange={e => updateEntry(i, 'label', e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={entry.weight}
                    onChange={e => updateEntry(i, 'weight', e.target.value)}
                    className="w-20 h-8 text-xs"
                  />
                  <button
                    onClick={() => removeEntry(i)}
                    disabled={entries.length === 1}
                    className="text-muted-foreground hover:text-accent transition-colors disabled:opacity-30 p-1"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addEntry}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Add entry
            </button>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || preview.length === 0 || createWheel.isPending}
            className="font-display tracking-widest self-start"
          >
            {createWheel.isPending ? 'Creating…' : 'Create Wheel'}
          </Button>
        </div>
      </div>
    </div>
  )
}
