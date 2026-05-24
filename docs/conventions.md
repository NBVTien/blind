# Conventions

## Web

### Colors
- All tokens in `index.css` use **OKLCH only**. Never add `hsl(`.
- Dark-only theme — no `.dark` class toggle.

### Tailwind
- No `tailwind.config.*` or `postcss.config.*` — Tailwind v4 uses the vite plugin.
- Path alias `@/*` → `web/src/*`.
- `tsconfig.app.json` requires `"ignoreDeprecations": "6.0"` (TS6 deprecated `baseUrl`).

### Pages
- File: `web/src/app/<route>/page.tsx`
- Export: named, suffix `Page` (e.g. `export function DashboardPage()`)
- Register in `main.tsx` under `AppLayout` children

### Component splitting
A single `AComponent.tsx` may be refactored into a directory when it grows too large:
```
AComponent/
  index.tsx        ← same public exports as the original file
  components/      ← sub-components used only inside AComponent
  utils.ts         ← pure helpers
  constants.ts     ← shared constants
  types.ts         ← local TypeScript types
```
Imports from outside the directory never change — they still resolve to `AComponent` (via `index.tsx`).

### Data Fetching
- All query keys + hooks live in `lib/queries.ts`. **Never fetch inside components.**
- `QueryClient` lives in `AppLayout` — single instance, `staleTime: 30_000`, `refetchOnWindowFocus: false`.
- Use TanStack Query `useQuery` / `useMutation` exclusively.

### shadcn/ui
- Components land in `web/src/components/ui/` — treat as **vendor/read-only**.
- Add via: `pnpm dlx shadcn@latest add <component>`
- Gotcha: shadcn sometimes creates `web/@/` — fix:
  ```bash
  cp -r web/@/components/ui/* web/src/components/ui/
  cp -r web/@/hooks/* web/src/hooks/
  rm -rf web/@
  ```
- **Always use shadcn `Select` instead of native `<select>`.** Radix `SelectItem` rejects empty string `value` — use a sentinel (e.g. `'__random__'`) and map back on `onValueChange`.

### Design
- No shadcn `Card` component on new pages — use border-bottom rows, typographic hierarchy.
- No Inter, Roboto, or system fonts — see `docs/design.md`.
- Fonts: Cinzel (headings via `font-display`), Crimson Text (body).

---

## API

### Module structure
```
api/src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/
    create-<feature>.dto.ts
    update-<feature>.dto.ts
```

### Adding a feature module
```bash
cd api
npx nest g module <feature>
npx nest g controller <feature>
npx nest g service <feature>
```

### DTOs
- Use `class-validator` decorators.
- `ValidationPipe` is global (whitelist + transform) — no need to add per-controller.

### Imports
- `module: commonjs` — **no `.js` extensions** on local imports.
- External package imports use bare specifiers as normal.

### Database
- `DbService` (global) wraps `better-sqlite3` — inject it directly into any service.
- All queries are **synchronous** — no `async/await` needed for DB calls.
- JSON columns (`cells`, `edges`, `players`, `log`) — always `JSON.stringify` on write, `JSON.parse` on read.
- Schema lives in `DbService.migrate()` — add new tables/columns there.

---

## Shared Package

- ESM-only, TypeScript, no React/DOM imports.
- Add types to `shared/src/index.ts`.
- Rebuild after changes: `pnpm --filter @blind/shared build`
- Import in both web and api: `import type { MyType } from '@blind/shared'`
- API resolves it via tsconfig paths → `../shared/dist/index.d.ts` (must build shared first).

---

## Build order when changing shared types

```bash
pnpm --filter @blind/shared build   # 1. compile shared
cd api && npm run build             # 2. rebuild api
pnpm --filter web build             # 3. verify web
```
