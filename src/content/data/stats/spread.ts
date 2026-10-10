import { numericChoices, qcFromSamples, textChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { lin, num, ordinal, plain } from '../../../engine/tex';
import type { BoxPlotFigure, Choice, Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { fTex, kthByRank, listTex, popSD, QC_WORDS, quartilesF, sortAsc } from './util';

const flip = (c: QCChoice): QCChoice => (c === 'A' ? 'B' : c === 'B' ? 'A' : c);

/* =============================================================================================
 * 1. Compare standard deviations without computing them (QC)
 * =========================================================================================== */

type SDMode = 'shift' | 'scale' | 'cluster' | 'var-scale' | 'var-shift' | 'compute' | 'constant';

/** A list entry coef * x + c (coef = 0 for a plain number). */
type Entry = [number, number];

interface SDParams {
  mode: SDMode;
  listS: Entry[];
  listT: Entry[];
  /** compute / constant modes: Quantity B is a number instead of SD(T). */
  numB: number | null;
  /** x is any number with lo < x < hi (null = unbounded). */
  lo: number | null;
  hi: number | null;
}

const SD_MODES: Record<Difficulty, SDMode[]> = {
  1: ['shift', 'scale', 'scale', 'cluster', 'constant'],
  2: ['shift', 'scale', 'cluster', 'cluster', 'var-scale', 'var-shift'],
  3: ['cluster', 'var-scale', 'var-scale', 'var-shift', 'compute', 'compute'],
};

const entryTex = ([a, c]: Entry) => (a === 0 ? num(c) : lin([[a, 'x'], [c, '']]));
const plainList = (xs: number[]): Entry[] => xs.map((v) => [0, v]);

/** Population SD of a list of entries at a given x. */
const sdAt = (list: Entry[], x: number) => popSD(list.map(([a, c]) => a * x + c));

const sdCompareQC: Template<SDParams> = {
  id: 'data.spread.sd-compare-qc',
  skill: 'data.spread',
  format: 'qc',
  style: 'compare standard deviations by spread around the mean',
  generate(rng, d) {
    const mode = rng.pick(SD_MODES[d]);
    const base = { lo: null as number | null, hi: null as number | null, numB: null as number | null };
    const distinctInts = (n: number, lo: number, hi: number) => sortAsc(rng.sample(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), n));
    let listS: Entry[];
    let listT: Entry[];
    let ansST: QCChoice; // SD(S) vs SD(T) (or vs numB)
    let why: string;
    let traps: Partial<Record<QCChoice, string>> = {};
    let info: string;
    const showList = (l: Entry[], shuffle: boolean) => listTex((shuffle ? rng.shuffle(l) : l).map(entryTex));

    if (mode === 'shift') {
      const b = distinctInts(rng.int(4, 6), 1, 30);
      const c = rng.int(5, 60);
      listS = plainList(b);
      listT = plainList(b.map((v) => v + c));
      if (rng.chance(0.5)) [listS, listT] = [listT, listS];
      ansST = 'C';
      const bigger = listS[0][1] > listT[0][1] ? 'A' : 'B';
      traps = { [bigger]: 'stat-sd-shift' };
      const up = listS[0][1] > listT[0][1] ? ['S', 'T'] : ['T', 'S'];
      why = `The numbers in list $${up[0]}$ are the numbers in list $${up[1]}$, each increased by $${c}$. Adding the same number to every value moves the mean by that amount but does not change the distances from the mean, so the standard deviations are equal.`;
      info = `List $S$: $${showList(listS, d > 1)}$

List $T$: $${showList(listT, d > 1)}$`;
    } else if (mode === 'scale') {
      const k = rng.pick([2, 3, 4, 10]);
      const b = distinctInts(rng.int(3, 5), 1, 12);
      listS = plainList(b);
      listT = plainList(b.map((v) => k * v));
      const swap = rng.chance(0.5);
      if (swap) [listS, listT] = [listT, listS];
      ansST = swap ? 'A' : 'B';
      traps = { C: 'stat-sd-scale' };
      why = `Each number in ${swap ? '$S$' : '$T$'} is $${k}$ times the corresponding number in ${swap ? '$T$' : '$S$'}. Multiplying every value by $${k}$ multiplies every distance from the mean by $${k}$, so the standard deviation is $${k}$ times as large. The pattern of the numbers is the same, but the spread is not.`;
      info = `List $S$: $${showList(listS, false)}$

List $T$: $${showList(listT, false)}$`;
    } else if (mode === 'cluster') {
      const m = rng.int(15, 60);
      const r = rng.int(6, 14);
      const six = rng.chance(0.5);
      const far = six ? [m - r, m - r, m - r + 1, m + r - 1, m + r, m + r] : [m - r, m - r + 1, m, m + r - 1, m + r];
      const e = rng.int(1, 2);
      const near = six ? [m - r, m - e, m, m, m + e, m + r] : [m - r, m - e, m, m + e, m + r];
      const farIsS = rng.chance(0.5);
      listS = plainList(farIsS ? far : near);
      listT = plainList(farIsS ? near : far);
      ansST = farIsS ? 'A' : 'B';
      traps = { C: 'stat-sd-range' };
      why = `Both lists have mean $${m}$ and range $${2 * r}$. In ${farIsS ? '$S$' : '$T$'} most of the numbers are far from the mean (near $${m - r}$ and $${m + r}$), while in ${farIsS ? '$T$' : '$S$'} most of the numbers are close to $${m}$. Greater distances from the mean mean a greater standard deviation; the same range does not mean the same standard deviation.`;
      info = `List $S$: $${showList(listS, false)}$

List $T$: $${showList(listT, false)}$`;
    } else if (mode === 'var-scale') {
      const b = distinctInts(rng.int(3, 4), 1, 9);
      const cons = rng.pick(['pos', 'pos', 'gt1', 'lt1'] as const);
      listS = b.map((v) => [v, 0] as Entry);
      listT = plainList(b);
      if (cons === 'pos') {
        base.lo = 0;
        ansST = 'D';
        traps = { A: 'stat-one-value-tested' };
      } else if (cons === 'gt1') {
        base.lo = 1;
        ansST = 'A';
        traps = { C: 'stat-sd-scale' };
      } else {
        base.lo = 0;
        base.hi = 1;
        ansST = 'B';
        traps = { C: 'stat-sd-scale' };
      }
      const range = cons === 'pos' ? '$x > 0$' : cons === 'gt1' ? '$x > 1$' : '$0 < x < 1$';
      info = `${range}

List $S$: $${showList(listS, false)}$

List $T$: $${showList(listT, false)}$`;
      why = `Each number in $S$ is $x$ times the corresponding number in $T$, so the standard deviation of $S$ is $x$ times the standard deviation of $T$. ${
        cons === 'pos'
          ? 'If $x > 1$, the standard deviation of $S$ is greater; if $x = 1$, they are equal; if $x < 1$, it is less.'
          : cons === 'gt1'
            ? 'Since $x > 1$, the standard deviation of $S$ is greater.'
            : 'Since $x < 1$, the standard deviation of $S$ is less.'
      }`;
    } else if (mode === 'var-shift') {
      const b = distinctInts(rng.int(3, 5), 0, 15);
      const c = rng.int(1, 30);
      listS = b.map((v) => [1, v] as Entry);
      listT = plainList(b.map((v) => v + c));
      ansST = 'C';
      traps = { D: 'stat-sd-shift' };
      info = `$x$ is a number.

List $S$: $${showList(listS, false)}$

List $T$: $${showList(listT, false)}$`;
      why = `List $S$ is the list $${listTex(b)}$ with $x$ added to each number, and list $T$ is the same list with $${c}$ added to each number. Adding a constant does not change the standard deviation, whatever the constant is, so both standard deviations equal the standard deviation of $${listTex(b)}$.`;
    } else if (mode === 'constant') {
      const k = rng.int(3, 40);
      const n = rng.int(4, 6);
      listS = plainList(Array(n).fill(k));
      listT = [];
      base.numB = 0;
      ansST = 'C';
      traps = { A: 'stat-sd-constant' };
      info = `List $S$: $${showList(listS, false)}$`;
      why = `Every number in $S$ equals the mean, $${k}$, so every distance from the mean is 0 and the standard deviation is 0.`;
    } else {
      // compute: SD of a small list versus a number with one decimal place
      for (;;) {
        const m = rng.int(10, 60);
        const pattern = rng.pick(['four', 'five', 'equal'] as const);
        let devs: number[];
        if (pattern === 'equal') {
          const dv = rng.int(2, 6);
          devs = [-dv, -dv, dv, dv];
        } else {
          const a = rng.int(2, 7);
          const bb = rng.int(1, a - 1);
          devs = pattern === 'four' ? [-a, -bb, bb, a] : [-a, -bb, 0, bb, a];
        }
        const n = devs.length;
        const ss = devs.reduce((s, v) => s + v * v, 0);
        const sd = Math.sqrt(ss / n);
        const sampleSd = Math.sqrt(ss / (n - 1));
        const mad = devs.reduce((s, v) => s + Math.abs(v), 0) / n;
        let numB: number;
        let trapAns: QCChoice | null = null;
        let trapId = '';
        if (pattern === 'equal') {
          numB = Math.abs(devs[0]);
          trapAns = 'A';
          trapId = 'stat-sample-sd';
        } else {
          // a one-decimal number strictly between SD and sample SD, or between MAD and SD
          const useSample = rng.chance(0.5);
          const lo = useSample ? sd : mad;
          const hi = useSample ? sampleSd : sd;
          const cands: number[] = [];
          for (let t = Math.ceil(lo * 10 + 1e-9); t / 10 < hi - 1e-9; t++) if (Math.abs(t / 10 - lo) > 0.04 && Math.abs(hi - t / 10) > 0.04) cands.push(t / 10);
          if (!cands.length) continue;
          numB = rng.pick(cands);
          trapAns = useSample ? 'A' : 'B';
          trapId = useSample ? 'stat-sample-sd' : 'stat-sd-mad';
        }
        const vals = devs.map((v) => m + v);
        listS = plainList(rng.shuffle(vals));
        listT = [];
        base.numB = numB;
        ansST = Math.abs(sd - numB) < 1e-9 ? 'C' : sd > numB ? 'A' : 'B';
        traps = trapAns && trapAns !== ansST ? { [trapAns]: trapId } : {};
        info = `List $S$: $${showList(listS, false)}$`;
        why = `The mean is $${m}$, and the distances from the mean are $${listTex(devs.map((v) => Math.abs(v)))}$. The standard deviation is the square root of the average of the squared distances: $\\sqrt{\\dfrac{${devs.map((v) => v * v).join(' + ')}}{${n}}} = \\sqrt{${fTex(new Frac(ss, n))}}${
          Number.isInteger(sd) ? ` = ${sd}` : ` \\approx ${sd.toFixed(2)}`
        }$. Compare with $${num(numB)}$ (it may help to compare squares: $${fTex(new Frac(ss, n))}$ versus $${num(Math.round(numB * numB * 100) / 100)}$).

${
          pattern === 'equal'
            ? `Dividing by $${n - 1}$ instead of $${n}$ (about $${sampleSd.toFixed(2)}$) is not the standard deviation the GRE uses.`
            : `Dividing by $${n - 1}$ instead of $${n}$ (about $${sampleSd.toFixed(2)}$) or averaging the distances (about $${mad.toFixed(2)}$) is not the standard deviation the GRE uses.`
        }`;
        break;
      }
    }
    const side: 'A' | 'B' = mode === 'constant' || mode === 'compute' ? 'A' : rng.chance(0.75) ? 'A' : 'B';
    const qS = 'The standard deviation of the numbers in list $S$';
    const qT = base.numB !== null ? `$${num(base.numB)}$` : 'The standard deviation of the numbers in list $T$';
    const ans = side === 'A' ? ansST : flip(ansST);
    const tr: Partial<Record<QCChoice, string>> = {};
    for (const [k, v] of Object.entries(traps)) {
      const k2 = side === 'A' ? (k as QCChoice) : flip(k as QCChoice);
      if (k2 !== ans) tr[k2] = v;
    }
    return {
      params: { mode, listS: listS!, listT: listT!, ...base },
      q: {
        format: 'qc',
        info: info!,
        quantityA: side === 'A' ? qS : qT,
        quantityB: side === 'A' ? qT : qS,
        answer: ans,
        traps: Object.keys(tr).length ? (tr as QCQuestion['traps']) : undefined,
        explanation: `${why!} So ${QC_WORDS[ans]}. (${ans})`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const usesX = [...p.listS, ...p.listT].some(([a]) => a !== 0);
    const xs: number[] = [];
    if (!usesX) xs.push(0);
    else {
      const lo = p.lo ?? -1000;
      const hi = p.hi ?? 1000;
      for (let i = 0; i < 300; i++) xs.push(lo + (hi - lo) * (0.0005 + 0.999 * rng.next()));
      xs.push(lo + (hi - lo) * 0.001, hi - (hi - lo) * 0.001);
      if (lo < 1 && hi > 1) xs.push(1);
    }
    const quantityA = q.quantityA.includes('list $S$');
    const samples = xs.map((x) => {
      const s = sdAt(p.listS, x);
      const t = p.numB !== null ? p.numB : sdAt(p.listT, x);
      return (quantityA ? [s, t] : [t, s]) as [number, number];
    });
    const expected = qcFromSamples(samples);
    return q.answer === expected ? null : `expected ${expected}`;
  },
};

/* =============================================================================================
 * 2. Standard deviation of a linear transformation (MCS), book DA-16
 * =========================================================================================== */

interface LinParams {
  mode: 'which' | 'value';
  /** which: the equations y = a x + b and the x range; greatest or least. */
  eqs: [number, number][];
  xMax: number;
  want: 'greatest' | 'least';
  /** value: data set statistics, transformation y = k x + c, statistic asked. */
  M: number;
  stat: number;
  k: number;
  c: number;
  ask: 'sd' | 'range';
  values: number[];
}

const sdLinear: Template<LinParams> = {
  id: 'data.spread.sd-linear',
  skill: 'data.spread',
  format: 'mcs',
  style: 'standard deviation after every value is transformed by y = ax + b',
  generate(rng, d) {
    const mode = d === 1 ? rng.pick(['value', 'value', 'which'] as const) : rng.pick(['which', 'value'] as const);
    const none = { eqs: [] as [number, number][], xMax: 0, want: 'greatest' as const, M: 0, stat: 0, k: 0, c: 0, ask: 'sd' as const, values: [] as number[] };
    if (mode === 'which') {
      const want: 'greatest' | 'least' = d === 3 && rng.chance(0.4) ? 'least' : 'greatest';
      const xMax = rng.pick([20, 50, 100]);
      for (;;) {
        const slopes = rng.sample([1, 2, 3, 4, 5, 6], 5).map((a) => (d === 3 && rng.chance(0.35) ? -a : a));
        const abs = slopes.map(Math.abs);
        const target = want === 'greatest' ? Math.max(...abs) : Math.min(...abs);
        const iCorrect = abs.indexOf(target);
        const intercepts = slopes.map(() => rng.int(-20, 40));
        // decoy: give a wrong equation the largest intercept
        const decoy = rng.pick(slopes.map((_, i) => i).filter((i) => i !== iCorrect));
        intercepts[decoy] = Math.max(...intercepts) + rng.int(30, 300);
        if (want === 'greatest' && intercepts[iCorrect] === Math.max(...intercepts)) continue;
        const eqs = slopes.map((a, i) => [a, intercepts[i]] as [number, number]);
        const eqText = ([a, b]: [number, number]) => `$y = ${lin([[a, 'x'], [b, '']])}$`;
        // traps: the largest intercept; the largest signed slope when a negative slope is the answer
        const wrong: Choice[] = eqs
          .map((e, i) => ({ e, i }))
          .filter(({ i }) => i !== iCorrect)
          .map(({ e, i }) => {
            let trap: string | undefined;
            if (i === decoy) trap = 'stat-sd-intercept';
            else if (want === 'greatest' && e[0] === Math.max(...slopes) && slopes[iCorrect] < 0) trap = 'stat-sd-negative-slope';
            else if (want === 'least' && e[0] === Math.min(...slopes) && e[0] < 0) trap = 'stat-sd-negative-slope';
            return { text: eqText(e), ...(trap ? { trap } : {}) };
          });
        const { choices, answer } = textChoices(rng, eqText(eqs[iCorrect]), wrong, 'random');
        const order = choices.map((c) => eqs.find((e) => eqText(e) === c.text)!);
        const [ca, cb] = eqs[iCorrect];
        return {
          params: { ...none, mode, eqs: order, xMax, want },
          q: {
            format: 'mcs',
            stem: `For each of the following equations, $y$ is computed for every integer $x$ from 1 to ${xMax}. Which equation gives the ${xMax} values of $y$ with the ${want} standard deviation?`,
            choices,
            answer,
            explanation: `Every equation transforms the same ${xMax} values of $x$ by $y = ax + b$. Adding $b$ shifts every value and does not change the standard deviation; multiplying by $a$ multiplies every distance from the mean by $|a|$. So the standard deviation of the $y$-values is $|a|$ times the standard deviation of $1, 2, \\ldots, ${xMax}$.

The ${want} standard deviation comes from the ${want} value of $|a|$: $y = ${lin([[ca, 'x'], [cb, '']])}$, with $|a| = ${Math.abs(ca)}$.${
              ca < 0 ? ' A negative slope reverses the order of the values but does not reduce their spread.' : ''
            } The large constant in $y = ${lin([[eqs[decoy][0], 'x'], [eqs[decoy][1], '']])}$ makes the values large, not spread out.`,
          },
        };
      }
    }

    // value mode
    const ask: 'sd' | 'range' = rng.chance(0.65) ? 'sd' : 'range';
    const M = rng.int(20, 80);
    const stat = ask === 'sd' ? rng.int(3, 12) : rng.int(10, 40);
    let k: number;
    let c: number;
    if (d === 1) {
      k = 1;
      c = rng.sign() * rng.int(5, 25);
    } else if (d === 2) {
      k = rng.int(2, 5);
      c = rng.chance(0.6) ? rng.sign() * rng.int(3, 20) : 0;
    } else {
      k = rng.sign() * rng.int(2, 5);
      c = rng.int(5, 60) * (k < 0 ? 1 : rng.sign());
    }
    const correct = Math.abs(k) * stat;
    const traps = [
      { value: Math.abs(k) * stat + c, trap: 'stat-sd-shift' },
      { value: k * k * stat, trap: 'stat-sd-variance' },
      { value: stat, trap: 'stat-sd-scale' },
      { value: stat + c, trap: 'stat-sd-shift' },
      { value: k * M + c, trap: 'stat-sd-is-mean' },
    ].filter((t) => t.value > 0 && t.value !== correct);
    const uniq = traps.filter((t, i) => traps.findIndex((u) => u.value === t.value) === i);
    const { choices, answer } = numericChoices(rng, {
      correct,
      traps: rng.sample(uniq, Math.min(uniq.length, 4)),
      fillers: [correct + Math.abs(k), correct * 2, correct + stat, correct - Math.abs(k)].filter((v) => v > 0),
      format: (v) => `$${fTex(v)}$`,
    });
    const statName = ask === 'sd' ? 'standard deviation' : 'range';
    const op =
      k === 1
        ? c > 0
          ? `adding $${c}$ to each value in $S$`
          : `subtracting $${-c}$ from each value in $S$`
        : `multiplying each value in $S$ by $${k}$${c === 0 ? '' : c > 0 ? ` and then adding $${c}$` : ` and then subtracting $${-c}$`}`;
    const values = choices.map((ch) => Number(ch.text.replace(/\$/g, '').replace(/\{,\}/g, '')));
    return {
      params: { ...none, mode, M, stat, k, c, ask, values },
      q: {
        format: 'mcs',
        stem: `Data set $S$ has a mean of $${M}$ and a ${statName} of $${stat}$. Data set $T$ is formed by ${op}. What is the ${statName} of data set $T$?`,
        choices,
        answer,
        explanation: `${
          k === 1
            ? `Adding or subtracting the same number shifts every value, and the mean, by that amount, so the distances between values do not change.`
            : `Multiplying every value by $${k}$ multiplies every distance between values (and from the mean) by $${Math.abs(k)}$${c === 0 ? '' : '; adding or subtracting a constant afterward shifts everything without changing those distances'}.`
        } The ${statName} of $T$ is $${Math.abs(k) === 1 ? `${correct}` : `${Math.abs(k)} \\times ${stat} = ${correct}`}$.

The mean, by contrast, does change: the mean of $T$ is $${k === 1 ? `${M} ${c < 0 ? '-' : '+'} ${Math.abs(c)}` : `${k}(${M})${c === 0 ? '' : ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}`}`} = ${num(k * M + c)}$${k < 0 ? `, and a ${statName} is never negative: use $|${k}| = ${-k}$` : ''}.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    if (p.mode === 'which') {
      // Compute every standard deviation numerically.
      const sds = p.eqs.map(([a, b]) => popSD(Array.from({ length: p.xMax }, (_, i) => a * (i + 1) + b)));
      const target = p.want === 'greatest' ? Math.max(...sds) : Math.min(...sds);
      const idx = sds.map((s, i) => (Math.abs(s - target) < 1e-9 ? i : -1)).filter((i) => i >= 0);
      if (idx.length !== 1) return 'tie between equations';
      return idx[0] === q.answer ? null : `expected ${idx[0]}`;
    }
    // Build a data set with the stated mean and statistic, transform it, measure.
    const data = p.ask === 'sd' ? [p.M - p.stat, p.M - p.stat, p.M + p.stat, p.M + p.stat] : [p.M - p.stat / 2, p.M, p.M + 1, p.M + p.stat / 2];
    if (p.ask === 'sd' && Math.abs(popSD(data) - p.stat) > 1e-9) return 'construction failed';
    const t = data.map((v) => p.k * v + p.c);
    const got = p.ask === 'sd' ? popSD(t) : Math.max(...t) - Math.min(...t);
    const idx = p.values.findIndex((v) => Math.abs(v - got) < 1e-9);
    return idx === q.answer ? null : `expected value ${got}`;
  },
};

/* =============================================================================================
 * 3. Percentiles from counts (MCS), book DA-15
 * =========================================================================================== */

interface PctParams {
  mode: 'shift' | 'between';
  N: number;
  p: number;
  m: number;
  dir: 'below' | 'above';
  p2: number;
  options: number[];
}

const percentile: Template<PctParams> = {
  id: 'data.spread.percentile',
  skill: 'data.spread',
  format: 'mcs',
  style: 'percentiles: shift a percentile by a count of values',
  generate(rng, d) {
    const mode: PctParams['mode'] = d === 3 && rng.chance(0.5) ? 'between' : 'shift';
    const N = rng.pick(d === 1 ? [200, 400, 500, 1000] : [250, 400, 500, 600, 800, 1200, 1500, 2000]);
    if (mode === 'shift') {
      for (;;) {
        const dir: 'below' | 'above' = d === 1 || rng.chance(0.65) ? 'below' : 'above';
        const ans = 5 * rng.int(3, 17);
        const s = rng.int(3, d === 1 ? 12 : 22);
        const p = dir === 'below' ? ans + s : ans - s;
        if (p < 5 || p > 97 || (s * N) % 100) continue;
        const m = (s * N) / 100;
        const start = Math.min(Math.max(5, ans - 5 * rng.int(0, 4)), 75);
        const options = [0, 1, 2, 3, 4].map((i) => start + 5 * i);
        if (!options.includes(ans)) continue;
        const nearest5 = (v: number) => 5 * Math.round(v / 5);
        const trapOf = (v: number): string | undefined => {
          if (v === ans) return undefined;
          if (v === nearest5(dir === 'below' ? p + s : p - s)) return 'stat-percentile-direction';
          if (v === nearest5(p)) return 'stat-percentile-no-shift';
          if (m < 100 && v === nearest5(dir === 'below' ? p - m : p + m)) return 'stat-percentile-count';
          return undefined;
        };
        const choices = options.map((v) => ({ text: `${ordinal(v)}`, ...(trapOf(v) ? { trap: trapOf(v)! } : {}) }));
        return {
          params: { mode, N, p, m, dir, p2: 0, options },
          q: {
            format: 'mcs',
            stem: `A data set consists of ${plain(N)} different measurements. The measurement $x$ is at the ${ordinal(p)} percentile of the data. Exactly ${m} of the measurements are ${
              dir === 'below' ? 'greater than $y$ and less than $x$' : 'greater than $x$ and less than $y$'
            }. Approximately at which percentile is the measurement $y$?`,
            choices,
            answer: options.indexOf(ans),
            explanation: `A percentile measures the percent of the data below a value. The ${m} measurements between $x$ and $y$ are $\\frac{${m}}{${num(N)}} = ${s}\\%$ of the data.

So $y$ is about ${s} percentile points ${dir === 'below' ? 'below' : 'above'} $x$: $${p} ${dir === 'below' ? '-' : '+'} ${s} = ${ans}$, the ${ordinal(ans)} percentile.

Moving by the count ${m} itself, instead of the percent it represents, confuses measurements with percentage points.`,
          },
        };
      }
    }
    // between: approximately how many values lie between two percentiles
    for (;;) {
      const p1 = 5 * rng.int(2, 9);
      const p2 = p1 + 5 * rng.int(2, 10);
      if (p2 > 95) continue;
      const ans = ((p2 - p1) * N) / 100;
      if (!Number.isInteger(ans)) continue;
      const traps = [
        { value: (p2 * N) / 100, trap: 'stat-percentile-no-shift' },
        { value: ((p1 + p2) * N) / 100, trap: 'stat-percentile-direction' },
        { value: p2 - p1, trap: 'stat-percentile-count' },
      ].filter((t) => Number.isInteger(t.value) && t.value !== ans);
      const { choices, answer } = numericChoices(rng, {
        correct: ans,
        traps,
        fillers: [ans / 2, ans * 2, ans + N / 10].filter((v) => Number.isInteger(v)),
        format: (v) => `$${fTex(v)}$`,
        step: Math.max(1, Math.round(N / 20)),
      });
      return {
        params: { mode, N, p: p1, m: 0, dir: 'below', p2, options: [] },
        q: {
          format: 'mcs',
          stem: `A data set consists of ${plain(N)} different measurements. The measurement $u$ is at the ${ordinal(p1)} percentile and the measurement $v$ is at the ${ordinal(p2)} percentile. Approximately how many of the measurements are greater than $u$ and less than $v$?`,
          choices,
          answer,
          explanation: `About ${p1}% of the measurements are below $u$ and about ${p2}% are below $v$, so about $${p2} - ${p1} = ${p2 - p1}$ percent of them lie between $u$ and $v$.

$${p2 - p1}\\%$ of $${num(N)}$ is $${num(ans)}$.`,
        },
      };
    }
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    // Simulate N distinct measurements 1..N; a value's percentile = percent of the data below it.
    const pct = (rankBelow: number) => (100 * rankBelow) / p.N;
    if (p.mode === 'shift') {
      const belowX = (p.p * p.N) / 100; // values below x
      const belowY = p.dir === 'below' ? belowX - p.m - 1 : belowX + p.m + 1;
      const yPct = pct(belowY);
      let best = 0;
      p.options.forEach((o, i) => {
        if (Math.abs(o - yPct) < Math.abs(p.options[best] - yPct)) best = i;
      });
      return best === q.answer ? null : `expected ${p.options[best]}th (y at ${yPct})`;
    }
    const belowU = Math.round((p.p * p.N) / 100);
    const belowV = Math.round((p.p2 * p.N) / 100);
    const between = belowV - belowU - 1;
    const vals = q.choices.map((c) => Number(c.text.replace(/\$/g, '').replace(/\{,\}/g, '')));
    let best = 0;
    vals.forEach((v, i) => {
      if (Math.abs(v - between) < Math.abs(vals[best] - between)) best = i;
    });
    return best === q.answer ? null : `expected about ${between}`;
  },
};

/* =============================================================================================
 * 4. Quartiles, interquartile range and box plots (NE)
 * =========================================================================================== */

type QAsk = 'iqr' | 'range' | 'q1' | 'q3' | 'diff-medians' | 'diff-iqr';

interface QuartParams {
  mode: 'list' | 'boxplot';
  list: number[];
  ask: QAsk;
}

const BOX_CTX = [
  {
    title: 'TEST SCORES',
    groups: ['Class A', 'Class B'],
    one: 'the test scores of the students in a class',
    two: 'the test scores of the students in Class A and in Class B',
    steps: [5],
    starts: [20, 25, 30, 35, 40],
  },
  {
    title: 'DAILY HIGH TEMPERATURES (°F)',
    groups: ['City P', 'City Q'],
    one: 'the daily high temperatures, in degrees Fahrenheit, in a city during one month',
    two: 'the daily high temperatures, in degrees Fahrenheit, in City P and in City Q during one month',
    steps: [2, 5],
    starts: [40, 46, 50, 56, 60],
  },
  {
    title: 'COMMUTE TIMES (MINUTES)',
    groups: ['Group 1', 'Group 2'],
    one: 'the commute times, in minutes, of the employees of a company',
    two: 'the commute times, in minutes, of the employees in Group 1 and in Group 2',
    steps: [2, 5, 10],
    starts: [0, 10],
  },
];

const quartiles: Template<QuartParams> = {
  id: 'data.spread.quartiles',
  skill: 'data.spread',
  format: 'ne',
  style: 'quartiles and interquartile range from a list or a box plot',
  generate(rng, d) {
    const mode: QuartParams['mode'] = rng.chance(d === 1 ? 0.4 : 0.35) ? 'boxplot' : 'list';
    if (mode === 'boxplot') {
      const ctx = rng.pick(BOX_CTX);
      const two = d > 1;
      const step = rng.pick(ctx.steps);
      const ticks = 12;
      const axisMin = rng.pick(ctx.starts);
      const axisMax = axisMin + ticks * step;
      const makeBox = () => {
        const pts = sortAsc(rng.sample(Array.from({ length: ticks - 1 }, (_, i) => i + 1), 5)).map((i) => axisMin + i * step);
        return { min: pts[0], q1: pts[1], median: pts[2], q3: pts[3], max: pts[4] };
      };
      const boxes = two ? [makeBox(), makeBox()] : [makeBox()];
      const ask: QAsk = two ? rng.pick(['diff-medians', 'diff-iqr', 'iqr']) : rng.pick(['iqr', 'iqr', 'range']);
      const b0 = boxes[0];
      const named = boxes.map((b, i) => ({ ...b, ...(two ? { name: ctx.groups[i] } : {}) }));
      const figure: BoxPlotFigure = { kind: 'boxplot', title: ctx.title, boxes: named, axisMin, axisMax, step };
      let answer: number;
      let stem: string;
      let expl: string;
      const traps: { value: Frac; trap: string }[] = [];
      if (ask === 'iqr') {
        const which = two ? rng.int(0, 1) : 0;
        const b = boxes[which];
        answer = b.q3 - b.q1;
        traps.push({ value: frac(b.max - b.min), trap: 'stat-iqr-range' });
        if (b.q3 - b.median !== answer) traps.push({ value: frac(b.q3 - b.median), trap: 'stat-iqr-half' });
        stem = `The box plot summarizes ${two ? ctx.two : ctx.one}. What is the interquartile range of the ${two ? `${ctx.groups[which]} ` : ''}data?`;
        expl = `The box runs from the first quartile, $${b.q1}$, to the third quartile, $${b.q3}$. The interquartile range is $${b.q3} - ${b.q1} = ${answer}$.

The whiskers show the least and greatest values; $${b.max} - ${b.min} = ${b.max - b.min}$ is the range, not the interquartile range.`;
      } else if (ask === 'range') {
        answer = b0.max - b0.min;
        traps.push({ value: frac(b0.q3 - b0.q1), trap: 'stat-iqr-range' });
        stem = `The box plot summarizes ${ctx.one}. What is the range of the data?`;
        expl = `The ends of the whiskers are the least value, $${b0.min}$, and the greatest value, $${b0.max}$. The range is $${b0.max} - ${b0.min} = ${answer}$.`;
      } else if (ask === 'diff-medians') {
        const [b1, b2] = boxes;
        if (b1.median === b2.median) return quartiles.generate(rng, d);
        const hi = b1.median > b2.median ? 0 : 1;
        answer = Math.abs(b1.median - b2.median);
        traps.push({ value: frac(Math.abs(b1.q3 - b2.q3)), trap: 'stat-boxplot-wrong-mark' });
        stem = `The box plot summarizes ${ctx.two}. The median for ${ctx.groups[hi]} is how much greater than the median for ${ctx.groups[1 - hi]}?`;
        expl = `The median is the line inside each box: $${boxes[hi].median}$ for ${ctx.groups[hi]} and $${boxes[1 - hi].median}$ for ${ctx.groups[1 - hi]}. The difference is $${answer}$.`;
      } else {
        const [b1, b2] = boxes;
        const i1 = b1.q3 - b1.q1;
        const i2 = b2.q3 - b2.q1;
        if (i1 === i2) return quartiles.generate(rng, d);
        const hi = i1 > i2 ? 0 : 1;
        answer = Math.abs(i1 - i2);
        const r1 = b1.max - b1.min;
        const r2 = b2.max - b2.min;
        if (Math.abs(r1 - r2) !== answer) traps.push({ value: frac(Math.abs(r1 - r2)), trap: 'stat-iqr-range' });
        stem = `The box plot summarizes ${ctx.two}. The interquartile range for ${ctx.groups[hi]} is how much greater than the interquartile range for ${ctx.groups[1 - hi]}?`;
        expl = `Each interquartile range is the length of the box: ${ctx.groups[0]}: $${b1.q3} - ${b1.q1} = ${i1}$; ${ctx.groups[1]}: $${b2.q3} - ${b2.q1} = ${i2}$. The difference is $${answer}$.

Comparing the whiskers would compare the ranges instead.`;
      }
      return {
        params: { mode, list: [], ask },
        q: {
          format: 'ne',
          figure,
          stem,
          answer: frac(answer),
          traps: traps.filter((t) => t.value.sign() > 0 && !t.value.eq(answer)),
          explanation: expl,
        },
      };
    }

    // list mode
    const n = d === 1 ? rng.pick([8, 10]) : d === 2 ? rng.pick([10, 12]) : rng.pick([8, 12, 14]);
    const ask: QAsk = d === 1 ? rng.pick(['q1', 'q3', 'iqr', 'range']) : 'iqr';
    const list = rng.sample(Array.from({ length: d === 3 ? 60 : 40 }, (_, i) => i + (d === 3 ? 20 : 1)), n);
    const sorted = sortAsc(list);
    const { q1, q2, q3 } = quartilesF(list);
    const shown = d === 1 ? sorted : list;
    let answer: Frac;
    const traps: { value: Frac; trap: string }[] = [];
    const range = sorted[n - 1] - sorted[0];
    if (ask === 'range') answer = frac(range);
    else if (ask === 'q1') answer = q1;
    else if (ask === 'q3') answer = q3;
    else answer = q3.sub(q1);
    if (ask === 'iqr') {
      traps.push({ value: frac(range), trap: 'stat-iqr-range' });
      if (!q3.sub(q2).eq(answer)) traps.push({ value: q3.sub(q2), trap: 'stat-iqr-half' });
      if (d > 1) {
        const lowerHalf = list.slice(0, n / 2);
        const upperHalf = list.slice(n / 2);
        const mid = (xs: number[]) => (xs.length % 2 ? frac(xs[(xs.length - 1) / 2]) : new Frac(xs[xs.length / 2 - 1] + xs[xs.length / 2], 2));
        const slip = mid(upperHalf).sub(mid(lowerHalf));
        if (!slip.eq(answer)) traps.push({ value: slip, trap: 'stat-median-unsorted' });
      }
    }
    const h = n / 2;
    const halfMedian = (start: number) => (h % 2 ? `the ${ordinal(start + (h + 1) / 2)} value, $${num(sorted[start + (h - 1) / 2])}$` : `the average of the ${ordinal(start + h / 2)} and ${ordinal(start + h / 2 + 1)} values, $\\frac{${sorted[start + h / 2 - 1]} + ${sorted[start + h / 2]}}{2} = ${fTex(start === 0 ? q1 : q3)}$`);
    const what = ask === 'range' ? 'range' : ask === 'q1' ? 'first quartile' : ask === 'q3' ? 'third quartile' : 'interquartile range';
    return {
      params: { mode, list, ask },
      q: {
        format: 'ne',
        stem: `$$${listTex(shown)}$$

What is the ${what} of the ${n} numbers listed above?`,
        answer,
        traps: traps.filter((t, i) => t.value.sign() > 0 && !t.value.eq(answer) && traps.findIndex((u) => u.value.eq(t.value)) === i),
        explanation:
          ask === 'range'
            ? `In increasing order the least number is $${sorted[0]}$ and the greatest is $${sorted[n - 1]}$, so the range is $${sorted[n - 1]} - ${sorted[0]} = ${range}$.`
            : `${d === 1 ? 'The numbers are already in increasing order' : `In increasing order: $${listTex(sorted)}$`}. The lower half is the ${h} least numbers and the upper half is the ${h} greatest.

The first quartile is the median of the lower half: ${halfMedian(0)}. The third quartile is the median of the upper half: ${halfMedian(h)}.${
                ask === 'iqr'
                  ? `

The interquartile range is $${fTex(q3)} - ${fTex(q1)} = ${fTex(answer)}$. (The range, $${range}$, uses the extremes instead of the quartiles.)`
                  : ''
              }`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    let expected: Frac;
    if (p.mode === 'boxplot') {
      const fig = q.figure as BoxPlotFigure;
      const [b1, b2] = fig.boxes;
      const stem = q.stem;
      if (p.ask === 'iqr') {
        const b = fig.boxes.length === 2 && stem.includes(`of the ${fig.boxes[1].name} data`) ? b2 : b1;
        expected = frac(b.q3 - b.q1);
      } else if (p.ask === 'range') expected = frac(b1.max - b1.min);
      else if (p.ask === 'diff-medians') expected = frac(Math.abs(b1.median - b2.median));
      else expected = frac(Math.abs(b1.q3 - b1.q1 - (b2.q3 - b2.q1)));
    } else {
      // Quartiles by rank counting: Q1 = median of the n/2 smallest, Q3 = median of the n/2 largest.
      const n = p.list.length;
      const h = n / 2;
      const kth = (k: number) => kthByRank(p.list, k);
      const medOfRanks = (from: number) => (h % 2 ? frac(kth(from + (h + 1) / 2)) : new Frac(kth(from + h / 2) + kth(from + h / 2 + 1), 2));
      const q1 = medOfRanks(0);
      const q3 = medOfRanks(h);
      expected = p.ask === 'range' ? frac(kth(n) - kth(1)) : p.ask === 'q1' ? q1 : p.ask === 'q3' ? q3 : q3.sub(q1);
    }
    return q.answer.eq(expected) ? null : `expected ${expected}`;
  },
};

export const spreadTemplates = [sdCompareQC, sdLinear, percentile, quartiles];
