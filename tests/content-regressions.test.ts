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
      return [
        {
          seed,
          d,
          mode,
          c: c.toNumber(),
          vals: values.map((v) => v.toNumber()),
          tagged: q.choices.findIndex((ch) => ch.trap),
          flagged: q.choices.flatMap((ch, i) => (ch.trap ? [i] : [])),
          texts: q.choices.map((ch) => ch.text),
          ex: q.explanation ?? '',
        },
      ];
    });

  it('never claims the greatest absolute value for a number that does not have it', () => {
    const bad = rows()
      .filter((r) => r.tagged >= 0 && /has the greatest absolute value/.test(r.ex) && Math.abs(r.vals[r.tagged]) < Math.max(...r.vals.map(Math.abs)))
      .map((r) => `seed ${r.seed} d${r.d}: ${r.vals[r.tagged]} is not the largest in |x| of ${r.vals}`);
    expect(bad).toEqual([]);
  });

  it('flags only real slips, and the explanation names the criterion of the main one (same side of 0 as c for far, other side of 0 for close)', () => {
    const bad: string[] = [];
    let far = 0;
    let close = 0;
    for (const r of rows()) {
      const all = r.vals.map((v, i) => ({ v, i })).filter(({ i }) => r.flagged.includes(i));
      if (all.length === 0) continue;
      const same = r.vals.filter((x) => Math.sign(x) === Math.sign(r.c));
      const other = r.vals.filter((x) => Math.sign(x) === -Math.sign(r.c));
      const gap = (x: number) => Math.abs(Math.abs(x) - Math.abs(r.c));
      if (r.mode === 'far') far++;
      else close++;
      for (const { v, i } of all) {
        const sameSide = Math.abs(v) === Math.max(...same.map(Math.abs)) && Math.sign(v) === Math.sign(r.c);
        const mirror = Math.sign(v) === -Math.sign(r.c) && gap(v) === Math.min(...other.map(gap));
        const real =
          r.mode === 'far'
            ? sameSide || Math.abs(v) === Math.max(...r.vals.map(Math.abs)) || gap(v) === Math.max(...r.vals.map(gap)) || v === Math.max(...r.vals) || v === Math.min(...r.vals)
            : mirror || Math.abs(v) === Math.min(...r.vals.map(Math.abs));
        if (!real) bad.push(`seed ${r.seed} d${r.d}: ${r.mode} flagged ${v} is not a slip of the kinds the explanation describes`);
        if (!r.ex.includes(r.texts[i])) bad.push(`seed ${r.seed} d${r.d}: flagged ${v} is not discussed in the explanation`);
        if (r.mode === 'far' && sameSide && !r.ex.includes('among the numbers on the same side of 0 as')) bad.push(`seed ${r.seed} d${r.d}: far explanation does not state the same-side criterion`);
        if (r.mode === 'close' && mirror && !r.ex.includes('among the numbers on the other side of 0')) bad.push(`seed ${r.seed} d${r.d}: close explanation does not state the other-side criterion`);
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

describe('alg.inequalities.abs-qc', () => {
  it('every value tried in the explanation satisfies the condition on m, and the cases shown support the answer', () => {
    const bad: string[] = [];
    let linear = 0;
    let restricted = 0;
    let dAnswers = 0;
    for (const { seed, d, q, params } of bodies('alg.inequalities.abs-qc')) {
      const { kind, k, cond } = params as { kind: string; k: number[]; cond: string };
      if (q.format !== 'qc' || kind !== 'abs-vs-linear' || k[2] === 2) continue; // 'same' form: no values tried
      linear++;
      if (cond !== 'none') restricted++;
      const K = k[0];
      const plus = k[1] === 1;
      const allowed = (m: number) => (cond === 'none' ? true : cond === 'pos' ? m > 0 : m < 0);
      const shown = [...(q.explanation ?? '').matchAll(/For \$m = (-?\d+)\$: Quantity A is (-?\d+) and Quantity B is (-?\d+)\./g)].map((x) => ({ m: Number(x[1]), a: Number(x[2]), b: Number(x[3]) }));
      const where = `seed ${seed} d${d} (${cond})`;
      if (shown.length === 0) bad.push(`${where}: no value tried`);
      for (const s of shown) {
        if (!allowed(s.m)) bad.push(`${where}: tries m = ${s.m}`);
        const a = Math.abs(plus ? s.m + K : s.m - K);
        const b = plus ? K - s.m : s.m + K;
        if (a !== s.a || b !== s.b) bad.push(`${where}: m = ${s.m} gives ${a} and ${b}, not ${s.a} and ${s.b}`);
      }
      const rel = new Set(shown.map((s) => (s.a > s.b ? 'A' : s.a < s.b ? 'B' : 'C')));
      if (rel.size > 1 && q.answer !== 'D') bad.push(`${where}: the cases disagree but the answer is ${q.answer}`);
      if (q.answer === 'D' && rel.size < 2) bad.push(`${where}: the answer is D but the cases shown do not disagree (${[...rel]})`);
      if (q.answer === 'D') dAnswers++;
      if (rel.size === 1 && q.answer !== 'D' && !rel.has(q.answer)) bad.push(`${where}: the case shown gives ${[...rel]} but the answer is ${q.answer}`);
    }
    expect(linear).toBeGreaterThan(100);
    expect(restricted).toBeGreaterThan(50);
    expect(dAnswers).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
});

describe('arith.real-numbers.order-qc', () => {
  // The allowed ranges and expressions, re-implemented here with plain floats (independent of the generator).
  const RANGE: Record<string, (x: number) => boolean> = {
    '0 < x < 1': (x) => x > 0 && x < 1,
    '-1 < x < 0': (x) => x > -1 && x < 0,
    'x > 1': (x) => x > 1,
    'x < -1': (x) => x < -1,
    'x < 0': (x) => x < 0,
    '-1 \\le x \\le 0': (x) => x >= -1 && x <= 0,
    '0 \\le x \\le 1': (x) => x >= 0 && x <= 1,
    '0 < x \\le 1': (x) => x > 0 && x <= 1,
    '-1 < x < 1': (x) => x > -1 && x < 1,
    'x > 0': (x) => x > 0,
    '0 < |x| < 1': (x) => x !== 0 && Math.abs(x) < 1,
    '|x| \\ge 1': (x) => Math.abs(x) >= 1,
    '|x| > 1': (x) => Math.abs(x) > 1,
    'x \\le -1': (x) => x <= -1,
  };
  const FN: Record<string, (x: number) => number> = {
    x: (x) => x,
    '-x': (x) => -x,
    'x^2': (x) => x ** 2,
    'x^3': (x) => x ** 3,
    'x^4': (x) => x ** 4,
    'x^5': (x) => x ** 5,
    '\\frac{1}{x}': (x) => 1 / x,
    '\\frac{1}{x^2}': (x) => 1 / x ** 2,
    '|x|': (x) => Math.abs(x),
    '\\sqrt{x}': (x) => Math.sqrt(x),
    '-x^3': (x) => -(x ** 3),
    '0': () => 0,
    '1': () => 1,
  };
  const texNum = (s: string) => {
    const m = /^(-?)(?:(\d+)|\\frac\{(\d+)\}\{(\d+)\})$/.exec(s)!;
    const v = m[2] !== undefined ? Number(m[2]) : Number(m[3]) / Number(m[4]);
    return m[1] ? -v : v;
  };
  const rel = (u: number, v: number) => (Math.abs(u - v) <= 1e-13 * Math.max(1, Math.abs(u), Math.abs(v)) ? 'C' : u > v ? 'A' : 'B');
  const GRID = [...Array.from({ length: 481 }, (_, i) => -30 + i * 0.125), -1.01, -0.99, -0.01, 0.01, 0.99, 1.01];

  it('every value tried is allowed, and the conclusion follows from the cases and the equality points it states', () => {
    const bad: string[] = [];
    let counts = { A: 0, B: 0, C: 0, D: 0 };
    for (const { seed, d, q, params } of bodies('arith.real-numbers.order-qc')) {
      if (q.format !== 'qc') continue;
      counts[q.answer]++;
      const { a, b } = params as { a: string; b: string };
      const info = (q.info ?? '').slice(1, -1);
      const inRange = RANGE[info];
      const ex = q.explanation ?? '';
      const where = `seed ${seed} d${d} (${info}; ${a} vs ${b})`;
      const rows = [...ex.matchAll(/^- \$x = (.+?)\$(?: \(endpoint\))?: Quantity A is \$.+?\$ and Quantity B is \$.+?\$, so A \$(.)\$ B$/gm)].map((m) => ({ x: texNum(m[1]), sym: m[2] }));
      const concl = ex.split('\n\n').pop()!;
      if (!inRange || !FN[a] || !FN[b]) {
        bad.push(`${where}: unknown condition or expression`);
        continue;
      }
      if (rows.length === 0) bad.push(`${where}: no value tried`);
      for (const r of rows) {
        if (!inRange(r.x)) bad.push(`${where}: tries x = ${r.x}, outside the range`);
        const want = { '>': 'A', '<': 'B', '=': 'C' }[r.sym];
        if (rel(FN[a](r.x), FN[b](r.x)) !== want) bad.push(`${where}: x = ${r.x} is shown as A ${r.sym} B`);
      }
      // what dense sampling of the whole range says
      const seen = new Set(GRID.filter((x) => inRange(x) && Number.isFinite(FN[a](x)) && Number.isFinite(FN[b](x))).map((x) => rel(FN[a](x), FN[b](x))));
      const shown = new Set(rows.map((r) => ({ '>': 'A', '<': 'B', '=': 'C' })[r.sym]));
      if (q.answer === 'D') {
        if (shown.size < 2) bad.push(`${where}: answer D but the cases shown agree`);
        if (!/at \$x = .+\$.* at \$x = /.test(concl)) bad.push(`${where}: answer D without two cited cases`);
      } else {
        if (seen.size !== 1 || !seen.has(q.answer)) bad.push(`${where}: answer ${q.answer} but the range gives ${[...seen]}`);
        if (shown.size !== 1 || !shown.has(q.answer)) bad.push(`${where}: the cases shown do not all give ${q.answer}`);
      }
      if (q.answer === 'A' || q.answer === 'B') {
        // the equality points are stated, correctly: the comparison can only change there
        const absPair = (a === '|x|' && (b === 'x' || b === '-x')) || (b === '|x|' && (a === 'x' || a === '-x'));
        if (absPair) {
          // |x| = x exactly when x >= 0 and |x| = -x exactly when x <= 0: no allowed x may satisfy it
          if (!/exactly when/.test(concl)) bad.push(`${where}: abs pair without the exact equality set`);
          const other = a === '|x|' ? b : a;
          if (GRID.some((x) => inRange(x) && (other === 'x' ? x >= 0 : x <= 0))) bad.push(`${where}: an allowed x makes the quantities equal yet the answer is ${q.answer}`);
        } else {
          const eq = [-1, 0, 1].filter((x) => Number.isFinite(FN[a](x)) && Number.isFinite(FN[b](x)) && FN[a](x) === FN[b](x));
          if (eq.length === 0 ? !/never equal/.test(concl) : /never equal/.test(concl)) bad.push(`${where}: equality statement wrong (equal at ${eq})`);
          for (const p of [-1, 0, 1]) if (concl.includes(`$x = ${p}$`) !== eq.includes(p)) bad.push(`${where}: conclusion ${eq.includes(p) ? 'omits' : 'wrongly states'} x = ${p}`);
          if (eq.some((p) => inRange(p))) bad.push(`${where}: an equality point is allowed yet the answer is ${q.answer}`);
        }
      }
      if (q.answer === 'C' && !/\|x\| = /.test(concl)) bad.push(`${where}: answer C without the absolute value identity`);
      if (/one test value per region/.test(ex)) bad.push(`${where}: still concludes from a bare test value`);
    }
    expect(counts.A).toBeGreaterThan(50);
    expect(counts.C).toBeGreaterThan(20);
    expect(counts.D).toBeGreaterThan(20);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('"equal only at -1, 0 or 1" holds for every pair of expressions the questions use (on the whole line)', () => {
    const pairs = new Set(bodies('arith.real-numbers.order-qc').map(({ params }) => `${(params as { a: string }).a} ~ ${(params as { b: string }).b}`));
    const sorted = [...new Set(GRID)].sort((p, q) => p - q);
    const bad: string[] = [];
    for (const pair of pairs) {
      const [a, b] = pair.split(' ~ ');
      const absPair = (a === '|x|' && (b === 'x' || b === '-x')) || (b === '|x|' && (a === 'x' || a === '-x'));
      if (absPair) continue; // equal on a whole half-line, stated separately
      for (let i = 0; i + 1 < sorted.length; i++) {
        const [g, h] = [sorted[i], sorted[i + 1]];
        const vals = [g, h].map((x) => [FN[a](x), FN[b](x)]);
        if (!vals.flat().every(Number.isFinite)) continue;
        if (rel(vals[0][0], vals[0][1]) !== rel(vals[1][0], vals[1][1]) && ![-1, 0, 1].some((p) => p >= g && p <= h)) bad.push(`${a} vs ${b}: the comparison changes between ${g} and ${h}`);
      }
    }
    expect(pairs.size).toBeGreaterThan(80);
    expect(bad).toEqual([]);
  });
});
