import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shuffle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCreateMap } from '@/lib/maps.queries'
import { ParamSlider } from './ParamSlider'
import { DensityDiagram } from './DensityDiagram'
import { ChaosDiagram } from './ChaosDiagram'
import { ConnectivityDiagram } from './ConnectivityDiagram'
import { SpecialTypesPicker } from './SpecialTypesPicker'

export function NewMapPage() {
  const navigate = useNavigate()
  const createMap = useCreateMap()

  const [name, setName] = useState('')
  const [gridW, setGridW] = useState('8')
  const [gridH, setGridH] = useState('6')
  const [density, setDensity] = useState(40)
  const [chaos, setChaos] = useState(30)
  const [specialRate, setSpecialRate] = useState(30)
  const [specialTypes, setSpecialTypes] = useState<string[]>(['shop', 'trap', 'boss', 'loot'])
  const [connectivity, setConnectivity] = useState(20)
  const [randomStartEnd, setRandomStartEnd] = useState(false)

  function handleCreate() {
    if (!name.trim()) return
    createMap.mutate(
      { name: name.trim(), gridW: Number(gridW), gridH: Number(gridH), density, chaos, specialRate, specialTypes, connectivity, randomStartEnd },
      { onSuccess: (map) => navigate(`/maps/${map.id}`) },
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Button variant="ghost" size="icon" aria-label="Back to maps" onClick={() => navigate('/maps')} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl leading-tight">New Map</h1>
          <p className="text-muted-foreground text-sm">Configure generation parameters.</p>
        </div>
      </div>

      <div className="grid grid-cols-[260px_1fr] gap-10">
        {/* ── Left: identity + actions ── */}
        <div className="flex flex-col gap-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground font-display block mb-1.5">
              Map Name
            </label>
            <Input
              placeholder="e.g. The Forgotten Dungeon"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-display block mb-1.5">
                Width (4–12)
              </label>
              <Input type="number" min={4} max={12} value={gridW} onChange={e => setGridW(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs uppercase tracking-widest text-muted-foreground font-display block mb-1.5">
                Height (4–12)
              </label>
              <Input type="number" min={4} max={12} value={gridH} onChange={e => setGridH(e.target.value)} />
            </div>
          </div>

          {/* random start/end */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={randomStartEnd}
                onChange={e => setRandomStartEnd(e.target.checked)}
              />
              <div className={`w-9 h-5 rounded-full transition-colors ${randomStartEnd ? 'bg-primary' : 'bg-border'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${randomStartEnd ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Shuffle className="h-3.5 w-3.5 text-primary" />
                Random start &amp; end
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Off: top-left → bottom-right corners.<br />
                On: random path cells.
              </p>
            </div>
          </label>

          <div className="pt-2 flex flex-col gap-3">
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || createMap.isPending}
              className="w-full font-display tracking-widest text-xs"
            >
              {createMap.isPending ? 'Generating…' : 'Generate Map'}
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => navigate('/maps')}>
              Cancel
            </Button>
          </div>
        </div>

        {/* ── Right: parameter sliders ── */}
        <div className="flex flex-col gap-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-display border-b border-border pb-2">
            Generation Parameters
          </p>

          <ParamSlider label="Density" lowLabel="Sparse" highLabel="Dense" value={density} onChange={setDensity}>
            <DensityDiagram value={density} />
          </ParamSlider>

          <ParamSlider label="Chaos" lowLabel="Direct" highLabel="Winding" value={chaos} onChange={setChaos}>
            <ChaosDiagram value={chaos} />
          </ParamSlider>

          <SpecialTypesPicker
            rate={specialRate}
            onRateChange={setSpecialRate}
            types={specialTypes}
            onTypesChange={setSpecialTypes}
          />

          <ParamSlider label="Connectivity" lowLabel="Isolated branches" highLabel="Many shortcuts" value={connectivity} onChange={setConnectivity}>
            <ConnectivityDiagram value={connectivity} />
          </ParamSlider>
        </div>
      </div>
    </div>
  )
}
