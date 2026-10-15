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

/** True when v is b^k for some integer k >= 0 (exact integer loop, no floating-point logarithm). */
const isIntegerPower = (v: number, b: number) => {
  for (let p = 1; p <= v; p *= b) if (p === v) return true;
  return false;
};

describe('alg.expressions.power-factor-ne', () => {
  it('b^x = v is never an exact power, so "x is not an integer" is true', () => {
    const bad: string[] = [];
    let n = 0;
    for (const { seed, d, q, params } of bodies('alg.expressions.power-factor-ne')) {
      const { kind, b, v } = params as { kind: string; b: number; v: number };
      if (kind !== 'value' && kind !== 'square') continue;
      n++;
      if (isIntegerPower(v, b)) bad.push(`seed ${seed} d${d}: ${b}^x = ${v} has the integer solution x`);
      if (q.format === 'ne' && /not an integer/.test(q.explanation ?? '') && isIntegerPower(v, b)) bad.push(`seed ${seed} d${d}: explanation says x is not an integer`);
    }
    expect(n).toBeGreaterThan(300);
    expect(bad).toEqual([]);
  });
});

describe('alg.functions.property-ne', () => {
  it('no wrong-method value (the traps and the mistake named in the explanation) equals the right answer', () => {
    const bad: string[] = [];
    let n = 0;
    for (const { seed, d, q, params } of bodies('alg.functions.property-ne')) {
      if (q.format !== 'ne') continue;
      const { kind, k } = params as { kind: string; k: number[] };
      const answer = q.answer.toNumber();
      // each wrong value is recomputed here from the parameters, the way the mistaken student would
      let wrong: number | null;
      if (kind === 'periodic') wrong = k[3] + (k[2] - k[1]); // counts the distance instead of the steps
      else if (kind === 'step') wrong = k[0] > 1 ? k[4] + k[1] * (k[3] - k[2]) : null; // counts b - a steps instead of (b - a) / p (a real mistake only when p > 1)
      else if (kind === 'growth') wrong = k[3] * k[0] * k[2]; // treats the growth as linear: v r n instead of v r^n
      else wrong = k[4] ? k[3] * k[3] + k[2] : k[5] * k[3] + k[2]; // substitutes t directly into the rule
      n++;
      if (wrong === answer) bad.push(`seed ${seed} d${d} (${kind}): the mistaken value ${wrong} equals the answer`);
      if (q.traps?.some((tr) => tr.value.toNumber() === answer)) bad.push(`seed ${seed} d${d}: a trap value equals the answer`);
    }
    expect(n).toBeGreaterThan(1000);
    expect(bad).toEqual([]);
  });
});

describe('arith.exponents.negative-exponent-qc', () => {
  type Neg = { kind: string; fa: { neg: boolean }; fb: { neg: boolean } | null };
  const rows = () =>
    bodies('arith.exponents.negative-exponent-qc').flatMap(({ seed, d, q, params }) => {
      if (q.format !== 'qc') return [];
      const { kind, fa, fb } = params as Neg;
      return [{ seed, d, kind, negBase: fa.neg || !!fb?.neg, info: q.info ?? '', ex: q.explanation ?? '' }];
    });

  it('talks about the parity of n only when a base is negative', () => {
    const bad = rows()
      .filter((r) => !r.negBase && /\b(even|odd)\b/.test(`${r.info} ${r.ex}`))
      .map((r) => `seed ${r.seed} d${r.d} (${r.kind}): parity mentioned for positive bases`);
    expect(bad).toEqual([]);
  });

  it('never shows two parity cases that say the same thing', () => {
    const bad: string[] = [];
    let split = 0;
    for (const r of rows()) {
      const ev = /- If \$n\$ is even: (.*)\n/.exec(r.ex);
      const od = /- If \$n\$ is odd: (.*)\n/.exec(r.ex);
      if (!ev || !od) continue;
      split++;
      if (ev[1] === od[1]) bad.push(`seed ${r.seed} d${r.d}: identical cases "${ev[1]}"`);
    }
    expect(split).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });
});
