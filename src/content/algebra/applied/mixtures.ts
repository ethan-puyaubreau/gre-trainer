import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { choiceValuesMatch, dx, valuedChoices, expectMcm, expectMcs, expectQc, money, NAMES, qcEnd, uniqueIndex } from './util';

const pct = (p: number | Frac) => `${p instanceof Frac ? dx(p) : p} percent`;

/* =============================================================================================
 * 1. Mixtures: combine, dilute, add pure substance, how much to add (NE) [GEN AL-G24]
 * =========================================================================================== */

interface MixParams {
  kind: 'combine' | 'add-water' | 'add-pure' | 'how-much';
  /** liters and percents */
  x: number;
  p: number;
  y: number;
  q: number;
  target: number;
}

const SUBST = [
  { solution: 'saline solution', s: 'salt' },
  { solution: 'acid solution', s: 'acid' },
  { solution: 'sugar solution', s: 'sugar' },
];

const mixture: Template<MixParams> = {
  id: 'alg.mixtures-interest.mixture',
  skill: 'alg.mixtures-interest',
  format: 'ne',
  style: 'concentration of a mixture, or how much to add',
  generate(rng, d) {
    const kind: MixParams['kind'] = d === 1 ? 'combine' : d === 2 ? rng.pick(['combine', 'add-water', 'add-pure'] as const) : rng.pick(['how-much', 'add-pure', 'add-water'] as const);
    const S = rng.pick(SUBST);
    const base: MixParams = { kind, x: 0, p: 0, y: 0, q: 0, target: 0 };
    if (kind === 'combine') {
      for (;;) {
        const x = rng.int(2, 12) * (d === 1 ? 1 : rng.pick([1, 2]));
        const y = rng.int(2, 12);
        const p = rng.int(1, 8) * 5;
        const q = p + rng.int(2, 10) * 5;
        if (x === y || q >= 100) continue;
        const c = frac(x * p + y * q, x + y);
        if (!c.mul(10).isInt()) continue;
        const avg = frac(p + q, 2);
        return {
          params: { ...base, x, p, y, q },
          q: {
            format: 'ne',
            stem: `A chemist mixes ${x} liters of a ${pct(p)} ${S.solution} with ${y} liters of a ${pct(q)} ${S.solution}. What percent of the resulting mixture is ${S.s}?`,
            answer: c,
            suffix: 'percent',
            traps: avg.eq(c) ? [] : [{ value: avg, trap: 'algw-average-percents' }],
            explanation: `Track the ${S.s}: $${dx(frac(p, 100))}(${x}) + ${dx(frac(q, 100))}(${y}) = ${dx(frac(x * p, 100))} + ${dx(frac(y * q, 100))} = ${dx(frac(x * p + y * q, 100))}$ liters of ${S.s} in $${x + y}$ liters of mixture.

Concentration: $\\frac{${dx(frac(x * p + y * q, 100))}}{${x + y}} = ${dx(c.div(100))}$, that is, ${dx(c)} percent.

The plain average of the percents (${dx(avg)}) is wrong because the amounts are different: the mixture is closer to the ${x > y ? `${p} percent` : `${q} percent`} solution, which makes up more of it.`,
          },
        };
      }
    }
    if (kind === 'add-water') {
      for (;;) {
        const x = rng.int(2, 20) * 2;
        const p = rng.int(2, 9) * 5;
        const q = rng.int(1, p / 5 - 1) * 5;
        const total = frac(x * p, q);
        if (!total.isInt()) continue;
        const w = total.sub(x);
        if (w.toNumber() > 200) continue;
        return {
          params: { ...base, x, p, target: q },
          q: {
            format: 'ne',
            stem: `A container holds ${x} liters of a ${pct(p)} ${S.solution}. How many liters of pure water must be added to the container so that the resulting solution is ${pct(q)} ${S.s}?`,
            answer: w,
            suffix: 'liters',
            traps: [{ value: total, trap: 'algw-total-vs-added' }],
            explanation: `Water adds volume but no ${S.s}. The container has $${dx(frac(p, 100))}(${x}) = ${dx(frac(x * p, 100))}$ liters of ${S.s}, and that must be ${q} percent of the new total:

$$${dx(frac(q, 100))}T = ${dx(frac(x * p, 100))} \\quad\\Rightarrow\\quad T = ${num(total)} \\text{ liters}$$

So $${num(total)} - ${x} = ${num(w)}$ liters of water must be added. ${num(total)} liters is the final volume, not the amount added.`,
          },
        };
      }
    }
    if (kind === 'add-pure') {
      for (;;) {
        const x = rng.int(2, 15) * 2;
        const p = rng.int(1, 6) * 5;
        const q = p + rng.int(1, 6) * 5;
        if (q >= 60) continue;
        const y = frac(x * (q - p), 100 - q);
        if (!y.mul(10).isInt() || y.n === 0) continue;
        const naive = frac(x * (q - p), 100);
        return {
          params: { ...base, x, p, target: q },
          q: {
            format: 'ne',
            stem: `A tank contains ${x} liters of a ${pct(p)} ${S.solution}. How many liters of pure ${S.s} must be added to the tank so that the resulting solution is ${pct(q)} ${S.s}?`,
            answer: y,
            suffix: 'liters',
            traps: naive.eq(y) || !naive.isTerminating() ? [] : [{ value: naive, trap: 'algw-pure-adds-volume' }],
            explanation: `Let $y$ be the liters of pure ${S.s} added. It increases both the ${S.s} and the total volume:

$$\\frac{${dx(frac(x * p, 100))} + y}{${x} + y} = ${dx(frac(q, 100))} \\quad\\Rightarrow\\quad ${dx(frac(x * p, 100))} + y = ${dx(frac(x * q, 100))} + ${dx(frac(q, 100))}y$$

So $${dx(frac(100 - q, 100))}y = ${dx(frac(x * (q - p), 100))}$ and $y = ${dx(y)}$ liters.

Using ${dx(frac(q - p, 100))} × ${x} = ${dx(naive)} forgets that the added ${S.s} also adds to the volume.`,
          },
        };
      }
    }
    // how much of the strong solution to add to x liters of a weak one to reach the target
    for (;;) {
      const x = rng.int(2, 20) * 2;
      const b = rng.int(1, 6) * 5;
      const a = b + rng.int(3, 10) * 5;
      const c = rng.int(b / 5 + 1, a / 5 - 1) * 5;
      if (a >= 100) continue;
      const y = frac(x * (c - b), a - c);
      if (!y.mul(10).isInt()) continue;
      const inv = frac(x * (a - c), c - b);
      return {
        params: { ...base, x, p: b, y: 0, q: a, target: c },
        q: {
          format: 'ne',
          stem: `How many liters of a ${pct(a)} ${S.solution} must be added to ${x} liters of a ${pct(b)} ${S.solution} to produce a mixture that is ${pct(c)} ${S.s}?`,
          answer: y,
          suffix: 'liters',
          traps: inv.isTerminating() && !inv.eq(y) ? [{ value: inv, trap: 'algw-mixture-ratio-inverted' }] : [],
          explanation: `Let $y$ be the liters of the ${a} percent solution. Amount of ${S.s}: $${dx(frac(a, 100))}y + ${dx(frac(b * x, 100))} = ${dx(frac(c, 100))}(y + ${x})$.

So $${dx(frac(a - c, 100))}y = ${dx(frac(x * (c - b), 100))}$ and $y = ${dx(y)}$ liters.

Quick check by balance: the ${b} percent solution is ${c - b} points below the target and the ${a} percent solution is ${a - c} points above, so the amounts must be in the ratio ${a - c} : ${c - b}, and $${x} \\times \\frac{${c - b}}{${a - c}} = ${dx(y)}$. Flipping the ratio gives $${inv.isTerminating() ? dx(inv) : num(inv)}$.`,
        },
      };
    }
  },
  check(q, { kind, x, p, y, q: qq, target }) {
    if (q.format !== 'ne') return 'wrong format';
    const ans = q.answer;
    if (kind === 'combine') {
      // Balance: x (c - p) = y (q - c)
      return frac(x).mul(ans.sub(p)).eq(frac(y).mul(frac(qq).sub(ans))) ? null : `balance fails for ${ans}`;
    }
    let solute: Frac;
    let volume: Frac;
    if (kind === 'add-water') {
      solute = frac(x * p, 100);
      volume = ans.add(x);
    } else if (kind === 'add-pure') {
      solute = frac(x * p, 100).add(ans);
      volume = ans.add(x);
    } else {
      solute = frac(x * p, 100).add(ans.mul(qq).div(100));
      volume = ans.add(x);
    }
    return solute.div(volume).mul(100).eq(target) ? null : `resulting concentration ${solute.div(volume).mul(100)} != ${target}`;
  },
};

