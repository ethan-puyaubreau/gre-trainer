import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { frac, type Frac } from '../../../engine/frac';
import { factorize, gcd, lcm, range } from '../../../engine/math';
import { clock } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { QC_WORDS, expectMcm, expectNe, expectQc, factorTex, listAnd } from './util';

/** LCM by scanning the multiples of the largest number (checks use it instead of the gcd formula). */
function lcmBrute(xs: number[]): number {
  const top = Math.max(...xs);
  for (let m = top; ; m += top) if (xs.every((x) => m % x === 0)) return m;
}
/** GCD by scanning down from the smallest number. */
function gcdBrute(xs: number[]): number {
  for (let d = Math.min(...xs); d >= 1; d--) if (xs.every((x) => x % d === 0)) return d;
  return 1;
}

const lcmList = (xs: number[]) => xs.reduce((a, x) => lcm(a, x), 1);
const fmtTime = (m: number) => (m === 720 ? '12:00 noon' : clock(m, 'short'));

/** "lcm(12, 20, 30)" explanation with prime factorizations. */
function lcmWork(xs: number[]): string {
  const L = lcmList(xs);
  return `${listAnd(xs.map((x) => `$${x} = ${factorTex(factorize(x))}$`))}. Take each prime to its highest power: the LCM is $${factorTex(factorize(L))} = ${L}$`;
}

/* ------------------------------------------------------------------ 1. Coinciding schedules (MCM, times) */

interface ScheduleParams {
  start: number;
  intervals: number[];
  times: number[];
}

const CONTEXTS = [
  {
    intro: (iv: string, n: number) => `Buses on ${n === 2 ? 'two routes' : 'three routes'} leave a downtown station every ${iv} minutes, respectively.`,
    together: (n: number) => `${n === 2 ? 'both' : 'all three'} buses leave the station at the same time`,
    actor: 'buses',
  },
  {
    intro: (iv: string, n: number) => `In a factory, ${n === 2 ? 'two machines start' : 'three machines start'} a cleaning cycle every ${iv} minutes, respectively.`,
    together: (n: number) => `${n === 2 ? 'both' : 'all three'} machines start a cleaning cycle at the same time`,
    actor: 'machines',
  },
  {
    intro: (iv: string, n: number) => `${n === 2 ? 'Two' : 'Three'} automatic sprinklers in a park turn on every ${iv} minutes, respectively.`,
    together: (n: number) => `${n === 2 ? 'both' : 'all three'} sprinklers turn on at the same time`,
    actor: 'sprinklers',
  },
];

const POOL = [12, 15, 18, 20, 24, 25, 30, 36, 40, 45, 50, 60, 75, 90];

