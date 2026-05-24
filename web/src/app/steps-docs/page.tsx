export function StepsDocsPage() {
  return (
    <div className="p-10 max-w-3xl">
      <div className="mb-10">
        <p className="text-xs font-display tracking-[0.3em] uppercase text-muted-foreground mb-2">Reference</p>
        <h1 className="font-display font-light text-4xl leading-none" style={{ letterSpacing: '0.08em' }}>Death Steps</h1>
        <p className="text-muted-foreground text-sm mt-3">
          Steps that fire in order when a player reaches 0 HP. Configured in{' '}
          <a href="/game-config" className="text-primary underline underline-offset-2">Game Config</a>.
        </p>
      </div>

      <Section title="Step Types">
        <StepRow
          name="Skip Turns"
          type="SKIP_TURNS"
          fields="count: number"
          notes="Player misses the next N turns. Any remaining steps (RESPAWN_AT_START, GIVE_HP) are deferred until all skips are exhausted. While skipping, the player's token stays in place and their turn is auto-passed each round."
        />
        <StepRow
          name="Respawn at Start"
          type="RESPAWN_AT_START"
          fields="hp: number"
          notes="Teleports the player to the start cell and sets their HP to the given value (clamped to maxHp). Typically placed after SKIP_TURNS so the player reappears after the penalty period ends."
        />
        <StepRow
          name="Give HP"
          type="GIVE_HP"
          fields="amount: number"
          notes="Adds HP to the player in place — no teleport. Use instead of RESPAWN_AT_START for a soft revive. Also deferred past any preceding SKIP_TURNS step."
        />
      </Section>

      <Section title="How sequencing works">
        <div className="text-sm text-muted-foreground flex flex-col gap-3">
          <p>
            Steps execute top-to-bottom the moment a player's HP reaches 0.
            <strong className="text-foreground"> SKIP_TURNS is a gate</strong> — it sets a counter on the player and stops execution.
            The remaining steps resume automatically once all skips are spent.
          </p>
          <p>
            Only one SKIP_TURNS step matters per sequence — multiple SKIP_TURNS steps would stack their counts,
            which is valid but unusual.
          </p>
          <p>
            If there is no SKIP_TURNS step, all steps fire immediately on death (instant revive or penalty).
          </p>
        </div>
      </Section>

      <Section title="Examples">
        <ExampleRow
          label="Default (skip 3 → respawn)"
          steps={[
            { type: 'SKIP_TURNS', detail: 'count: 3' },
            { type: 'RESPAWN_AT_START', detail: 'hp: 1' },
          ]}
          outcome="Player sits out 3 turns, then appears at start with 1 HP."
        />
        <ExampleRow
          label="Instant soft revive"
          steps={[
            { type: 'GIVE_HP', detail: 'amount: 1' },
          ]}
          outcome="Player immediately recovers 1 HP in place. No turn skip."
        />
        <ExampleRow
          label="Heavy penalty"
          steps={[
            { type: 'SKIP_TURNS', detail: 'count: 5' },
            { type: 'RESPAWN_AT_START', detail: 'hp: 1' },
          ]}
          outcome="Player skips 5 turns, then respawns at start with 1 HP."
        />
        <ExampleRow
          label="Skip + partial heal"
          steps={[
            { type: 'SKIP_TURNS', detail: 'count: 2' },
            { type: 'GIVE_HP', detail: 'amount: 2' },
          ]}
          outcome="Player skips 2 turns, then gets 2 HP restored in place (no teleport)."
        />
      </Section>

      <div className="mt-12 border-t border-border pt-6 flex flex-col gap-1">
        <p className="text-xs text-muted-foreground font-display tracking-widest uppercase">Triggered by</p>
        <p className="text-sm text-muted-foreground mt-1">
          Any action that reduces HP to 0:{' '}
          <span className="font-mono text-foreground">ADJUST_HP</span>,{' '}
          <span className="font-mono text-foreground">SET_PLAYER_HP</span>,{' '}
          <span className="font-mono text-foreground">BOSS_FIGHT_SPIN</span> (lose outcome).
        </p>
        <p className="text-xs text-muted-foreground font-display tracking-widest uppercase mt-4">Configure at</p>
        <p className="text-sm font-mono text-foreground mt-1">PATCH /api/game-config</p>
        <p className="text-sm text-muted-foreground">
          Body: <span className="font-mono text-foreground">{'{ "deathSequence": [ { "type": "...", ... } ] }'}</span>
        </p>
      </div>
    </div>
  )
}

// ─── Layout components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-3 pb-2 border-b border-border">
        {title}
      </h2>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

function StepRow({ name, type, fields, notes }: { name: string; type: string; fields: string; notes: string }) {
  return (
    <div className="py-3 border-b border-border last:border-0 grid grid-cols-[180px_1fr] gap-4 items-start">
      <div>
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs font-mono text-primary mt-0.5">{type}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-mono mb-1">{fields}</p>
        <p className="text-sm text-muted-foreground">{notes}</p>
      </div>
    </div>
  )
}

function ExampleRow({ label, steps, outcome }: {
  label: string
  steps: { type: string; detail: string }[]
  outcome: string
}) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="flex flex-col gap-1 mb-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs font-display tracking-widest text-muted-foreground w-4 shrink-0">{i + 1}.</span>
            <span className="text-xs font-mono text-primary">{s.type}</span>
            <span className="text-xs text-muted-foreground font-mono">{s.detail}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground italic ml-6">{outcome}</p>
    </div>
  )
}
