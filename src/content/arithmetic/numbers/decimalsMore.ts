import { qcCompare } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, expectMCS, expectQC, F, pickWeighted, qcEnd, qcFromFloatSamples, plainNum, relClose, swapQC } from './util';

/* ================================================================== 1. Repeating decimals vs terminating values (QC) */

type RepMode = 'sum-one' | 'vs-trunc' | 'vs-frac' | 'digit';

interface RepParams {
  mode: RepMode;
  /** repeating blocks, as digit strings */
  blocks: string[];
  /** the other quantity, exact */
  other: Frac;
  swap: boolean;
}

const QC_REL_WORDS: Record<QCChoice, string> = { A: 'Quantity A greater', B: 'Quantity B greater', C: 'the two quantities equal', D: 'an undetermined relation' };
const repTex = (block: string) => `0.\\overline{${block}}`;
const repValue = (block: string) => F(Number(block), 10 ** block.length - 1);

const repeatingQC: Template<RepParams> = {
  id: 'arith.decimals.repeating-qc',
  skill: 'arith.decimals',
  format: 'qc',
  style: 'repeating decimals compared with terminating values',
  generate(rng, d) {
    const mode = pickWeighted<RepMode>(
      rng,
      d === 1
        ? [
            ['sum-one', 4],
            ['vs-trunc', 3],
            ['vs-frac', 2],
            ['digit', 1],
          ]
        : [
            ['sum-one', 3],
            ['vs-trunc', 3],
            ['vs-frac', 3],
            ['digit', 3],
          ],
    );
    const swap = rng.chance(0.4);
    let blocks: string[];
    let other: Frac;
    let qa: string;
    let qb: string;
    let trapRel: QCChoice | null = null;
    let why: string;
    let relOverride: QCChoice | null = null;
    let extraInfo = '';
    if (mode === 'sum-one') {
      const two = d >= 2 && rng.chance(d === 2 ? 0.6 : 0.7);
      if (two) {
        const x = d === 2 ? rng.int(12, 49) : rng.int(50, 87);
        const s = pickWeighted(rng, [
          [99, 3],
          [100, 3],
          [rng.int(90, 98), 2],
        ] as [number, number][]);
        const y = s - x;
        blocks = [String(x).padStart(2, '0'), String(y).padStart(2, '0')];
      } else {
        // three one-digit repeating decimals
        const s = pickWeighted(rng, [
          [9, 3],
          [10, 2.5],
          [11, 1],
          [rng.int(5, 8), 2],
        ] as [number, number][]);
        let ds: number[];
        do ds = [rng.int(1, 6), rng.int(1, 6)];
        while (s - ds[0] - ds[1] < 1 || s - ds[0] - ds[1] > 9);
        blocks = [...ds, s - ds[0] - ds[1]].map(String);
      }
      other = F(1);
      const v = blocks.map(repValue).reduce((a, b) => a.add(b), F(0));
      const naive = blocks.map((b) => F(Number(b), 10 ** b.length)).reduce((a, b) => a.add(b), F(0));
      const naiveRel = qcCompare(naive, 1);
      const rel = qcCompare(v, 1);
      if (naiveRel !== rel) trapRel = naiveRel;
      qa = `$${blocks.map(repTex).join(' + ')}$`;
      qb = '$1$';
      const L = blocks[0].length;
      const den = 10 ** L - 1;
      const total = blocks.reduce((t, b) => t + Number(b), 0);
      why = `Write each repeating decimal as a fraction: ${blocks.map((b) => `$${repTex(b)} = \\frac{${Number(b)}}{${den}}$`).join(', ')}. The sum is $\\frac{${total}}{${den}}$${
        v.eq(1) ? ' $= 1$' : `, which is ${v.gt(1) ? 'greater' : 'less'} than 1`
      }.${trapRel ? ` Adding only the digits you see ($${decimal(naive)}$) ignores that every repeating decimal is a little more than its first ${L === 1 ? 'digit' : 'block'}.` : ''}`;
    } else if (mode === 'vs-trunc') {
      const L = d === 1 ? 1 : 2;
      let blk: string;
      do blk = L === 1 ? String(rng.int(1, 8)) : String(d === 2 ? rng.int(10, 49) : rng.int(50, 98));
      while (L === 2 && blk[0] === blk[1]);
      blocks = [blk];
      const v = repValue(blk);
      const kase = rng.pick(['trunc', 'longer', 'next'] as const);
      // trunc: 0.ab (A); longer: 0.abab (A); next: round up, e.g. 0.28 for 0.2727... (B), or 0.ab + tiny that is still below (A)
      if (kase === 'trunc') other = F(Number(blk), 10 ** L);
      else if (kase === 'longer') other = F(Number(blk + blk), 10 ** (2 * L));
      else other = F(Number(blk) + 1, 10 ** L);
      const rel = qcCompare(v, other);
      if (rel !== 'C' && kase !== 'next') trapRel = 'C';
      qa = `$${repTex(blk)}$`;
      qb = `$${decimal(other)}$`;
      why = `$${repTex(blk)} = 0.${blk.repeat(L === 1 ? 6 : 3)}\\ldots$ keeps going after $${decimal(other)}$${
        kase === 'next' ? '' : ' stops'
      }. ${
        kase === 'next'
          ? `It starts with $0.${blk}$, so it is less than $${decimal(other)}$: indeed $${repTex(blk)} = \\frac{${Number(blk)}}{${10 ** L - 1}} \\approx ${v.toNumber().toFixed(4)}$.`
          : `The two agree on the digits shown, and the repeating decimal has more nonzero digits after them, so it is greater.`
      }`;
    } else if (mode === 'digit') {
      // x is a digit: 0.xxx... = x/9 runs from 1/9 to 1 (and 0.999... is exactly 1), so a comparison value inside that range cannot be decided
      blocks = [];
      const others: Frac[] = [F(1, 5), F(1, 4), F(3, 10), F(1, 3), F(2, 5), F(1, 2), F(3, 5), F(2, 3), F(3, 4), F(4, 5), F(9, 10), F(1), F(1, 10), F(1, 20)];
      other = rng.pick(others);
      const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const rels = new Set(xs.map((x) => qcCompare(F(x, 9), other)));
      relOverride = rels.size === 1 ? [...rels][0] : 'D';
      const first = qcCompare(F(1, 9), other);
      trapRel = relOverride === 'D' ? first : null;
      extraInfo = ' The digit $x$ is a positive integer less than 10.';
      qa = '$0.\\overline{x}$';
      qb = `$${other.isTerminating() ? decimal(other) : other.toTex()}$`;
      const lo = xs.find((x) => qcCompare(F(x, 9), other) !== first);
      why =
        relOverride === 'D'
          ? `$0.\\overline{x} = \\frac{x}{9}$, so it runs from $\\frac{1}{9} \\approx 0.111$ (for $x = 1$) to $0.\\overline{9} = 1$ (for $x = 9$). $x = 1$ gives ${QC_REL_WORDS[first]}, but $x = ${lo}$ gives ${QC_REL_WORDS[qcCompare(F(lo!, 9), other)]}. Two allowed values disagree, so the relationship cannot be determined.`
          : `$0.\\overline{x} = \\frac{x}{9}$ lies between $\\frac{1}{9}$ and $1$ for every allowed $x$, and every such value is ${relOverride === 'A' ? 'greater' : 'less'} than $${other.isTerminating() ? decimal(other) : other.toTex()}$.`;
    } else {
      const choices: [string, Frac][] = (
        d === 1
          ? [
              ['3', F(1, 3)],
              ['6', F(2, 3)],
              ['09', F(1, 11)],
              ['18', F(2, 11)],
              ['27', F(3, 11)],
            ]
          : d === 2
            ? [
                ['36', F(4, 11)],
                ['45', F(5, 11)],
                ['54', F(6, 11)],
                ['63', F(7, 11)],
                ['81', F(9, 11)],
              ]
            : [
                ['12', F(4, 33)],
                ['15', F(5, 33)],
                ['21', F(7, 33)],
                ['24', F(8, 33)],
                ['30', F(10, 33)],
                ['39', F(13, 33)],
              ]
      ) as [string, Frac][];
      const [blk, frac] = rng.pick(choices);
      blocks = [blk];
      const kase = rng.pick(['C', 'C', 'near'] as const);
      if (kase === 'C') other = frac;
      else {
        // a nearby fraction with a small denominator
        const near = [F(frac.n, frac.d + 1), F(frac.n + 1, frac.d + 1), F(frac.n * 10 + 1, frac.d * 10), F(Number(blk), 10 ** blk.length)].filter((x) => !x.eq(frac));
        other = rng.pick(near);
      }
      qa = `$${repTex(blk)}$`;
      qb = `$${other.toTex()}$`;
      const v = repValue(blk);
      why = `$${repTex(blk)} = \\frac{${Number(blk)}}{${10 ** blk.length - 1}} = ${v.toTex()}$. Compare $${v.toTex()}$ with $${other.toTex()}$${
        v.eq(other) ? ': they are equal' : `: cross-multiplying, $${v.n} \\cdot ${other.d} = ${num(v.n * other.d)}$ and $${other.n} \\cdot ${v.d} = ${num(other.n * v.d)}$`
      }.`;
    }
    const v = blocks.map(repValue).reduce((a, b) => a.add(b), F(0));
    const rel = relOverride ?? qcCompare(v, other);
    const answer = swap ? swapQC(rel) : rel;
    const tr = trapRel && trapRel !== rel ? (swap ? swapQC(trapRel) : trapRel) : null;
    const traps: QCQuestion['traps'] = tr ? { [tr]: mode === 'digit' ? 'tested-one-value' : 'num-repeating-truncate' } : undefined;
    return {
      params: { mode, blocks, other, swap },
      q: {
        format: 'qc',
        info: `A bar over one or more digits means that those digits repeat without end; for example, $0.\\overline{25} = 0.252525\\ldots$${extraInfo}`,
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        traps,
        explanation: `${why}

${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, blocks, other, swap }) {
    if (mode === 'digit') {
      // x = 1..9: expand 0.xxx... to 16 digits and compare with the other value
      const samples: [number, number][] = [];
      for (let x = 1; x <= 9; x++) {
        let sum = 0;
        for (let i = 0; i < 16; i++) sum += x * 10 ** -(i + 1);
        samples.push(swap ? [other.toNumber(), sum] : [sum, other.toNumber()]);
      }
      return expectQC(q, qcFromFloatSamples(samples, 1e-12));
    }
    // Expand the repeating decimals to many digits and add them as floating-point numbers.
    let sum = 0;
    for (const b of blocks) {
      const digits = b.repeat(Math.ceil(30 / b.length)).slice(0, 30);
      let x = 0;
      for (let i = 0; i < 16; i++) x += Number(digits[i]) * 10 ** -(i + 1);
      sum += x;
    }
    const o = other.toNumber();
    return expectQC(q, qcFromFloatSamples([swap ? [o, sum] : [sum, o]], 1e-12));
  },
};

/* ================================================================== 2. A percent of a number written with a power of 10 (MCS) */

interface PTParams {
  /** the percent, e.g. 0.5 for "0.5 percent" */
  q: Frac;
  /** mantissa and exponent of the number: b x 10^k */
  b: Frac;
  k: number;
  /** the five choices, as exact values */
  values: Frac[];
}

// Each level has its own percents and mantissas, so no question appears at two levels.
const PT_Q: Record<1 | 2 | 3, Frac[]> = {
  1: [F(1), F(10), F(5), F(50), F(20), F(25)],
  2: [fdec(0.5), fdec(2.5), fdec(0.1), fdec(0.2), fdec(0.4), fdec(0.8)],
  3: [fdec(0.05), fdec(0.25), fdec(0.02), fdec(0.15), F(125), F(150)],
};
const PT_B: Record<1 | 2 | 3, Frac[]> = {
  1: [2, 3, 4, 5, 6, 8].map((x) => F(x)),
  2: [1.2, 2.4, 3.5, 4.5, 6.4, 7.5].map(fdec),
  3: [1.6, 2.5, 3.2, 4.8, 7.2, 9.6].map(fdec),
};

/** Exact Frac from a short decimal literal. */
function fdec(x: number): Frac {
  return F(Math.round(x * 1000), 1000);
}

const percentPowerTen: Template<PTParams> = {
  id: 'arith.decimals.percent-power-ten',
  skill: 'arith.decimals',
  format: 'mcs',
  style: 'a percent of a number written with a power of 10, answered as a decimal',
  generate(rng, d) {
    const level = d as 1 | 2 | 3;
    for (;;) {
      const q = rng.pick(PT_Q[level]);
      const b = rng.pick(PT_B[level]);
      const k = rng.int(level === 1 ? 2 : level === 2 ? 3 : 4, level === 1 ? 5 : level === 2 ? 7 : 8);
      const N = b.mul(10 ** k);
      const value = q.div(100).mul(N);
      if (value.lt(F(1, 100)) || value.gt(F(10 ** 6))) continue;
      // Every wrong value is a decimal point put in the wrong place by a known slip.
      const slips: { f: Frac; trap: string; say: string }[] = [
        { f: value.mul(100), trap: 'int-percent-not-divided', say: 'treating the percent as a plain number and never dividing by 100' },
        { f: value.div(100), trap: 'num-decimal-shift', say: 'dividing by 100 twice' },
        { f: value.mul(10), trap: 'num-decimal-shift', say: 'moving the decimal point one place too far to the right' },
        { f: value.div(10), trap: 'num-decimal-shift', say: 'moving the decimal point one place too far to the left' },
        { f: value.mul(1000), trap: 'num-decimal-shift', say: 'moving the decimal point three places too far to the right' },
        { f: value.div(1000), trap: 'num-decimal-shift', say: 'moving the decimal point three places too far to the left' },
        { f: value.mul(10000), trap: 'num-decimal-shift', say: 'counting four extra zeros' },
        { f: value.div(10000), trap: 'num-decimal-shift', say: 'dividing by 100 twice and then shifting again' },
      ].filter((x) => x.f.isTerminating());
      const wrong = rng.shuffle(slips);
      const below = wrong.filter((x) => x.f.lt(value));
      const above = wrong.filter((x) => x.f.gt(value));
      let target = rng.int(0, 4);
      target = Math.max(Math.min(target, below.length), 4 - above.length);
      const picked = [...below.slice(0, target), ...above.slice(0, 4 - target)];
      if (picked.length !== 4) continue;
      const all = [{ f: value, ok: true, trap: '', say: '' }, ...picked.map((x) => ({ ...x, ok: false }))].sort((x, y) => x.f.cmp(y.f));
      const fmt = (v: Frac) => (v.isInt() ? num(v.toNumber()) : decimal(v));
      const texts = all.map((x) => `$${fmt(x.f)}$`);
      if (new Set(texts).size !== 5) continue;
      const choices = all.map((x, i) => ({ text: texts[i], ...(x.ok ? {} : { trap: x.trap }) }));
      const answer = all.findIndex((x) => x.ok);
      const bTex = `${decimal(b)} \\times 10^{${k}}`;
      const stem = rng.chance(0.5) ? `What is ${plainNum(q)} percent of $${bTex}$?` : `Which of the following is equal to ${plainNum(q)} percent of $${bTex}$?`;
      const cited = picked.slice(0, 2).map((x) => `$${fmt(x.f)}$ comes from ${x.say}`);
      return {
        params: { q, b, k, values: all.map((x) => x.f) },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `Turn the percent into a decimal first: ${plainNum(q)} percent means ${plainNum(q)} out of 100, that is $${decimal(q.div(100))}$.

The number is $${bTex} = ${fmt(N)}$, so the answer is $${decimal(q.div(100))} \\times ${fmt(N)} = ${fmt(value)}$.

Check: 1 percent of $${fmt(N)}$ is $${fmt(N.div(100))}$, and ${plainNum(q)} percent is ${plainNum(q)} times that: $${fmt(N.div(100).mul(q))}$.

Trap: ${cited.join('; ')}. A percent is always a number out of 100.`,
        },
      };
    }
  },
  check(q, { q: qq, b, k, values }) {
    // Floating-point evaluation of the percent of the number, compared with each choice.
    const expected = (qq.toNumber() / 100) * (b.toNumber() * 10 ** k);
    const hits = values.flatMap((v, i) => (relClose(v.toNumber(), expected, 1e-9) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 3. Moving the decimal point (NE) */

type DPMode = 'difference' | 'sum' | 'reciprocal';

interface DPParams {
  mode: DPMode;
  k: number;
  dir: 'left' | 'right';
  c: Frac;
}

const decimalPointNE: Template<DPParams> = {
  id: 'arith.decimals.decimal-point-ne',
  skill: 'arith.decimals',
  format: 'ne',
  style: 'moving the decimal point: find the number',
  generate(rng, d) {
    const mode: DPMode = d === 1 ? 'difference' : d === 2 ? rng.pick(['difference', 'sum'] as const) : rng.pick(['reciprocal', 'sum', 'reciprocal'] as const);
    if (mode === 'reciprocal') {
      // x * 10^k = c / x  ->  x^2 = c * 10^-k
      let r: number;
      let k: number;
      do {
        r = rng.pick([2, 3, 4, 5, 6, 7, 8, 9]);
        k = rng.pick([2, 4, 6]);
      } while (r === 3 && k === 6);
      const c = r * r;
      const x = F(r, 10 ** (k / 2));
      const wrongWay = F(r * 10 ** (k / 2));
      const noRoot = F(c, 10 ** k);
      if (wrongWay.eq(x) || noRoot.eq(x)) return decimalPointNE.generate(rng, d);
      return {
        params: { mode, k, dir: 'right', c: F(c) },
        q: {
          format: 'ne',
          stem: `When the decimal point of a certain positive number is moved ${k} places to the right, the new number equals ${c} times the reciprocal of the starting number. What was the starting number?`,
          answer: x,
          traps: [
            { value: wrongWay, trap: 'num-decimal-shift' },
            { value: noRoot, trap: 'num-decimal-shift' },
          ].filter((t) => !t.value.eq(x)),
          explanation: `Moving the decimal point ${k} places to the right multiplies by $10^{${k}} = ${num(10 ** k)}$. If the number is $x$, then $${num(10 ** k)}x = \\frac{${c}}{x}$, so $x^2 = \\frac{${c}}{${num(10 ** k)}}$ and $x = \\frac{${r}}{${num(10 ** (k / 2))}} = ${decimal(x)}$.

Check: moving the point gives $${decimal(x.mul(10 ** k))}$, and $${c} \\times \\frac{1}{${decimal(x)}} = ${decimal(F(c).div(x))}$. Do not forget the square root: $x^2$, not $x$, equals $${decimal(noRoot)}$.`,
        },
      };
    }
    const k = d === 1 ? 1 : rng.pick([1, 2]);
    const dir: 'left' | 'right' = mode === 'sum' ? 'left' : rng.chance(0.5) ? 'left' : 'right';
    let x: Frac;
    do x = F(rng.int(11, 999), rng.pick([1, 10]));
    while (x.isInt() && x.n % 10 === 0);
    const shifted = dir === 'left' ? x.div(10 ** k) : x.mul(10 ** k);
    const c = mode === 'sum' ? x.add(shifted) : shifted.sub(x).abs();
    // Trap: modelling the move in the other direction.
    const factor = 10 ** k;
    const wrong =
      mode === 'sum' ? c.div(1 + factor) : dir === 'left' ? c.div(factor - 1) : c.mul(factor).div(factor - 1);
    const place = `${k === 1 ? 'one place' : `${k} places`} to the ${dir}`;
    const stem =
      mode === 'sum'
        ? `When the decimal point of a positive number is moved ${place}, the new number is added to the original number, and the sum is ${plainNum(c)}. What is the original number?`
        : `Moving the decimal point of a positive number ${place} ${dir === 'left' ? 'decreases' : 'increases'} the number by ${plainNum(c)}. What is the original number?`;
    const mult = dir === 'left' ? `\\frac{x}{${num(factor)}}` : `${num(factor)}x`;
    const eq =
      mode === 'sum'
        ? `x + ${mult} = ${decimal(c)}`
        : dir === 'left'
          ? `x - ${mult} = ${decimal(c)}`
          : `${mult} - x = ${decimal(c)}`;
    const coef = mode === 'sum' ? F(1).add(F(1, factor)) : dir === 'left' ? F(1).sub(F(1, factor)) : F(factor - 1);
    if (wrong.eq(x)) return decimalPointNE.generate(rng, d); // the slip would give the right number: draw again
    return {
      params: { mode, k, dir, c },
      q: {
        format: 'ne',
        stem,
        answer: x,
        traps: wrong.isTerminating() ? [{ value: wrong, trap: 'num-decimal-shift' }] : [],
        explanation: `Moving the decimal point ${place} ${dir === 'left' ? 'divides' : 'multiplies'} the number by ${num(factor)}. With $x$ the original number: $${eq}$, so $${decimal(coef)}x = ${decimal(c)}$ and $x = ${decimal(x)}$.

Check: ${dir === 'left' ? `$${decimal(x)} \\to ${decimal(shifted)}$` : `$${decimal(x)} \\to ${decimal(shifted)}$`}, and ${mode === 'sum' ? `$${decimal(x)} + ${decimal(shifted)} = ${decimal(c)}$` : `the difference is $${decimal(c)}$`}.`,
      },
    };
  },
  check(q, { mode, k, dir, c }) {
    if (q.format !== 'ne') return 'wrong format';
    // Move the decimal point of the proposed answer in its decimal string, then verify the statement.
    const shiftStr = (s: string, places: number, toRight: boolean): number => {
      const [w, f = ''] = s.split('.');
      const digits = w + f;
      let point = w.length + (toRight ? places : -places);
      let ds = digits;
      while (point <= 0) {
        ds = '0' + ds;
        point++;
      }
      while (point > ds.length) ds += '0';
      return Number(`${ds.slice(0, point)}.${ds.slice(point) || '0'}`);
    };
    const xs = q.answer.toDecimalString();
    const x = q.answer.toNumber();
    if (mode === 'reciprocal') {
      const moved = shiftStr(xs, k, true);
      return Math.abs(moved - c.toNumber() / x) < 1e-9 * Math.max(1, moved) ? null : `moved ${moved} != ${c} / ${x}`;
    }
    const moved = shiftStr(xs, k, dir === 'right');
    const v = mode === 'sum' ? x + moved : Math.abs(moved - x);
    return close(v, c.toNumber()) ? null : `moving the point of ${xs} gives ${v}, not ${c}`;
  },
};

export const decimalExtraTemplates = [repeatingQC, percentPowerTen, decimalPointNE];