const schedule: Template<ScheduleParams> = {
  id: 'arith.lcm-gcd.schedule',
  skill: 'arith.lcm-gcd',
  format: 'mcm',
  style: 'times when periodic events coincide again',
  generate(rng, diff) {
    const n = diff === 1 ? 2 : 3;
    for (;;) {
      const intervals = rng.sample(POOL, n).sort((a, b) => a - b);
      const L = lcmList(intervals);
      const [lo, hi] = diff === 1 ? [40, 120] : diff === 2 ? [60, 180] : [90, 240];
      if (L < lo || L > hi) continue;
      const product = intervals.reduce((s, x) => s * x, 1);
      if (product === L) continue;
      if (intervals.some((x) => intervals.some((y) => y !== x && y % x === 0))) continue; // no interval divides another
      const start = diff === 3 ? rng.pick([6, 7, 8]) * 60 + rng.pick([0, 15, 30]) : rng.pick([6, 7, 8, 9]) * 60;
      const hours = Math.ceil((L * rng.int(2, 3)) / 60) + 1;
      const end = start + Math.min(hours, 11) * 60;
      const correct = range(1, 20)
        .map((k) => start + k * L)
        .filter((t) => t < end);
      if (correct.length < 1) continue;
      // Times where only some of the events coincide.
      // (with two schedules: times that fit one of them only)
      const partial = new Set<number>();
      const subsets: number[][] = n === 2 ? [[intervals[0]], [intervals[1]]] : [[intervals[0], intervals[1]], [intervals[0], intervals[2]], [intervals[1], intervals[2]]];
      for (const sub of subsets) {
        const l2 = lcmList(sub);
        for (let t = start + l2; t < end; t += l2) if ((t - start) % L !== 0) partial.add(t);
      }
      const partialArr = [...partial].filter((t) => (t - start) % 15 === 0);
      const step = 30;
      void step;
      // Wrong times that come from a real slip: multiples of the GCD (instead of the LCM) and the sum of the intervals.
      const G = intervals.reduce((acc, x) => gcd(acc, x));
      const sumT = intervals.reduce((acc, x) => acc + x, 0);
      const slipTrap = new Map<number, string>();
      for (let t = start + G; t < end; t += G) if ((t - start) % L !== 0 && (t - start) % 5 === 0 && !partial.has(t)) slipTrap.set(t, 'int-gcd-lcm-swapped');
      for (const t of [start + sumT, start + 2 * sumT]) if (t < end && (t - start) % L !== 0 && !partial.has(t)) slipTrap.set(t, 'int-added-intervals');
      const grid = [...slipTrap.keys()];
      const nChoices = diff === 1 ? 6 : 8;
      const nCorrect = Math.min(correct.length, rng.int(1, 3));
      const picksC = rng.sample(correct, nCorrect);
      const picksP = rng.sample(partialArr, Math.min(partialArr.length, rng.int(2, 3)));
      const picksG = rng.sample(grid, Math.min(grid.length, nChoices - nCorrect - picksP.length));
      if (picksC.length + picksP.length + picksG.length !== nChoices || picksP.length < 1) continue;
      const times = [...picksC, ...picksP, ...picksG].sort((a, b) => a - b);
      const isCorrect = (t: number) => (t - start) % L === 0;
      const { choices, answer } = flaggedChoices(
        times.map((t) => ({
          text: fmtTime(t),
          correct: isCorrect(t),
          ...(partial.has(t) ? { trap: 'int-lcm-two-only' } : slipTrap.has(t) ? { trap: slipTrap.get(t)! } : {}),
        })) as (Choice & { correct: boolean })[],
      );
      const ctx = rng.pick(CONTEXTS);
      const iv = n === 2 ? `${intervals[0]} and ${intervals[1]}` : `${intervals[0]}, ${intervals[1]}, and ${intervals[2]}`;
      const allTimes = correct.map(fmtTime);
      const partialExample = picksP[0];
      const fits = intervals.filter((x) => (partialExample - start) % x === 0);
      const odd = intervals.find((x) => (partialExample - start) % x !== 0)!;
      const fitsText = fits.length === 1 ? `the ${fits[0]}-minute schedule only` : `the ${fits[0]}- and ${fits[1]}-minute schedules only`;
      return {
        params: { start, intervals, times },
        q: {
          format: 'mcm',
          stem: `${ctx.intro(iv, n)} At ${fmtTime(start)}, ${ctx.together(n)}. Other than at ${fmtTime(start)}, at which of the following times before ${fmtTime(end)} do ${ctx.together(n)}?`,
          instruction: 'Indicate all such times.',
          choices,
          answer,
          explanation: `The ${ctx.actor} line up again every lcm$(${intervals.join(', ')})$ minutes. ${lcmWork(intervals)} minutes${L % 60 === 0 ? ` (${L / 60} hour${L === 60 ? '' : 's'})` : ` (${Math.floor(L / 60)} hour${Math.floor(L / 60) === 1 ? '' : 's'} ${L % 60} minutes)`}.

So, between ${fmtTime(start)} and ${fmtTime(end)}, they coincide only at ${listAnd(allTimes)} (every ${L} minutes).

${fmtTime(partialExample)} fits ${fitsText}: ${partialExample - start} minutes is not a multiple of ${odd}. Use the LCM of all the intervals.`,
        },
      };
    }
  },
  check(q, { start, intervals, times }) {
    const expected = times.flatMap((t, i) => (t > start && intervals.every((x) => (t - start) % x === 0) ? [i] : []));
    return expectMcm(q, expected);
  },
};

/* ------------------------------------------------------------------ 2. Which numbers are common multiples / could be x (MCM) */

interface MultSelParams {
  mode: 'common' | 'lcm-inverse' | 'gcd-inverse';
  a: number;
  b: number;
  values: number[];
}

const NONCOPRIME: [number, number][] = [
  [4, 6],
  [6, 8],
  [6, 9],
  [6, 10],
  [8, 12],
  [9, 12],
  [10, 15],
  [12, 18],
  [14, 21],
  [12, 16],
  [15, 20],
  [10, 25],
];

