import { qcCompare } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, expectMCS, expectQC, F, pct, pickWeighted, qcEnd, qcFromFloatSamples, plainNum, swapQC } from './util';

/* ================================================================== 1. Repeating decimals vs terminating values (QC) */

type RepMode = 'sum-one' | 'vs-trunc' | 'vs-frac';

interface RepParams {
  mode: RepMode;
  /** repeating blocks, as digit strings */
  blocks: string[];
  /** the other quantity, exact */
  other: Frac;
  swap: boolean;
}

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
          ]
        : [
            ['sum-one', 3],
            ['vs-trunc', 3],
            ['vs-frac', 3],
          ],
    );
    const swap = rng.chance(0.4);
    let blocks: string[];
    let other: Frac;
    let qa: string;
    let qb: string;
    let trapRel: QCChoice | null = null;
    let why: string;
    if (mode === 'sum-one') {
      const two = d === 3 && rng.chance(0.6);
      if (two) {
        const x = rng.int(12, 87);
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
      const L = d === 1 ? 1 : rng.pick([1, 2]);
      let blk: string;
      do blk = L === 1 ? String(rng.int(1, 8)) : String(rng.int(10, 98));
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
    } else {
      const choices: [string, Frac][] = [
        ['3', F(1, 3)],
        ['6', F(2, 3)],
        ['09', F(1, 11)],
        ['18', F(2, 11)],
        ['27', F(3, 11)],
        ['36', F(4, 11)],
        ['45', F(5, 11)],
        ['54', F(6, 11)],
        ['63', F(7, 11)],
        ['81', F(9, 11)],
        ['12', F(4, 33)],
        ['15', F(5, 33)],
      ];
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
    const rel = qcCompare(v, other);
    const answer = swap ? swapQC(rel) : rel;
    const tr = trapRel && trapRel !== rel ? (swap ? swapQC(trapRel) : trapRel) : null;
    const traps: QCQuestion['traps'] = tr ? { [tr]: 'num-repeating-truncate' } : undefined;
    return {
      params: { mode, blocks, other, swap },
      q: {
        format: 'qc',
        info: 'A bar over one or more digits means that those digits repeat without end; for example, $0.\\overline{25} = 0.252525\\ldots$',
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        traps,
        explanation: `${why}

${qcEnd(answer)}`,
      },
    };
  },
  check(q, { blocks, other, swap }) {
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

/* ================================================================== 2. A power of 10 as a percent of another (MCS) */

interface PTParams {
  q: Frac;
  /** relation y = x + c for each choice; null = the multiplicative decoy */
  rels: (number | null)[];
  mult: number;
}

const QS: { q: Frac; d: number[] }[] = [
  { q: F(1), d: [1, 2] },
  { q: F(10), d: [1, 2] },
  { q: F(1, 100), d: [2, 3] },
  { q: F(1000), d: [2, 3] },
  { q: F(1, 1000), d: [3] },
  { q: F(10000), d: [3] },
];

const percentPowerTen: Template<PTParams> = {
  id: 'arith.decimals.percent-power-ten',
  skill: 'arith.decimals',
  format: 'mcs',
  style: 'a power of 10 written as a percent of another power of 10',
  generate(rng, d) {
    const { q } = rng.pick(QS.filter((x) => x.d.includes(d)));
    // 10^x = (q / 100) 10^y  ->  x = y + log10(q) - 2  ->  y = x + (2 - log10 q)
    const lg = Math.round(Math.log10(q.toNumber()));
    const c = 2 - lg;
    const forgot100 = -lg; // treated q% as q
    const reversed = -c;
    const mult = 10 ** Math.abs(c === 0 ? 2 : c);
    const withMult = rng.chance(0.4);
    const nNum = withMult ? 4 : 5;
    // required distractors, then neighbors chosen so that c lands at a random rank among the numeric choices
    const required = [reversed, ...(rng.chance(0.7) ? [forgot100] : [])].filter((v, i, arr) => v !== c && arr.indexOf(v) === i);
    const nb = required.filter((v) => v < c).length;
    const na = required.length - nb;
    const rank = rng.int(nb, nNum - 1 - na);
    const below = rng.shuffle([c - 1, c - 2, c - 3, c - 4, c - 5].filter((v) => !required.includes(v))).slice(0, rank - nb);
    const above = rng.shuffle([c + 1, c + 2, c + 3, c + 4, c + 5].filter((v) => !required.includes(v))).slice(0, nNum - 1 - na - rank);
    const numeric = [c, ...required, ...below, ...above].sort((a, b) => a - b);
    const final: (number | null)[] = withMult ? (rng.chance(0.5) ? [null, ...numeric] : [...numeric, null]) : numeric;
    const relTex = (r: number | null) => (r === null ? `$y = ${num(mult)}x$` : r === 0 ? '$y = x$' : `$y = x ${r > 0 ? '+' : '-'} ${Math.abs(r)}$`);
    const trapOf = (r: number | null) => (r === null ? undefined : r === c ? undefined : r === reversed ? 'num-exponent-sign' : r === forgot100 ? 'num-percent-as-number' : undefined);
    const choices = final.map((r) => ({ text: relTex(r), ...(trapOf(r) ? { trap: trapOf(r)! } : {}) }));
    const qTex = pct(q);
    const qDec = q.div(100);
    return {
      params: { q, rels: final, mult },
      q: {
        format: 'mcs',
        stem: `If $x$ and $y$ are integers and $10^{x}$ is equal to $${qTex}$ of $10^{y}$, which of the following must be true?`,
        choices,
        answer: final.indexOf(c),
        explanation: `$${qTex}$ is $\\frac{${q.isInt() ? num(q.toNumber()) : decimal(q)}}{100} = ${decimal(qDec)} = 10^{${lg - 2}}$. So $10^{x} = 10^{${lg - 2}} \\cdot 10^{y} = 10^{y ${lg - 2 < 0 ? '-' : '+'} ${Math.abs(lg - 2)}}$, which means $x = y ${lg - 2 < 0 ? '-' : '+'} ${Math.abs(lg - 2)}$, that is, ${relTex(c)}.

${
          forgot100 === reversed
            ? `Forgetting to divide the percent by 100, or moving the exponent to the wrong side, gives ${relTex(reversed)}.`
            : `Two slips to avoid: forgetting that a percent is divided by 100 (that would give ${relTex(forgot100)}), and moving the exponent to the wrong side (${relTex(reversed)}).`
        } Exponents of 10 add and subtract; they do not multiply the variables.`,
      },
    };
  },
  check(q, { q: qq, rels, mult }) {
    // Numeric check with actual numbers: for several y, find x with 10^x = (q/100) 10^y, then test each relation.
    const ok = rels.map((r) =>
      [3, 7, 12].every((y) => {
        const x = Math.round(Math.log10((qq.toNumber() / 100) * 10 ** y));
        return r === null ? y === mult * x : y === x + r;
      }),
    );
    const hits = ok.flatMap((v, i) => (v ? [i] : []));
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
      return {
        params: { mode, k, dir: 'right', c: F(c) },
        q: {
          format: 'ne',
          stem: `When the decimal point of a certain positive number is moved ${k} places to the right, the result is ${c} times the reciprocal of the original number. What is the original number?`,
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
    return {
      params: { mode, k, dir, c },
      q: {
        format: 'ne',
        stem,
        answer: x,
        traps: wrong.isTerminating() && !wrong.eq(x) ? [{ value: wrong, trap: 'num-decimal-shift' }] : [],
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
