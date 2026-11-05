---
name: verify
description: Pre-commit / pre-PR verification gate for this repo - typecheck, the test suites the change touches (or all), production build with bundle-size check, secret and debug-output scan, and a diff review - ending in a READY / NOT READY report. Use after finishing a feature, fix or refactor, before committing or opening a PR.
---

<!-- Adapted from everything-claude-code (skills/verification-loop), MIT, see .claude/THIRD_PARTY.md. -->

# Verify

Run the phases in order and stop at the first hard failure to fix it. Use `set -o pipefail` so a pipe does not
hide an exit code.

## 1. Typecheck
`npx tsc -b` (about 15 s). Any error: NOT READY.

## 2. Tests
Pick by what changed (`git diff --name-only <base>...HEAD` plus the working tree):

| Changed | Run |
| --- | --- |
| `src/content/<area>/` | `npx vitest run tests/content-<area>.test.ts tests/content-regressions.test.ts tests/mutation.test.ts tests/registry.test.ts` |
| `src/engine/`, `src/mastery/`, `src/store/`, `tests/quality*` | `npm test` (all, ~10 min: run it in the background) |
| `src/transfer/` | `npx vitest run tests/transfer.test.ts tests/store.test.ts` |
| UI only (`src/pages`, `src/components`, CSS) | `npx vitest run tests/store.test.ts tests/session.test.ts` + the `browser-qa` skill |

Before a PR to `main`, run `npm test` regardless. Report passed / failed counts.

## 3. Build
`npm run build`. Then compare the main chunk with the previous size:
`ls -l dist/assets/index-*.js`. The generators chunk is ~2.8 MB on purpose; flag growth over 5 % and any new
dependency that lands in it instead of a lazy chunk.

## 4. Scan
```bash
git diff <base>...HEAD -U0 | grep -nE '^\+.*(console\.log|debugger|Math\.random|sk-[A-Za-z0-9]{10}|service_role|BEGIN [A-Z ]*PRIVATE KEY)'
```
`Math.random` inside `src/content/` is a blocker (seeds must reproduce questions); elsewhere it needs a reason.
`console.log` is a blocker; `console.warn` with a reason is fine.

## 5. Diff review
`git diff --stat <base>...HEAD`. Read every changed file once more for: unintended edits, a persisted-shape change
without a migration, a renamed skill/template id, user-facing failure paths without a message (see `CLAUDE.md`).

## Report

```
VERIFY - <branch> @ <short sha>
Types:  PASS | FAIL (n errors)
Tests:  PASS | FAIL (passed/total, which suites)
Build:  PASS | FAIL (main chunk X kB, +/-Y %)
Scan:   PASS | FAIL (findings)
Diff:   n files; notes
Result: READY | NOT READY
Not checked: <anything skipped and why, e.g. "real-phone camera">
```
Never report READY with a phase skipped silently: list it under "Not checked".