const multiplesSelect: Template<MultSelParams> = {
  id: 'arith.lcm-gcd.multiples-select',
  skill: 'arith.lcm-gcd',
  format: 'mcm',
  style: 'common multiples, or numbers with a given LCM or GCD',
  generate(rng, diff) {
    const mode: MultSelParams['mode'] = diff === 1 ? 'common' : diff === 2 ? rng.pick(['common', 'lcm-inverse'] as const) : rng.pick(['lcm-inverse', 'gcd-inverse'] as const);
    for (;;) {
      let a: number;
      let b: number;
      let good: number[];
      let bad: { v: number; trap?: string }[];
      if (mode === 'common') {
        [a, b] = rng.pick(NONCOPRIME);
        const L = lcm(a, b);
        const top = Math.max(150, 4 * L);
        good = range(1, Math.floor(top / L)).map((k) => k * L);
        bad = range(1, top)
          .filter((v) => (v % a === 0) !== (v % b === 0))
          .map((v) => ({ v, trap: 'int-one-condition-only' }));
      } else if (mode === 'lcm-inverse') {
        a = rng.pick([4, 6, 8, 9, 10, 12, 15, 18, 20]);
        b = a * rng.pick([2, 3, 5]); // b is the LCM
        good = range(1, b).filter((x) => b % x === 0 && lcm(x, a) === b);
        bad = [
          ...range(1, b)
            .filter((x) => b % x === 0 && lcm(x, a) !== b)
            .map((v) => ({ v, trap: 'int-lcm-gcd-not-checked' })),
          ...[2 * b, b + a].map((v) => ({ v })),
        ];
      } else {
        const g = rng.pick([4, 6, 8, 9, 10, 12]);
        a = g * rng.pick([2, 3, 5]);
        b = g; // b is the GCD
        good = range(1, 12)
          .map((m) => m * g)
          .filter((x) => gcd(x, a) === g);
        bad = [
          ...range(1, 12)
            .map((m) => m * g)
            .filter((x) => gcd(x, a) !== g)
            .map((v) => ({ v, trap: 'int-lcm-gcd-not-checked' })),
          ...range(2, g - 1)
            .filter((x) => a % x === 0)
            .map((v) => ({ v })),
        ];
      }
      const nChoices = diff === 1 ? 5 : 6;
      const nGood = rng.int(diff === 1 ? 1 : 2, 3);
      if (good.length < nGood) continue;
      const trapBad = bad.filter((x) => x.trap);
      const plainBad = bad.filter((x) => !x.trap);
      const nTrap = Math.min(trapBad.length, nChoices - nGood - (plainBad.length ? 1 : 0));
      const picks = [
        ...rng.sample(good, nGood).map((v) => ({ v, correct: true })),
        ...rng.sample(trapBad, nTrap).map((x) => ({ ...x, correct: false })),
      ];
      const used = new Set(picks.map((x) => x.v));
      for (const x of rng.shuffle(plainBad)) {
        if (picks.length >= nChoices) break;
        if (!used.has(x.v)) {
          picks.push({ ...x, correct: false });
          used.add(x.v);
        }
      }
      if (picks.length !== nChoices || new Set(picks.map((x) => x.v)).size !== nChoices) continue;
      picks.sort((x, y) => x.v - y.v);
      const { choices, answer } = flaggedChoices(
        picks.map((x) => ({ text: `$${x.v}$`, correct: x.correct, ...('trap' in x && x.trap ? { trap: x.trap } : {}) })) as (Choice & { correct: boolean })[],
      );
      const values = picks.map((x) => x.v);
      let stem: string;
      let explanation: string;
      if (mode === 'common') {
        const L = lcm(a, b);
        stem = `Which of the following integers are multiples of both ${a} and ${b}?`;
        explanation = `A number is a multiple of both ${a} and ${b} exactly when it is a multiple of their least common multiple. ${lcmWork([a, b])}, so the common multiples are ${range(1, 4)
          .map((k) => k * L)
          .join(', ')}, and so on.

${values.map((v) => `- ${v}: ${v % L === 0 ? `$${v} = ${L} \\cdot ${v / L}$ ✓` : v % a === 0 ? `a multiple of ${a} but not of ${b} ✗` : v % b === 0 ? `a multiple of ${b} but not of ${a} ✗` : `not a multiple of ${a} or ${b} ✗`}`).join('\n')}

Common multiples need not be multiples of $${a} \\cdot ${b} = ${a * b}$: ${L} already works.`;
      } else if (mode === 'lcm-inverse') {
        stem = `The least common multiple of the positive integer $x$ and ${a} is ${b}. Which of the following could be the value of $x$?`;
        const need = factorize(b).filter(([p, e]) => (factorize(a).find(([q]) => q === p)?.[1] ?? 0) < e);
        explanation = `$${a} = ${factorTex(factorize(a))}$ and $${b} = ${factorTex(factorize(b))}$. So $x$ must divide ${b}, and $x$ must supply ${listAnd(need.map(([p, e]) => `$${e === 1 ? p : `${p}^{${e}}`}$`))}, which ${a} lacks.

${values.map((v) => `- ${v}: lcm$(${v}, ${a}) = ${lcm(v, a)}$ ${lcm(v, a) === b ? '✓' : '✗'}`).join('\n')}

Being a divisor of ${b} is not enough: compute the LCM for each choice.`;
      } else {
        stem = `The greatest common divisor of the positive integer $x$ and ${a} is ${b}. Which of the following could be the value of $x$?`;
        explanation = `$x$ must be a multiple of ${b}, but $x$ and ${a} must share no larger factor. Since $${a} = ${b} \\cdot ${a / b}$, $x = ${b}m$ where $m$ shares no factor with ${a / b}.

${values.map((v) => `- ${v}: gcd$(${v}, ${a}) = ${gcd(v, a)}$ ${gcd(v, a) === b ? '✓' : '✗'}`).join('\n')}

A multiple of ${b} can have a greater GCD with ${a}: compute it for each choice.`;
      }
      return {
        params: { mode, a, b, values },
        q: {
          format: 'mcm',
          stem,
          instruction: mode === 'common' ? 'Indicate all such integers.' : 'Indicate all such values.',
          choices,
          answer,
          explanation,
        },
      };
    }
  },
  check(q, { mode, a, b, values }) {
    const ok = (v: number) =>
      mode === 'common' ? v % a === 0 && v % b === 0 : mode === 'lcm-inverse' ? lcmBrute([v, a]) === b : gcdBrute([v, a]) === b;
    return expectMcm(
      q,
      values.flatMap((v, i) => (ok(v) ? [i] : [])),
    );
  },
};

