Sync `docs/` to reflect the current state of the code. Run this after implementing any feature.

Steps:

1. **Detect what changed** — look at recently modified files (git diff or the files touched in this session). Identify which doc sections are affected:
   - New or changed endpoint → `docs/api.md`
   - New or changed type/field → `docs/data-model.md`
   - New page, UI behavior, or generation logic → `docs/features.md`
   - New convention, gotcha, or architectural decision → `docs/conventions.md`
   - New design token, layout rule, or visual change → `docs/design.md`

2. **Read the affected doc sections** before editing — understand what's already there.

3. **Update only what changed** — do not rewrite sections that are still accurate. Do not add fluff. Keep the same terse doc style.

4. **Check for cross-doc consistency** — if a type changes in `data-model.md`, verify `api.md` request/response shapes still match. If a UI behavior changes in `features.md`, verify `design.md` still describes it correctly.

5. **Report** — list each file updated and one-line summary of what changed in each.

Rules:
- Never invent behavior that isn't in the code.
- If something is removed from the code, remove it from docs too.
- Docs are the source of truth for future sessions — write as if the reader has never seen the code.
