import { it } from 'vitest';
import { TEMPLATES } from '../src/content';
import { generateBody } from '../src/engine/generate';
it.skipIf(!process.env.PRINT)('trap retention', () => {
  let n = 0, withTrap = 0;
  for (const t of TEMPLATES) {
    if (t.format !== 'mcs') continue;
    for (let seed = 1; seed <= 60; seed++) for (const d of [1, 2, 3] as const) {
      try { const { q } = generateBody(t, seed, d); if (q.format === 'mcs') { n++; if (q.choices.some((c) => c.trap)) withTrap++; } } catch {}
    }
  }
  console.log('MCS with at least one trap:', withTrap, '/', n);
});
