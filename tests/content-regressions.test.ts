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
