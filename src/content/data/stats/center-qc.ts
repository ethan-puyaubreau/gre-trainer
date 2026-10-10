import { qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num, usd } from '../../../engine/tex';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { fTex, listTex, meanF, medianByRank, medianF, medianNum, QC_WORDS, sortAsc, total } from './util';

/** QC answer when Quantity A is `a` and Quantity B is `b`. */
const rel = (a: Frac | number, b: Frac | number): QCChoice => qcFromSamples([[a, b]]);
/** Swap A and B in a QC answer. */
const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);

/* =============================================================================================
 * Mean versus median when some values are unknown (QC)
 *  - determined: the mean is given, which fixes x
 *  - gap: x has a few possible integer values (book: three possibilities in the middle gap)
 *  - above / middle: x in an open range, mean vs median
 *  - signs: n negative and m positive numbers, nothing else known
 *  - threshold: total given (so the mean is known) and more than half are below a threshold
 * =========================================================================================== */

type MMMode = 'determined' | 'gap' | 'above' | 'middle' | 'signs' | 'threshold';

interface MMParams {
  mode: MMMode;
  base: number[];
  /** determined: the stated mean. */
  givenMean: number;
  /** x is an integer with lo < x < hi (null = unbounded). */
  lo: number | null;
  hi: number | null;
  /** Which quantity holds the "first" statistic (mean, or median for gap/signs). */
  side: 'A' | 'B';
  /** determined: compare the median with 'mean' or 'x'. gap: Quantity B number in bValue. */
  other: 'mean' | 'x';
  bValue: number;
  /** signs mode. */
  nNeg: number;
  nPos: number;
  signsAsk: 'mean-median' | 'median-zero';
  /** threshold mode: n values, total T, more than half below K. */
  n: number;
  T: number;
  K: number;
}

const MM_MODES: Record<Difficulty, MMMode[]> = {
  1: ['determined', 'determined', 'gap', 'gap', 'above'],
  2: ['gap', 'gap', 'threshold', 'threshold', 'determined', 'middle', 'signs'],
  3: ['signs', 'threshold', 'threshold', 'middle', 'gap', 'gap', 'determined'],
};

const NO_MM = { base: [], givenMean: 0, lo: null, hi: null, other: 'mean' as const, bValue: 0, nNeg: 0, nPos: 0, signsAsk: 'mean-median' as const, n: 0, T: 0, K: 0 };

const relWord = (a: Frac, b: Frac | number) => (a.gt(b) ? 'greater than' : a.lt(b) ? 'less than' : 'equal to');