/* ------------------------------------------------------------------ 3. Common multiples with an unknown x; GCD x LCM (QC) */

type CmKind = 'least' | 'remainder' | 'value' | 'gcd-lcm-product' | 'gcd-lcm-sum';

interface CmParams {
  kind: CmKind;
  a: number;
  b: number;
  m: number;
  k: number;
}

const commonMultipleQC: Template<CmParams> = {
  id: 'arith.lcm-gcd.common-multiple-qc',
  skill: 'arith.lcm-gcd',
  format: 'qc',
  style: 'compare using common multiples of an unknown x, or GCD × LCM',
  generate(rng, diff) {
    const kinds: CmKind[] =
      diff === 1 ? ['least', 'value', 'value'] : diff === 2 ? ['least', 'remainder', 'value', 'value', 'gcd-lcm-product'] : ['remainder', 'gcd-lcm-sum', 'gcd-lcm-product', 'least', 'value'];
    const kind = rng.pick(kinds);
    for (;;) {
      const [a, b] = rng.pick(NONCOPRIME);
      const L = lcm(a, b);
      const G = gcd(a, b);
      let m = 0;
      let k = 0;
      // Each difficulty has its own wording, so the same numbers never give the same question twice.
      let info = [
        `$x$ is a positive integer that is a multiple of both ${a} and ${b}.`,
        `$x$ is a positive integer divisible by both ${a} and ${b}.`,
        `The positive integer $x$ is a common multiple of ${a} and ${b}.`,
      ][diff - 1];
      let quantityA: string;
      let quantityB: string;
      let answer: QCChoice;
      let traps: QCQuestion['traps'];
      let explanation: string;
      if (kind === 'least') {
        const roll = rng.next();
        k = roll < 0.3 ? L : roll < 0.6 ? a * b : L + rng.pick([-G, G]);
        if (k <= 0) continue;
        answer = qcCompare(L, k);
        const trapAns = qcCompare(a * b, k);
        traps = trapAns !== answer ? { [trapAns]: 'int-lcm-is-product' } : undefined;
        quantityA = ['The least possible value of $x$', 'The smallest value that $x$ can have', 'The minimum possible value of $x$'][diff - 1];
        quantityB = `$${k}$`;
        explanation = `The least positive common multiple of ${a} and ${b} is their LCM. ${lcmWork([a, b])}.

Compare ${L} with ${k}: ${QC_WORDS[answer]}. (${answer})

The product $${a} \\cdot ${b} = ${a * b}$ is a common multiple, but not the least one, because ${a} and ${b} share the factor ${G}.`;
      } else if (kind === 'remainder') {
        const useProduct = rng.chance(0.55);
        m = useProduct ? a * b : rng.pick(range(2, L).filter((d) => L % d === 0 && d !== a && d !== b && d > 2));
        if (!m) continue;
        k = 0;
        const zero = L % m === 0;
        answer = zero ? 'C' : 'D';
        traps = useProduct ? { C: 'int-lcm-is-product' } : { D: 'tested-one-value' };
        if (!zero && !useProduct) continue;
        if (zero && useProduct) continue;
        quantityA = [`The remainder when $x$ is divided by ${m}`, `The remainder when $x$ is divided by ${m}`, `The remainder of $x$ divided by ${m}`][diff - 1];
        quantityB = '$0$';
        explanation = zero
          ? `Every common multiple of ${a} and ${b} is a multiple of their LCM. ${lcmWork([a, b])}. Since ${m} divides ${L}, every possible $x$ is a multiple of ${m}, so the remainder is always 0. (C)`
          : `Every common multiple of ${a} and ${b} is a multiple of their LCM. ${lcmWork([a, b])}, so $x$ can be ${L}, ${2 * L}, ${3 * L}, and so on.

$x = ${a * b}$ leaves remainder 0 when divided by ${m}, but $x = ${L}$ leaves remainder ${L} (it is less than ${m}). The relationship cannot be determined. (D)

$x$ does not have to be a multiple of $${a} \\cdot ${b}$: ${a} and ${b} share the factor ${G}.`;
      } else if (kind === 'value') {
        const roll = rng.next();
        k = roll < 0.6 ? L - rng.pick([1, 2, G]) : roll < 0.8 ? L : L + rng.int(1, L - 1);
        if (k <= 0) continue;
        answer = k < L ? 'A' : 'D';
        traps = answer === 'D' ? { [k === L ? 'C' : 'A']: 'tested-one-value' } : undefined;
        quantityA = '$x$';
        quantityB = `$${k}$`;
        explanation = `The positive common multiples of ${a} and ${b} are the multiples of their LCM. ${lcmWork([a, b])}. So $x$ can be ${L}, ${2 * L}, ${3 * L}, and so on.

${
          answer === 'A'
            ? `Even the least possible value, ${L}, is greater than ${k}, so Quantity A is greater. (A)`
            : `$x = ${L}$ ${k === L ? `equals ${k}` : `is less than ${k}`}, but $x = ${Math.ceil((k + 1) / L) * L}$ is greater, so the relationship cannot be determined. (D)`
        }`;
      } else {
        // x and y with given GCD g and LCM l
        const g = rng.pick([2, 3, 4, 5, 6]);
        const core = rng.pick([6, 10, 12, 15, 30]);
        const l = g * core;
        const pairs: [number, number][] = [];
        for (let x = g; x <= l; x += g) {
          const y = (g * l) / x;
          if (Number.isInteger(y) && x <= y && gcd(x, y) === g && lcm(x, y) === l) pairs.push([x, y]);
        }
        if (pairs.length < 2) continue;
        info = [
          `$x$ and $y$ are positive integers. Their greatest common divisor is ${g}, and their least common multiple is ${l}.`,
          `$x$ and $y$ are positive integers. Their greatest common divisor is ${g}, and their least common multiple is ${l}.`,
          `The positive integers $x$ and $y$ have a greatest common divisor of ${g} and a least common multiple of ${l}.`,
        ][diff - 1];
        m = g;
        k = l;
        if (kind === 'gcd-lcm-product') {
          answer = 'C';
          traps = { D: 'tested-one-value' };
          quantityA = '$xy$';
          quantityB = `$${g * l}$`;
          explanation = `For any two positive integers, $\\text{GCD} \\times \\text{LCM} = xy$. So $xy = ${g} \\cdot ${l} = ${g * l}$, whatever $x$ and $y$ are. For example, ${listAnd(pairs.slice(0, 2).map(([x, y]) => `$${x} \\cdot ${y} = ${x * y}$`))}. (C)`;
        } else {
          answer = 'D';
          traps = { B: 'tested-one-value' };
          quantityA = '$x + y$';
          quantityB = `$${g + l}$`;
          const [p1, p2] = [pairs[0], pairs[pairs.length - 1]];
          explanation = `Several pairs work, for example ${listAnd(pairs.map(([x, y]) => `$(${x}, ${y})$`))}.

$x = ${p1[0]}, y = ${p1[1]}$ gives $x + y = ${p1[0] + p1[1]}$, equal to ${g + l}; $x = ${p2[0]}, y = ${p2[1]}$ gives $${p2[0] + p2[1]}$, which is less. The relationship cannot be determined. (D)

Only the product is fixed: $xy = \\text{GCD} \\times \\text{LCM} = ${g * l}$.`;
        }
        return {
          params: { kind, a: g, b: l, m, k },
          q: { format: 'qc', info, quantityA, quantityB, answer, traps, explanation },
        };
      }
      return {
        params: { kind, a, b, m, k },
        q: { format: 'qc', info, quantityA, quantityB, answer, traps, explanation },
      };
    }
  },
  check(q, { kind, a, b, m, k }) {
    const samples: [number, number][] = [];
    if (kind === 'gcd-lcm-product' || kind === 'gcd-lcm-sum') {
      // a = GCD, b = LCM: brute force all pairs up to the LCM
      const ds = range(1, b).filter((d) => b % d === 0); // x and y must divide the LCM
      for (const x of ds)
        for (const y of ds)
          if (gcdBrute([x, y]) === a && lcmBrute([x, y]) === b) samples.push(kind === 'gcd-lcm-product' ? [x * y, a * b] : [x + y, a + b]);
    } else {
      const xs = range(1, a * b * 3).filter((x) => x % a === 0 && x % b === 0);
      if (kind === 'least') samples.push([Math.min(...xs), k]);
      else if (kind === 'remainder') for (const x of xs) samples.push([x % m, 0]);
      else for (const x of xs) samples.push([x, k]);
    }
    if (!samples.length) return 'no samples';
    return expectQc(q, qcFromSamples(samples));
  },
};

