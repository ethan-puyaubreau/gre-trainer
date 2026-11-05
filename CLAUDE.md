# GRE Quant Trainer: notes for Claude

Static React 19 + TypeScript + Vite app on GitHub Pages (`base: '/gre-trainer/'`, hash routes `#/…`). No backend, no
account: progress lives in `localStorage` (zustand `persist`), moves by JSON export or QR transfer.

## Commands

| | |
| --- | --- |
| `npm run dev` | http://localhost:5173/gre-trainer/ |
| `npx tsc -b` | typecheck (~15 s; the Stop hook runs it when `src/` or `tests/` changed) |
| `npx vitest run tests/<file>.test.ts` | one suite; the content suites are slow |
| `npm test` | everything (~10 min: every generator × 150 seeds × 3 levels) |
| `npm run build` | typecheck + production build into `dist/` |
| `node scripts/qa/smoke.mjs` | browser QA against `npx vite preview` (see the `browser-qa` skill) |

There is no ESLint or Prettier: follow the style of the surrounding code (2 spaces, single quotes, long lines are fine).

## Map

- `src/engine/` question model, rng, exact fractions (`Frac`), grading, KaTeX rendering.
- `src/content/<area>/` skills, traps and **templates** (question generators). Rules in `CONTENT_GUIDE.md`.
- `src/mastery/` levels, repair queue, spaced review, section tests, habit (streak, goal).
- `src/store/progress.ts` the persisted store; `migrate.ts` upgrades older saves.
- `src/transfer/codec.ts` QR transfer: pack, deflate, frames. `src/pages/Transfer.tsx` the screens.
- `src/pages/` one file per route; `src/App.tsx` routes and nav; `public/sw.js` offline cache.
- `tests/` vitest. `tests/quality.ts` and `tests/validate.ts` check every generator.

## Invariants (break one and saved progress or answer keys break)

- **Never rename a skill or template id** once shipped: saved progress refers to them.
- **Generators use only the `rng` they get**, never `Math.random`; a seed must reproduce a question. `check()` re-derives
  the answer by a *different* method. The app serves seeds 1–500 only.
- **A change to the persisted shape** needs a `persist` version bump and a step in `migrateProgress`, plus a test in
  `tests/migrate.test.ts`. `isProgressData` must keep rejecting anything the pages would crash on.
- **Imports and transfers are untrusted input**: always go through `importData` (validation + migration).
- **No secrets in the bundle**: anything in `import.meta.env.VITE_*` is public.
- **Every async user path reports failure** in the UI. Empty `catch` blocks are allowed only for best-effort
  storage/cleanup, with a comment saying why ignoring is safe (the existing code does this consistently).
- **Accessibility**: real buttons and links, labelled inputs, one `<h1>` per page, keyboard reachable.

## Workflow

- Commits: lowercase conventional style, imperative, short (`fix: say a bag contains marbles`, `feat: …`, `test: …`).
- Before a commit: `npx tsc -b`, the suites the change touches, and `npm test` for engine/content/mastery changes.
- UI changes: check them in a real browser (`browser-qa` skill) at phone and desktop widths, light and dark.
- Agents in `.claude/agents/`: `content-reviewer` for new or changed templates, `react-reviewer` for `.tsx`
  changes, `silent-failure-hunter` for error handling. The `verify` skill is the pre-PR gate.
