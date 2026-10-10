import { flaggedChoices, numericChoices, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num, usd } from '../../../engine/tex';
import type { Choice, Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { fTex, listTex, meanF, meanFracs, medianByRank, medianF, QC_WORDS, sortAsc, total } from './util';

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
        (d < 3 ? !m.isInt() : !m.mul(10).isInt() || m.isInt() === rng.chance(0.3))
      );
      const S = m.mul(n);
      const S2 = (n - 1) * m2;
      const avgOfMeans = m.mul(2).sub(m2);
      const wrongCount = m.sub(m2).mul(n);
      const traps = [
        { value: avgOfMeans, trap: 'stat-average-of-means' },
        { value: wrongCount, trap: 'stat-wrong-count' },
      ].filter((t) => !t.value.eq(x));
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
      } while (!money && x > 100);
      const avgOfMeans = 2 * t - m;
      const wrongCount = n * (t - m);
      const traps = [
        { value: frac(avgOfMeans), trap: 'stat-average-of-means' },
        { value: frac(wrongCount), trap: 'stat-wrong-count' },
      ].filter((tr) => !tr.value.eq(x));
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
    } while (p.sign() <= 0 || answer.sign() <= 0 || !answer.isTerminating() || answer.mul(100).d !== 1 || answer.eq(m));
    const avgOfMeans = m.mul(2).sub(p);
    const wrongCount = m.mul(n).sub(p.mul(k)).div(n);
    const traps = [
      { value: avgOfMeans, trap: 'stat-average-of-means' },
      { value: wrongCount, trap: 'stat-wrong-count' },
    ].filter((t) => !t.value.eq(answer));
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
 * 2. Mean vs median with an unknown member (QC)
 * =========================================================================================== */

type MMMode = 'determined' | 'above' | 'below' | 'middle';

interface MMParams {
  mode: MMMode;
  base: number[];
  /** determined: the given mean. */
  givenMean: number;
  /** Allowed integer values of x: lo < x < hi (null = unbounded). */
  lo: number | null;
  hi: number | null;
  /** Which side is the mean. */
  meanSide: 'A' | 'B';
  /** determined mode: compare the median with 'mean' or with 'x'. */
  other: 'mean' | 'x';
}