/* ------------------------------------------------------------------ 4. Word problems: equal groups (GCD) and packages (LCM) (NE) */

type WordKind = 'bouquets' | 'per-bouquet' | 'tiles' | 'packages' | 'package-count' | 'laps' | 'lap-minutes';

interface WordParams {
  kind: WordKind;
  nums: number[];
}

const FLOWERS = ['roses', 'tulips', 'lilies'];

const groupsWord: Template<WordParams> = {
  id: 'arith.lcm-gcd.groups-word',
  skill: 'arith.lcm-gcd',
  format: 'ne',
  style: 'word problem: largest equal groups (GCD) or least common amount (LCM)',
  generate(rng, diff) {
    const kinds: WordKind[] =
      diff === 1 ? ['bouquets', 'packages', 'package-count'] : diff === 2 ? ['bouquets', 'package-count', 'laps', 'tiles'] : ['per-bouquet', 'tiles', 'lap-minutes', 'laps'];
    const kind = rng.pick(kinds);
    for (;;) {
      let nums: number[];
      let answer: Frac;
      let stem: string;
      let suffix: string;
      let explanation: string;
      const traps: { value: Frac; trap: string }[] = [];
      if (kind === 'bouquets' || kind === 'per-bouquet') {
        const g = rng.int(4, 18);
        const three = kind === 'per-bouquet' && rng.chance(0.5);
        const ms = rng.sample(range(2, 9), three ? 3 : 2);
        if (gcdBrute(ms) !== 1) continue;
        nums = ms.map((x) => x * g);
        if (Math.max(...nums) > 150) continue;
        const G = g;
        const L = lcmList(nums);
        const flowers = FLOWERS.slice(0, nums.length);
        const intro = `A florist has ${listAnd(nums.map((x, i) => `${x} ${flowers[i]}`))}. She wants to divide all of these flowers into identical bouquets, with no flowers left over.`;
        const gcdLine = `${listAnd(nums.map((x) => `$${x} = ${factorTex(factorize(x))}$`))}, so the GCD is ${G}`;
        if (kind === 'bouquets') {
          answer = frac(G);
          stem = `${intro} What is the greatest number of bouquets she can make?`;
          suffix = 'bouquets';
          if (L <= 5000) traps.push({ value: frac(L), trap: 'int-gcd-lcm-swapped' });
          explanation = `The number of bouquets must divide ${listAnd(nums.map(String))}, so the greatest possible number is their greatest common divisor: ${gcdLine}. Each bouquet then has ${listAnd(
            nums.map((x, i) => `${x / G} ${flowers[i]}`),
          )}.

The LCM (${L}) answers a different question: it is the least number that ${listAnd(nums.map(String))} ${nums.length === 2 ? 'both' : 'all'} divide.`;
        } else {
          const per = nums.reduce((s, x) => s + x / G, 0);
          answer = frac(per);
          stem = `${intro} If she makes the greatest possible number of bouquets, how many flowers will be in each bouquet?`;
          suffix = 'flowers';
          if (G !== per) traps.push({ value: frac(G), trap: 'int-gcd-lcm-swapped' });
          explanation = `The greatest number of bouquets is the GCD of ${listAnd(nums.map(String))}: ${gcdLine}.

Each bouquet then has ${listAnd(nums.map((x, i) => `$${x} \\div ${G} = ${x / G}$ ${flowers[i]}`))}, for a total of ${per} flowers.

${G} is the number of bouquets, not the number of flowers in each one.`;
        }
      } else if (kind === 'tiles') {
        const g = rng.pick([12, 15, 18, 20, 24, 30, 36]);
        const [p, q] = rng.sample(range(2, 9), 2);
        if (gcd(p, q) !== 1) continue;
        nums = [g * p, g * q];
        const G = g;
        answer = frac(p * q);
        stem = `A rectangular floor measures ${nums[0]} centimeters by ${nums[1]} centimeters. It is to be covered completely by identical square tiles, with no gaps, no overlaps, and no cut tiles. What is the least number of tiles needed?`;
        suffix = 'tiles';
        explanation = `The fewest tiles means the largest tile. Its side must divide both ${nums[0]} and ${nums[1]}, so the largest side is their GCD: $${nums[0]} = ${factorTex(factorize(nums[0]))}$ and $${nums[1]} = ${factorTex(
          factorize(nums[1]),
        )}$, so the GCD is ${G} centimeters.

Then $${nums[0]} \\div ${G} = ${p}$ tiles fit along one side and $${nums[1]} \\div ${G} = ${q}$ along the other: $${p} \\times ${q} = ${p * q}$ tiles. (${G} is the side of each tile, not the number of tiles.)`;
      } else if (kind === 'packages' || kind === 'package-count') {
        const [x, y] = rng.pick(NONCOPRIME.filter(([u, v]) => u >= 6 && v >= 8));
        nums = [x, y];
        const L = lcm(x, y);
        const askCups = kind === 'package-count';
        answer = frac(askCups ? L / x : L);
        stem = `Paper cups are sold only in packages of ${x}, and lids are sold only in packages of ${y}. A caterer wants to buy exactly as many cups as lids. What is the least number of ${askCups ? 'packages of cups' : 'cups'} the caterer can buy?`;
        suffix = askCups ? 'packages' : 'cups';
        traps.push({ value: frac(askCups ? y : x * y), trap: 'int-lcm-is-product' });
        if (!askCups) traps.push({ value: frac(gcd(x, y)), trap: 'int-gcd-lcm-swapped' });
        explanation = `The number of cups must be a multiple of ${x} and the number of lids a multiple of ${y}, so the least equal amount is lcm$(${x}, ${y})$. ${lcmWork([x, y])}.${
          askCups ? ` That is $${L} \\div ${x} = ${L / x}$ packages of cups (and ${L / y} packages of lids).` : ` The least number of cups is ${L}.`
        }

${
          askCups
            ? `Buying ${y} packages of cups (to match ${x} packages of lids) also gives equal numbers, but not the least.`
            : `$${x} \\cdot ${y} = ${x * y}$ also works, but it is not the least: ${x} and ${y} share the factor ${gcd(x, y)}.`
        }`;
      } else {
        const t1 = rng.pick([40, 45, 48, 54, 60, 72, 75, 80, 84, 90]);
        const t2 = rng.pick([48, 54, 60, 64, 72, 75, 80, 90, 96, 100, 108, 120]);
        if (t2 <= t1 || gcd(t1, t2) < 6) continue;
        nums = [t1, t2];
        const L = lcm(t1, t2);
        if (L > 1500) continue;
        const askLaps = kind === 'laps';
        answer = askLaps ? frac(L / t1) : frac(L, 60);
        if (!answer.isTerminating()) continue;
        const intro = `Two runners start together at the starting line of a circular track and run in the same direction, each at a constant pace. One runner completes a lap every ${t1} seconds and the other every ${t2} seconds.`;
        stem = askLaps
          ? `${intro} When the two runners are next at the starting line at the same time, how many laps will the faster runner have completed?`
          : `${intro} After how many minutes will the two runners next be at the starting line at the same time?`;
        suffix = askLaps ? 'laps' : 'minutes';
        if (askLaps) traps.push({ value: frac(t2), trap: 'int-lcm-is-product' });
        else if (frac(t1 * t2, 60).isTerminating()) traps.push({ value: frac(t1 * t2, 60), trap: 'int-lcm-is-product' });
        explanation = `Each runner is at the starting line at the multiples of his or her lap time, so they are there together first after lcm$(${t1}, ${t2})$ seconds. ${lcmWork([t1, t2])} seconds.${
          askLaps ? ` In ${L} seconds the faster runner completes $${L} \\div ${t1} = ${L / t1}$ laps (and the slower one ${L / t2}).` : ` That is $${L} \\div 60 = ${answer.toDecimalString()}$ minutes.`
        }

The product $${t1} \\cdot ${t2}$ seconds is also a common multiple, but not the first one.`;
      }
      if (traps.some((t) => t.value.eq(answer))) continue; // a trap equal to the answer is no trap: draw again
      return {
        params: { kind, nums },
        q: {
          format: 'ne',
          stem,
          answer,
          suffix,
          traps,
          explanation,
        },
      };
    }
  },
  check(q, { kind, nums }) {
    let expected: Frac;
    if (kind === 'bouquets') expected = frac(gcdBrute(nums));
    else if (kind === 'per-bouquet') {
      const g = gcdBrute(nums);
      expected = frac(nums.reduce((s, x) => s + x / g, 0));
    } else if (kind === 'tiles') {
      // try every square side; the fewest tiles wins
      let best = Infinity;
      for (let side = 1; side <= Math.min(...nums); side++) if (nums[0] % side === 0 && nums[1] % side === 0) best = Math.min(best, (nums[0] / side) * (nums[1] / side));
      expected = frac(best);
    } else if (kind === 'packages' || kind === 'package-count') {
      const [x, y] = nums;
      let i = 1; // packages of cups
      while ((x * i) % y !== 0) i++;
      expected = kind === 'package-count' ? frac(i) : frac(x * i);
    } else {
      const [t1, t2] = nums;
      let t = 1; // simulate second by second
      while (t % t1 !== 0 || t % t2 !== 0) t++;
      expected = kind === 'laps' ? frac(t / t1) : frac(t, 60);
    }
    return expectNe(q, expected);
  },
};


