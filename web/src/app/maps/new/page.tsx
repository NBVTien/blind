import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shuffle, Save, Trash2, ChevronDown, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateMap, useMapTemplates, useCreateTemplate, useDeleteTemplate } from '@/lib/maps.queries'
import { DensityDiagram } from './DensityDiagram'
import { ChaosDiagram } from './ChaosDiagram'
import { ConnectivityDiagram } from './ConnectivityDiagram'
import { SPECIAL_CELL_TYPES, type SpecialCellType } from '@blind/shared'

// ── Compact inline param row ──────────────────────────────────────────────────
// label [12ch] | mini SVG [48px] | slider [flex-1] | value [3ch]
function ParamRow({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  preview,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  preview?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 h-8">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-display w-28 shrink-0 leading-none">
        {label}
      </span>
      {preview && (
        <div className="w-12 h-7 shrink-0 rounded overflow-hidden border border-border/60 bg-[oklch(0.10_0.005_60)]">
          {preview}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-primary h-1"
      />
      <span className="text-xs text-primary tabular-nums font-display font-semibold w-6 text-right shrink-0">
        {value}
      </span>
    </div>
  )
}

// ── Special cell type colors ───────────────────────────────────────────────────
const TYPE_META: Record<SpecialCellType, { label: string; color: string }> = {
  shop:   { label: 'Shop',   color: 'oklch(0.72 0.16 65)' },
  trap:   { label: 'Trap',   color: 'oklch(0.55 0.22 25)' },
  boss:   { label: 'Boss',   color: 'oklch(0.45 0.18 300)' },
  loot:   { label: 'Loot',   color: 'oklch(0.65 0.16 90)' },
  chance: { label: 'Chance', color: 'oklch(0.62 0.22 200)' },
  jail:   { label: 'Jail',   color: 'oklch(0.28 0.05 250)' },
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function NewMapPage() {
  const navigate = useNavigate()
  const createMap = useCreateMap()
  const { data: templates = [] } = useMapTemplates()
  const createTemplate = useCreateTemplate()
  const deleteTemplate = useDeleteTemplate()

  const [name, setName] = useState('')
  const [gridW, setGridW] = useState('8')
  const [gridH, setGridH] = useState('6')
  const [density, setDensity] = useState(40)
  const [chaos, setChaos] = useState(30)
  const [specialRate, setSpecialRate] = useState(30)
  const [specialTypes, setSpecialTypes] = useState<string[]>(['shop', 'trap', 'boss', 'loot'])
  const [connectivity, setConnectivity] = useState(20)
  const [oneWayRate, setOneWayRate] = useState(0)
  const [portalCount, setPortalCount] = useState(0)
  const [randomStartEnd, setRandomStartEnd] = useState(false)
  const [emptyMap, setEmptyMap] = useState(false)

  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  function handleCreate() {
    if (!name.trim()) return
    createMap.mutate(
      { name: name.trim(), gridW: Number(gridW), gridH: Number(gridH), density, chaos, specialRate, specialTypes, connectivity, randomStartEnd, oneWayRate, portalCount, emptyMap },
      { onSuccess: (map) => navigate(`/maps/${map.id}`) },
    )
  }

  function handleSaveTemplate() {
    if (!templateName.trim()) return
    createTemplate.mutate(
      { name: templateName.trim(), params: { gridW: Number(gridW), gridH: Number(gridH), density, chaos, specialRate, connectivity, oneWayRate, portalCount, specialTypes, randomStartEnd } },
      { onSuccess: () => { setTemplateName(''); setShowSaveTemplate(false) } },
    )
  }

  function handleLoadTemplate(t: typeof templates[0]) {
    const p = t.params
    if (p.gridW !== undefined) setGridW(String(p.gridW))
    if (p.gridH !== undefined) setGridH(String(p.gridH))
    if (p.density !== undefined) setDensity(p.density)
    if (p.chaos !== undefined) setChaos(p.chaos)
    if (p.specialRate !== undefined) setSpecialRate(p.specialRate)
    if (p.connectivity !== undefined) setConnectivity(p.connectivity)
    if (p.oneWayRate !== undefined) setOneWayRate(p.oneWayRate)
    if (p.portalCount !== undefined) setPortalCount(p.portalCount)
    if (p.specialTypes !== undefined) setSpecialTypes(p.specialTypes)
    if (p.randomStartEnd !== undefined) setRandomStartEnd(p.randomStartEnd)
    setShowTemplatePicker(false)
  }

  function toggleSpecial(t: SpecialCellType) {
    if (specialTypes.includes(t)) {
      if (specialTypes.length === 1) return
      setSpecialTypes(specialTypes.filter(x => x !== t))
    } else {
      setSpecialTypes([...specialTypes, t])
    }
  }

  const activeTypes = specialTypes.filter((t): t is SpecialCellType =>
    (SPECIAL_CELL_TYPES as string[]).includes(t)
  )

  return (
    <div className="px-8 py-8 max-w-4xl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/maps')} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-light font-display tracking-wide leading-none">New Map</h1>
      </div>

      {/* ── Two-column body ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[200px_1fr] gap-10">

        {/* ╔══════ Left: identity + options + CTA ══════╗ */}
        <div className="flex flex-col gap-5">

          {/* Name */}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-display block mb-1.5">Name</label>
            <Input
              placeholder="The Forgotten Dungeon"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
              className="h-9"
            />
          </div>

          {/* Grid size */}
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-display block mb-1.5">Grid</label>
            <div className="flex items-center gap-2">
              <Input type="number" min={4} max={12} value={gridW} onChange={e => setGridW(e.target.value)} className="w-16 h-9 text-center tabular-nums" />
              <span className="text-muted-foreground/40 text-sm">×</span>
              <Input type="number" min={4} max={12} value={gridH} onChange={e => setGridH(e.target.value)} className="w-16 h-9 text-center tabular-nums" />
            </div>
          </div>

          {/* Mode toggles */}
          <div className="flex flex-col gap-1 pt-1 border-t border-border">
            <ModeToggle
              checked={emptyMap}
              onChange={setEmptyMap}
              label="Empty map"
              sub="No paths generated"
            />
            <div className={`transition-opacity duration-150 ${emptyMap ? 'opacity-30 pointer-events-none' : ''}`}>
              <ModeToggle
                checked={randomStartEnd}
                onChange={setRandomStartEnd}
                label="Random start/end"
                sub="Not fixed at corners"
                icon={<Shuffle className="h-3 w-3 text-primary/70" />}
              />
            </div>
          </div>

          {/* Templates */}
          <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-display">Templates</span>
            <div className="relative">
              <button
                onClick={() => setShowTemplatePicker(v => !v)}
                disabled={templates.length === 0}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs border border-border rounded hover:bg-muted/30 disabled:opacity-35 disabled:cursor-default transition-colors text-muted-foreground"
              >
                <span>{templates.length === 0 ? 'No templates' : 'Load…'}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
              {showTemplatePicker && templates.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border border-border rounded overflow-hidden shadow-lg">
                  {templates.map(t => (
                    <div key={t.id} className="flex items-center group">
                      <button className="flex-1 text-left px-3 py-2 text-xs hover:bg-muted/40 transition-colors" onClick={() => handleLoadTemplate(t)}>
                        {t.name}
                      </button>
                      <button className="px-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all" onClick={e => { e.stopPropagation(); deleteTemplate.mutate(t.id) }} aria-label={`Delete ${t.name}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showSaveTemplate ? (
              <div className="flex flex-col gap-1.5">
                <Input
                  placeholder="Template name"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); if (e.key === 'Escape') setShowSaveTemplate(false) }}
                  autoFocus
                  className="h-7 text-xs"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSaveTemplate} disabled={!templateName.trim() || createTemplate.isPending}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowSaveTemplate(true)} className="flex items-center gap-1.5 px-1 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Save className="h-3 w-3" />
                Save as template
              </button>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-border">
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createMap.isPending}
              className="w-full font-display tracking-widest text-xs h-9 gap-2"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {createMap.isPending ? 'Generating…' : emptyMap ? 'Create Empty' : 'Generate Map'}
            </Button>
            <button onClick={() => navigate('/maps')} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1">
              Cancel
            </button>
          </div>
        </div>

        {/* ╔══════ Right: generation params ══════╗ */}
        <div className={`flex flex-col gap-0 transition-opacity duration-150 ${emptyMap ? 'opacity-25 pointer-events-none' : ''}`}>

          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-display border-b border-border pb-2 mb-4">
            Generation
          </div>

          {/* Path shape params */}
          <div className="flex flex-col gap-2.5 mb-5">
            <ParamRow label="Density" value={density} onChange={setDensity} preview={<DensityDiagram value={density} />} />
            <ParamRow label="Chaos" value={chaos} onChange={setChaos} preview={<ChaosDiagram value={chaos} />} />
            <ParamRow label="Connectivity" value={connectivity} onChange={setConnectivity} preview={<ConnectivityDiagram value={connectivity} />} />
            <ParamRow label="One-Way" value={oneWayRate} onChange={setOneWayRate} preview={<OneWayMini value={oneWayRate} />} />
            <ParamRow label="Portals" value={portalCount} onChange={setPortalCount} min={0} max={10} step={1} preview={<PortalMini value={portalCount} />} />
          </div>

          {/* Special cells */}
          <div className="border-t border-border pt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-display">Special Cells</span>
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">{specialTypes.length} enabled</span>
            </div>

            {/* Type chips */}
            <div className="flex gap-1.5 flex-wrap">
              {SPECIAL_CELL_TYPES.map(t => {
                const on = specialTypes.includes(t)
                const { label, color } = TYPE_META[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleSpecial(t)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-all duration-100"
                    style={{
                      borderColor: on ? color : 'oklch(0.35 0.01 0)',
                      background: on ? `color-mix(in oklch, ${color} 12%, transparent)` : 'transparent',
                      color: on ? color : 'oklch(0.45 0.01 0)',
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: on ? color : 'oklch(0.4 0.01 0)' }} />
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Rate row */}
            <div className="flex items-center gap-3 h-8">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground font-display w-28 shrink-0">Rate</span>
              <div className="w-12 h-7 shrink-0 rounded overflow-hidden border border-border/60 bg-[oklch(0.10_0.005_60)]">
                <svg viewBox="0 0 48 28" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const threshold = (i + 1) / 8
                    const active = specialRate / 100 >= threshold
                    const type = activeTypes[i % Math.max(activeTypes.length, 1)]
                    const color = active && type ? TYPE_META[type].color : 'oklch(0.28 0.012 60)'
                    return (
                      <circle key={i} cx={4 + i * 6.5} cy={14} r={active ? 4 : 2.5}
                        fill={color} opacity={active ? 1 : 0.3}
                        style={{ transition: 'all 0.12s' }}
                      />
                    )
                  })}
                </svg>
              </div>
              <input
                type="range" min={0} max={100} step={5} value={specialRate}
                onChange={e => setSpecialRate(Number(e.target.value))}
                className="flex-1 accent-primary h-1"
              />
              <span className="text-xs text-primary tabular-nums font-display font-semibold w-6 text-right shrink-0">{specialRate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mode toggle chip ──────────────────────────────────────────────────────────
function ModeToggle({ checked, onChange, label, sub, icon }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  sub: string
  icon?: React.ReactNode
}) {
  return (
    <label className="flex items-center gap-2.5 py-2 cursor-pointer group">
      <div className="relative shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-7 h-4 rounded-full transition-colors duration-150 ${checked ? 'bg-primary' : 'bg-border'}`} />
        <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform duration-150 ${checked ? 'translate-x-3 bg-primary-foreground' : 'translate-x-0 bg-foreground/60'}`} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-xs text-foreground leading-none">
          {icon}
          <span>{label}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-none">{sub}</p>
      </div>
    </label>
  )
}

// ── Miniature diagrams (48×28 viewBox) ───────────────────────────────────────

function OneWayMini({ value }: { value: number }) {
  const pct = value / 100
  const segs = [
    { x1: 4, y1: 14, x2: 18, y2: 14, oneWay: pct > 0.2 },
    { x1: 18, y1: 14, x2: 32, y2: 14, oneWay: pct > 0.55 },
    { x1: 32, y1: 14, x2: 44, y2: 14, oneWay: pct > 0.8 },
    { x1: 14, y1: 5,  x2: 14, y2: 23, oneWay: pct > 0.35 },
    { x1: 34, y1: 5,  x2: 34, y2: 23, oneWay: pct > 0.65 },
  ]
  return (
    <svg viewBox="0 0 48 28" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {segs.map((s, i) => {
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1
        const len = Math.sqrt(dx * dx + dy * dy)
        const nx = dx / len, ny = dy / len
        const px = -ny, py = nx
        return (
          <g key={i}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
              stroke={s.oneWay ? 'oklch(68% 0.14 30)' : 'oklch(55% 0.06 260)'}
              strokeWidth={1.4} strokeLinecap="round" />
            {s.oneWay && (
              <polygon
                points={`${mx + nx * 3},${my + ny * 3} ${mx - nx * 2.5 + px * 2},${my - ny * 2.5 + py * 2} ${mx - nx * 2.5 - px * 2},${my - ny * 2.5 - py * 2}`}
                fill="oklch(68% 0.14 30)"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function PortalMini({ value }: { value: number }) {
  const nodes = [
    { x: 8,  y: 7  }, { x: 16, y: 18 }, { x: 8,  y: 24 },
    { x: 40, y: 7  }, { x: 32, y: 18 }, { x: 40, y: 24 },
  ]
  const portals: [number, number][] = [[0, 5], [1, 4], [2, 3]]
  const visiblePortals = portals.filter((_, i) => value > i * 3)
  return (
    <svg viewBox="0 0 48 28" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      {[[0,1],[1,2],[0,2],[3,4],[4,5],[3,5]].map(([a,b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
          stroke="oklch(55% 0.06 260)" strokeWidth={1} strokeLinecap="round" />
      ))}
      {visiblePortals.map(([a, b], i) => {
        const ax = nodes[a].x, ay = nodes[a].y, bx = nodes[b].x, by = nodes[b].y
        const mx = (ax + bx) / 2, my = (ay + by) / 2 - 6
        return (
          <g key={i}>
            <path d={`M${ax},${ay} Q${mx},${my} ${bx},${by}`}
              fill="none" stroke="oklch(70% 0.18 300)" strokeWidth={1.2} strokeDasharray="2 1.5" />
            <circle cx={ax} cy={ay} r={2} fill="oklch(70% 0.18 300)" />
            <circle cx={bx} cy={by} r={2} fill="oklch(70% 0.18 300)" />
          </g>
        )
      })}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={3} fill="oklch(22% 0.02 260)" stroke="oklch(45% 0.06 260)" strokeWidth={0.8} />
      ))}
    </svg>
  )
}
