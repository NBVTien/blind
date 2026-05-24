export function ParamSlider({
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
  children,
}: {
  label: string
  lowLabel: string
  highLabel: string
  value: number
  onChange: (v: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs uppercase tracking-widest text-muted-foreground font-display">
          {label}
        </span>
        <span className="text-xs text-primary font-display tabular-nums font-semibold">{value}</span>
      </div>

      {/* diagram box */}
      <div className="rounded border border-border bg-map-bg h-24 relative overflow-hidden">
        {children}
        <span className="absolute bottom-1.5 left-2 text-[9px] text-muted-foreground/50 uppercase tracking-widest font-display pointer-events-none">
          {lowLabel}
        </span>
        <span className="absolute bottom-1.5 right-2 text-[9px] text-muted-foreground/50 uppercase tracking-widest font-display pointer-events-none">
          {highLabel}
        </span>
        {/* value fill bar at bottom */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-primary/40 transition-all duration-75"
          style={{ width: `${value}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}