/* ------------------------------------------------------------------ 5. Work/rest cycles: on which days do both rest at once (MCM) */

interface RestParams {
  a1: number;
  r1: number;
  a2: number;
  r2: number;
  /** total length of the period, in hours, starting at noon of day 0 */
  T: number;
  /** wording of the question (one family per difficulty) */
  ctx: number;
}

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const clockOf = (t: number) => ((12 + t) % 24 === 0 ? 'midnight' : (12 + t) % 24 === 12 ? 'noon' : clock(((12 + t) % 24) * 60, 'short'));
const hourText = (t: number) => `${WEEK[Math.floor((12 + t) / 24)]} ${clockOf(t)}`;
/** "Tuesday 6:00 p.m. to 8:00 p.m.", "Wednesday 10:00 p.m. to midnight", "Friday 10:00 p.m. to Saturday 2:00 a.m." */
const spanText = (st: number, en: number) => {
  const sameDay = Math.floor((12 + st) / 24) === Math.floor((12 + en - 1) / 24);
  return `${hourText(st)} to ${sameDay ? clockOf(en) : hourText(en)}`;
};

/** Three wordings of the same situation: each difficulty uses its own. */
const REST_CONTEXTS = [
  (a1: number, r1: number, a2: number, r2: number, end: string) =>
    `Machine X runs for ${a1} hours, then rests for ${r1} hours, and repeats this cycle without stopping. Machine Y runs for ${a2} hours, then rests for ${r2} hours, and repeats this cycle without stopping. Both machines start running at noon on a Monday, and both are shut down at noon on the following ${end}. On which of the following days is there a time when both machines are resting?`,
  (a1: number, r1: number, a2: number, r2: number, end: string) =>
    `Pump X works for ${a1} hours, then stays off for ${r1} hours, and keeps repeating this pattern. Pump Y works for ${a2} hours, then stays off for ${r2} hours, and keeps repeating this pattern. Both pumps are switched on at noon on a Monday and are switched off for good at noon on the following ${end}. On which of the following days are both pumps off at the same time at some point?`,
  (a1: number, r1: number, a2: number, r2: number, end: string) =>
    `Lamp X stays on for ${a1} hours and then off for ${r1} hours, over and over. Lamp Y stays on for ${a2} hours and then off for ${r2} hours, over and over. Both lamps are turned on at noon on a Monday, and the experiment ends at noon on the following ${end}. On which of the following days are both lamps off together at some time?`,
];

