# Design System

## Aesthetic Direction

**Dark cartographic dungeon — parchment-on-void.**

A GM tool that feels like an ancient dungeon map lit by torchlight. Dark, atmospheric, functional. No cards. No generic SaaS feel.

The physical scene: a GM running a live session on a laptop in a dim room, players on phones nearby. Every design choice must serve that moment — fast reads, no hunting, atmosphere that doesn't slow you down.

## Fonts

- **Display (headings, titles):** `Cormorant Garamond` — italic-capable old-style serif. Weights 300/400/600/700. Used for h1–h6 and `.font-display`. Large display sizes use `font-light` (300); labels use default weight.
- **Body:** `Vollkorn` — warm old-style serif designed for screen reading. Moderate stroke contrast, round proportions, robust at small sizes on dark backgrounds. Weights 400/600/700 + italic 400. All body text, labels, UI copy.

Both loaded from Google Fonts in `index.css` (must be the first `@import`).

**Typographic rhythm:**
- Page titles: Cormorant Garamond `text-3xl font-light tracking-wide` (display register)
- Section heads: Cormorant Garamond `text-xl font-semibold tracking-wider uppercase` (label register)
- Body / UI copy: Vollkorn `text-base`
- Tabular data (gold, HP numbers): Vollkorn `text-sm tabular-nums`
- Status/badge text: Vollkorn `text-xs tracking-widest uppercase`

Never mix font families within a hierarchy tier. Cormorant for structure; Vollkorn for content.

## Theme

Two modes. Default: **dark**. Persisted to `localStorage` key `theme`. Toggle button (Sun/Moon icon) in Sidebar footer. No flash on load — inline script in `index.html` applies `.light` class to `<html>` before React mounts.

- Dark = default `:root` tokens (dungeon void)
- Light = `:root.light` tokens (parchment daylit map) — warm cream bg, near-black ink fg, amber primary shifted darker for contrast

`useTheme` hook in `web/src/hooks/use-theme.ts` manages state + class mutation.

## Color Palette (OKLCH)

All tokens defined in `web/src/index.css`. Dark is default `:root`; light overrides via `:root.light`.

| Token | Value | Use |
|-------|-------|-----|
| `--background` | `oklch(0.12 0.008 60)` | Near-black warm |
| `--foreground` | `oklch(0.92 0.03 75)` | Warm parchment white |
| `--primary` | `oklch(0.74 0.19 62)` | Amber/ochre — interactive, selected, active states |
| `--primary-foreground` | `oklch(0.10 0.008 60)` | Text on primary backgrounds |
| `--muted` | `oklch(0.18 0.006 60)` | Subtle surface layer (input bg, row hover) |
| `--muted-foreground` | `oklch(0.6 0.04 70)` | Subdued labels, secondary text |
| `--accent` | `oklch(0.65 0.18 30)` | Red-amber — danger, destructive, boss threat |
| `--accent-foreground` | `oklch(0.95 0.02 75)` | Text on accent backgrounds |
| `--border` | `oklch(0.92 0.03 75 / 16%)` | Faint ruled lines |
| `--success` | `oklch(0.72 0.17 145)` | Positive outcomes, loot, win states |
| `--success-foreground` | `oklch(0.10 0.008 60)` | Text on success backgrounds |
| `--warning` | `oklch(0.82 0.16 85)` | Caution, trap suggestion banners |
| `--warning-foreground` | `oklch(0.10 0.008 60)` | Text on warning backgrounds |

**Cell-type color palette** (SVG fill values, not CSS tokens):

| Cell type | Fill | Rationale |
|-----------|------|-----------|
| plain | `oklch(0.14 0.006 60)` | Near-void — traversed space |
| start | `oklch(0.46 0.18 145)` | Forest green — entry/life |
| end | `oklch(0.38 0.15 300)` | Deep violet — destination |
| shop | `oklch(0.72 0.18 62)` | Amber — commerce, warmth |
| trap | `oklch(0.45 0.22 25)` | Blood red — danger |
| boss | `oklch(0.28 0.12 295)` | Dark purple — dread |
| loot | `oklch(0.68 0.20 115)` | Yellow-green — reward |
| chance | `oklch(0.58 0.18 200)` | Teal — unknown outcome |
| jail | `oklch(0.40 0.04 240)` | Muted blue-grey — trapped |