const meanMedianQC: Template<MMParams> = {
  id: 'data.center.mean-median-qc',
  skill: 'data.center',
  format: 'qc',
  style: 'mean versus median of a list with an unknown value',
  generate(rng, d) {
    const n = d === 3 ? rng.pick([5, 7]) : 5;
    const modes: MMMode[] = d === 1 ? ['determined', 'determined', 'above', 'below'] : ['determined', 'above', 'below', 'middle'];
    const mode = rng.pick(modes);
    const meanSide: 'A' | 'B' = rng.chance(0.5) ? 'A' : 'B';
    const mid = (n - 1) / 2; // number of base values on each side of the median slot

    if (mode === 'determined') {
      // The mean is given, which fixes x; compare the median with the mean (or with x).
      const target = rng.pick(['A', 'B', 'C', 'C'] as QCChoice[]);
      for (let tries = 0; ; tries++) {
        const base = sortAsc(rng.sample(Array.from({ length: 40 }, (_, i) => i + 2), n - 1));
        const M = rng.int(base[0] + 3, base[n - 2] - 2);
        const x = n * M - total(base);
        if (x < 1 || x > 60 || base.includes(x)) continue;
        const all = [...base, x];
        const med = medianF(all);
        const other = rng.chance(d === 1 ? 0.2 : 0.4) ? 'x' : 'mean';
        const B = other === 'mean' ? frac(M) : frac(x);
        const rel = med.cmp(B);
        const ans: QCChoice = meanSide === 'A' ? (rel > 0 ? 'B' : rel < 0 ? 'A' : 'C') : rel > 0 ? 'A' : rel < 0 ? 'B' : 'C';
        if (ans !== target && tries < 400) continue;
        // Show the list unsorted, x in the middle slot so that "the middle entry" is a trap.
        const shown = rng.shuffle(base);
        shown.splice(mid, 0, NaN);
        const listShown = shown.map((v) => (Number.isNaN(v) ? 'x' : num(v)));
        const middleAsWritten = shown[mid];
        void middleAsWritten;
        const sorted = sortAsc(all);
        const medTex = fTex(med);
        const qMedian = 'The median of the numbers';
        const qOther = other === 'mean' ? `$${M}$` : '$x$';
        const traps: QCQuestion['traps'] = {};
        // Trap: taking x (the middle entry as written) as the median.
        const slip = meanSide === 'A' ? frac(x).cmp(B) : B.cmp(frac(x));
        const slipAns: QCChoice = other === 'x' ? 'C' : meanSide === 'A' ? (slip > 0 ? 'B' : slip < 0 ? 'A' : 'C') : slip > 0 ? 'B' : slip < 0 ? 'A' : 'C';
        if (slipAns !== ans) traps[slipAns] = 'stat-median-unsorted';
        const A = meanSide === 'A' ? qOther : qMedian;
        const Bq = meanSide === 'A' ? qMedian : qOther;
        return {
          params: { mode, base, givenMean: M, lo: null, hi: null, meanSide, other },
          q: {
            format: 'qc',
            info: `The average (arithmetic mean) of the ${n} numbers $${listTex(listShown)}$ is $${M}$.`,
            quantityA: A,
            quantityB: Bq,
            answer: ans,
            traps: Object.keys(traps).length ? traps : undefined,
            explanation: `The ${n} numbers total $${n} \\times ${M} = ${n * M}$, so $x = ${n * M} - ${total(base)} = ${x}$.

In increasing order the list is $${listTex(sorted)}$, so the median is the middle value, $${medTex}$. (The middle entry of the list as written is not the median until the list is sorted.)

Compare the median, $${medTex}$, with ${other === 'mean' ? `the mean, $${M}$` : `$x = ${x}$`}: ${QC_WORDS[ans]}. (${ans})`,
          },
        };
      }
    }

    // Unknown x in a range: build a base list and an interval for x.
    for (let tries = 0; ; tries++) {
      const spread = d === 1 ? 30 : 45;
      const base = sortAsc(rng.sample(Array.from({ length: spread }, (_, i) => i + 1), n - 1));
      const S = total(base);
      let lo: number | null = null;
      let hi: number | null = null;
      let ans: QCChoice;
      let explanation: string;
      let natural: number; // the first value a student would try
      if (mode === 'above') {
        lo = base[n - 2] + rng.int(0, 4);
        natural = lo + 1;
        // median is fixed: base[mid] (x is the largest); mean = (S + x)/n increases without bound.
        const med = base[mid];
        const meanAtLo = new Frac(S + lo + 1, n);
        const meanGreater = meanAtLo.gt(med);
        const rel: QCChoice = meanGreater ? (meanSide === 'A' ? 'A' : 'B') : 'D';
        ans = rel;
        explanation = `Since $x > ${lo}$, $x$ is the greatest of the ${n} numbers, so the median is the middle number of the others in order: $${med}$, whatever $x$ is.

The mean is $\\dfrac{${S} + x}{${n}}$, which grows with $x$. ${
          meanGreater
            ? `Even for the smallest allowed value, $x = ${lo + 1}$, the mean is $${fTex(meanAtLo)}$, already greater than $${med}$. So the mean is always greater than the median.`
            : `For $x = ${lo + 1}$ the mean is $${fTex(meanAtLo)}$, ${meanAtLo.eq(med) ? 'equal to' : 'less than'} the median $${med}$; for a very large $x$ (say $x = ${num(1000)}$) the mean is far greater than $${med}$. The comparison depends on $x$.`
        }`;
      } else if (mode === 'below') {
        hi = base[0] - rng.int(0, 3);
        if (hi < 2) continue;
        natural = hi - 1;
        const med = base[mid - 1];
        const meanAtHi = new Frac(S + hi - 1, n);
        const meanLess = meanAtHi.lt(med);
        const lowBound = rng.chance(0.5) ? 0 : null;
        lo = lowBound;
        // With x >= 1 (x > 0) the mean is bounded below by (S + 1)/n.
        const meanAtLow = lo === null ? null : new Frac(S + lo + 1, n);
        let rel: QCChoice;
        if (meanLess) rel = meanSide === 'A' ? 'B' : 'A';
        else if (meanAtLow && meanAtLow.gt(med)) rel = meanSide === 'A' ? 'A' : 'B';
        else rel = 'D';
        if (meanAtLow && meanAtLow.lte?.(med)) void 0;
        ans = rel;
        const range = lo === null ? `$x < ${hi}$` : `$0 < x < ${hi}$`;
        explanation = `Since ${range}, $x$ is the least of the ${n} numbers, so the median is fixed: $${med}$.

The mean is $\\dfrac{${S} + x}{${n}}$, which shrinks as $x$ decreases. ${
          meanLess
            ? `Even for the largest allowed value, $x = ${hi - 1}$, the mean is $${fTex(meanAtHi)}$, less than $${med}$. So the mean is always less than the median.`
            : meanAtLow && meanAtLow.gt(med)
              ? `Even for the smallest allowed value, $x = 1$, the mean is $${fTex(meanAtLow)}$, greater than $${med}$. So the mean is always greater than the median.`
              : `For $x = ${hi - 1}$ the mean is $${fTex(meanAtHi)}$, ${meanAtHi.eq(med) ? 'equal to' : 'greater than'} the median $${med}$; but for ${lo === null ? `a very negative $x$ (say $x = -${num(1000)}$)` : '$x = 1$'} the mean is $${fTex(new Frac(S + (lo === null ? -1000 : 1), n))}$, ${new Frac(S + (lo === null ? -1000 : 1), n).lt(med) ? 'less than' : 'not less than'} $${med}$. The comparison depends on $x$.`
        }`;
        if (!meanLess && !(meanAtLow && meanAtLow.gt(med)) && lo !== null && !new Frac(S + 1, n).lt(med)) continue;
      } else {
        // middle: x lies strictly between the two middle base values, so x is the median.
        const a = base[mid - 1];
        const b = base[mid];
        if (b - a < 4) continue;
        lo = a + rng.int(0, Math.floor((b - a) / 3));
        hi = b - rng.int(0, Math.floor((b - a) / 3));
        if (hi - lo < 3) continue;
        natural = lo + 1;
        // mean - median = (S + x)/n - x = (S - (n - 1)x)/n: positive iff x < S/(n - 1).
        const crit = new Frac(S, n - 1);
        const allBelow = crit.gt(hi - 1);
        const allAbove = crit.lt(lo + 1);
        const rel: QCChoice = allBelow ? (meanSide === 'A' ? 'A' : 'B') : allAbove ? (meanSide === 'A' ? 'B' : 'A') : 'D';
        ans = rel;
        explanation = `Since $${lo} < x < ${hi}$, $x$ is the middle number in order, so the median is $x$ itself.

The mean is greater than the median exactly when $\\dfrac{${S} + x}{${n}} > x$, that is, when $${S} > ${n - 1}x$, or $x < ${fTex(crit)}$. ${
          allBelow
            ? `Every allowed $x$ (at most $${hi - 1}$) is less than $${fTex(crit)}$, so the mean is always greater.`
            : allAbove
              ? `Every allowed $x$ (at least $${lo + 1}$) is greater than $${fTex(crit)}$, so the mean is always less.`
              : `Some allowed values of $x$ are below $${fTex(crit)}$ and some are not (try $x = ${lo + 1}$ and $x = ${hi - 1}$), so the comparison depends on $x$.`
        }`;
      }
      // Answer mix: D about 45% of the unknown-x questions.
      if (tries < 300) {
        const want = rng.chance(0.45) ? 'D' : 'AB';
        if ((want === 'D') !== (ans === 'D')) continue;
      }
      // Trap: testing only the most natural value.
      const traps: QCQuestion['traps'] = {};
      if (ans === 'D') {
        const all = [...base, natural];
        const mean = meanF(all);
        const med = medianF(all);
        const r = mean.cmp(med);
        const slip: QCChoice = r === 0 ? 'C' : (r > 0) === (meanSide === 'A') ? 'A' : 'B';
        traps[slip] = 'stat-one-value-tested';
      } else traps.C = 'stat-mean-is-median';
      const cond =
        mode === 'above' ? `$x > ${lo}$` : mode === 'below' ? (lo === null ? `$x < ${hi}$` : `$0 < x < ${hi}$`) : `$${lo} < x < ${hi}$`;
      const shown = rng.shuffle([...base.map((v) => num(v)), 'x']);
      const qMean = 'The average (arithmetic mean) of the numbers';
      const qMed = 'The median of the numbers';
      return {
        params: { mode, base, givenMean: 0, lo, hi, meanSide, other: 'mean' },
        q: {
          format: 'qc',
          info: `$x$ is an integer such that ${cond}.

The list of numbers: $${listTex(shown)}$`,
          quantityA: meanSide === 'A' ? qMean : qMed,
          quantityB: meanSide === 'A' ? qMed : qMean,
          answer: ans,
          traps,
          explanation: `${explanation} (${ans})`,
        },
      };
    }
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    let expected: QCChoice;
    if (p.mode === 'determined') {
      // Solve for x by trying every candidate value.
      let x = NaN;
      for (let c = -500; c <= 500; c++) if (meanF([...p.base, c]).eq(p.givenMean)) x = c;
      const all = [...p.base, x];
      const med = medianByRank(all);
      const other = p.other === 'mean' ? meanF(all) : frac(x);
      expected = qcFromSamples([p.meanSide === 'A' ? [other, med] : [med, other]]);
    } else {
      const lo = p.lo ?? -100000;
      const hi = p.hi ?? 100000;
      const xs = new Set<number>([lo + 1, hi - 1, Math.floor((lo + hi) / 2)]);
      for (let i = 0; i < 300; i++) xs.add(rng.int(lo + 1, hi - 1));
      for (let v = lo + 1; v <= Math.min(hi - 1, lo + 200); v++) xs.add(v);
      for (let v = hi - 1; v >= Math.max(lo + 1, hi - 200); v--) xs.add(v);
      const samples: [Frac, Frac][] = [...xs].map((x) => {
        const all = [...p.base, x];
        const mean = meanF(all);
        const med = medianByRank(all);
        return p.meanSide === 'A' ? [mean, med] : [med, mean];
      });
      expected = qcFromSamples(samples);
    }
    return q.answer === expected ? null : `expected ${expected}`;
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
        // distractors: the old median slots, the mean of the base, values next to the solutions
        const cands = [frac(b[1]), frac(b[2]), meanF(b), ...sols.map((s) => s.add(1)), ...sols.map((s) => s.sub(1)), frac(b[3] + 1)].filter(
          (v) => v.isInt() && v.n >= 0 && !sols.some((s) => s.eq(v)),
        );
        const uniq = cands.filter((v, i) => cands.findIndex((w) => w.eq(v)) === i);
        if (uniq.length < 3) continue;
        const wrong = rng.sample(uniq, Math.min(uniq.length, rng.int(3, 4)));
        const values = [...sols, ...wrong].sort((x, y) => x.cmp(y));
        const meanOfBase = meanF(b);
        const { choices, answer } = flaggedChoices(
          values.map((v) => ({
            text: `$${fTex(v)}$`,
            correct: sols.some((s) => s.eq(v)),
            ...(v.eq(meanOfBase) && !sols.some((s) => s.eq(v)) ? { trap: 'stat-only-one-case' } : {}),
          })),
        );
        const S = total(b);
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

So $x$ can be ${sols.map((s) => `$${fTex(s)}$`).join(', ').replace(/, ([^,]*)$/, ' or $1')}. Solving only one case finds just one of them.`,
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
      // Candidate values around the boundary.
      const pivot = sol.lo ?? sol.hi!;
      const cands: Frac[] = [];
      for (let delta = -9; delta <= 9; delta++) cands.push(pivot.add(delta));
      cands.push(m, frac(b[0]), frac(b[N - 2]), pivot.add(14), pivot.sub(14));
      const pool = cands.filter((v, i) => v.sign() > 0 && cands.findIndex((w) => w.eq(v)) === i);
      const good = pool.filter((v) => inInterval(v, sol));
      const bad = pool.filter((v) => !inInterval(v, sol));
      if (!good.length || bad.length < 3) continue;
      const nGood = sol.lo !== null && sol.hi !== null ? 1 : rng.int(2, Math.min(3, good.length));
      const pickGood = rng.sample(good, Math.min(nGood, good.length));
      // make sure the boundary itself (or the single solution) is often included, and m tested
      if (!pickGood.some((v) => v.eq(pivot)) && rng.chance(0.6)) pickGood[0] = pivot;
      const badNear = bad.filter((v) => Math.abs(v.sub(pivot).toNumber()) <= 4);
      const mIsBad = bad.some((v) => v.eq(m));
      const nBad = rng.int(3, d === 1 ? 3 : 4);
      const pickBad: Frac[] = [];
      if (mIsBad) pickBad.push(m);
      for (const v of rng.shuffle(badNear)) if (pickBad.length < nBad && !pickBad.some((w) => w.eq(v))) pickBad.push(v);
      for (const v of rng.shuffle(bad)) if (pickBad.length < nBad && !pickBad.some((w) => w.eq(v))) pickBad.push(v);
      const values = [...pickGood, ...pickBad].filter((v, i, arr) => arr.findIndex((w) => w.eq(v)) === i).sort((x, y) => x.cmp(y));
      if (values.length < 4 || !values.some((v) => !inInterval(v, sol))) continue;
      const items: (Choice & { correct: boolean })[] = values.map((v) => ({
        text: `$${fTex(v)}$`,
        correct: inInterval(v, sol),
        ...(!inInterval(v, sol) && v.eq(m) ? { trap: 'stat-median-is-x' } : {}),
      }));
      const { choices, answer } = flaggedChoices(items);
      const shown = rng.shuffle([...b.map((v) => num(v)), 'x']);
      let reason: string;
      if (N % 2 === 1) {
        const k = (N - 1) / 2;
        reason = `In order, the ${N - 1} known numbers are $${listTex(b)}$. With $x$ added there are ${N} numbers, and the median is the ${k + 1}th of them. Wherever $x$ goes, the median is $${b[k - 1]}$ if $x \\le ${b[k - 1]}$, $x$ itself if $${b[k - 1]} \\le x \\le ${b[k]}$, and $${b[k]}$ if $x \\ge ${b[k]}$.`;
      } else {
        const k = N / 2;
        reason = `In order, the ${N - 1} known numbers are $${listTex(b)}$. With $x$ there are ${N} numbers, so the median is the average of the ${k}th and ${k + 1}th. The ${k}th or ${k + 1}th is always $${b[k - 1]}$; the other middle number is $${b[k - 2]}$ if $x \\le ${b[k - 2]}$, $x$ if $${b[k - 2]} \\le x \\le ${b[k]}$, and $${b[k]}$ if $x \\ge ${b[k]}$. A median of $${fTex(m)}$ needs that other middle number to be $2 \\times ${fTex(m)} - ${b[k - 1]} = ${fTex(m.mul(2).sub(b[k - 1]))}$.`;
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

${solText}${mIsBad && values.some((v) => v.eq(m)) ? ` Note that $x = ${fTex(m)}$ does not work: the median is the middle value of the ordered list, not necessarily $x$.` : ''}`,
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
 * 4. Greatest / least possible value given the average and the median (MCS)
 * =========================================================================================== */

type ExtremeAsk = 'max-largest' | 'min-largest' | 'max-smallest';

interface ExtremeParams {
  M: number;
  D: number;
  distinct: boolean;
  ask: ExtremeAsk;
}

/** Closed-form answer (n = 5 positive integers a <= b <= D <= d <= e). */
function extremeFormula(M: number, D: number, distinct: boolean, ask: ExtremeAsk): number | null {
  const S = 5 * M;
  if (ask === 'max-largest') {
    const others = distinct ? 1 + 2 + D + (D + 1) : 1 + 1 + D + D;
    const e = S - others;
    return e >= (distinct ? D + 2 : D) ? e : null;
  }
  if (ask === 'min-largest') {
    const low = distinct ? D - 2 + (D - 1) : 2 * D;
    if (distinct && D < 3) return null;
    const T = S - D - low; // d + e
    const e = distinct ? Math.max(Math.floor(T / 2) + 1, D + 2) : Math.max(Math.ceil(T / 2), D);
    // need the rest to fit: d = T - e must be >= D (or D + 1)
    const dd = T - e;
    if (dd < (distinct ? D + 1 : D)) return null;
    return e;
  }
  // max-smallest: d, e minimal; a <= b <= D
  const up = distinct ? D + 1 + (D + 2) : 2 * D;
  const T = S - D - up; // a + b
  const a = distinct ? Math.min(Math.floor((T - 1) / 2), D - 2) : Math.min(Math.floor(T / 2), D);
  if (a < 1) return null;
  // b = T - a must satisfy a <= b <= D (or a < b < D)
  const b = T - a;
  if (distinct ? !(a < b && b < D) : !(a <= b && b <= D)) return null;
  return a;
}

const extremeValue: Template<ExtremeParams> = {
  id: 'data.center.extreme-value',
  skill: 'data.center',
  format: 'mcs',
  style: 'greatest or least possible value given the average and the median',
  generate(rng, d) {
    const asks: ExtremeAsk[] = d === 1 ? ['max-largest'] : d === 2 ? ['max-largest', 'min-largest'] : ['min-largest', 'max-smallest', 'max-largest'];
    for (;;) {
      const ask = rng.pick(asks);
      const distinct = d === 1 ? false : d === 2 ? rng.chance(0.5) : rng.chance(0.6);
      const D = rng.int(d === 1 ? 6 : 8, d === 3 ? 30 : 20);
      const M = ask === 'min-largest' ? D + rng.int(1, d === 3 ? 8 : 5) : rng.int(Math.max(4, D - 3), D + 10);
      const ans = extremeFormula(M, D, distinct, ask);
      if (ans === null) continue;
      const S = 5 * M;
      const traps: { value: number; trap: string }[] = [];
      if (ask === 'max-largest') {
        traps.push({ value: S - (1 + 1 + D + 1), trap: 'stat-extreme-order' });
        traps.push({ value: S - (0 + 0 + D + D), trap: 'stat-extreme-zero' });
        traps.push({ value: distinct ? S - (1 + 1 + D + D) : S - (1 + 2 + D + D + 1), trap: 'stat-extreme-distinct' });
        traps.push({ value: S - D, trap: 'stat-extreme-order' });
      } else if (ask === 'min-largest') {
        const alt = extremeFormula(M, D, !distinct, ask);
        if (alt !== null) traps.push({ value: alt, trap: 'stat-extreme-distinct' });
        traps.push({ value: S - 4 * D, trap: 'stat-extreme-order' });
        traps.push({ value: M, trap: 'stat-extreme-order' });
      } else {
        const alt = extremeFormula(M, D, !distinct, ask);
        if (alt !== null) traps.push({ value: alt, trap: 'stat-extreme-distinct' });
        traps.push({ value: Math.floor((S - D) / 4), trap: 'stat-extreme-order' });
        traps.push({ value: D, trap: 'stat-extreme-order' });
      }
      const usable = traps.filter((t) => t.value > 0 && t.value !== ans);
      const fillers = [ans + 1, ans - 1, ans + 2, ans - 2, ans + 3].filter((v) => v > 0);
      let built;
      try {
        built = numericChoices(rng, {
          correct: ans,
          traps: usable.map((t) => ({ value: t.value, trap: t.trap })),
          fillers,
          format: (v) => `$${fTex(v)}$`,
        });
      } catch {
        continue;
      }
      const what = ask === 'max-largest' ? 'greatest possible value of the largest' : ask === 'min-largest' ? 'least possible value of the largest' : 'greatest possible value of the smallest';
      const kind = distinct ? 'different positive integers' : 'positive integers';
      let expl: string;
      if (ask === 'max-largest') {
        const o = distinct ? [1, 2, D, D + 1] : [1, 1, D, D];
        expl = `Write the integers in order as $a \\le b \\le ${D} \\le d \\le e$${distinct ? ' (all different)' : ''}. Their sum is $5 \\times ${M} = ${S}$.

To make $e$ as large as possible, make the others as small as possible: $a$ and $b$ ${distinct ? 'are at least 1 and 2' : 'are at least 1'}, and $d$, which is at or above the median, is at least $${o[3]}$. Then $e = ${S} - (${o.join(' + ')}) = ${ans}$.

The value above the median cannot be made 1: it must be at least the median.`;
      } else if (ask === 'min-largest') {
        const low = distinct ? [D - 2, D - 1] : [D, D];
        const T = S - D - low[0] - low[1];
        expl = `Write the integers in order as $a \\le b \\le ${D} \\le d \\le e$${distinct ? ' (all different)' : ''}, with sum $5 \\times ${M} = ${S}$.

To make $e$ as small as possible, make the others as large as possible. $a$ and $b$ can be at most $${low[0]}$ and $${low[1]}$, so $d + e \\ge ${S} - ${D} - ${low[0]} - ${low[1]} = ${T}$. Since $d ${distinct ? '<' : '\\le'} e$, $e$ is at least ${distinct ? `the least integer greater than half of ${T}` : `half of ${T}`}: $e = ${ans}$ (with $d = ${T - ans}$).`;
      } else {
        const up = distinct ? [D + 1, D + 2] : [D, D];
        const T = S - D - up[0] - up[1];
        expl = `Write the integers in order as $a \\le b \\le ${D} \\le d \\le e$${distinct ? ' (all different)' : ''}, with sum $5 \\times ${M} = ${S}$.

To make $a$ as large as possible, make $d$ and $e$ as small as possible: $${up[0]}$ and $${up[1]}$. Then $a + b = ${S} - ${D} - ${up[0]} - ${up[1]} = ${T}$, and since $a ${distinct ? '<' : '\\le'} b ${distinct ? '<' : '\\le'} ${D}$, the greatest possible $a$ is $${ans}$ (with $b = ${T - ans}$).`;
      }
      return {
        params: { M, D, distinct, ask },
        q: {
          format: 'mcs',
          stem: `A list consists of 5 ${kind}. The average (arithmetic mean) of the 5 integers is $${M}$, and their median is $${D}$. What is the ${what} integer in the list?`,
          choices: built.choices,
          answer: built.answer,
          explanation: expl,
        },
      };
    }
  },
  check(q, { M, D, distinct, ask }) {
    if (q.format !== 'mcs') return 'wrong format';
    // Brute force over every sorted list a <= b <= D <= d <= e of positive integers with sum 5M.
    const S = 5 * M;
    let best: number | null = null;
    for (let a = 1; a <= D; a++)
      for (let b = a; b <= D; b++)
        for (let dd = D; dd <= S; dd++) {
          const e = S - a - b - D - dd;
          if (e < dd) break;
          if (distinct && !(a < b && b < D && D < dd && dd < e)) continue;
          const v = ask === 'max-smallest' ? a : e;
          if (best === null) best = v;
          else best = ask === 'min-largest' ? Math.min(best, v) : Math.max(best, v);
        }
    if (best === null) return 'no list satisfies the conditions';
    return q.choices[q.answer].text === `$${num(best)}$` ? null : `expected ${best}`;
  },
};

export const centerTemplates = [sumUpdate, meanMedianQC, whichValues, extremeValue];
