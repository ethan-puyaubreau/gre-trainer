# Going to production

The app is a static site on GitHub Pages with no backend and no account: progress lives on the user's devices.

## What ships

- **Welcome page** (`src/pages/Welcome.tsx`): first-time visitors (no answers, welcome not finished) land there instead
  of an empty dashboard. It sets the daily goal and the exam date. Anyone with saved answers skips it.
- **Offline / installable** (`public/sw.js`, `public/manifest.webmanifest`): the service worker is registered in
  production builds only. Pages are network first with the cached shell as a fallback; hashed assets are cache first.
  The first visit precaches the shell, its JS/CSS and the KaTeX woff2 fonts. Bump `CACHE` in `sw.js` only to force a full
  re-download; normal deploys need nothing (new hashes, network-first `index.html`).
- **Profile transfer by QR code** (below).
- **Accessibility**: skip link, labelled main nav, a heading on every page.

## Profile transfer by QR code

Settings → **Another device**, or `#/transfer`.

1. The sending device packs the progress (`src/transfer/codec.ts`): the export with its history stored in columns
   (template table, seeds, flags, time deltas), deflated with the browser's `CompressionStream`, base64url-encoded.
2. The text is cut into frames of 900 characters, each shown as a QR code (level M, `uqr`) in a loop at 2, 4 or 7 codes
   per second. Each frame is a link: `<site>#/receive/<id>.<i>.<n>.<chunk>`.
3. The receiving device scans with its camera (`#/transfer/receive`): the browser's `BarcodeDetector` when it has one
   (Chrome, Android), otherwise `jsQR` (Safari, Firefox), loaded only then. Frames can come in any order; repeats are
   ignored; a frame of another transfer starts over. A phone's own camera app works too: any frame opens the receive page,
   which keeps that frame and starts the scanner for the rest.
4. Once every frame is in, the profile is decoded, validated like a file import, summarised, and imported only after
   the user confirms. The sender keeps its copy.

Sizes: a profile with 1,500 answers is 30 codes (about 8 s per loop at Normal speed; the end-to-end test receives it in
about 16 s). The 4,000-answer maximum is about 64 codes. When the history is longer than 200 answers, the sender can
choose **Quick**: every skill level, schedule and setting, and only the last 200 answers.

Privacy: the data goes from screen to camera. The frame links put the data after `#`, which browsers never send to the
server, so even a link opened by a camera app does not leave the device.

Tests: `tests/transfer.test.ts` checks an exact round trip (including old-style ids and missing responses), the frame
count of a full history, out-of-order reassembly and junk rejection.

## Launch checklist

- [ ] `npm test` and `npm run build` green on `main` (CI does both).
- [ ] On the live URL: Lighthouse PWA and accessibility pass; install the app on a phone and open it in airplane mode.
- [ ] Transfer a real profile laptop → iPhone (Safari, jsQR path) and laptop → Android (Chrome, BarcodeDetector path).
- [ ] Camera access needs HTTPS: GitHub Pages provides it; a custom domain must keep "Enforce HTTPS" on.
