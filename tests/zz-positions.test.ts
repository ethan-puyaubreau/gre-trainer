import { it } from 'vitest';
import { TEMPLATES } from '../src/content';
import { generateBody } from '../src/engine/generate';
it.skipIf(!process.env.PRINT)('positions', () => {
  const pos = [0, 0, 0, 0, 0];
  const qc: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const skewed: string[] = [];
  for (const t of TEMPLATES) {
    if (t.format !== 'mcs' && t.format !== 'qc') continue;
    const local = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 60; seed++) for (const d of [1, 2, 3] as const) {
      try {
        const { q } = generateBody(t, seed, d);
        if (q.format === 'mcs') { pos[q.answer]++; local[q.answer]++; }
        if (q.format === 'qc') qc[q.answer]++;
      } catch {}
    }
    if (t.format === 'mcs') { const n = local.reduce((a, b) => a + b, 0); const max = Math.max(...local) / n; if (max > 0.5 || local[0] + local[4] < n * 0.1) skewed.push(`${t.id} ${local.join('/')}`); }
  }
  console.log('MCS positions A-E', pos.join(' '), '\nQC', JSON.stringify(qc), '\nskewed:\n' + skewed.join('\n'));
});
