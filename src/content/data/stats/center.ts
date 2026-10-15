import { flaggedChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num, ordinal, usd } from '../../../engine/tex';
import type { Choice, Difficulty, Template } from '../../../engine/types';
import { trapOnlyChoices } from '../prob/util';
import { fTex, listTex, meanF, meanFracs, medianByRank, medianF, sortAsc, total } from './util';

/* =============================================================================================
 * 1. Sum = mean x count: removed, added, corrected or complementary values (NE)
 * =========================================================================================== */

type SumMode = 'drop' | 'target' | 'fix' | 'split';

interface SumParams {
  mode: SumMode;
  n: number;
  /** Mean of the n original values. */
  m: Frac;
  /** drop: mean of the remaining values; target: the target mean; split: mean of the k values. */
  m2: Frac;
  k: number;
  /** fix: correct value a, recorded value b. drop: 'low' / 'high' is in `which`. */
  a: number;
  b: number;
  which: 'low' | 'high';
  /** Upper bound of a sensible value (100 for test scores), 0 when none. */
  cap: number;
}

const SUM_MODES: Record<Difficulty, SumMode[]> = {
  1: ['drop', 'target'],
  2: ['drop', 'target', 'fix', 'split'],
  3: ['split', 'fix', 'drop', 'target'],
};

const DROP_CTX = [
  {
    // test scores
    stem: (n: number, m: string, m2: string, hi: boolean) =>
      `The average (arithmetic mean) of ${n} test scores is $${m}$. When the ${hi ? 'highest' : 'lowest'} score is removed, the average of the remaining ${n - 1} scores is $${m2}$. What is the ${hi ? 'highest' : 'lowest'} score?`,
    suffix: undefined as string | undefined,
    noun: 'scores',
    range: [55, 92] as [number, number],
    cap: 100,
  },
  {
    stem: (n: number, m: string, m2: string, hi: boolean) =>
      `The average (arithmetic mean) age of the ${n} members of a committee is $${m}$ years. When the ${hi ? 'oldest' : 'youngest'} member leaves the committee, the average age of the remaining ${n - 1} members is $${m2}$ years. How old is the member who left?`,
    suffix: 'years',
    noun: 'ages',
    range: [30, 52] as [number, number],
    cap: 0,
  },
  {
    stem: (n: number, m: string, m2: string, hi: boolean) =>
      `The average (arithmetic mean) weight of ${n} packages is $${m}$ pounds. When the ${hi ? 'heaviest' : 'lightest'} package is removed, the average weight of the remaining ${n - 1} packages is $${m2}$ pounds. What is the weight, in pounds, of the package that was removed?`,
    suffix: 'pounds',
    noun: 'weights',
    range: [12, 40] as [number, number],
    cap: 0,
  },
];