**Color strategy: Committed.** Amber/ochre (`--primary`) carries 40–60% of all interactive surface area. It is not an accent — it IS the product color. Do not reduce it to ≤10%.

## Layout Rules

- **No cards on new pages.** Use horizontal rules, bottom-border rows, typographic hierarchy.
- Tables and lists use `border-b` dividers only — value `var(--border)`.
- Generous whitespace. Let typography breathe. Minimum `py-6` between major sections.
- Sidebar collapsible (icon mode). App title "BLIND" in Cormorant Garamond `font-bold tracking-widest` at top.
- **No nested containers.** One outer `px-6 max-w-prose` or `px-8` per page — never a wrapper inside a wrapper.
- **Row-based data layouts.** Player rows, item rows, log entries: `flex items-center gap-4 py-3 border-b`. Not grids of equal-weight tiles.
- Page max-width where content should be readable: `max-w-3xl` for prose-heavy pages (`/game-config`, `/items`). Full width for map/dashboard.

## Spacing Rhythm

Varied spacing is intentional — same padding everywhere is monotony.

| Context | Token |
|---------|-------|
| Page outer padding | `px-8 py-10` |
| Section gap | `mt-10 mb-4` (heading) + `mt-2` (content) |
| Row item gap | `gap-3` or `gap-4` |
| Inline controls (gold/hp buttons) | `gap-1` |
| Between major page sections | `mt-12` |

## Map Grid

Graph-style SVG renderer (not CSS grid):
- Cell nodes: `52×28px` rounded rects (`rx=8`), `CELL_SIZE=72px` spacing between centers.
- Cell background: `oklch(0.1 0.005 60)` with dot-grid pattern (1.2px dots at cell centers).
- Edges: 2px amber lines (`oklch(0.72 0.16 65 / 55%)`) between node centers, `strokeLinecap="round"`.
- Disconnected nodes: 18% opacity.
- Edge-source node: dashed amber ring overlay (`stroke-dasharray="4 3"`).
- Selected player cell: amber fill `oklch(0.74 0.19 62 / 20%)` + solid amber border.
- Cell colors by type: see color palette table above.

**Map atmosphere rules:**
- The dot-grid pattern should always be subtle enough that cell colors read first.
- Never add drop-shadows to SVG nodes — depth comes from color, not elevation.
- Player tokens (32px circles) use the player's color with the initial as text. Font: Cormorant Garamond bold. No border.
- Active/selected player token: scale-110 + subtle amber outer ring (`box-shadow` equivalent: `filter: drop-shadow(0 0 6px oklch(0.74 0.19 62 / 60%))`).

## State-Specific Styling

**Turn states (player rows):**
- `ACTIVE`: left inset line `border-l-2 border-primary pl-3`, player name in `text-primary font-semibold`
- `DONE`: muted opacity `opacity-60`, name in `text-muted-foreground`
- `SKIP×N`: muted + italic name, skip count badge in `text-accent text-xs uppercase tracking-widest`

**HP display:**
- Full hearts: `fill-accent text-accent` (red-amber)
- Empty hearts: `text-muted-foreground` outline only
- 1 HP remaining: heart icon pulses — `animate-pulse` on the single filled heart

**Gold display:**
- Numbers use `tabular-nums` — they change frequently, prevent layout shift
- Negative-adjacent warning (≤0): number in `text-accent`

**Boss fight panel:**
- Boss HP hearts: larger (`h-4 w-4`), filled in `text-accent`
- At 50% boss HP: hearts gain `animate-pulse`
- Win result: text in `text-success`; Lose result: text in `text-accent`