/* =============================================================================================
 * 2. Simple vs compound interest, compounding frequency, doubling (QC) [GEN AL-G25; BOOK AL-34]
 * =========================================================================================== */

interface InterestQcParams {
  mode: 'simple-compound' | 'frequency' | 'unknown-principal' | 'doubling' | 'two-rates';
  P: number;
  r: number;
  r2: number;
  n: number;
  swap: boolean;
  K: number;
  bound: 'none' | 'gt' | 'lt';
  bv: number;
  m: number;
}

/** Value after `years` years at `rate` percent, compounded `k` times a year, by repeated multiplication. */
function grow(P: Frac, rate: number, years: number, k = 1): Frac {
  let v = P;
  for (let i = 0; i < years * k; i++) v = v.add(v.mul(rate).div(100 * k));
  return v;
}

const interestQC: Template<InterestQcParams> = {
  id: 'alg.mixtures-interest.interest-qc',
  skill: 'alg.mixtures-interest',
  format: 'qc',
  style: 'simple versus compound interest, doubling',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1 ? (['simple-compound', 'doubling', 'simple-compound'] as const) : d === 2 ? (['frequency', 'unknown-principal', 'doubling', 'simple-compound'] as const) : (['unknown-principal', 'two-rates', 'frequency'] as const),
    );
    const base: InterestQcParams = { mode, P: 0, r: 0, r2: 0, n: 0, swap: false, K: 0, bound: 'none', bv: 0, m: 0 };
    const swap = rng.chance(0.4);
    const side = (a: string, b: string) => (swap ? [b, a] : [a, b]);
    if (mode === 'simple-compound') {
      const n = rng.pick([1, 2, 2, 3]);
      const P = n === 3 ? rng.pick([10000, 20000]) : rng.pick([1000, 2000, 5000, 10000]);
      const r = rng.pick([2, 4, 5, 6, 8, 10]);
      const simple = frac(P).mul(100 + r * n).div(100);
      const comp = grow(frac(P), r, n);
      const [qa, qb] = side(
        `The value of an investment of ${money(P)} after ${n} year${n === 1 ? '' : 's'} at ${r} percent simple annual interest`,
        `The value of an investment of ${money(P)} after ${n} year${n === 1 ? '' : 's'} at ${r} percent annual interest, compounded annually`,
      );
      const answer = swap ? qcCompare(comp, simple) : qcCompare(simple, comp);
      const traps: QCQuestion['traps'] = answer !== 'C' ? { C: 'algw-simple-for-compound' } : undefined;
      return {
        params: { ...base, P, r, n, swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps,
          explanation: `Simple interest: $${num(P)}(1 + ${n} \\times ${dx(frac(r, 100))}) = ${money(simple, !simple.isInt())}$. Compound interest: $${num(P)}(${dx(frac(100 + r, 100))})^{${n}} = ${money(comp, !comp.isInt())}$.

${n === 1 ? 'For a single year the two methods agree: interest has not yet had time to earn interest.' : 'With compounding, the interest of each year also earns interest, so after the first year the compound value is larger.'} ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'frequency') {
      const P = rng.pick([1000, 2000, 4000, 10000]);
      const r = rng.pick([4, 6, 8, 10, 12]);
      const semi = grow(frac(P), r, 1, 2);
      const annual = grow(frac(P), r, 1, 1);
      const [qa, qb] = side(
        `The value after 1 year of ${money(P)} invested at ${r} percent annual interest, compounded annually`,
        `The value after 1 year of ${money(P)} invested at ${r} percent annual interest, compounded semiannually`,
      );
      const answer = swap ? qcCompare(semi, annual) : qcCompare(annual, semi);
      return {
        params: { ...base, P, r, swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps: { C: 'algw-compounding-frequency' },
          explanation: `Compounded annually: $${num(P)}(${dx(frac(100 + r, 100))}) = ${money(annual, !annual.isInt())}$. Compounded semiannually, each half year earns $\\frac{${r}}{2} = ${r / 2}$ percent: $${num(P)}(${dx(frac(200 + r, 200))})^2 = ${money(semi, !semi.isInt())}$.

The interest earned in the first half year earns interest in the second half, so semiannual compounding gives more. ${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'unknown-principal') {
      const r = rng.pick([10, 20]);
      const factor = frac((100 + r) * (100 + r), 10000); // 1.21 or 1.44
      const gain = factor.sub(1); // 0.21 or 0.44
      const K = rng.pick([100, 200, 300, 420, 500, 840]);
      const th = frac(K).div(gain);
      const bound: InterestQcParams['bound'] = rng.pick(['none', 'none', 'gt', 'lt']);
      let bv = 0;
      if (bound === 'gt') bv = Math.ceil(th.toNumber() / 100) * 100 + rng.pick([0, 100, 500]);
      if (bound === 'lt') bv = Math.floor(th.toNumber() / 100) * 100 - rng.pick([0, 100]);
      const effBound = bound === 'lt' && bv <= 0 ? 'none' : bound;
      const answer: QCChoice = effBound === 'none' ? 'D' : effBound === 'gt' ? 'A' : 'B';
      const traps: QCQuestion['traps'] = answer === 'D' ? { A: 'algw-single-case' } : { D: 'algw-single-case' };
      return {
        params: { ...base, r, K, bound: effBound, bv },
        q: {
          format: 'qc',
          info: `An investment of $x$ dollars earns ${r} percent annual interest, compounded annually.${effBound === 'gt' ? ` $x > ${num(bv)}$` : effBound === 'lt' ? ` $0 < x < ${num(bv)}$` : ''}`,
          quantityA: 'The value of the investment, in dollars, after 2 years',
          quantityB: `$x + ${num(K)}$`,
          answer,
          traps,
          explanation: `After 2 years the value is $x(${dx(frac(100 + r, 100))})^2 = ${dx(factor)}x$. Compare $${dx(factor)}x$ with $x + ${num(K)}$: subtract $x$ from both, leaving $${dx(gain)}x$ versus ${num(K)}, that is, $x$ versus $\\frac{${num(K)}}{${dx(gain)}} \\approx ${num(Math.round(th.toNumber()))}$.

${
            effBound === 'none'
              ? `The investment could be smaller or larger than that (for instance ${money(100)} or ${money(10000)}). ${qcEnd('D')}`
              : effBound === 'gt'
                ? `Since $x > ${num(bv)}$, which is more than $\\frac{${num(K)}}{${dx(gain)}}$, Quantity A is larger. ${qcEnd('A')}`
                : `Since $x < ${num(bv)}$, which is less than $\\frac{${num(K)}}{${dx(gain)}}$, Quantity B is larger. ${qcEnd('B')}`
          }`,
        },
      };
    }
    if (mode === 'doubling') {
      const k = rng.pick([3, 4, 5, 6, 8, 10]);
      const n = rng.int(2, 4);
      const exact = 2 ** n;
      const m = rng.pick([exact, exact, 2 * n, n + 1, 2 ** (n + 1), 2 ** (n - 1)]);
      const answer = qcCompare(exact, m);
      const trapAns = qcCompare(2 * n, m);
      const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-linear-growth' } : answer === 'C' ? { D: 'algw-single-case' } : undefined;
      return {
        params: { ...base, n, m, K: k },
        q: {
          format: 'qc',
          info: `The value of an investment doubles every ${k} years.`,
          quantityA: `The value of the investment after ${n * k} years`,
          quantityB: `${m} times the initial value of the investment`,
          answer,
          traps,
          explanation: `${n * k} years is ${n} periods of ${k} years, and the value doubles in each: $2^{${n}} = ${exact}$ times the initial value, whatever that value is.

Compare ${exact} with ${m}. ${qcEnd(answer)} The growth is not linear: ${n} doublings multiply by $2^{${n}}$, not by ${2 * n}.`,
        },
      };
    }
    // two-rates: interest at r1 simple vs r2 compound, same principal and years
    for (;;) {
      const n = rng.pick([2, 3]);
      const P = n === 3 ? rng.pick([10000, 20000]) : rng.pick([1000, 2000, 5000, 10000]);
      const r2 = rng.pick([4, 5, 6, 8, 10]);
      const r1 = r2 + rng.pick([0, 1]) + (rng.chance(0.5) ? 0.5 : 0);
      const simpleI = frac(P).mul(frac(Math.round(r1 * 10), 1000)).mul(n);
      const compI = grow(frac(P), r2, n).sub(P);
      if (simpleI.eq(compI)) continue;
      const [qa, qb] = side(
        `The interest earned in ${n} years on ${money(P)} at ${r1} percent simple annual interest`,
        `The interest earned in ${n} years on ${money(P)} at ${r2} percent annual interest, compounded annually`,
      );
      const answer = swap ? qcCompare(compI, simpleI) : qcCompare(simpleI, compI);
      const naive: QCChoice = r1 > r2 ? (swap ? 'B' : 'A') : 'C';
      const traps: QCQuestion['traps'] = naive !== answer ? { [naive]: 'algw-simple-for-compound' } : undefined;
      return {
        params: { ...base, P, r: r1, r2, n, swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps,
          explanation: `Simple: $${num(P)} \\times ${dx(frac(Math.round(r1 * 10), 1000))} \\times ${n} = ${money(simpleI, !simpleI.isInt())}$. Compound: $${num(P)}(${dx(frac(100 + r2, 100))})^{${n}} - ${num(P)} = ${money(compI, !compI.isInt())}$.

${qcEnd(answer)} A higher simple rate does not automatically win: compounding adds interest on interest every year.`,
        },
      };
    }
  },
  check(q, prm, rng) {
    if (prm.mode === 'simple-compound') {
      // Year-by-year: simple adds the same interest each year, compound adds interest on the current value.
      let s = frac(prm.P);
      let c = frac(prm.P);
      for (let i = 0; i < prm.n; i++) {
        s = s.add(frac(prm.P * prm.r, 100));
        c = c.mul(100 + prm.r).div(100);
      }
      return expectQc(q, prm.swap ? qcCompare(c, s) : qcCompare(s, c));
    }
    if (prm.mode === 'frequency') {
      const annual = frac(prm.P).mul(100 + prm.r).div(100);
      const semi = frac(prm.P).mul(200 + prm.r).div(200).mul(200 + prm.r).div(200);
      return expectQc(q, prm.swap ? qcCompare(semi, annual) : qcCompare(annual, semi));
    }
    if (prm.mode === 'unknown-principal') {
      const samples: [Frac, Frac][] = [];
      for (let i = 0; i < 400; i++) {
        const x = frac(rng.int(1, 2000000), 100);
        if (prm.bound === 'gt' && !x.gt(prm.bv)) continue;
        if (prm.bound === 'lt' && !x.lt(prm.bv)) continue;
        let v = x;
        for (let y = 0; y < 2; y++) v = v.add(v.mul(prm.r).div(100));
        samples.push([v, x.add(prm.K)]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    if (prm.mode === 'doubling') {
      const samples: [Frac, Frac][] = [];
      for (let i = 0; i < 20; i++) {
        const P = frac(rng.int(1, 100000));
        let v = P;
        for (let y = 1; y <= prm.n * prm.K; y++) if (y % prm.K === 0) v = v.mul(2);
        samples.push([v, P.mul(prm.m)]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    let c = frac(prm.P);
    for (let i = 0; i < prm.n; i++) c = c.mul(100 + prm.r2).div(100);
    const compI = c.sub(prm.P);
    let simpleI = frac(0);
    for (let i = 0; i < prm.n; i++) simpleI = simpleI.add(frac(prm.P * Math.round(prm.r * 10), 1000));
    return expectQc(q, prm.swap ? qcCompare(compI, simpleI) : qcCompare(simpleI, compI));
  },
};

/* =============================================================================================
 * 3. Growth computations: compound value, principal for a target, doubling, quarterly (MCS)
 *    [BOOK AL-34 doubling; GEN interest]
 * =========================================================================================== */

interface GrowthParams {
  kind: 'compound-value' | 'principal' | 'doubling-expr' | 'quarterly';
  P: number;
  r: number;
  n: number;
  I: number;
  k: number;
  /** For numeric kinds: choice values; for doubling: coefficient/exponent pairs. */
  values: Frac[];
  forms: { coef: number; pow: number }[];
  cents: boolean;
}

const growth: Template<GrowthParams> = {
  id: 'alg.mixtures-interest.growth',
  skill: 'alg.mixtures-interest',
  format: 'mcs',
  style: 'value after compounding, principal needed, doubling',
  generate(rng, d) {
    const kind: GrowthParams['kind'] = d === 1 ? rng.pick(['compound-value', 'principal'] as const) : d === 2 ? rng.pick(['compound-value', 'doubling-expr', 'principal'] as const) : rng.pick(['quarterly', 'doubling-expr', 'compound-value'] as const);
    const base: GrowthParams = { kind, P: 0, r: 0, n: 0, I: 0, k: 0, values: [], forms: [], cents: false };
    const nm = rng.pick(NAMES);
    if (kind === 'doubling-expr') {
      const k = rng.pick([3, 4, 5, 6, 7, 8, 9, 10, 12]);
      const n = rng.int(3, 5);
      const forms = [
        { coef: n, pow: 1 },
        { coef: 2 * n, pow: 1 },
        { coef: 2 ** (n - 1), pow: 1 },
        { coef: 2 ** n, pow: 1 },
        { coef: 1, pow: n },
      ];
      const uniq = forms.filter((f, i) => forms.findIndex((g) => g.coef === f.coef && g.pow === f.pow) === i);
      while (uniq.length < 5) uniq.push({ coef: 2 ** (n + uniq.length - 3), pow: 1 });
      const ordered = uniq.slice(0, 5).sort((a, b) => a.pow - b.pow || a.coef - b.coef);
      const ftex = (f: { coef: number; pow: number }) => (f.pow === 1 ? `${f.coef}P` : `P^{${f.pow}}`);
      const trapOf = (f: { coef: number; pow: number }) =>
        f.pow > 1 ? undefined : f.coef === n || f.coef === 2 * n ? 'algw-linear-growth' : f.coef === 2 ** (n - 1) ? 'algw-geo-exponent' : undefined;
      const choices: Choice[] = ordered.map((f) => {
        const t = f.coef === 2 ** n && f.pow === 1 ? undefined : trapOf(f);
        return { text: `$${ftex(f)}$`, ...(t ? { trap: t } : {}) };
      });
      const answer = ordered.findIndex((f) => f.coef === 2 ** n && f.pow === 1);
      return {
        params: { ...base, k, n, forms: ordered },
        q: {
          format: 'mcs',
          stem: `${nm} invested $P$ dollars in an account. The value of the account doubles every ${k} years. If ${nm} makes no deposits or withdrawals, which of the following represents the value of the account, in dollars, after ${n * k} years?`,
          choices,
          answer,
          explanation: `${n * k} years contain ${n} doubling periods of ${k} years each. After each period the value is multiplied by 2: $P \\to 2P \\to 4P \\to \\cdots$, so after ${n} periods it is $2^{${n}}P = ${2 ** n}P$.

$${n}P$ or $${2 * n}P$ treat the growth as linear, $${2 ** (n - 1)}P$ misses one doubling, and $P^{${n}}$ puts the exponent on the wrong thing.`,
        },
      };
    }
    let correct: Frac;
    let traps: { value: Frac; trap: string }[] = [];
    let stem: string;
    let explanation: string;
    let fmt: (v: Frac) => string;
    let params: GrowthParams;
    if (kind === 'compound-value') {
      for (;;) {
        const P = rng.pick([1000, 2000, 2500, 4000, 5000, 8000, 10000, 20000]);
        const r = rng.pick([2, 3, 4, 5, 6, 8, 10]);
        const n = d === 3 ? 3 : 2;
        const v = grow(frac(P), r, n);
        if (!v.mul(100).isInt()) continue;
        correct = v;
        const simple = frac(P).mul(100 + r * n).div(100);
        traps = [
          { value: simple, trap: 'algw-simple-for-compound' },
          { value: v.sub(P), trap: 'algw-interest-vs-value' },
        ];
        const extra = grow(frac(P), r, n + 1);
        if (extra.mul(100).isInt()) traps.push({ value: extra, trap: 'algw-seq-off-by-one' });
        const cents = !v.isInt() || traps.some((t) => !t.value.isInt());
        fmt = (x) => money(x, cents);
        params = { ...base, P, r, n, cents };
        stem = `${nm} deposited ${money(P)} in an account that earns ${r} percent annual interest, compounded annually. If no other deposits or withdrawals are made, what will the value of the account be at the end of ${n} years?`;
        explanation = `Each year the value is multiplied by $1 + ${dx(frac(r, 100))} = ${dx(frac(100 + r, 100))}$:

$$${num(P)} \\times ${dx(frac(100 + r, 100))}^{${n}} = ${dx(v)}$$

So the account holds ${money(v, cents)}. Simple interest would give only ${money(simple, cents)}, because it ignores the interest earned on interest; ${money(v.sub(P), cents)} is the interest alone, not the value.`;
        break;
      }
    } else if (kind === 'principal') {
      for (;;) {
        const r = rng.pick([2, 3, 4, 5, 6, 8]);
        const n = rng.int(2, 6);
        const P = rng.int(2, 40) * 500;
        const I = frac(P * r * n, 100);
        if (!I.isInt()) continue;
        correct = frac(P);
        const noYears = I.mul(100).div(r);
        traps = [
          { value: noYears, trap: 'algw-interest-years' },
          { value: I.mul(100).div(r * n).add(I), trap: 'algw-interest-vs-value' },
        ];
        fmt = (x) => money(x);
        params = { ...base, P, r, n, I: I.toNumber() };
        stem = `How many dollars must be invested at ${r} percent simple annual interest to earn ${money(I)} in interest in ${n} years?`;
        explanation = `Simple interest is $I = Prt$: $${num(I)} = P \\times ${dx(frac(r, 100))} \\times ${n} = ${dx(frac(r * n, 100))}P$.

So $P = \\frac{${num(I)}}{${dx(frac(r * n, 100))}} = ${num(P)}$, that is, ${money(P)}. Leaving out the ${n} years gives ${money(noYears)}, the amount that would earn ${money(I)} in a single year.`;
        break;
      }
    } else {
      // quarterly: closest value after 1 year
      const P = rng.pick([5000, 10000, 20000, 40000]);
      const r = rng.pick([4, 8, 12]);
      const exact = grow(frac(P), r, 1, 4);
      const round = (x: Frac) => frac(Math.round(x.toNumber()));
      correct = round(exact);
      const simple = frac(P).mul(100 + r).div(100);
      const semi = grow(frac(P), r, 1, 2);
      const unsplit = grow(frac(P), r, 4, 1);
      traps = [
        { value: round(simple), trap: 'algw-simple-for-compound' },
        { value: round(semi), trap: 'algw-compounding-frequency' },
        { value: round(unsplit), trap: 'algw-compound-rate-split' },
      ];
      fmt = (x) => money(x);
      params = { ...base, P, r, n: 1, k: 4 };
      stem = `${nm} deposits ${money(P)} in an account that earns ${r} percent annual interest, compounded quarterly. If no other deposits or withdrawals are made, which of the following is closest to the value of the account at the end of 1 year?`;
      explanation = `Quarterly compounding at ${r} percent per year means ${r / 4} percent per quarter, applied 4 times:

$$${num(P)}(${dx(frac(400 + r, 400))})^4 \\approx ${dx(frac(Math.round(exact.toNumber() * 100), 100))}$$

The closest choice is ${money(correct)}. Simple interest gives ${money(round(simple))} and semiannual compounding ${money(round(semi))}; using ${r} percent each quarter gives a far larger ${money(round(unsplit))}.`;
    }
    // Plain distractors on one side, rounded like the answer.
    const dir = rng.sign();
    const step = frac(Math.max(1, Math.round(correct!.toNumber() / 50 / 10) * 10));
    const fillers = [correct!.add(step.mul(dir)), correct!.add(step.mul(2 * dir)), correct!.sub(step.mul(dir))].filter((v) => v.sign() > 0 && v.mul(100).isInt());
    const { choices, answer, values } = valuedChoices(rng, { correct: correct!, traps: traps!, fillers, format: fmt!, unit: step, positive: true });
    params!.values = values;
    return { params: params!, q: { format: 'mcs', stem: stem!, choices, answer, explanation: explanation! } };
  },
  check(q, prm) {
    if (q.format !== 'mcs') return 'wrong format';
    if (prm.kind === 'doubling-expr') {
      // Simulate year by year with a concrete P and compare each form.
      const P = 3;
      let v = P;
      for (let y = 1; y <= prm.n * prm.k; y++) if (y % prm.k === 0) v *= 2;
      return expectMcs(
        q,
        uniqueIndex(prm.forms, (f) => (f.pow === 1 ? f.coef * P : P ** f.pow) === v),
      );
    }
    const fmt = (x: Frac) => money(x, prm.cents);
    const err = choiceValuesMatch(q, prm.values, fmt);
    if (err) return err;
    if (prm.kind === 'compound-value') {
      let v = frac(prm.P);
      for (let y = 0; y < prm.n; y++) v = v.add(v.mul(prm.r).div(100));
      return expectMcs(
        q,
        uniqueIndex(prm.values, (x) => x.eq(v)),
      );
    }
    if (prm.kind === 'principal') {
      return expectMcs(
        q,
        uniqueIndex(prm.values, (x) => {
          let earned = frac(0);
          for (let y = 0; y < prm.n; y++) earned = earned.add(x.mul(prm.r).div(100));
          return earned.eq(prm.I);
        }),
      );
    }
    let v = frac(prm.P);
    for (let qtr = 0; qtr < 4; qtr++) v = v.add(v.mul(prm.r).div(400));
    const dist = prm.values.map((x) => Math.abs(x.toNumber() - v.toNumber()));
    const best = Math.min(...dist);
    return expectMcs(
      q,
      uniqueIndex(dist, (x) => x === best),
    );
  },
};

/* =============================================================================================
 * 4. Which concentrations are possible for a mixture (MCM) [GEN; weighted-average range]
 * =========================================================================================== */

interface RangeParams {
  p: number;
  q: number;
  cond: 'more-low' | 'more-high' | 'twice-low';
  values: number[];
}

const possibleConcentration: Template<RangeParams> = {
  id: 'alg.mixtures-interest.possible-concentration',
  skill: 'alg.mixtures-interest',
  format: 'mcm',
  style: 'which concentrations a mixture can have (weighted average range)',
  generate(rng, d) {
    const p = rng.int(1, 6) * 5;
    const q = p + rng.int(3, 8) * 5 + (d === 3 ? rng.pick([0, 5]) : 0);
    const cond: RangeParams['cond'] = d === 1 ? rng.pick(['more-low', 'more-high'] as const) : d === 2 ? rng.pick(['more-low', 'more-high', 'twice-low'] as const) : 'twice-low';
    const mean = (p + q) / 2;
    const third = (2 * p + q) / 3;
    // Allowed interval and its endpoints' inclusion.
    const lo = cond === 'more-high' ? mean : p;
    const hi = cond === 'more-high' ? q : cond === 'more-low' ? mean : third;
    const hiIncluded = cond === 'twice-low';
    const ok = (c: number) => c > lo && (c < hi || (hiIncluded && c === hi));
    const cands = new Map<number, string | undefined>();
    const addC = (c: number, trap?: string) => {
      if (c > 0 && c < 100 && Number.isInteger(c * 2) && !cands.has(c)) cands.set(c, trap);
    };
    // inside values
    const insideOpts: number[] = [];
    for (let c = Math.ceil(lo * 2) / 2; c <= hi; c += 0.5) if (ok(c) && Number.isInteger(c)) insideOpts.push(c);
    const nIn = Math.min(insideOpts.length, rng.int(2, 3));
    for (const c of rng.sample(insideOpts, nIn)) addC(c);
    if (hiIncluded && Number.isInteger(third) && rng.chance(0.6)) addC(third);
    // boundary and outside values
    addC(mean, ok(mean) ? undefined : 'algw-average-percents');
    addC(p, 'algw-weighted-range');
    addC(q, 'algw-weighted-range');
    addC(cond === 'more-high' ? rng.int(p + 1, Math.floor(mean) - 1) : Math.min(99, Math.ceil(mean) + rng.int(1, 4)));
    addC(Math.max(1, p - rng.int(2, 5)), 'algw-weighted-range');
    addC(Math.min(99, q + rng.int(2, 6)), 'algw-weighted-range');
    const all = [...cands.entries()].map(([c, trap]) => ({ c, trap: ok(c) ? undefined : trap, correct: ok(c) }));
    const correctOnes = all.filter((x) => x.correct);
    const wrongOnes = rng.shuffle(all.filter((x) => !x.correct));
    const total = d === 1 ? 6 : 7;
    const items = [...correctOnes, ...wrongOnes.slice(0, Math.max(0, total - correctOnes.length))].sort((x, y) => x.c - y.c);
    const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${num(it.c)}$`, correct: it.correct, ...(it.trap ? { trap: it.trap } : {}) })));
    const condText =
      cond === 'more-low'
        ? 'and there are more liters of solution A than of solution B'
        : cond === 'more-high'
          ? 'and there are more liters of solution B than of solution A'
          : 'and the amount of solution A is at least twice the amount of solution B';
    const S = rng.pick(SUBST);
    const range =
      cond === 'more-low'
        ? `between ${p} and the plain average ${num(mean)}, not including either`
        : cond === 'more-high'
          ? `between the plain average ${num(mean)} and ${q}, not including either`
          : `greater than ${p} and at most $${num(frac(2 * p + q, 3))}$ (the value for exactly twice as much A as B)`;
    return {
      params: { p, q, cond, values: items.map((it) => it.c) },
      q: {
        format: 'mcm',
        stem: `Solution A is ${pct(p)} ${S.s} and solution B is ${pct(q)} ${S.s}. A mixture is made by combining $x$ liters of solution A with $y$ liters of solution B, where $x$ and $y$ are positive ${condText}. Which of the following could be the percent of ${S.s} in the mixture?`,
        instruction: 'Indicate all such percents.',
        choices,
        answer,
        explanation: `The mixture's percent is a weighted average of ${p} and ${q}: $\\frac{${p}x + ${q}y}{x + y}$. It is always strictly between ${p} and ${q}, and it equals the plain average ${num(mean)} only when $x = y$. More of solution ${cond === 'more-high' ? 'B pulls it above' : 'A pulls it below'} ${num(mean)}${
          cond === 'twice-low' ? `; with $x = 2y$ it is $\\frac{2(${p}) + ${q}}{3} = ${num(frac(2 * p + q, 3))}$, and with even more A it is lower still` : ''
        }.

So the possible percents are ${range}. ${p} and ${q} themselves would need one of the amounts to be 0.`,
      },
    };
  },
  check(q, { p, q: qq, cond, values }) {
    // For each value, solve for the ratio x/y that produces it, then test the condition on the ratio.
    return expectMcm(
      q,
      values.map((c) => {
        if (!(c > p && c < qq)) return false;
        const ratio = frac(Math.round((qq - c) * 2), Math.round((c - p) * 2)); // x / y
        if (cond === 'more-low') return ratio.gt(1);
        if (cond === 'more-high') return ratio.lt(1);
        return ratio.gt(2) || ratio.eq(2);
      }),
    );
  },
};

export const mixtureTemplates: Template<any>[] = [mixture, interestQC, growth, possibleConcentration];