const sumUpdate: Template<SumParams> = {
  id: 'data.center.sum-update',
  skill: 'data.center',
  format: 'ne',
  style: 'use sum = average × count to find a removed, needed or corrected value',
  generate(rng, d) {
    const mode = rng.pick(SUM_MODES[d]);
    const base: SumParams = { mode, n: 0, m: frac(0), m2: frac(0), k: 0, a: 0, b: 0, which: 'low', cap: 0 };

    if (mode === 'drop') {
      const ctx = rng.pick(DROP_CTX);
      const hi = rng.chance(0.5);
      let n = 0;
      let m2 = 0;
      let x = 0;
      let m: Frac;
      do {
        n = d === 1 ? rng.int(4, 6) : d === 2 ? rng.int(5, 10) : rng.int(8, 16);
        m2 = rng.int(...ctx.range);
        const gap = rng.int(d === 1 ? 6 : 4, d === 3 ? 30 : 22);
        x = hi ? m2 + gap : m2 - gap;
        m = new Frac((n - 1) * m2 + x, n);
      } while (
        x <= 0 ||
        (ctx.cap && x > ctx.cap) ||
        (d < 3 ? !m.isInt() : !m.mul(10).isInt() || m.isInt() === rng.chance(0.3)) ||
        m.mul(2).sub(m2).eq(x) ||
        m.sub(m2).mul(n).eq(x)
      );
      const S = m.mul(n);
      const S2 = (n - 1) * m2;
      const avgOfMeans = m.mul(2).sub(m2);
      const wrongCount = m.sub(m2).mul(n);
      const traps = [
        { value: avgOfMeans, trap: 'stat-average-of-means' },
        { value: wrongCount, trap: 'stat-wrong-count' },
      ];
      return {
        params: { ...base, n, m, m2: frac(m2), which: hi ? 'high' : 'low', cap: ctx.cap },
        q: {
          format: 'ne',
          stem: ctx.stem(n, fTex(m), num(m2), hi),
          answer: frac(x),
          suffix: ctx.suffix,
          traps,
          explanation: `Work with sums, not averages. The ${n} ${ctx.noun} add up to $${n} \\times ${fTex(m)} = ${fTex(S)}$, and the remaining ${n - 1} add up to $${n - 1} \\times ${num(m2)} = ${num(S2)}$.

The value removed is the difference: $${fTex(S)} - ${num(S2)} = ${num(x)}$.

Averaging the averages does not work, because the two groups have different sizes: $2 \\times ${fTex(m)} - ${num(m2)} = ${fTex(avgOfMeans)}$ is wrong.`,
        },
      };
    }

    if (mode === 'target') {
      const money = d === 3 ? rng.chance(0.6) : rng.chance(0.3);
      let n = 0;
      let m = 0;
      let t = 0;
      let x = 0;
      do {
        n = d === 1 ? rng.int(3, 5) : d === 2 ? rng.int(4, 8) : rng.int(6, 12);
        if (money) {
          m = rng.int(12, 60) * 5;
          t = m + rng.int(1, d === 3 ? 6 : 4) * 5;
        } else {
          m = rng.int(68, 88);
          t = m + rng.int(1, d === 1 ? 3 : 4);
        }
        x = (n + 1) * t - n * m;
      } while ((!money && x > 100) || 2 * t - m === x || n * (t - m) === x);
      const avgOfMeans = 2 * t - m;
      const wrongCount = n * (t - m);
      const traps = [
        { value: frac(avgOfMeans), trap: 'stat-average-of-means' },
        { value: frac(wrongCount), trap: 'stat-wrong-count' },
      ];
      const stem = money
        ? `During the first ${n} days of a fund drive, a volunteer collected an average (arithmetic mean) of ${usd(m)} per day. How much must the volunteer collect on day ${n + 1} so that the average amount collected per day for the ${n + 1} days is ${usd(t)}?`
        : `Maria's average (arithmetic mean) score on her first ${n} tests is $${m}$. What score must she earn on her next test to raise her average for all ${n + 1} tests to $${t}$?`;
      const fmt = (v: number) => (money ? usd(v) : num(v));
      return {
        params: { ...base, n, m: frac(m), m2: frac(t), cap: money ? 0 : 100 },
        q: {
          format: 'ne',
          stem,
          answer: frac(x),
          prefix: money ? '\\$' : undefined,
          traps,
          explanation: `Compare totals. The first ${n} ${money ? 'days' : 'tests'} total $${n} \\times ${fmt(m)} = ${fmt(n * m)}$. An average of $${fmt(t)}$ over ${n + 1} ${money ? 'days' : 'tests'} needs a total of $${n + 1} \\times ${fmt(t)} = ${fmt((n + 1) * t)}$.

So the next value must be $${fmt((n + 1) * t)} - ${fmt(n * m)} = ${fmt(x)}$.

Equivalently, it must be $${fmt(t)}$ plus enough to lift each of the ${n} earlier values by $${fmt(t - m)}$: $${fmt(t)} + ${n} \\times ${fmt(t - m)} = ${fmt(x)}$. Answering $${fmt(avgOfMeans)}$ treats the old average as if it counted only once.`,
        },
      };
    }

    if (mode === 'fix') {
      const n = rng.pick(d === 2 ? [4, 5, 8, 10] : [8, 10, 20, 25, 40]);
      let m: Frac;
      let a = 0;
      let b = 0;
      do {
        m = d === 2 ? frac(rng.int(20, 80)) : new Frac(rng.int(200, 900), 10);
        a = rng.int(10, 99);
        b = a + rng.sign() * rng.int(6, 45);
      } while (b <= 0 || a === b || m.mul(n).sub(b).sign() <= 0);
      const answer = m.add(new Frac(a - b, n));
      const notDivided = m.add(a - b);
      const sign = m.sub(new Frac(a - b, n));
      const traps = [
        { value: notDivided, trap: 'stat-change-not-divided' },
        { value: sign, trap: 'stat-change-direction' },
      ];
      return {
        params: { ...base, n, m, a, b },
        q: {
          format: 'ne',
          stem: `The average (arithmetic mean) of ${n} numbers is $${fTex(m)}$. It was later discovered that one of the numbers had been recorded as $${b}$ instead of its correct value, $${a}$. What is the correct average of the ${n} numbers?`,
          answer,
          traps,
          explanation: `The recorded total is $${n} \\times ${fTex(m)} = ${fTex(m.mul(n))}$. Replacing $${b}$ by $${a}$ changes the total by $${a} - ${b} = ${num(a - b)}$, so the correct total is $${fTex(m.mul(n).add(a - b))}$.

The correct average is $${fTex(m.mul(n).add(a - b))} \\div ${n} = ${fTex(answer)}$.

Shortcut: the average changes by $${num(a - b)} \\div ${n} = ${fTex(new Frac(a - b, n))}$. Adding the whole change of $${num(a - b)}$ to the average forgets to share it among the ${n} numbers.`,
        },
      };
    }

    // split
    let n = 0;
    let k = 0;
    let m: Frac;
    let p: Frac;
    let answer: Frac;
    do {
      n = d === 2 ? rng.int(5, 10) : rng.int(8, 16);
      k = rng.int(2, n - 2);
      m = frac(rng.int(10, 60));
      p = d === 2 ? m.add(rng.sign() * rng.int(2, 9)) : m.add(new Frac(rng.sign() * rng.int(4, 30), 2));
      answer = m.mul(n).sub(p.mul(k)).div(n - k);
    } while (
      p.sign() <= 0 ||
      answer.sign() <= 0 ||
      !answer.isTerminating() ||
      answer.mul(100).d !== 1 ||
      answer.eq(m) ||
      m.mul(2).sub(p).eq(answer) ||
      m.mul(n).sub(p.mul(k)).div(n).eq(answer)
    );
    const avgOfMeans = m.mul(2).sub(p);
    const wrongCount = m.mul(n).sub(p.mul(k)).div(n);
    const traps = [
      { value: avgOfMeans, trap: 'stat-average-of-means' },
      { value: wrongCount, trap: 'stat-wrong-count' },
    ];
    return {
      params: { ...base, n, m, m2: p, k },
      q: {
        format: 'ne',
        stem: `The average (arithmetic mean) of ${n} numbers is $${fTex(m)}$. If the average of ${k} of these numbers is $${fTex(p)}$, what is the average of the other ${n - k} numbers?`,
        answer,
        traps,
        explanation: `All ${n} numbers total $${n} \\times ${fTex(m)} = ${fTex(m.mul(n))}$; the ${k} numbers total $${k} \\times ${fTex(p)} = ${fTex(p.mul(k))}$.

The other ${n - k} numbers total $${fTex(m.mul(n))} - ${fTex(p.mul(k))} = ${fTex(m.mul(n).sub(p.mul(k)))}$, so their average is $${fTex(m.mul(n).sub(p.mul(k)))} \\div ${n - k} = ${fTex(answer)}$.

The groups have different sizes (${k} and ${n - k}), so the answer is not $2 \\times ${fTex(m)} - ${fTex(p)} = ${fTex(avgOfMeans)}$.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const x = q.answer;
    // Forward simulation: build an explicit data set using the claimed answer and recompute every
    // stated average.
    const fill = (v: Frac, count: number) => Array.from({ length: count }, () => v);
    switch (p.mode) {
      case 'drop': {
        const all = [x, ...fill(p.m2, p.n - 1)];
        if (!meanFracs(all).eq(p.m)) return `mean of the data set with ${x} is ${meanFracs(all)}, not ${p.m}`;
        if (p.which === 'low' ? x.gt(p.m2) : x.lt(p.m2)) return 'removed value cannot be the extreme one';
        if (p.cap && x.gt(p.cap)) return 'value above the cap';
        return null;
      }
      case 'target': {
        const all = [...fill(p.m, p.n), x];
        if (!meanFracs(all).eq(p.m2)) return `new mean is ${meanFracs(all)}, not ${p.m2}`;
        if (p.cap && x.gt(p.cap)) return 'value above the cap';
        return null;
      }
      case 'fix': {
        const rest = fill(p.m.mul(p.n).sub(p.b).div(p.n - 1), p.n - 1);
        if (!meanFracs([frac(p.b), ...rest]).eq(p.m)) return 'recorded data inconsistent';
        const correct = meanFracs([frac(p.a), ...rest]);
        return correct.eq(x) ? null : `correct mean is ${correct}`;
      }
      case 'split': {
        const all = [...fill(p.m2, p.k), ...fill(x, p.n - p.k)];
        return meanFracs(all).eq(p.m) ? null : `mean with ${x} is ${meanFracs(all)}, not ${p.m}`;
      }
    }
  },
};

/* =============================================================================================
 * 3. Which values of x give the list a given median (or make mean = median)? (MCM)
 * =========================================================================================== */

interface WhichParams {
  base: number[];
  cond: 'median' | 'mean-eq-median';
  /** Target median for cond = 'median'. */
  m: Frac;
  /** Choice values. */
  values: Frac[];
}

/** Solution set of median(base + x) = m as an interval [lo, hi] (null = unbounded), by the clamp rule. */
function medianSolutions(base: number[], m: Frac): { lo: Frac | null; hi: Frac | null } | null {
  const b = sortAsc(base);
  const N = b.length + 1;
  if (N % 2 === 1) {
    const k = (N - 1) / 2; // median = clamp(x, b[k-1], b[k]) (1-based b_k, b_{k+1})
    const lowV = b[k - 1];
    const highV = b[k];
    if (m.lt(lowV) || m.gt(highV)) return null;
    if (lowV === highV) return { lo: null, hi: null };
    if (m.eq(lowV)) return { lo: null, hi: frac(lowV) };
    if (m.eq(highV)) return { lo: frac(highV), hi: null };
    return { lo: m, hi: m };
  }
  const k = N / 2; // median = (b_k + clamp(x, b_{k-1}, b_{k+1})) / 2
  const mid = b[k - 1];
  const lowV = b[k - 2];
  const highV = b[k];
  const need = m.mul(2).sub(mid);
  if (need.lt(lowV) || need.gt(highV)) return null;
  if (lowV === highV) return { lo: null, hi: null };
  if (need.eq(lowV)) return { lo: null, hi: frac(lowV) };
  if (need.eq(highV)) return { lo: frac(highV), hi: null };
  return { lo: need, hi: need };
}

const inInterval = (x: Frac, s: { lo: Frac | null; hi: Frac | null }) => (s.lo === null || !x.lt(s.lo)) && (s.hi === null || !x.gt(s.hi));

/** Values of x with mean(base + x) = median(base + x), solved piece by piece (N odd). */
function meanEqMedianSolutions(base: number[]): Frac[] {
  const b = sortAsc(base);
  const N = b.length + 1;
  const k = (N - 1) / 2;
  const S = total(b);
  const lowV = b[k - 1];
  const highV = b[k];
  const out: Frac[] = [];
  // x <= lowV: median lowV, mean (S + x)/N = lowV -> x = N lowV - S
  const x1 = N * lowV - S;
  if (x1 <= lowV) out.push(frac(x1));
  // lowV <= x <= highV: median x, (S + x)/N = x -> x = S/(N - 1)
  const x2 = new Frac(S, N - 1);
  if (!x2.lt(lowV) && !x2.gt(highV)) out.push(x2);
  // x >= highV: median highV
  const x3 = N * highV - S;
  if (x3 >= highV) out.push(frac(x3));
  return out.filter((v, i) => out.findIndex((w) => w.eq(v)) === i);
}

const whichValues: Template<WhichParams> = {
  id: 'data.center.which-values',
  skill: 'data.center',
  format: 'mcm',
  style: 'which values of an unknown give the list a stated median',
  generate(rng, d) {
    const cond: WhichParams['cond'] = d === 3 && rng.chance(0.5) ? 'mean-eq-median' : 'median';
    if (cond === 'mean-eq-median') {
      for (;;) {
        const base = sortAsc(rng.sample(Array.from({ length: 24 }, (_, i) => i + 1), 4));
        const sols = meanEqMedianSolutions(base);
        if (sols.length < 2 || sols.some((s) => !s.isInt() || s.n < 0)) continue;
        const b = base;
        const S = total(b);
        // Wrong values, each from a mistake: a case solution that falls outside its own case, the mean
        // taken over the 4 known numbers (x left out of the count), or a number already in the list.
        const named: { v: Frac; trap: string }[] = [];
        const add = (v: Frac, trap: string) => {
          if (v.isInt() && v.sign() > 0 && !sols.some((s) => s.eq(v)) && !named.some((w) => w.v.eq(v))) named.push({ v, trap });
        };
        add(frac(5 * b[1] - S), 'stat-case-not-checked');
        add(new Frac(S, 4), 'stat-case-not-checked');
        add(frac(5 * b[2] - S), 'stat-case-not-checked');
        for (const v of rng.shuffle([frac(4 * b[1] - S), new Frac(S, 3), frac(4 * b[2] - S)])) add(v, 'stat-wrong-count');
        for (const v of rng.shuffle([b[1], b[2]])) add(frac(v), 'stat-median-known-number');
        if (named.length < 3) continue;
        const wrong = named.slice(0, rng.int(3, Math.min(4, named.length)));
        const values = [...sols, ...wrong.map((w) => w.v)].sort((x, y) => x.cmp(y));
        const { choices, answer } = flaggedChoices(
          values.map((v) => {
            const w = wrong.find((x) => x.v.eq(v));
            return { text: `$${fTex(v)}$`, correct: !w, ...(w ? { trap: w.trap } : {}) };
          }),
        );
        const lines = [
          `- If $x \\le ${b[1]}$, the median is $${b[1]}$; the mean is $${b[1]}$ when $${S} + x = ${5 * b[1]}$, so $x = ${5 * b[1] - S}$${5 * b[1] - S <= b[1] ? ' ✓' : `, which is not $\\le ${b[1]}$ ✗`}.`,
          `- If $${b[1]} \\le x \\le ${b[2]}$, the median is $x$; the mean is $x$ when $${S} + x = 5x$, so $x = ${fTex(new Frac(S, 4))}$${sols.some((s) => s.eq(new Frac(S, 4))) ? ' ✓' : ' (not in this range) ✗'}.`,
          `- If $x \\ge ${b[2]}$, the median is $${b[2]}$; the mean is $${b[2]}$ when $x = ${5 * b[2] - S}$${5 * b[2] - S >= b[2] ? ' ✓' : ' ✗'}.`,
        ];
        return {
          params: { base: b, cond, m: frac(0), values },
          q: {
            format: 'mcm',
            stem: `The average (arithmetic mean) of the 5 numbers $${listTex(rng.shuffle([...b.map((v) => num(v)), 'x']))}$ is equal to their median. Which of the following could be the value of $x$?`,
            instruction: 'Indicate all such values.',
            choices,
            answer,
            explanation: `The median depends on where $x$ falls among $${listTex(b)}$, so split into cases. The mean is $\\dfrac{${S} + x}{5}$.
${lines.join('\n')}

So $x$ can be ${sols.map((s) => `$${fTex(s)}$`).join(', ').replace(/, ([^,]*)$/, ' or $1')}. Solving only one case finds just one of them.

Check: with $x = ${fTex(sols[0])}$ the ordered list is $${listTex(sortAsc([...b, sols[0].n]))}$, and its mean and median are both $${fTex(meanF([...b, sols[0].n]))}$.

Trap: $x = ${fTex(wrong[0].v)}$ gives the list $${listTex(sortAsc([...b, wrong[0].v.n]))}$, with mean $${fTex(meanF([...b, wrong[0].v.n]))}$ but median $${fTex(medianF([...b, wrong[0].v.n]))}$.`,
          },
        };
      }
    }

    const N = d === 1 ? 5 : d === 2 ? rng.pick([5, 6]) : rng.pick([6, 7]);
    for (;;) {
      const base = sortAsc(rng.sample(Array.from({ length: 30 }, (_, i) => i + 1), N - 1));
      const b = base;
      // pick a target median: an endpoint case (interval of solutions) most of the time
      let m: Frac;
      if (N % 2 === 1) {
        const k = (N - 1) / 2;
        const r = rng.next();
        m = r < 0.4 ? frac(b[k]) : r < 0.8 ? frac(b[k - 1]) : frac(rng.int(b[k - 1] + 1, Math.max(b[k - 1] + 1, b[k] - 1)));
      } else {
        const k = N / 2;
        const r = rng.next();
        const target = r < 0.4 ? b[k] : r < 0.8 ? b[k - 2] : rng.int(b[k - 2] + 1, Math.max(b[k - 2] + 1, b[k] - 1));
        m = new Frac(b[k - 1] + target, 2);
      }
      const sol = medianSolutions(b, m);
      if (!sol || (sol.lo === null && sol.hi === null)) continue;
      // Right values: around the boundary of the solutions.
      const pivot = sol.lo ?? sol.hi!;
      const good: Frac[] = [];
      for (let delta = -9; delta <= 9; delta++) {
        const v = pivot.add(delta);
        if (v.sign() > 0 && inInterval(v, sol) && !good.some((w) => w.eq(v))) good.push(v);
      }
      if (!good.length) continue;
      const nGood = sol.lo !== null && sol.hi !== null ? 1 : rng.int(2, Math.min(3, good.length));
      const pickGood = rng.sample(good, Math.min(nGood, good.length));
      // make sure the boundary itself (or the single solution) is often included
      if (!pickGood.some((v) => v.eq(pivot)) && rng.chance(0.6)) pickGood[0] = pivot;
      // Wrong values, each from a mistake.
      const k = N % 2 === 1 ? (N - 1) / 2 : N / 2;
      const named: { v: Frac; trap: string }[] = [];
      const add = (v: Frac, trap: string) => {
        if (v.sign() > 0 && !inInterval(v, sol) && !named.some((w) => w.v.eq(v))) named.push({ v, trap });
      };
      // the edge of the solutions, one step on the wrong side
      if (sol.lo !== null && sol.hi !== null) add(rng.chance(0.5) ? sol.lo.sub(1) : sol.lo.add(1), 'stat-median-boundary');
      else add(sol.lo !== null ? sol.lo.sub(1) : sol.hi!.add(1), 'stat-median-boundary');
      const others: { v: Frac; trap: string }[] = [];
      const addOther = (v: Frac, trap: string) => {
        if (v.sign() > 0 && !inInterval(v, sol) && !others.some((w) => w.v.eq(v))) others.push({ v, trap });
      };
      addOther(m, 'stat-median-is-x');
      if (N % 2 === 0) {
        addOther(m.sub(b[k - 1]), 'stat-median-no-double');
        addOther(m.mul(2).sub(b[k - 2]), 'stat-median-wrong-middle');
        addOther(m.mul(2).sub(b[k]), 'stat-median-wrong-middle');
      }
      for (const v of N % 2 === 1 ? [b[k - 1], b[k]] : [b[k - 2], b[k - 1], b[k]]) addOther(frac(v), 'stat-median-known-number');
      for (const o of rng.shuffle(others)) if (!named.some((w) => w.v.eq(o.v))) named.push(o);
      if (named.length < 2) continue;
      const pickBad = named.slice(0, Math.min(named.length, rng.int(2, d === 1 ? 3 : 4)));
      const values = [...pickGood, ...pickBad.map((w) => w.v)].sort((x, y) => x.cmp(y));
      if (values.length < 4) continue;
      const listWith = (v: Frac) => [...b.map((e) => frac(e)), v].sort((p, q) => p.cmp(q));
      const medianOf = (xs: Frac[]) => (xs.length % 2 ? xs[(xs.length - 1) / 2] : xs[xs.length / 2 - 1].add(xs[xs.length / 2]).div(2));
      const trapped = pickBad[0];
      const items: (Choice & { correct: boolean })[] = values.map((v) => {
        const w = pickBad.find((x) => x.v.eq(v));
        return { text: `$${fTex(v)}$`, correct: !w, ...(w ? { trap: w.trap } : {}) };
      });
      const { choices, answer } = flaggedChoices(items);
      const shown = rng.shuffle([...b.map((v) => num(v)), 'x']);
      let reason: string;
      if (N % 2 === 1) {
        const k = (N - 1) / 2;
        reason = `In order, the ${N - 1} known numbers are $${listTex(b)}$. With $x$ added there are ${N} numbers, and the median is the ${ordinal(k + 1)} of them. Wherever $x$ goes, the median is $${b[k - 1]}$ if $x \\le ${b[k - 1]}$, $x$ itself if $${b[k - 1]} \\le x \\le ${b[k]}$, and $${b[k]}$ if $x \\ge ${b[k]}$.`;
      } else {
        const k = N / 2;
        reason = `In order, the ${N - 1} known numbers are $${listTex(b)}$. With $x$ there are ${N} numbers, so the median is the average of the ${ordinal(k)} and ${ordinal(k + 1)}. One of these two middle numbers is always $${b[k - 1]}$; the other middle number is $${b[k - 2]}$ if $x \\le ${b[k - 2]}$, $x$ if $${b[k - 2]} \\le x \\le ${b[k]}$, and $${b[k]}$ if $x \\ge ${b[k]}$. A median of $${fTex(m)}$ needs that other middle number to be $2 \\times ${fTex(m)} - ${b[k - 1]} = ${fTex(m.mul(2).sub(b[k - 1]))}$.`;
      }
      const solText =
        sol.lo !== null && sol.hi !== null
          ? `So $x$ must equal $${fTex(sol.lo)}$ exactly.`
          : sol.lo !== null
            ? `So the median is $${fTex(m)}$ exactly when $x \\ge ${fTex(sol.lo)}$.`
            : `So the median is $${fTex(m)}$ exactly when $x \\le ${fTex(sol.hi!)}$.`;
      return {
        params: { base: b, cond: 'median', m, values },
        q: {
          format: 'mcm',
          stem: `The median of the ${N} numbers $${listTex(shown)}$ is $${fTex(m)}$. Which of the following could be the value of $x$?`,
          instruction: 'Indicate all such values.',
          choices,
          answer,
          explanation: `${reason}

${solText}

Check: with $x = ${fTex(pickGood[0])}$ the ordered list is $${listTex(listWith(pickGood[0]).map(fTex))}$, whose median is $${fTex(medianOf(listWith(pickGood[0])))}$.

Trap: $x = ${fTex(trapped.v)}$ gives $${listTex(listWith(trapped.v).map(fTex))}$, whose median is $${fTex(medianOf(listWith(trapped.v)))}$, not $${fTex(m)}$.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'wrong format';
    // Brute force: add each choice to the list and compute the statistics directly.
    const expected = p.values.flatMap((v, i) => {
      const scaled = [...p.base.map((b) => b * v.d), v.n];
      const med = medianByRank(scaled).div(v.d);
      const mean = meanF(scaled).div(v.d);
      const ok = p.cond === 'median' ? med.eq(p.m) : mean.eq(med);
      return ok ? [i] : [];
    });
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/* =============================================================================================
 * 4. Greatest / least possible value of a list built under constraints (MCS)
 *  - book DA-26: least / greatest possible average given the median and the greatest value
 *  - largest / smallest member given the average and the median
 * =========================================================================================== */

type ExtremeAsk = 'max-largest' | 'min-largest' | 'max-smallest' | 'min-mean' | 'max-mean';

interface ExtremeParams {
  n: number;
  /** Average (for the member asks). */
  M: number;
  /** Median. */
  D: number;
  /** Greatest value (for the mean asks). */
  top: number;
  distinct: boolean;
  ask: ExtremeAsk;
}

/** Closed-form answer for n = 5 positive integers a <= b <= D <= d <= e with sum 5M. */
function memberFormula(M: number, D: number, distinct: boolean, ask: ExtremeAsk): number | null {
  const S = 5 * M;
  if (ask === 'max-largest') {
    const others = distinct ? 1 + 2 + D + (D + 1) : 1 + 1 + D + D;
    const e = S - others;
    return e >= (distinct ? D + 2 : D) ? e : null;
  }
  if (ask === 'min-largest') {
    if (distinct && D < 3) return null;
    const low = distinct ? D - 2 + (D - 1) : 2 * D;
    const T = S - D - low; // d + e
    const e = distinct ? Math.max(Math.floor(T / 2) + 1, D + 2) : Math.max(Math.ceil(T / 2), D);
    return T - e >= (distinct ? D + 1 : D) ? e : null;
  }
  // max-smallest: d, e as small as possible
  const up = distinct ? D + 1 + (D + 2) : 2 * D;
  const T = S - D - up; // a + b
  const a = distinct ? Math.min(Math.floor((T - 1) / 2), D - 2) : Math.min(Math.floor(T / 2), D);
  if (a < 1) return null;
  const b = T - a;
  return (distinct ? a < b && b < D : a <= b && b <= D) ? a : null;
}

/** Every multiset of `size` integers from lo..hi, as a list of sums (brute force). */
function multisetSums(size: number, lo: number, hi: number): number[] {
  const out: number[] = [];
  const rec = (left: number, from: number, acc: number) => {
    if (left === 0) {
      out.push(acc);
      return;
    }
    for (let v = from; v <= hi; v++) rec(left - 1, v, acc + v);
  };
  rec(size, lo, 0);
  return out;
}

const extremeValue: Template<ExtremeParams> = {
  id: 'data.center.extreme-value',
  skill: 'data.center',
  format: 'mcs',
  style: 'least or greatest possible value: build the extreme list',
  generate(rng, d) {
    const asks: ExtremeAsk[] =
      d === 1 ? ['max-largest', 'min-mean', 'max-mean'] : d === 2 ? ['min-mean', 'max-mean', 'max-largest', 'min-largest'] : ['min-mean', 'min-largest', 'max-smallest', 'max-mean'];
    for (;;) {
      const ask = rng.pick(asks);

      if (ask === 'min-mean' || ask === 'max-mean') {
        const n = d === 1 ? 5 : rng.pick(d === 2 ? [5, 7] : [7, 9]);
        const h = (n - 1) / 2;
        const D = rng.int(d === 1 ? 5 : 8, d === 3 ? 30 : 20);
        const top = D + rng.int(5, d === 3 ? 60 : 40);
        const totalAns = ask === 'min-mean' ? h + h * D + top : (h + 1) * D + h * top;
        const ans = new Frac(totalAns, n);
        // Each wrong choice is the average of a list built with one mistake.
        const avg = (tot: number, count = n) => new Frac(tot, count);
        const mk = (tot: number, trap: string, why: (v: string) => string, count = n) => ({ value: avg(tot, count), trap, why });
        const traps = rng.shuffle(
          ask === 'min-mean'
            ? [
                mk(h + D + (h - 1) + top, 'stat-extreme-order', (v) => `setting the integers above the median to 1 as well gives an average of $${v}$, but they come after the median in increasing order, so each is at least $${D}$`),
                mk(h * D + top, 'stat-extreme-zero', (v) => `taking 0 for the integers below the median gives $${v}$, but the integers are positive, so the least is 1`),
                mk(h + (h + 1) * D, 'stat-extreme-top-ignored', (v) => `leaving everything above the median at $${D}$ gives $${v}$, but the greatest integer is $${top}$`),
                mk((h + 1) * D + h * top, 'stat-extreme-direction', (v) => `building the list for the greatest average gives $${v}$, but this question asks for the least`),
                mk(h + D + h * top, 'stat-extreme-direction', (v) => `raising every integer above the median to $${top}$ gives $${v}$, which pushes them the wrong way`),
                mk(2 * h * D + top, 'stat-extreme-short', (v) => `leaving the integers below the median at $${D}$ gives $${v}$, but they can be as small as 1`),
                mk(h + h * D + top + D, 'stat-extreme-median-twice', (v) => `counting the median twice gives $${v}$, but it is one integer of the list`),
                mk(h + (h - 1) * D + top, 'stat-extreme-median-missing', (v) => `leaving the median out gives $${v}$, but it is one of the ${n} integers`, n - 1),
              ]
            : [
                mk(2 * h * top + D, 'stat-extreme-order', (v) => `setting the integers below the median to $${top}$ gives $${v}$, but they come before the median in increasing order, so each is at most $${D}$`),
                mk(2 * h * D + top, 'stat-extreme-short', (v) => `leaving the integers above the median at $${D}$ gives $${v}$, but they can be as large as the greatest integer, $${top}$`),
                mk(h + D + h * top, 'stat-extreme-direction', (v) => `leaving the integers below the median at 1 gives $${v}$, but they can be as large as $${D}$`),
                mk(h + h * D + top, 'stat-extreme-direction', (v) => `building the list for the least average gives $${v}$, but this question asks for the greatest`),
                mk((h + 1) * D + h * top + D, 'stat-extreme-median-twice', (v) => `counting the median twice gives $${v}$, but it is one integer of the list`),
                mk(h * D + h * top, 'stat-extreme-median-missing', (v) => `leaving the median out gives $${v}$, but it is one of the ${n} integers`, n - 1),
              ],
        );
        // decimals when the count is 5, fractions otherwise, so that the choices share one form
        const tex = (v: Frac) => (n === 5 ? fTex(v) : v.isInt() ? num(v.n) : v.toTex());
        const built = trapOnlyChoices(rng, ans, traps, (v) => `$${tex(v)}$`);
        if (!built) continue;
        const cite = rng.pick(built.used);
        const ones = Array(h).fill(1);
        const listMin = [...ones, D, ...Array(h - 1).fill(D), top];
        const listMax = [...Array(h).fill(D), D, ...Array(h - 1).fill(top), top];
        const shown = ask === 'min-mean' ? listMin : listMax;
        const how =
          ask === 'min-mean'
            ? `To make the average as small as possible, make every integer as small as the conditions allow. The ${h} integers below the median can each be 1. The median is $${D}$, and the ${h - 1} integer${h - 1 === 1 ? '' : 's'} between the median and the greatest must be at least $${D}$. The greatest is $${top}$.`
            : `To make the average as large as possible, make every integer as large as the conditions allow. The ${h} integers below the median can be at most $${D}$, the median is $${D}$, and the ${h - 1} integer${h - 1 === 1 ? '' : 's'} above the median can be as large as the greatest, $${top}$.`;
        return {
          params: { n, M: 0, D, top, distinct: false, ask },
          q: {
            format: 'mcs',
            stem: `A list consists of ${n} positive integers. The greatest integer in the list is $${top}$, and the median of the list is $${D}$. What is the ${ask === 'min-mean' ? 'least' : 'greatest'} possible value of the average (arithmetic mean) of the ${n} integers?`,
            choices: built.choices,
            answer: built.answer,
            explanation: `${how}

That list is $${listTex(shown)}$, with total $${num(totalAns)}$, so the ${ask === 'min-mean' ? 'least' : 'greatest'} possible average is $${num(totalAns)} \\div ${n} = ${tex(ans)}$.

Trap: ${cite.why(tex(cite.value))}.

To push an average to its extreme, push every free value as far as the conditions allow.`,
          },
        };
      }

      const distinct = d === 1 ? false : rng.chance(d === 2 ? 0.5 : 0.6);
      const D = rng.int(d === 1 ? 6 : 8, d === 3 ? 30 : 20);
      const M = ask === 'min-largest' ? D + rng.int(1, d === 3 ? 8 : 5) : rng.int(Math.max(4, D - 3), D + 10);
      const ans = memberFormula(M, D, distinct, ask);
      if (ans === null) continue;
      const S = 5 * M;
      const lt = distinct ? '<' : '\\le';
      const dMin = distinct ? D + 1 : D; // smallest d
      const lowMin = distinct ? 3 : 2; // smallest a + b
      const lowMax = distinct ? 2 * D - 3 : 2 * D; // largest a + b
      // least e when d + e = T (d <= e, or d < e when the integers are different)
      const shareMin = (T: number) => (distinct ? Math.max(Math.floor(T / 2) + 1, D + 2) : Math.max(Math.ceil(T / 2), D));
      const mk = (value: number, trap: string, why: (v: string) => string) => ({ value, trap, why });
      const altWhy = (v: string) => `${distinct ? 'allowing repeated integers' : 'requiring different integers'} gives $${v}$; reread whether the integers must be different`;
      const equalWhy = (v: string, x: number) =>
        `making the four integers other than the median equal gives $${v}$, but then ${x < D ? `$d$ and $e$ would be below the median $${D}$` : `$a$ and $b$ would be above the median $${D}$`}`;
      let traps: ReturnType<typeof mk>[];
      let rule: string;
      let expl: string;
      if (ask === 'max-largest') {
        const o = distinct ? [1, 2, D, D + 1] : [1, 1, D, D];
        const alt = memberFormula(M, D, !distinct, ask);
        const opp = memberFormula(M, D, distinct, 'min-largest');
        traps = [
          mk(S - (lowMin + D + 1), 'stat-extreme-order', (v) => `$d = 1$ would give $e = ${v}$, but $d$ cannot be below the median $${D}$`),
          mk(S - (D + dMin), 'stat-extreme-zero', (v) => `$a = b = 0$ would give $e = ${v}$, but the integers are positive`),
          mk(S - D, 'stat-extreme-zero', (v) => `taking $a$, $b$ and $d$ as 0 would give $e = ${v}$, but the integers are positive`),
          mk(S - (lowMin + dMin), 'stat-extreme-median-missing', (v) => `leaving the median out of the sum gives $e = ${v}$, but it is one of the five integers`),
          mk(S - (distinct ? 4 * D - 2 : 4 * D), 'stat-extreme-direction', (v) => `making $a$, $b$ and $d$ as close to the median as the order allows gives $e = ${v}$, which shrinks $e$ instead of growing it`),
          mk(ans - D, 'stat-extreme-median-twice', (v) => `counting the median twice gives $e = ${v}$, but it appears once in the sum`),
          ...(opp !== null ? [mk(opp, 'stat-extreme-direction', (v) => `$${v}$ is the least possible value of the largest integer, but this question asks for the greatest`)] : []),
          ...(alt !== null ? [mk(alt, 'stat-extreme-distinct', altWhy)] : []),
        ];
        rule = 'To push one value up, push every other free value down, only as far as the order lets you.';
        expl = `To make the largest integer as big as possible, make the others as small as the order allows.

In increasing order the integers are $a ${lt} b ${lt} ${D} ${lt} d ${lt} e$, and their sum is $5 \\times ${M} = ${S}$. Here ${distinct ? '$a$ and $b$ can be 1 and 2' : '$a$ and $b$ can both be 1'}, and $d$, which comes after the median, is at least $${o[3]}$. So $e = ${S} - (${o.join(' + ')}) = ${ans}$.

Check: $${o.join(' + ')} + ${ans} = ${S}$.`;
      } else if (ask === 'min-largest') {
        const low = distinct ? [D - 2, D - 1] : [D, D];
        const T = S - D - lowMax;
        const alt = memberFormula(M, D, !distinct, ask);
        const opp = memberFormula(M, D, distinct, 'max-largest');
        const x4 = Math.ceil((S - D) / 4);
        traps = [
          mk(T - dMin, 'stat-extreme-balance', (v) => `putting all of the rest into $e$ (with $d = ${dMin}$) gives $e = ${v}$, which is larger than needed`),
          mk(x4, 'stat-extreme-order', (v) => equalWhy(`e = ${v}`, x4)),
          mk(shareMin(S - lowMax), 'stat-extreme-median-missing', (v) => `leaving the median out of the sum gives $e = ${v}$, but it is one of the five integers`),
          mk(shareMin(S - D - lowMin), 'stat-extreme-direction', (v) => `leaving $a$ and $b$ small gives $e = ${v}$, but to shrink $e$ the others must be large`),
          mk(Math.floor(T / 2), 'stat-extreme-rounding', (v) => `rounding the even split down gives $e = ${v}$, but then $d$ and $e$ would break the order`),
          mk(shareMin(T - D), 'stat-extreme-median-twice', (v) => `counting the median twice gives $e = ${v}$, but it appears once in the sum`),
          ...(opp !== null ? [mk(opp, 'stat-extreme-direction', (v) => `$${v}$ is the greatest possible value of the largest integer, but this question asks for the least`)] : []),
          ...(alt !== null ? [mk(alt, 'stat-extreme-distinct', altWhy)] : []),
        ];
        rule = 'To shrink the greatest value, enlarge the others up to their cap, then share what is left.';
        expl = `To make the largest integer as small as possible, make the others as large as the order allows, then share what is left.

In increasing order the integers are $a ${lt} b ${lt} ${D} ${lt} d ${lt} e$, and their sum is $5 \\times ${M} = ${S}$. Here $a$ and $b$ are at most $${low[0]}$ and $${low[1]}$, so $d + e = ${S} - ${D} - ${low[0]} - ${low[1]} = ${T}$. Share it as evenly as the order allows: $d = ${T - ans}$, $e = ${ans}$.

Check: $${low[0]} + ${low[1]} + ${D} + ${T - ans} + ${ans} = ${S}$.`;
      } else {
        const up = distinct ? [D + 1, D + 2] : [D, D];
        const T = S - D - up[0] - up[1];
        const alt = memberFormula(M, D, !distinct, ask);
        const x4 = Math.floor((S - D) / 4);
        const capped = (t: number) => (distinct ? Math.min(Math.floor((t - 1) / 2), D - 2) : Math.min(Math.floor(t / 2), D));
        traps = [
          mk(x4, 'stat-extreme-order', (v) => equalWhy(`a = ${v}`, x4)),
          mk(distinct ? Math.floor((T - 1) / 2) : Math.floor(T / 2), 'stat-extreme-order', (v) => `splitting $a + b$ evenly with no limit gives $a = ${v}$, but $b$ cannot be above the median $${D}$`),
          mk(T - D, 'stat-extreme-balance', (v) => `taking $b = ${D}$ gives $a = ${v}$, but $a$ is largest when $a$ and $b$ are as equal as possible`),
          mk(capped(T + D), 'stat-extreme-median-missing', (v) => `leaving the median out of the sum gives $a = ${v}$, but it is one of the five integers`),
          mk(capped(T - D), 'stat-extreme-median-twice', (v) => `counting the median twice gives $a = ${v}$, but it appears once in the sum`),
          ...(alt !== null ? [mk(alt, 'stat-extreme-distinct', altWhy)] : []),
        ];
        rule = 'To raise the smallest value, make the values free to go down as small as the order allows.';
        expl = `To make the smallest integer as big as possible, make the integers above the median as small as the order allows.

In increasing order the integers are $a ${lt} b ${lt} ${D} ${lt} d ${lt} e$, and their sum is $5 \\times ${M} = ${S}$. Here $d$ and $e$ can be $${up[0]}$ and $${up[1]}$, so $a + b = ${S} - ${D} - ${up[0]} - ${up[1]} = ${T}$. Since $a ${lt} b ${lt} ${D}$, the greatest possible $a$ is $${ans}$ (with $b = ${T - ans}$).

Check: $${ans} + ${T - ans} + ${D} + ${up[0]} + ${up[1]} = ${S}$.`;
      }
      const built = trapOnlyChoices(
        rng,
        ans,
        rng.shuffle(traps.filter((t) => t.value > 0)),
        (v) => `$${fTex(v)}$`,
      );
      if (!built) continue;
      const cite = rng.pick(built.used);
      const what = ask === 'max-largest' ? 'greatest possible value of the largest' : ask === 'min-largest' ? 'least possible value of the largest' : 'greatest possible value of the smallest';
      return {
        params: { n: 5, M, D, top: 0, distinct, ask },
        q: {
          format: 'mcs',
          stem: `A list consists of 5 ${distinct ? 'different positive integers' : 'positive integers'}. The average (arithmetic mean) of the 5 integers is $${M}$, and their median is $${D}$. What is the ${what} integer in the list?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `${expl}

Trap: ${cite.why(num(cite.value))}.

${rule}`,
        },
      };
    }
  },
  check(q, { n, M, D, top, distinct, ask }) {
    if (q.format !== 'mcs') return 'wrong format';
    let best: number | null = null;
    if (ask === 'min-mean' || ask === 'max-mean') {
      // Enumerate every possible lower half (values 1..D) and upper half (values D..top, top included).
      const h = (n - 1) / 2;
      const lows = multisetSums(h, 1, D);
      const ups = multisetSums(h - 1, D, top).map((s) => s + top);
      const pickLow = ask === 'min-mean' ? Math.min(...lows) : Math.max(...lows);
      const pickUp = ask === 'min-mean' ? Math.min(...ups) : Math.max(...ups);
      const tot = new Frac(pickLow + D + pickUp, n);
      return q.choices[q.answer].text === `$${fTex(tot)}$` ? null : `expected ${tot}`;
    }
    // Brute force over every sorted list a <= b <= D <= d <= e of positive integers with sum 5M.
    const S = 5 * M;
    for (let a = 1; a <= D; a++)
      for (let b = a; b <= D; b++)
        for (let dd = D; dd <= S; dd++) {
          const e = S - a - b - D - dd;
          if (e < dd) break;
          if (distinct && !(a < b && b < D && D < dd && dd < e)) continue;
          const v = ask === 'max-smallest' ? a : e;
          best = best === null ? v : ask === 'min-largest' ? Math.min(best, v) : Math.max(best, v);
        }
    if (best === null) return 'no list satisfies the conditions';
    return q.choices[q.answer].text === `$${num(best)}$` ? null : `expected ${best}`;
  },
};

/* =============================================================================================
 * 5. Overlapping lists of consecutive integers (MCS), book DA-13
 * =========================================================================================== */

type Anchor = 'medR-minT' | 'medR-medT' | 'maxR-medT';

interface ConsecParams {
  m: number;
  n: number;
  anchor: Anchor;
  ask: 'combined' | 'both';
}

const consecutiveLists: Template<ConsecParams> = {
  id: 'data.center.consecutive-lists',
  skill: 'data.center',
  format: 'mcs',
  style: 'medians of lists of consecutive integers that overlap',
  generate(rng, d) {
    for (;;) {
      const anchor: Anchor = d === 1 ? 'medR-minT' : rng.pick(d === 2 ? ['medR-minT', 'medR-minT', 'medR-medT', 'maxR-medT'] : ['medR-minT', 'medR-medT', 'maxR-medT']);
      const ask: ConsecParams['ask'] = rng.chance(d === 1 ? 0.5 : d === 2 ? 0.35 : 0.4) ? 'both' : 'combined';
      const odd = (lo: number, hi: number) => 2 * rng.int(Math.ceil((lo - 1) / 2), Math.floor((hi - 1) / 2)) + 1;
      const m = odd(d === 1 ? 7 : 11, d === 3 ? 61 : 31);
      let n = anchor === 'medR-minT' ? odd(d === 1 ? 7 : 9, d === 3 ? 51 : 31) : odd(7, d === 3 ? 61 : 31);
      if (n === m && anchor !== 'medR-minT') n += 2;
      let overlap: number;
      let why: string;
      if (anchor === 'medR-minT') {
        overlap = Math.min((m - 1) / 2, n - 1) + 1;
        why = `The median of $R$ is its middle integer, with $${(m - 1) / 2}$ integers of $R$ above it. $T$ starts at that median, so the integers in both lists are the median of $R$ and the ${n - 1 >= (m - 1) / 2 ? `$${(m - 1) / 2}$ integers above it` : `next $${n - 1}$ integers`}: $${overlap}$ integers.`;
      } else if (anchor === 'medR-medT') {
        overlap = Math.min(m, n);
        why = `Both lists are centered on the same integer, so the shorter list (${Math.min(m, n)} integers) lies entirely inside the longer one: $${overlap}$ integers are in both.`;
      } else {
        overlap = Math.min(m, (n + 1) / 2);
        why = `The median of $T$ is its middle integer, with $${(n - 1) / 2}$ integers of $T$ below it. The greatest integer of $R$ is that median, so the integers in both lists are that median and the ${(n - 1) / 2 <= m - 1 ? `$${(n - 1) / 2}$ integers below it` : `$${m - 1}$ integers below it`}: $${overlap}$ integers.`;
      }
      const combined = m + n - overlap;
      const ans = ask === 'combined' ? combined : overlap;
      // Wrong choices: counting errors on the overlap (the shared integers).
      const half = rng.pick([(m - 1) / 2, (m + 1) / 2, (n - 1) / 2, (n + 1) / 2].filter((h) => Number.isInteger(h) && h > 0 && h !== overlap));
      const step = rng.chance(0.5) ? 1 : -1;
      const mk = (value: number, trap: string, why: (v: number) => string) => ({ value, trap, why });
      const offWhy = (v: number) => `$${v}$ is off by one: check the first and last shared integers on the number line`;
      const singleWhy = (v: number) => `assuming the lists share only the integer where they are tied gives $${v}$, but they overlap on more integers`;
      // the same question under each of the other two conditions (the condition misread)
      const overlapUnder: Record<Anchor, number> = {
        'medR-minT': Math.min((m - 1) / 2, n - 1) + 1,
        'medR-medT': Math.min(m, n),
        'maxR-medT': Math.min(m, (n + 1) / 2),
      };
      const readAs: Record<Anchor, string> = {
        'medR-minT': 'the median of $R$ equals the smallest integer of $T$',
        'medR-medT': 'the two lists have the same median',
        'maxR-medT': 'the greatest integer of $R$ equals the median of $T$',
      };
      const misread = (['medR-minT', 'medR-medT', 'maxR-medT'] as Anchor[])
        .filter((a) => a !== anchor && n % 2 === 1) // the other conditions need a middle integer in T
        .map((a) =>
          mk(
            ask === 'combined' ? m + n - overlapUnder[a] : overlapUnder[a],
            a === 'medR-medT' ? 'stat-overlap-nested' : 'stat-overlap-wrong-anchor',
            (v) => `reading the condition as "${readAs[a]}" gives $${v}$, but that is not the condition stated`,
          ),
        );
      const traps =
        ask === 'combined'
          ? [
              mk(m + n, 'stat-overlap-ignored', (v) => `adding the lengths gives $${v}$, which counts the $${overlap}$ shared integers twice`),
              mk(combined + step, 'stat-overlap-off-by-one', offWhy),
              mk(m + n - 1, 'stat-overlap-single', singleWhy),
              mk(m + n - half, 'stat-overlap-half', (v) => `counting only $${half}$ integers as shared gives $${v}$, which the number line does not support`),
              mk(overlap, 'stat-overlap-other-count', (v) => `$${v}$ is the number of shared integers, but this question asks for the different integers`),
              mk(m + n - 2 * overlap, 'stat-overlap-subtract-twice', (v) => `subtracting the overlap twice gives $${v}$, but it is subtracted only once from the total of the lengths`),
              ...misread,
            ]
          : [
              mk(combined, 'stat-overlap-other-count', (v) => `$${v}$ is the number of different integers, not the number in both lists`),
              mk(overlap + step, 'stat-overlap-off-by-one', offWhy),
              mk(1, 'stat-overlap-single', singleWhy),
              mk(half, 'stat-overlap-half', (v) => `taking half of a list as the shared part gives $${v}$, which the number line does not support`),
              mk(m + n - 2 * overlap, 'stat-overlap-subtract-twice', (v) => `$${v}$ counts the integers in exactly one of the lists, not in both`),
              ...misread,
            ];
      const built = trapOnlyChoices(
        rng,
        ans,
        rng.shuffle(traps.filter((t) => t.value > 0)),
        (v) => `$${fTex(v)}$`,
      );
      if (!built) continue;
      const { choices, answer } = built;
      const cite = rng.pick(built.used);
      const anchorText =
        anchor === 'medR-minT'
          ? 'The median of list $R$ equals the smallest integer in list $T$.'
          : anchor === 'medR-medT'
            ? 'The median of the integers in list $R$ is equal to the median of the integers in list $T$.'
            : 'The greatest integer in list $R$ is equal to the median of the integers in list $T$.';
      const checkText =
        anchor === 'medR-minT'
          ? `if $R$ is $1$ to $${m}$, its median is $${(m + 1) / 2}$ and $T$ is $${(m + 1) / 2}$ to $${(m + 1) / 2 + n - 1}$.`
          : anchor === 'medR-medT'
            ? `if $R$ is $1$ to $${m}$, its median is $${(m + 1) / 2}$ and $T$ runs from $${(m + 1) / 2 - (n - 1) / 2}$ to $${(m + 1) / 2 + (n - 1) / 2}$.`
            : `if $R$ is $1$ to $${m}$, then $T$ runs from $${m - (n - 1) / 2}$ to $${m + (n - 1) / 2}$.`;
      return {
        params: { m, n, anchor, ask },
        q: {
          format: 'mcs',
          stem: `List $R$ consists of ${m} consecutive integers, and list $T$ consists of ${n} consecutive integers. ${anchorText} ${
            ask === 'combined' ? 'How many different integers are in list $R$, list $T$, or both?' : 'How many integers are in both list $R$ and list $T$?'
          }`,
          choices,
          answer,
          explanation: `Place both lists on the number line, starting from the anchor the problem gives.

${why}${ask === 'combined' ? ` The number of different integers is $${m} + ${n} - ${overlap} = ${combined}$: the shared integers are counted once.` : ''}

Check: ${checkText}

Trap: ${cite.why(cite.value)}.

${ask === 'combined' ? 'For overlapping lists, count each list and subtract what is counted twice.' : 'Put the lists on a number line from the stated anchor, then count the integers they have in common.'}`,
        },
      };
    }
  },
  check(q, { m, n, anchor, ask }) {
    if (q.format !== 'mcs') return 'wrong format';
    // Build actual lists and count with sets.
    const R = Array.from({ length: m }, (_, i) => 1000 + i);
    const medR = R[(m - 1) / 2];
    const t0 = anchor === 'medR-minT' ? medR : anchor === 'medR-medT' ? medR - (n - 1) / 2 : R[m - 1] - (n - 1) / 2;
    const T = Array.from({ length: n }, (_, i) => t0 + i);
    if (anchor !== 'medR-minT' && medianByRank(T).toNumber() !== (anchor === 'medR-medT' ? medR : R[m - 1])) return 'bad construction';
    const setR = new Set(R);
    const both = T.filter((v) => setR.has(v)).length;
    const expected = ask === 'both' ? both : new Set([...R, ...T]).size;
    return q.choices[q.answer].text === `$${num(expected)}$` ? null : `expected ${expected}`;
  },
};

export const centerTemplates = [sumUpdate, whichValues, extremeValue, consecutiveLists];
