// Browser QA for the built app: first visit, practice, dashboard, offline, keyboard, responsive and dark mode, and a full
// QR profile transfer between two browsers (the receiver's camera plays the sender's codes).
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/qa/smoke.cjs [base-url]          # default http://localhost:4173/gre-trainer/
//
// Needs Playwright with Chromium (preinstalled in Claude Code cloud sessions; elsewhere `npm i -D playwright` and
// `npx playwright install chromium`). Screenshots and the camera clip go to qa-out/ (git-ignored).
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const APP = process.argv[2] || 'http://localhost:4173/gre-trainer/';
const OUT = path.resolve(__dirname, '../../qa-out');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const watchErrors = (page) => {
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  return errs;
};

/** Answers `n` practice questions with the first option (or a number), whatever the question type. */
async function answer(page, n) {
  let done = 0;
  for (let guard = 0; guard < n * 6 && done < n; guard++) {
    const start = page.locator('main button.btn-big', { hasText: /start/i });
    if ((await start.count()) && !(await page.locator('.choices, .ne-input').count())) {
      await start.first().click();
      continue;
    }
    const choice = page.locator('.choices button:not([disabled])');
    const input = page.locator('main input[inputmode]:not([disabled])');
    if (await choice.count()) await choice.first().click();
    else if (await input.count()) await input.first().fill('3');
    else {
      // A lesson or recap screen: move on.
      const go = page.getByRole('button', { name: /got it|continue|start|questions/i });
      if (await go.count()) await go.first().click();
      else await page.waitForTimeout(150);
      continue;
    }
    const submit = page.locator('main button.btn-big').filter({ hasText: /check/i });
    if ((await submit.count()) && (await submit.first().isEnabled())) {
      await submit.first().click();
      done++;
    }
    const next = page.getByRole('button', { name: /next question/i });
    if (await next.count()) await next.first().click();
  }
  return done;
}

const progressOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('gre-trainer-progress') || 'null')?.state);

(async () => {
  const browser = await chromium.launch();

  // 1. First visit, desktop.
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desk.newPage();
  const errs = watchErrors(page);
  await page.goto(APP, { waitUntil: 'networkidle' });
  const h1 = await page.locator('h1').first().innerText().catch(() => '');
  check('first visit shows the welcome page', /GRE Quant/i.test(h1), h1);
  await page.screenshot({ path: `${OUT}/welcome-desktop.png`, fullPage: true });

  await page.keyboard.press('Tab');
  const firstTab = await page.evaluate(() => document.activeElement?.textContent?.trim());
  check('first Tab reaches the skip link', firstTab === 'Skip to content', firstTab);

  // 2. Plan setup, then practice.
  await page.getByRole('button', { name: /Start my first session/ }).click();
  await page.waitForTimeout(300);
  check('welcome leads to practice', (await page.evaluate(() => location.hash)) === '#/practice');
  const answered = await answer(page, 6);
  const st = await progressOf(page);
  check('practice records answers', st?.history?.length === answered && answered === 6, `${st?.history?.length} recorded / ${answered} answered`);

  // 3. Dashboard.
  await page.goto(APP);
  await page.waitForTimeout(400);
  const dash = await page.locator('main').innerText();
  check('dashboard replaces welcome once practised', /Course mastery/.test(dash));
  await page.screenshot({ path: `${OUT}/dashboard-desktop.png`, fullPage: true });

  // 4. Offline.
  await page.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 15000 }).catch(() => {});
  check('service worker controls the page', await page.evaluate(() => !!navigator.serviceWorker?.controller));
  await desk.setOffline(true);
  const offline = await page.reload().then(() => true, () => false);
  await page.waitForTimeout(500);
  check('reload works offline', offline && /Course mastery/.test(await page.locator('main').innerText().catch(() => '')));
  await desk.setOffline(false);
  check('no console errors (desktop)', errs.length === 0, errs.slice(0, 3).join(' | '));
  await desk.close();

  // 5. Responsive and dark mode.
  for (const [label, opts] of [
    ['phone', { ...devices['iPhone 13'] }],
    ['tablet', { viewport: { width: 768, height: 1024 } }],
    ['wide', { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }],
  ]) {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    for (const route of ['', '#/practice', '#/settings', '#/transfer/send']) {
      await p.goto(APP + route, { waitUntil: 'networkidle' });
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 1) check(`no horizontal scroll: ${label} ${route || '#/'}`, false, `${overflow}px`);
    }
    await p.screenshot({ path: `${OUT}/settings-${label}.png`, fullPage: true });
    await ctx.close();
  }
  check('no horizontal scroll at 390 / 768 / 1440 px', !results.some((r) => r.name.startsWith('no horizontal scroll:')));

  // 6. QR transfer: sender with a real profile, receiver whose camera plays the codes.
  const sender = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const sp = await sender.newPage();
  // A fresh browser with a dozen answers to send.
  await sp.goto(APP + '#/practice');
  await answer(sp, 12);
  const sent = await progressOf(sp);
  await sp.goto(APP + '#/transfer/send');
  await sp.waitForSelector('svg.qr');
  const counter = () => sp.locator('.transfer-counter').innerText();
  const total = Number((await counter()).match(/of (\d+)/)[1]);
  if (total > 1) await sp.getByRole('button', { name: 'Pause' }).click();
  while (total > 1 && !(await counter()).startsWith('Code 1 ')) await sp.getByRole('button', { name: 'Next code' }).click();
  const shot = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const jpgs = [];
  for (let i = 0; i < total; i++) {
    const svg = await sp.locator('svg.qr').evaluate((e) => e.outerHTML);
    await shot.setContent(
      `<body style="margin:0;background:#777;display:grid;place-items:center;height:720px"><div style="width:560px;background:#fff;padding:10px;transform:rotate(${(i % 5) - 2}deg)">${svg.replace('<svg', '<svg width="540" height="540"')}</div></body>`,
    );
    const jpg = await shot.screenshot({ type: 'jpeg', quality: 85 });
    for (let r = 0; r < 4; r++) jpgs.push(jpg);
    if (total > 1) await sp.getByRole('button', { name: 'Next code' }).click();
  }
  const clip = `${OUT}/codes.mjpeg`;
  fs.writeFileSync(clip, Buffer.concat(jpgs));
  await sender.close();

  const cam = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${clip}`] });
  const receiver = await cam.newContext({ ...devices['Pixel 7'], permissions: ['camera'] });
  const rp = await receiver.newPage();
  const rerrs = watchErrors(rp);
  await rp.goto(APP + '#/transfer/receive');
  const t0 = Date.now();
  await rp.getByRole('button', { name: 'Start the camera' }).click();
  const got = await rp.waitForSelector('text=Progress received', { timeout: 90000 }).then(() => true, () => false);
  check(`receiver reads all ${total} codes`, got, got ? `${((Date.now() - t0) / 1000).toFixed(1)} s` : (await rp.locator('.transfer-status').innerText().catch(() => 'no status')));
  if (got) {
    await rp.getByRole('button', { name: /Use this progress|Replace/ }).click();
    await rp.waitForTimeout(400);
    const recv = await progressOf(rp);
    check(
      'transferred progress is identical',
      JSON.stringify(recv.history) === JSON.stringify(sent.history) && JSON.stringify(recv.skills) === JSON.stringify(sent.skills),
      `${recv.history.length} answers`,
    );
  }
  check('no console errors (receiver)', rerrs.length === 0, rerrs.slice(0, 3).join(' | '));
  await cam.close();
  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ${path.relative(process.cwd(), OUT)}/`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