const restOverlap: Template<RestParams> = {
  id: 'arith.lcm-gcd.rest-overlap',
  skill: 'arith.lcm-gcd',
  format: 'mcm',
  style: 'two machines on work/rest cycles: on which days do they rest at the same time',
  generate(rng, diff) {
    const ctx = diff - 1;
    for (;;) {
      const c1 = rng.pick([6, 8, 9, 10, 12, 14, 15, 16, 18]);
      const k = rng.pick(diff === 1 ? [2] : [2, 3]);
      const c2 = c1 * k;
      if (c2 > 48) continue;
      const r1 = rng.int(2, Math.max(2, Math.floor(c1 / 2.5)));
      const r2 = rng.int(2, Math.max(2, Math.floor(c2 / 3)));
      const a1 = c1 - r1;
      const a2 = c2 - r2;
      const days = diff === 1 ? rng.pick([3, 4]) : diff === 2 ? rng.pick([4, 5]) : rng.pick([5, 6]);
      const T = days * 24;
      // hour-by-hour: which calendar days contain an hour when both rest
      const both: number[] = [];
      for (let t = 0; t < T; t++) if (t % c1 >= a1 && t % c2 >= a2) both.push(t);
      const dayIdx = [...new Set(both.map((t) => Math.floor((12 + t) / 24)))];
      const nDays = days + 1; // Monday .. the day the period ends at noon
      if (dayIdx.length < 1 || dayIdx.length > nDays - 2) continue;
      // A wrong day is tempting when a single machine rests at some time that day.
      const oneRests = (d: number) => range(0, T - 1).some((t) => Math.floor((12 + t) / 24) === d && (t % c1 >= a1 || t % c2 >= a2));
      // Every wrong day must be a real temptation: a day when one of the machines rests alone.
      if (range(0, nDays - 1).some((d) => !dayIdx.includes(d) && !oneRests(d))) continue;
      const items = range(0, nDays - 1).map((d) => ({
        text: WEEK[d],
        correct: dayIdx.includes(d),
        ...(!dayIdx.includes(d) && oneRests(d) ? { trap: 'int-one-condition-only' } : {}),
      }));
      const { choices, answer } = flaggedChoices(items as (Choice & { correct: boolean })[]);
      // explanation: rest windows within one long cycle, then every overlap in the period
      const overlaps: [number, number][] = [];
      for (const t of both) {
        const last = overlaps[overlaps.length - 1];
        if (last && last[1] === t) last[1] = t + 1;
        else overlaps.push([t, t + 1]);
      }
      const inCycle = overlaps.filter(([st]) => st < c2).map(([st, en]) => `hours ${st} to ${en}`);
      const endDay = WEEK[days];
      const wrongDay = items.find((it) => !it.correct && 'trap' in it);
      return {
        params: { a1, r1, a2, r2, T, ctx },
        q: {
          format: 'mcm',
          stem: REST_CONTEXTS[ctx](a1, r1, a2, r2, endDay),
          instruction: 'Indicate all such days.',
          choices,
          answer,
          explanation: `Two repeating cycles meet again at the LCM of their lengths: lcm$(${c1}, ${c2}) = ${c2}$ hours. Count hours from noon on Monday.

X rests in the last ${r1} hours of every ${c1}-hour cycle, and Y in the last ${r2} hours of every ${c2}-hour cycle. In the first ${c2} hours both rest during ${listAnd(inCycle)}. This repeats every ${c2} hours: ${listAnd(overlaps.slice(0, 3).map(([st, en]) => spanText(st, en)))}${overlaps.length > 3 ? ', and so on' : ''}.

So the days are ${listAnd(dayIdx.map((d) => WEEK[d]))}.${wrongDay ? ` Trap: on ${wrongDay.text} only one of them rests at a time, which is not enough.` : ''}`,
        },
      };
    }
  },
  check(q, { a1, r1, a2, r2, T }) {
    // intersect the rest intervals directly
    const rests = (a: number, r: number): [number, number][] => {
      const out: [number, number][] = [];
      for (let st = 0; st < T; st += a + r) out.push([st + a, Math.min(st + a + r, T)]);
      return out.filter(([x, y]) => x < y);
    };
    const days = new Set<number>();
    for (const [x1, y1] of rests(a1, r1))
      for (const [x2, y2] of rests(a2, r2)) {
        const lo = Math.max(x1, x2);
        const hi = Math.min(y1, y2);
        if (lo < hi) for (let d = Math.floor((12 + lo) / 24); d * 24 - 12 < hi; d++) days.add(d);
      }
    if (q.format !== 'mcm') return 'wrong format';
    const expected = q.choices.flatMap((c, i) => (days.has(WEEK.indexOf(c.text)) ? [i] : []));
    return expectMcm(q, expected);
  },
};

export const lcmGcdTemplates: Template<any>[] = [schedule, multiplesSelect, commonMultipleQC, groupsWord, restOverlap];