const meanMedianQC: Template<MMParams> = {
  id: 'data.center.mean-median-qc',
  skill: 'data.center',
  format: 'qc',
  style: 'mean versus median when a value is unknown',
  generate(rng, d) {
    const mode = rng.pick(MM_MODES[d]);
    const side: 'A' | 'B' = rng.chance(0.5) ? 'A' : 'B';
    const qMean = 'The average (arithmetic mean) of the numbers';
    const qMed = 'The median of the numbers';

    /* ------------------------------------------------------------ determined */
    if (mode === 'determined') {
      const target = rng.pick(['A', 'B', 'C', 'C'] as QCChoice[]);
      for (let tries = 0; ; tries++) {
        const base = sortAsc(rng.sample(Array.from({ length: 40 }, (_, i) => i + 2), 4));
        if (base[3] - base[0] < 6) continue;
        const M = rng.int(base[0] + 3, base[3] - 2);
        const x = 5 * M - total(base);
        if (x < 1 || x > 60 || base.includes(x)) continue;
        const all = [...base, x];
        const med = medianF(all);
        const other = rng.chance(d === 1 ? 0.25 : 0.4) ? 'x' : 'mean';
        const B = frac(other === 'mean' ? M : x);
        const ans = side === 'A' ? rel(B, med) : rel(med, B);
        if (ans !== target && tries < 400) continue;
        // x sits in the middle of the list as written: "the middle entry" is a trap.
        const shown: string[] = rng.shuffle(base).map((v) => num(v));
        shown.splice(2, 0, 'x');
        const qOther = other === 'mean' ? `$${M}$` : '$x$';
        const slip = side === 'A' ? rel(B, x) : rel(x, B);
        const traps: QCQuestion['traps'] = slip !== ans ? { [slip]: 'stat-median-unsorted' } : undefined;
        return {
          params: { ...NO_MM, mode, base, givenMean: M, side, other },
          q: {
            format: 'qc',
            info: `The average (arithmetic mean) of the 5 numbers $${listTex(shown)}$ is $${M}$.`,
            quantityA: side === 'A' ? qOther : qMed,
            quantityB: side === 'A' ? qMed : qOther,
            answer: ans,
            traps,
            explanation: `The 5 numbers total $5 \\times ${M} = ${5 * M}$, so $x = ${5 * M} - ${total(base)} = ${x}$.

In increasing order the numbers are $${listTex(sortAsc(all))}$, so the median is $${fTex(med)}$. (The entry written in the middle, $x$, is the median only if the list is already in order.)

Compare $${fTex(med)}$ with ${other === 'mean' ? `the mean, $${M}$` : `$x = ${x}$`}: ${QC_WORDS[ans]}. (${ans})`,
          },
        };
      }
    }

    /* ------------------------------------------------------------ gap (book: three possibilities) */
    if (mode === 'gap') {
      for (;;) {
        const base = sortAsc(rng.sample(Array.from({ length: 36 }, (_, i) => i + 1), 4));
        const [b0, b1, b2, b3] = base;
        const inGap = rng.chance(0.4);
        let lo: number;
        let hi: number | null;
        if (inGap) {
          // three possibilities inside the middle gap: the median is x itself
          if (b2 - b1 < 4) continue;
          lo = rng.int(b1, b2 - 4);
          hi = lo + 4;
        } else if (rng.chance(0.5)) {
          // x beyond the top: the median is fixed at b2
          lo = rng.int(b2, b3 + 3);
          hi = rng.chance(0.5) ? lo + 4 : null;
        } else {
          if (b1 < 6) continue;
          hi = rng.int(Math.max(5, b0 - 2), b1);
          lo = hi - 4;
          if (lo < 0) continue;
        }
        const poss = hi === null ? null : [lo + 1, lo + 2, lo + 3];
        // Quantity B: the middle possibility (book), or a nearby number for the one-sided cases.
        let bValue: number;
        if (inGap) bValue = lo + 2;
        else {
          const fixedMed = lo >= b2 ? b2 : b1;
          bValue = rng.pick([fixedMed, fixedMed, fixedMed + rng.int(1, 3), fixedMed - rng.int(1, 3), lo + 1 + (hi === null ? 0 : 1)]);
        }
        const medians = (hi === null ? [lo + 1, lo + 2, lo + 50] : poss!).map((x) => medianF([...base, x]));
        const set = new Set(medians.map((m) => m.cmp(bValue)));
        const ansA: QCChoice = set.size > 1 ? 'D' : rel(medians[0], bValue);
        const ans = side === 'A' ? ansA : flip(ansA);
        const traps: QCQuestion['traps'] = {};
        if (ans === 'D') traps.C = 'stat-one-value-tested';
        else if (bValue === lo + 1 + (hi === null ? 0 : 1) && ans !== 'C') traps.C = 'stat-median-is-x';
        const cond = hi === null ? `$x > ${lo}$` : `$${lo} < x < ${hi}$`;
        const shown = rng.shuffle([...base.map((v) => num(v)), 'x']);
        const fixedMed = lo >= b2 ? b2 : b1;
        const reason = inGap
          ? `$x$ can be $${poss!.join('$, $')}$. Each of these lies between $${b1}$ and $${b2}$, so in increasing order $x$ is the middle number and the median is $x$ itself: the median can be $${poss!.join('$, $')}$, which is less than, equal to, or greater than $${bValue}$.`
          : `Since ${cond}, $x$ is ${lo >= b2 ? `greater than $${b2}$` : `less than $${b1}$`}, so in increasing order the middle number is always $${fixedMed}$: the median is $${fixedMed}$ for every allowed $x$. Compare $${fixedMed}$ with $${bValue}$.`;
        return {
          params: { ...NO_MM, mode, base, lo, hi, side, bValue },
          q: {
            format: 'qc',
            info: `$x$ is an integer such that ${cond}.`,
            quantityA: side === 'A' ? `The median of the 5 numbers $${listTex(shown)}$` : `$${bValue}$`,
            quantityB: side === 'A' ? `$${bValue}$` : `The median of the 5 numbers $${listTex(shown)}$`,
            answer: ans,
            traps: Object.keys(traps).length ? traps : undefined,
            explanation: `In increasing order the known numbers are $${listTex(base)}$. ${reason} (${ans})`,
          },
        };
      }
    }

    /* ------------------------------------------------------------ above / middle (x in a range) */
    if (mode === 'above' || mode === 'middle') {
      for (let tries = 0; ; tries++) {
        const base = sortAsc(rng.sample(Array.from({ length: d === 1 ? 30 : 45 }, (_, i) => i + 1), 4));
        const S = total(base);
        let lo: number;
        let hi: number | null;
        let ansMean: QCChoice; // mean vs median
        let explanation: string;
        let natural: number;
        if (mode === 'above') {
          lo = base[3] + rng.int(0, 4);
          hi = null;
          natural = lo + 1;
          const med = base[2];
          const meanAtLo = new Frac(S + lo + 1, 5);
          ansMean = meanAtLo.gt(med) ? 'A' : 'D';
          explanation = `Since $x > ${lo}$, $x$ is the greatest of the 5 numbers, so the median is $${med}$ for every allowed $x$.

The mean, $\\dfrac{${S} + x}{5}$, grows with $x$. ${
            ansMean === 'A'
              ? `Even for the least allowed value, $x = ${lo + 1}$, the mean is $${fTex(meanAtLo)}$, already greater than $${med}$, so the mean is always greater.`
              : `For $x = ${lo + 1}$ the mean is $${fTex(meanAtLo)}$, ${relWord(meanAtLo, med)} the median; for a large $x$ such as $${num(1000)}$, the mean is far greater than $${med}$. The comparison depends on $x$.`
          }`;
        } else {
          const [, b1, b2] = base;
          if (b2 - b1 < 6) continue;
          lo = b1 + rng.int(0, Math.floor((b2 - b1) / 3));
          hi = b2 - rng.int(0, Math.floor((b2 - b1) / 3));
          if (hi - lo < 4) continue;
          natural = lo + 1;
          // mean - median = (S + x)/5 - x > 0  <=>  x < S/4
          const crit = new Frac(S, 4);
          const below = crit.gt(hi - 1);
          const above = crit.lt(lo + 1);
          ansMean = below ? 'A' : above ? 'B' : 'D';
          explanation = `Since $${lo} < x < ${hi}$, $x$ falls between $${b1}$ and $${b2}$, so it is the middle number and the median is $x$ itself.

The mean is greater than the median when $\\dfrac{${S} + x}{5} > x$, that is, when $${S} > 4x$, or $x < ${fTex(crit)}$. ${
            below
              ? `Every allowed $x$ (at most $${hi - 1}$) is less than $${fTex(crit)}$, so the mean is always greater.`
              : above
                ? `Every allowed $x$ (at least $${lo + 1}$) is greater than $${fTex(crit)}$, so the mean is always less.`
                : `$x = ${lo + 1}$ and $x = ${hi - 1}$ fall on different sides of $${fTex(crit)}$ (or on it), so the comparison depends on $x$.`
          }`;
        }
        if (tries < 200 && (ansMean === 'D') !== rng.chance(0.3)) continue;
        const ans = side === 'A' ? ansMean : flip(ansMean);
        const traps: QCQuestion['traps'] = {};
        if (ans === 'D') {
          const all = [...base, natural];
          const r = side === 'A' ? rel(meanF(all), medianF(all)) : rel(medianF(all), meanF(all));
          traps[r] = 'stat-one-value-tested';
        } else traps.C = 'stat-mean-is-median';
        const cond = hi === null ? `$x > ${lo}$` : `$${lo} < x < ${hi}$`;
        const shown = rng.shuffle([...base.map((v) => num(v)), 'x']);
        return {
          params: { ...NO_MM, mode, base, lo, hi, side },
          q: {
            format: 'qc',
            info: `$$${listTex(shown)}$$

In the list above, $x$ is an integer and ${cond}.`,
            quantityA: side === 'A' ? qMean : qMed,
            quantityB: side === 'A' ? qMed : qMean,
            answer: ans,
            traps,
            explanation: `${explanation} (${ans})`,
          },
        };
      }
    }

    /* ------------------------------------------------------------ signs (book: n negative, n positive) */
    if (mode === 'signs') {
      const ask: MMParams['signsAsk'] = rng.chance(0.5) ? 'mean-median' : 'median-zero';
      let nNeg: number;
      let nPos: number;
      if (ask === 'mean-median') {
        nNeg = rng.int(2, 6);
        nPos = rng.chance(0.6) ? nNeg : nNeg + rng.sign();
      } else {
        nNeg = rng.int(2, 6);
        const r = rng.next();
        nPos = r < 0.35 ? nNeg + 1 : r < 0.7 ? nNeg - 1 : r < 0.85 ? nNeg : nNeg - 2;
        if (nPos < 1) nPos = nNeg + 1;
      }
      const N = nNeg + nPos;
      let ansA: QCChoice; // first statistic (mean, or median) vs second (median, or 0)
      let why: string;
      if (ask === 'mean-median') {
        ansA = 'D';
        const ex1 = [...Array(nNeg).fill(-1), ...Array(nPos).fill(1)];
        ex1[ex1.length - 1] = 100;
        const ex2 = [...Array(nNeg).fill(-1), ...Array(nPos).fill(1)];
        ex2[0] = -100;
        why = `Try examples. If the negative numbers are all $-1$ and the positive numbers are $1$ except one that is $100$, the mean is $${fTex(meanF(ex1))}$ and the median is $${fTex(medianF(ex1))}$: the mean is greater. If instead one negative number is $-100$ and the rest are $\\pm 1$, the mean is $${fTex(meanF(ex2))}$ and the median is $${fTex(medianF(ex2))}$: the mean is less. The mean depends on the sizes of the numbers; only their signs are known.`;
      } else {
        // The middle position(s) in increasing order: negatives come first.
        const lowMid = N % 2 ? (N + 1) / 2 : N / 2;
        const highMid = N % 2 ? (N + 1) / 2 : N / 2 + 1;
        if (highMid <= nNeg) {
          ansA = 'B';
          why = `In increasing order the ${nNeg} negative numbers come first. The median is ${N % 2 ? `the ${ordinalWord(lowMid)} number` : `the average of the ${ordinalWord(lowMid)} and ${ordinalWord(highMid)} numbers`}, and ${N % 2 ? 'it is' : 'both are'} negative, so the median is negative.`;
        } else if (lowMid > nNeg) {
          ansA = 'A';
          why = `In increasing order the ${nNeg} negative numbers come first, followed by the ${nPos} positive ones. The median is ${N % 2 ? `the ${ordinalWord(lowMid)} number` : `the average of the ${ordinalWord(lowMid)} and ${ordinalWord(highMid)} numbers`}, and ${N % 2 ? 'it is' : 'both are'} positive, so the median is positive.`;
        } else {
          ansA = 'D';
          why = `In increasing order the median is the average of the ${ordinalWord(lowMid)} number (the greatest negative number) and the ${ordinalWord(highMid)} number (the least positive number). With $-1$ and $5$ the median is $2$; with $-5$ and $1$ it is $-2$. The sign of the median depends on the numbers.`;
        }
      }
      const ans = side === 'A' ? ansA : flip(ansA);
      const traps: QCQuestion['traps'] = {};
      if (ans === 'D') traps.C = ask === 'mean-median' ? 'stat-mean-is-median' : 'stat-one-value-tested';
      else traps.D = 'stat-median-position';
      const first = ask === 'mean-median' ? 'The average (arithmetic mean) of the numbers in the list' : 'The median of the numbers in the list';
      const second = ask === 'mean-median' ? 'The median of the numbers in the list' : '$0$';
      return {
        params: { ...NO_MM, mode, side, nNeg, nPos, signsAsk: ask },
        q: {
          format: 'qc',
          info: `A list consists of ${N} numbers: ${nNeg} negative numbers and ${nPos} positive number${nPos === 1 ? '' : 's'}.`,
          quantityA: side === 'A' ? first : second,
          quantityB: side === 'A' ? second : first,
          answer: ans,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `${why} (${ans})`,
        },
      };
    }

    /* ------------------------------------------------------------ threshold (book: totals and "more than half") */
    const n = rng.pick([7, 8, 9, 10, 12]);
    const meanK = rng.int(36, 84); // mean in thousands
    const T = n * meanK * 1000;
    const r = rng.next();
    const K = 1000 * (r < 0.55 ? meanK - rng.int(2, 12) : r < 0.7 ? meanK : meanK + rng.int(2, 12));
    const mean = meanK * 1000;
    const ansA: QCChoice = K <= mean ? 'A' : 'D';
    const ans = side === 'A' ? ansA : flip(ansA);
    const traps: QCQuestion['traps'] = ans === 'D' ? { [side === 'A' ? 'A' : 'B']: 'stat-threshold' } : { C: 'stat-mean-is-median' };
    const why =
      K <= mean
        ? `More than half of the salaries are less than ${usd(K)}, so the middle salary (or both middle salaries) in increasing order is less than ${usd(K)}: the median is less than ${usd(K)}, which is ${K === mean ? 'equal to' : 'less than'} the mean. So the mean is greater than the median.`
        : `The median is less than ${usd(K)}, but so is the mean, so that fact does not settle the comparison. For instance, the salaries could be nearly equal except one that is very small (median greater than the mean), or one very large salary could pull the mean above every other salary (median less than the mean).`;
    return {
      params: { ...NO_MM, mode, side, n, T, K },
      q: {
        format: 'qc',
        info: `The total of the annual salaries of the ${n} employees of a company is ${usd(T)}. More than half of the employees have annual salaries less than ${usd(K)}.`,
        quantityA: side === 'A' ? 'The average (arithmetic mean) of the annual salaries' : 'The median of the annual salaries',
        quantityB: side === 'A' ? 'The median of the annual salaries' : 'The average (arithmetic mean) of the annual salaries',
        answer: ans,
        traps,
        explanation: `The mean is the total divided by the number of employees: ${usd(T)} divided by ${n} is ${usd(mean)}.

${why} (${ans})`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const order = (a: Frac | number, b: Frac | number): [Frac | number, Frac | number] => (p.side === 'A' ? [a, b] : [b, a]);
    let expected: QCChoice;
    switch (p.mode) {
      case 'determined': {
        let x = NaN;
        for (let c = -100; c <= 200; c++) if (total(p.base) + c === p.givenMean * (p.base.length + 1)) x = c;
        const all = [...p.base, x];
        const med = medianByRank(all);
        expected = qcFromSamples([order(p.other === 'mean' ? meanF(all) : frac(x), med)]);
        break;
      }
      case 'gap': {
        const hi = p.hi ?? (p.lo as number) + 400;
        const xs: number[] = [];
        for (let x = (p.lo as number) + 1; x < hi; x++) xs.push(x);
        expected = qcFromSamples(xs.map((x) => order(medianByRank([...p.base, x]), p.bValue)));
        break;
      }
      case 'above':
      case 'middle': {
        const lo = p.lo as number;
        const hi = p.hi ?? lo + 100000;
        const xs = new Set<number>([lo + 1, hi - 1]);
        for (let i = 0; i < 300; i++) xs.add(rng.int(lo + 1, hi - 1));
        for (let v = lo + 1; v <= Math.min(hi - 1, lo + 100); v++) xs.add(v);
        expected = qcFromSamples([...xs].map((x) => order(meanF([...p.base, x]), medianByRank([...p.base, x]))));
        break;
      }
      case 'signs': {
        // Random lists with the stated signs, at many different scales.
        const samples: [number, number][] = [];
        const seen = new Set<string>();
        for (let i = 0; i < 400 && seen.size < 2; i++) {
          const sNeg = 10 ** rng.int(-2, 3);
          const sPos = 10 ** rng.int(-2, 3);
          const xs = [
            ...Array.from({ length: p.nNeg }, () => -(rng.next() + 0.001) * sNeg),
            ...Array.from({ length: p.nPos }, () => (rng.next() + 0.001) * sPos),
          ];
          const mean = xs.reduce((s, v) => s + v, 0) / xs.length;
          const med = medianNum(xs);
          const sample = (p.signsAsk === 'mean-median' ? order(mean, med) : order(med, 0)) as [number, number];
          samples.push(sample);
          seen.add(qcFromSamples([sample]));
        }
        expected = qcFromSamples(samples);
        break;
      }
      case 'threshold': {
        const samples: [number, number][] = [];
        const mean = p.T / p.n;
        const seen = new Set<string>();
        for (let i = 0; i < 2000 && samples.length < 150 && seen.size < 2; i++) {
          // two-level and random data sets, rescaled to the stated total
          const k = rng.int(1, p.n - 1);
          const ratio = 10 ** (rng.next() * 3 - 1.5);
          const raw = Array.from({ length: p.n }, (_, j) => (rng.chance(0.5) ? (j < k ? 1 : ratio) : rng.next() + 0.01));
          const s = raw.reduce((a, b) => a + b, 0);
          const xs = raw.map((v) => (v * p.T) / s);
          if (xs.filter((v) => v < p.K).length * 2 <= p.n) continue;
          const sample = order(mean, medianNum(xs)) as [number, number];
          samples.push(sample);
          seen.add(qcFromSamples([sample]));
        }
        if (samples.length < 20 && seen.size < 2) return 'too few valid samples';
        expected = qcFromSamples(samples);
        break;
      }
    }
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

function ordinalWord(n: number): string {
  return ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'][n] ?? `${n}th`;
}

/* =============================================================================================
 * Reason with totals (QC)
 *  - rest: the average of the remaining values vs the overall average (book DA-06)
 *  - spaced: sum of an evenly spaced list vs n x median (book DA-08)
 *  - same-mean: adding a value that leaves the average unchanged (book DA-24)
 * =========================================================================================== */

type TotMode = 'rest' | 'spaced' | 'same-mean';

interface TotParams {
  mode: TotMode;
  side: 'A' | 'B';
  /** rest: n values with mean M, the known values. */
  n: number;
  M: number;
  known: number[];
  /** spaced: the list itself. */
  list: number[];
  /** same-mean: list X = (a, b, s, t), Y = (a, b, t); compare s with `against`. t fixed when tGiven. */
  a: number;
  b: number;
  tGiven: number | null;
  against: 'zero' | 't' | 'meanY' | 'number';
  num: number;
}

const NO_TOT = { n: 0, M: 0, known: [], list: [], a: 0, b: 0, tGiven: null, against: 'zero' as const, num: 0 };

const totalsQC: Template<TotParams> = {
  id: 'data.center.totals-qc',
  skill: 'data.center',
  format: 'qc',
  style: 'compare using totals: leftover averages, sums versus n × median',
  generate(rng, d) {
    const mode = rng.pick<TotMode>(d === 1 ? ['rest', 'rest', 'spaced'] : d === 2 ? ['rest', 'spaced', 'same-mean'] : ['same-mean', 'same-mean', 'rest', 'spaced']);
    const side: 'A' | 'B' = rng.chance(0.5) ? 'A' : 'B';

    if (mode === 'rest') {
      const n = rng.int(d === 1 ? 5 : 6, d === 3 ? 15 : 10);
      const k = d === 3 ? rng.int(2, 3) : 2;
      const M = rng.int(20, 90);
      const target = rng.pick(['A', 'A', 'B', 'C'] as QCChoice[]);
      let known: number[];
      do {
        known = Array.from({ length: k }, () => M + rng.sign() * rng.int(1, 25));
      } while (rel(M * k, total(known)) !== (target === 'A' ? 'A' : target === 'B' ? 'B' : 'C') || known.some((v) => v <= 0) || new Set(known).size < k);
      const restMean = new Frac(n * M - total(known), n - k);
      const ansA = rel(restMean, M);
      const ans = side === 'A' ? ansA : flip(ansA);
      // trap: concluding from one known value only (or assuming the rest average M)
      const traps: QCQuestion['traps'] = ans !== 'C' ? { C: 'stat-rest-average' } : { D: 'stat-need-each-value' };
      const q1 = `The average of the other ${n - k} numbers`;
      return {
        params: { ...NO_TOT, mode, side, n, M, known },
        q: {
          format: 'qc',
          info: `The average (arithmetic mean) of ${n} numbers is $${M}$. ${k === 2 ? 'Two' : 'Three'} of the numbers are ${known.map((v) => `$${v}$`).join(k === 2 ? ' and ' : ', ').replace(/, (\$[^$]*\$)$/, ', and $1')}.`,
          quantityA: side === 'A' ? q1 : `$${M}$`,
          quantityB: side === 'A' ? `$${M}$` : q1,
          answer: ans,
          traps,
          explanation: `No need to find the other numbers' average exactly. If the ${n} numbers averaged $${M}$ and the known ${k} averaged $${M}$ too, the others would also average $${M}$. The known ${k} total $${total(known)}$, ${
            ansA === 'C' ? `exactly $${k} \\times ${M}$` : ansA === 'A' ? `less than $${k} \\times ${M} = ${k * M}$` : `more than $${k} \\times ${M} = ${k * M}$`
          }, so the other ${n - k} numbers must make up ${ansA === 'C' ? 'exactly their share' : ansA === 'A' ? 'the difference' : 'for the excess'}: their average is ${
            ansA === 'C' ? `$${M}$` : ansA === 'A' ? `greater than $${M}$` : `less than $${M}$`
          }.

Exactly: $\\dfrac{${n} \\times ${M} - ${total(known)}}{${n - k}} = ${fTex(restMean)}$. (${ans})`,
        },
      };
    }

    if (mode === 'spaced') {
      const evenly = rng.chance(d === 1 ? 0.7 : 0.55);
      let list: number[];
      let desc: string;
      if (evenly) {
        const kind = rng.pick(['first', 'range', 'odd', 'multiples'] as const);
        if (kind === 'first') {
          const n = rng.int(d === 1 ? 9 : 15, d === 3 ? 61 : 31);
          list = Array.from({ length: n }, (_, i) => i + 1);
          desc = `the first ${n} positive integers`;
        } else if (kind === 'range') {
          const a = rng.int(10, 60);
          const b = a + rng.int(8, 40);
          list = Array.from({ length: b - a + 1 }, (_, i) => a + i);
          desc = `the integers from ${a} to ${b}, inclusive`;
        } else if (kind === 'odd') {
          const n = rng.int(8, 30);
          list = Array.from({ length: n }, (_, i) => 2 * i + 1);
          desc = `the first ${n} positive odd integers`;
        } else {
          const m = rng.int(3, 9);
          const n = rng.int(8, 25);
          list = Array.from({ length: n }, (_, i) => m * (i + 1));
          desc = `the first ${n} positive multiples of ${m}`;
        }
      } else {
        const kind = rng.pick(['squares', 'powers', 'mixed'] as const);
        if (kind === 'squares') {
          const n = rng.int(4, 7);
          list = Array.from({ length: n }, (_, i) => (i + 1) ** 2);
          desc = `the squares of the first ${n} positive integers, $${listTex(list)}$`;
        } else if (kind === 'powers') {
          const n = rng.int(4, 7);
          list = Array.from({ length: n }, (_, i) => 2 ** i);
          desc = `the numbers $${listTex(list)}$`;
        } else {
          do {
            list = sortAsc(rng.sample(Array.from({ length: 40 }, (_, i) => i + 1), rng.int(5, 7)));
          } while (meanF(list).eq(medianF(list)));
          desc = `the numbers $${listTex(list)}$`;
        }
      }
      const n = list.length;
      const S = total(list);
      const med = medianF(list);
      const nMed = med.mul(n);
      const ansA = rel(S, nMed);
      const ans = side === 'A' ? ansA : flip(ansA);
      const traps: QCQuestion['traps'] = evenly ? undefined : { C: 'stat-mean-is-median' };
      const qSum = `The sum of the ${evenly ? 'integers' : 'numbers'} in list $L$`;
      const qProd = `${n} times the median of the ${evenly ? 'integers' : 'numbers'} in list $L$`;
      return {
        params: { ...NO_TOT, mode, side, list },
        q: {
          format: 'qc',
          info: `List $L$ consists of ${desc}.`,
          quantityA: side === 'A' ? qSum : qProd,
          quantityB: side === 'A' ? qProd : qSum,
          answer: ans,
          traps,
          explanation: evenly
            ? `In an evenly spaced list, the mean equals the median (the values pair off around the middle: first + last, second + second-to-last, ...). The sum is $n \\times \\text{mean}$, so it equals $n \\times \\text{median}$.

Here the median is $${fTex(med)}$, and both quantities equal $${n} \\times ${fTex(med)} = ${num(S)}$. (C)`
            : `This list is not evenly spaced, so the mean and the median need not be equal. The sum is $${num(S)}$, and the median is $${fTex(med)}$, so ${n} times the median is $${fTex(nMed)}$.

Equivalently, the mean, $${fTex(meanF(list))}$, is ${meanF(list).gt(med) ? 'greater' : 'less'} than the median. (${ans})`,
        },
      };
    }

    // same-mean (book: X = (a, b, s, t), Y = (a, b, t), equal averages)
    const a = rng.int(1, 20);
    let b = rng.int(1, 30);
    if (b === a) b++;
    const tGiven = rng.chance(d === 3 ? 0.35 : 0.5) ? rng.int(1, 40) : null;
    let against: TotParams['against'];
    let numB = 0;
    if (tGiven === null) against = rng.pick(['zero', 'zero', 't', 'meanY'] as const);
    else {
      against = rng.pick(['number', 'number', 'zero'] as const);
      const s = new Frac(a + b + tGiven, 3);
      const target = rng.pick(['A', 'B', 'C'] as QCChoice[]);
      numB = target === 'C' && s.isInt() ? s.n : Math.floor(s.toNumber()) + (target === 'B' ? rng.int(1, 3) : -rng.int(0, 2));
      if (target === 'C' && !s.isInt()) numB = Math.round(s.toNumber());
    }
    // s = (a + b + t)/3 (the common mean)
    let ansA: QCChoice;
    let why: string;
    const sFor = (t: number) => new Frac(a + b + t, 3);
    if (tGiven === null) {
      if (against === 'meanY') {
        ansA = 'C';
        why = `Adding $s$ to the list $${a}, ${b}, t$ leaves the average unchanged, which happens only when the added value equals the average. So $s$ is the average of $${a}$, $${b}$ and $t$. (C)`;
      } else if (against === 'zero') {
        ansA = 'D';
        why = `Adding $s$ to the list leaves the average unchanged, so $s$ equals that average: $s = \\dfrac{${a} + ${b} + t}{3} = \\dfrac{${a + b} + t}{3}$. That depends on $t$: for $t = 0$, $s = ${fTex(sFor(0))}$; for $t = -${a + b + 3}$, $s = -1$. (D)`;
      } else {
        ansA = 'D';
        why = `$s$ must equal the average of $${a}$, $${b}$ and $t$: $s = \\dfrac{${a + b} + t}{3}$. For $t = 0$, $s = ${fTex(sFor(0))} > t$; for $t = ${a + b + 30}$, $s = ${fTex(sFor(a + b + 30))} < t$. (D)`;
      }
    } else {
      const s = sFor(tGiven);
      const cmpTo = against === 'zero' ? 0 : numB;
      ansA = rel(s, cmpTo);
      why = `Adding $s$ to the list $${a}, ${b}, ${tGiven}$ leaves the average unchanged, so $s$ equals that average: $s = \\dfrac{${a} + ${b} + ${tGiven}}{3} = ${fTex(s)}$. Compare with $${cmpTo}$. (${side === 'A' ? ansA : flip(ansA)})`;
    }
    const ans = side === 'A' ? ansA : flip(ansA);
    const traps: QCQuestion['traps'] = {};
    if (ans === 'D' && against === 'zero') traps.C = 'stat-same-mean-zero';
    else if (ans !== 'D') traps.D = 'stat-need-each-value';
    const tTxt = tGiven === null ? 't' : num(tGiven);
    const qS = '$s$';
    const qOther = against === 'zero' ? '$0$' : against === 't' ? '$t$' : against === 'meanY' ? `The average (arithmetic mean) of $${a}$, $${b}$, and $t$` : `$${numB}$`;
    return {
      params: { ...NO_TOT, mode, side, a, b, tGiven, against, num: numB },
      q: {
        format: 'qc',
        info: `List $X$ consists of the numbers $${a}, ${b}, s$, and $${tTxt}$. List $Y$ consists of the numbers $${a}, ${b}$, and $${tTxt}$. The average (arithmetic mean) of the numbers in list $X$ is equal to the average of the numbers in list $Y$.`,
        quantityA: side === 'A' ? qS : qOther,
        quantityB: side === 'A' ? qOther : qS,
        answer: ans,
        traps: Object.keys(traps).length ? traps : undefined,
        explanation: why,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const order = (x: Frac | number, y: Frac | number): [Frac | number, Frac | number] => (p.side === 'A' ? [x, y] : [y, x]);
    let expected: QCChoice;
    if (p.mode === 'rest') {
      // Sample data sets with the stated mean that contain the known values.
      const k = p.known.length;
      const samples: [Frac, Frac][] = [];
      for (let i = 0; i < 20; i++) {
        const others = Array.from({ length: p.n - k }, () => rng.int(-50, 150));
        const shift = new Frac(p.n * p.M - total(p.known) - total(others), p.n - k);
        const data = [...p.known.map((v) => frac(v)), ...others.map((v) => shift.add(v))];
        const mean = data.reduce((s, v) => s.add(v), frac(0)).div(p.n);
        if (!mean.eq(p.M)) return 'sample construction failed';
        const rest = data.slice(k).reduce((s, v) => s.add(v), frac(0)).div(p.n - k);
        samples.push(order(rest, p.M) as [Frac, Frac]);
      }
      expected = qcFromSamples(samples);
    } else if (p.mode === 'spaced') {
      let s = 0;
      for (const v of p.list) s += v;
      expected = qcFromSamples([order(s, medianByRank(p.list).mul(p.list.length))]);
    } else {
      // Solve the equal-means condition for s numerically for many values of t.
      const ts = p.tGiven === null ? Array.from({ length: 200 }, () => rng.int(-300, 300)) : [p.tGiven];
      const samples: [Frac, Frac][] = ts.map((t) => {
        const meanY = new Frac(p.a + p.b + t, 3);
        // mean(X) as a function of s is linear: evaluate at s = 0 and s = 1 and solve mean(X) = mean(Y).
        const f0 = new Frac(p.a + p.b + t, 4);
        const f1 = new Frac(p.a + p.b + t + 1, 4);
        const s = meanY.sub(f0).div(f1.sub(f0));
        const other = p.against === 'zero' ? frac(0) : p.against === 't' ? frac(t) : p.against === 'meanY' ? meanY : frac(p.num);
        return order(s, other) as [Frac, Frac];
      });
      expected = qcFromSamples(samples);
    }
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

export const centerQCTemplates = [meanMedianQC, totalsQC];
