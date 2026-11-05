---
name: browser-qa
description: Check the built app in real browsers before shipping a UI change - first visit, practice, dashboard, offline, keyboard, three widths, dark mode and a full two-browser QR transfer - with scripts/qa/smoke.cjs, then look at the screenshots and give a SHIP / SHIP WITH FIXES / DO NOT SHIP verdict. Use after changing pages, components, CSS, the service worker or the transfer code.
---

<!-- Adapted from everything-claude-code (skills/browser-qa), MIT, see .claude/THIRD_PARTY.md. -->

# Browser QA

## Run

```bash
npm run build
npx vite preview --port 4173 &   # serves http://localhost:4173/gre-trainer/
node scripts/qa/smoke.cjs        # or: node scripts/qa/smoke.cjs https://ethan-puyaubreau.github.io/gre-trainer/
```

The script prints one PASS/FAIL line per check and exits 1 on any failure. It covers: welcome on first visit, skip
link, welcome → practice, answers recorded, dashboard, service worker + offline reload, console errors, no horizontal
scroll at 390/768/1440 px (the 1440 run is in dark mode), and a QR transfer between two browsers whose camera plays
the sender's codes, with the received progress compared field by field.

Against the live site it is read-only except for its own fresh browser profiles; it never touches a real user's data.

## Then look

The script cannot judge design. Open the screenshots in `qa-out/` and check, for the pages the change touched:
layout at each width, dark-mode contrast (text on `--surface`, chips, disabled buttons), focus rings, empty states
(a brand-new profile), long content (a 4000-answer profile), and that numbers and KaTeX are not clipped.

For a change to a page the script does not visit, add a step to `smoke.cjs` in the same style rather than checking
by hand once.

## Limits

- Automated checks are necessary, not sufficient: keyboard order and screen-reader reading still need a manual pass.
- The fake camera proves the jsQR path (Safari, Firefox). Chrome on Android uses `BarcodeDetector`; test a real phone
  before a release that changes `src/pages/Transfer.tsx` or `src/transfer/`.

## Report

```
QA - <url> - <date>
Script: n/n PASS (list failures)
Visual: notes per page and width
Verdict: SHIP | SHIP WITH FIXES (list) | DO NOT SHIP (blockers)
```
