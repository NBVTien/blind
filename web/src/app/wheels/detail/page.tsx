import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Minus, Save, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWheel, useUpdateWheel, useWheels } from '@/lib/wheels.queries'
import { useItems } from '@/lib/items.queries'
import { SpinWheel, wheelColor, type SpinWheelHandle } from '@/app/_components/SpinWheel'
import { ActionPicker, actionLabel } from '@/app/_components/ActionPicker'
import type { WheelEntry, AttachedAction } from '@blind/shared'

interface EntryInput { id?: string; label: string; weight: string; actions?: AttachedAction[] | null }

export function WheelDetailPage() {
  const { id: idStr } = useParams<{ id: string }>()
  const id = Number(idStr)
  const navigate = useNavigate()
  const { data: wheel, isLoading } = useWheel(id)
  const updateWheel = useUpdateWheel()

  const { data: items = [] } = useItems()
  const { data: wheels = [] } = useWheels()

  const wheelRef = useRef<SpinWheelHandle>(null)

  const [name, setName] = useState('')
  const [entries, setEntries] = useState<EntryInput[]>([])
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ label: string; colorIdx: number } | null>(null)
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null)

  const initialised = useRef(false)
  const [wheelSize, setWheelSize] = useState(320)
  const leftPanelRef = useRef<HTMLDivElement | null>(null)
  const obsRef = useRef<ResizeObserver | null>(null)

  const leftPanelCallbackRef = (el: HTMLDivElement | null) => {
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
    leftPanelRef.current = el
    if (!el) return
    const measure = () => {
      const s = Math.min(el.clientWidth, el.clientHeight) - 200
      setWheelSize(Math.max(200, s))
    }
    measure()
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    obsRef.current = obs
  }
  useEffect(() => {
    if (!wheel || initialised.current) return
    initialised.current = true
    setName(wheel.name)
    setEntries(wheel.entries.map(e => ({ id: e.id, label: e.label, weight: String(e.weight), actions: e.actions ?? null })))
  }, [wheel])

  function handleEntriesChange(next: EntryInput[]) {
    setEntries(next)
    setDirty(true)
    setSaved(false)
  }

  function handleSave() {
    const valid = entries.filter(e => e.label.trim() && Number(e.weight) > 0)
    if (!valid.length || !name.trim()) return
    updateWheel.mutate(
      {
        id: id,
        name: name.trim(),
        entries: valid.map(e => ({ label: e.label.trim(), weight: Number(e.weight), actions: e.actions ?? undefined })),
      },
      {
        onSuccess: () => {
          setDirty(false)
          setSaved(true)
          initialised.current = false
        },
      },
    )
  }

  const preview: WheelEntry[] = entries
    .filter(e => e.label.trim() && Number(e.weight) > 0)
    .map((e, i) => ({ id: e.id ?? String(i), label: e.label, weight: Number(e.weight) }))

  const total = preview.reduce((s, e) => s + e.weight, 0)

  function handleSpin() {
    if (spinning || preview.length === 0) return
    setResult(null)
    wheelRef.current?.spin()
  }

  function handleResult(entry: WheelEntry, colorIdx: number) {
    setSpinning(false)
    setResult({ label: entry.label, colorIdx })
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>
  if (!wheel) return <div className="p-6 text-muted-foreground">Wheel not found.</div>

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - var(--sidebar-header-h))' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-6 pb-4 shrink-0">
        <button
          aria-label="Back to wheels"
          onClick={() => navigate('/wheels')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setDirty(true); setSaved(false) }}
          className="font-display tracking-widest text-lg h-9 max-w-xs border-transparent hover:border-border focus:border-primary bg-transparent px-1"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || updateWheel.isPending}
            className="font-display tracking-widest flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {updateWheel.isPending ? 'Saving…' : saved && !dirty ? 'Saved' : 'Save'}
          </Button>
          {dirty && !updateWheel.isPending && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: wheel + spin */}
        <div ref={leftPanelCallbackRef} className="flex-[65] border-r border-border flex flex-col items-center justify-center gap-4 p-6 overflow-y-auto">
          <SpinWheel
            ref={wheelRef}
            entries={preview}
            size={wheelSize}
            onSpinStart={() => setSpinning(true)}
            onResult={handleResult}
          />

          <Button
            onClick={handleSpin}
            disabled={preview.length === 0 || spinning}
            className="font-display tracking-widest"
            style={{ width: wheelSize }}
          >
            {spinning ? 'Spinning…' : 'Spin'}
          </Button>

          {result && (
            <div
              className="rounded-md border px-4 py-3 text-center"
              style={{ width: wheelSize, borderColor: wheelColor(result.colorIdx) + '60', background: wheelColor(result.colorIdx) + '18' }}
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-1">Result</p>
              <p
                className="font-display tracking-wide text-lg font-semibold"
                style={{ color: wheelColor(result.colorIdx) }}
              >
                {result.label}
              </p>
            </div>
          )}

        </div>

        {/* Right: distribution + editor */}
        <div className="flex-[35] flex flex-col gap-6 p-6 overflow-y-auto">
          {/* Distribution */}
          {preview.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-2">Distribution</p>
              <div className="flex flex-col gap-1.5">
                {preview.map((e, i) => {
                  const pct = total > 0 ? e.weight / total * 100 : 0
                  const isResult = result && result.label === e.label && result.colorIdx === i
                  return (
                    <div key={e.id} className={`flex items-center gap-2 text-xs rounded px-1.5 py-1 transition-colors ${isResult ? 'bg-white/5' : ''}`}>
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: wheelColor(i) }} />
                      <span className="flex-1 min-w-0 truncate text-foreground">{e.label}</span>
                      <div className="w-20 h-1 bg-muted rounded-full overflow-hidden shrink-0">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: wheelColor(i) }} />
                      </div>
                      <span className="text-muted-foreground w-10 text-right shrink-0">{pct.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entries editor */}
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-3">Entries</p>
            <div className="flex gap-2 text-xs text-muted-foreground uppercase tracking-widest mb-2">
              <span className="flex-1">Label</span>
              <span className="w-20">Weight</span>
              <span className="w-6" />
            </div>
            <div className="flex flex-col gap-3">
              {entries.map((entry, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Entry ${i + 1}`}
                      value={entry.label}
                      onChange={e => handleEntriesChange(entries.map((en, j) => j === i ? { ...en, label: e.target.value } : en))}
                      className="flex-1 h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={entry.weight}
                      onChange={e => handleEntriesChange(entries.map((en, j) => j === i ? { ...en, weight: e.target.value } : en))}
                      className="w-20 h-8 text-xs"
                    />
                    <button
                      onClick={() => setExpandedEntry(expandedEntry === i ? null : i)}
                      className={`text-xs font-display tracking-widest px-1.5 py-0.5 rounded border transition-colors flex items-center justify-center ${
                        entry.actions?.length
                          ? 'border-primary/40 text-primary bg-primary/10'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                      title={entry.actions?.length ? actionLabel(entry.actions) : 'Add action'}
                    >
                      {entry.actions?.length ? <Zap className="h-3 w-3" /> : 'ACT'}
                    </button>
                    <button
                      onClick={() => handleEntriesChange(entries.filter((_, j) => j !== i))}
                      disabled={entries.length === 1}
                      className="text-muted-foreground hover:text-accent transition-colors disabled:opacity-30 p-1"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {expandedEntry === i && (
                    <div className="ml-0 pl-0">
                      <ActionPicker
                        value={entry.actions ?? null}
                        onChange={actions => handleEntriesChange(entries.map((en, j) => j === i ? { ...en, actions } : en))}
                        items={items}
                        wheels={wheels.filter(w => w.id !== id)}
                      />
                    </div>
                  )}
                  {entry.actions?.length && expandedEntry !== i && (
                    <p className="text-xs text-primary font-display pl-0.5 flex items-center gap-1">
                      <Zap className="h-3 w-3 shrink-0" /> {actionLabel(entry.actions)}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => handleEntriesChange([...entries, { label: '', weight: '1' }])}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Add entry
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
