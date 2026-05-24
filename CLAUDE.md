# blind-game — CLAUDE.md

## Before implementing any feature

**Read `docs/` first.** Every feature must be consistent with these docs. If something isn't described, ask before inventing behavior.

```
docs/overview.md      ← what the app is and who uses it
docs/features.md      ← full feature spec with UI details
docs/data-model.md    ← all shared types and their semantics
docs/api.md           ← all endpoints, bodies, storage details
docs/design.md        ← aesthetic direction, fonts, colors, layout rules
docs/conventions.md   ← coding conventions for web, api, and shared
```

## After implementing any feature

**Update `docs/` to reflect what changed.** Keep docs in sync with the code:
- New endpoint → update `docs/api.md`
- New type or field → update `docs/data-model.md`
- New page or UI behavior → update `docs/features.md`
- New convention or gotcha → update `docs/conventions.md`
- New design decision → update `docs/design.md`
- New `ActionType` or `GmActionPayload` field → update `/actions-docs` page (`web/src/app/actions-docs/page.tsx`)
- New `DeathActionStep` type → update `/steps-docs` page (`web/src/app/steps-docs/page.tsx`)

Docs are the source of truth. Code that diverges from docs means docs are wrong — fix them.

---

## Monorepo

pnpm workspace: `web/` + `api/` + `shared/`. Always run install from repo root.

```
web/    → port 36000  (Vite + React + TS + Tailwind v4 + shadcn/ui)
api/    → port 36001  (NestJS + better-sqlite3)
shared/ → ESM types only, no React/DOM
```

```bash
pnpm dev          # start both
pnpm dev:web      # web only
pnpm dev:api      # api only
```

---

## Web — Directory Structure

```
web/src/
  app/
    _components/   ← shared app-wide (layout, topbar, sidebar…)
    <route>/
      page.tsx     ← named export ending in Page (e.g. DashboardPage)
  components/
    ui/            ← shadcn-owned. NEVER hand-write here.
  hooks/           ← custom hooks
  lib/
    api.ts         ← single axios instance (reads VITE_API_URL)
    queries.ts     ← all queryKeys + TanStack Query hooks. No fetch in components.
    utils.ts       ← cn() and misc helpers
  main.tsx         ← router root
  index.css        ← design tokens + Tailwind
```

---

## API — Directory Structure

```
api/src/
  main.ts           ← bootstrap (port 36001, CORS → 36000, /api prefix)
  app.module.ts     ← root module
  db.service.ts     ← better-sqlite3 wrapper + schema migration
  db.module.ts      ← global module, exports DbService
  <feature>/
    <feature>.module.ts
    <feature>.controller.ts
    <feature>.service.ts
    dto/
```

---

## Build Verification

```bash
pnpm --filter @blind/shared build   # 1. shared types (run first if types changed)
pnpm --filter web build             # 2. web — must be zero TS errors
cd api && npm run build             # 3. api — nest build
```

Always fix build errors before continuing to new features.

**Note:** `nest start --watch` requires a pre-built `dist/` to start. Run `cd api && npm run build` once before `pnpm dev` if dist is missing.

---

## Design Tokens (index.css)

Structure order — never reorder:
1. Google Font `@import` (must be first)
2. `@import "tailwindcss"`
3. `@layer base { :root { ... } }` — all OKLCH, dark-only (no `.dark` block)
4. `@theme inline { ... }` — re-exports tokens to Tailwind utilities

Required tokens: `--success`, `--success-foreground`, `--warning`, `--warning-foreground`.