**Suggestion banner (trap/loot landing):**
- Background: `bg-warning/10 border border-warning/30`
- Text: `text-warning-foreground`
- No icon — the cell type label carries meaning

## Animations

Ease principle: always ease-out (exponential). No bounce, no elastic, no ease-in.

| Element | Animation |
|---------|-----------|
| Player token move | `transition-all duration-300 ease-out` |
| Player token selected pulse | `scale-110 + drop-shadow filter, duration-200` |
| Page section reveal | Staggered `opacity-0 → opacity-100`, `translateY(8px) → 0`, `duration-300`, `animation-delay` increments of 60ms |
| Log entry appear | Slide in from left, `translateX(-12px) → 0`, `opacity-0 → 1`, `duration-200` |
| Wheel spin result | `scale-95 → 100`, `opacity-0 → 1`, `duration-250` |
| Boss fight win/lose result | Same as wheel spin |
| Turn advance | ACTIVE badge cross-fades, `duration-150` |

Never animate layout properties (`width`, `height`, `padding`, `margin`). Use `transform` and `opacity` only.

## Utility Classes (index.css)

```css
.font-display     /* Cormorant Garamond font */
.dungeon-grid     /* subtle background dot-grid texture */
.cell-glow        /* amber border + hover glow on map cells */
.tabular-nums     /* font-variant-numeric: tabular-nums (gold/HP counters) */
```

## Icons

Use **lucide-react** icons exclusively. No emoji in UI code.

| Context | Icon |
|---------|------|
| Action/trigger | `<Zap />` |
| Jail / locked | `<Lock />` |
| Boss battle | `<Swords />` |
| HP / hearts | `<Heart />` (add `fill-accent text-accent` when filled) |
| Move / teleport | `<Navigation />` |
| Gold / economy | `<Coins />` |
| Inventory / item | `<Backpack />` |
| Spin wheel | `<RefreshCw />` |
| Turn advance | `<ChevronRight />` |
| Skip turn | `<ChevronsRight />` |
| Death / respawn | `<Skull />` |
| Add | `<Plus />` |
| Remove / delete | `<Trash2 />` |
| Settings / config | `<Settings2 />` |
| Log / history | `<ScrollText />` |

Sizing convention: `h-3 w-3` for inline/label use, `h-3.5 w-3.5` for buttons, `h-4 w-4` for prominent UI actions, `h-5 w-5` for section header icons.

**Icon color:** `text-muted-foreground` by default. `text-primary` when interactive/active. `text-accent` for destructive or danger states.

## Player View Design Constraints

The player view (`/play/:code/:playerId`) is intentionally spare. It is a character sheet, not a dashboard.

- No map. No map-adjacent hints. Players should not be able to infer map structure.
- Cell type shown as a label only — not a colored badge. Type name in Cormorant Garamond italic.
- Turn status: one line. "Your turn" in `text-primary font-semibold`. "Waiting" in `text-muted-foreground`.
- End Turn button: full width, prominent. Only enabled when `activePlayerId === this player`.
- Spin button (chance cell): same treatment as End Turn — full width, secondary styling.
- No sidebar. No navigation. Mobile-first single-column layout, `max-w-sm mx-auto px-6 py-10`.

## What NOT to do

- No `hsl(` in color tokens — OKLCH only
- No `tailwind.config.*` — Tailwind v4 uses vite plugin only
- No shadcn Card component on new pages
- No Inter, Roboto, or system fonts
- No purple gradients
- No emoji in UI — use lucide-react icons
- No side-stripe borders (`border-l` or `border-r` > 1px as decorative accents) — except the ACTIVE turn state inset (which is functional, not decorative)
- No gradient text (`background-clip: text`)
- No glassmorphism
- No hero-metric template (big number + small label + gradient accent)
- No identical card grids
- No shadow-based elevation — depth through color and opacity only
- No round numbers for spacing (`p-4 p-4 p-4`) — vary intentionally
