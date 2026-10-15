import { describe, expect, it } from 'vitest';
import { templateById } from '../src/content';
import { generateBody, SEED_POOL } from '../src/engine/generate';
import type { Difficulty } from '../src/engine/types';

/**
 * Regression tests for blocking content defects. Each one scans every seed the app can serve
 * (1..SEED_POOL) at every difficulty, so a fix is proven for the whole class of defect, not for
 * the one seed that revealed it. They read questions through `generateBody` and re-derive the
 * expected property independently of the generator.
 */
const DIFFS: Difficulty[] = [1, 2, 3];
const SEEDS = Array.from({ length: SEED_POOL }, (_, i) => i + 1);

function bodies(id: string, diffs: Difficulty[] = DIFFS) {
  const t = templateById.get(id);
  if (!t) throw new Error(`unknown template ${id}`);
  return diffs.flatMap((d) => SEEDS.map((seed) => ({ seed, d, ...generateBody(t, seed, d) })));
}

describe('geo.solids.measures', () => {
  it('tank: the key is the greatest multiple of 5 that respects the capacity bound', () => {
    const bad: string[] = [];
    let tanks = 0;
    for (const { seed, d, q, params } of bodies('geo.solids.measures')) {
      if ((params as any).mode !== 'tank' || q.format !== 'mcs') continue;
      tanks++;
      const [, , H, p] = (params as any).dims as number[];
      const key = Number(/\$(\d+)\$/.exec(q.choices[q.answer].text)![1]);
      // frozen height = depth x (100 + p) / 100 must not exceed H, and the next multiple of 5 must
      if (key * (100 + p) > 100 * H) bad.push(`seed ${seed} d${d}: key ${key} overfills (H ${H}, +${p}%)`);
      if ((key + 5) * (100 + p) <= 100 * H) bad.push(`seed ${seed} d${d}: key ${key} is not the greatest multiple of 5`);
      if (/nearest/.test(q.stem)) bad.push(`seed ${seed} d${d}: stem still asks for the nearest 5 cm`);
    }
    expect(tanks).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});

describe('arith.number-line.farthest', () => {
  type Far = { mode: 'far' | 'close'; c: { toNumber(): number }; values: { toNumber(): number }[] };
  const rows = () =>
    bodies('arith.number-line.farthest').flatMap(({ seed, d, q, params }) => {
      if (q.format !== 'mcs') return [];
      const { mode, c, values } = params as Far;
      return [{ seed, d, mode, c: c.toNumber(), vals: values.map((v) => v.toNumber()), tagged: q.choices.findIndex((ch) => ch.trap), ex: q.explanation ?? '' }];
    });

  it('never claims the greatest absolute value for a number that does not have it', () => {
    const bad = rows()
      .filter((r) => r.tagged >= 0 && /has the greatest absolute value/.test(r.ex) && Math.abs(r.vals[r.tagged]) < Math.max(...r.vals.map(Math.abs)))
      .map((r) => `seed ${r.seed} d${r.d}: ${r.vals[r.tagged]} is not the largest in |x| of ${r.vals}`);
    expect(bad).toEqual([]);
  });

  it('describes the real trap criterion: same side of 0 as c (far), other side of 0 (close)', () => {
    const bad: string[] = [];
    let far = 0;
    let close = 0;
    for (const r of rows()) {
      if (r.tagged < 0) continue;
      const v = r.vals[r.tagged];
      const same = r.vals.filter((x) => Math.sign(x) === Math.sign(r.c));
      const other = r.vals.filter((x) => Math.sign(x) === -Math.sign(r.c));
      if (r.mode === 'far') {
        far++;
        if (Math.abs(v) !== Math.max(...same.map(Math.abs))) bad.push(`seed ${r.seed} d${r.d}: far trap ${v} is not the largest in size on c's side`);
        if (!r.ex.includes('among the numbers on the same side of 0 as')) bad.push(`seed ${r.seed} d${r.d}: far explanation does not state the criterion`);
      } else {
        close++;
        const gap = (x: number) => Math.abs(Math.abs(x) - Math.abs(r.c));
        if (gap(v) !== Math.min(...other.map(gap))) bad.push(`seed ${r.seed} d${r.d}: close trap ${v} is not the closest in size to c on the other side`);
        if (!r.ex.includes('among the numbers on the other side of 0')) bad.push(`seed ${r.seed} d${r.d}: close explanation does not state the criterion`);
      }
    }
    expect(far).toBeGreaterThan(50);
    expect(close).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });
});
