import { flaggedChoices, qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { choiceValuesMatch, dx, trapChoices, expectMcm, expectMcs, expectQc, money, NAMES, qcEnd, uniqueIndex } from './util';

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
            explanation: `Two solutions are mixed in different amounts, so track the ${S.s} itself: $${dx(frac(p, 100))}(${x}) + ${dx(frac(q, 100))}(${y}) = ${dx(frac(x * p, 100))} + ${dx(frac(y * q, 100))} = ${dx(frac(x * p + y * q, 100))}$ liters of ${S.s} in $${x + y}$ liters of mixture.

Concentration: $\\frac{${dx(frac(x * p + y * q, 100))}}{${x + y}} = ${dx(c.div(100))}$, that is, ${dx(c)} percent.

Check: the result lies between ${p} and ${q}, closer to the ${x > y ? `${p} percent` : `${q} percent`} solution, which makes up more of the mixture.

Trap: the plain average of the percents, ${dx(avg)}, is right only for equal volumes, but here the volumes are ${x} and ${y} liters. Rule: weight each percent by its volume.`,
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
            explanation: `Water adds volume but no ${S.s}, so the amount of ${S.s} stays fixed while the total grows. The container has $${dx(frac(p, 100))}(${x}) = ${dx(frac(x * p, 100))}$ liters of ${S.s}, and that must be ${q} percent of the new total:

$$${dx(frac(q, 100))}T = ${dx(frac(x * p, 100))} \\quad\\Rightarrow\\quad T = ${num(total)} \\text{ liters}$$

So $${num(total)} - ${x} = ${num(w)}$ liters of water must be added.

Check: $\\frac{${dx(frac(x * p, 100))}}{${num(total)}} = ${dx(frac(q, 100))}$, that is, ${q} percent.

Trap: ${num(total)} liters is the final volume, not the amount added; adding that much water would bring the volume to ${num(total.add(x))} liters. Rule: water added = final volume $-$ starting volume.`,
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
            explanation: `Pure ${S.s} is all ${S.s}, so adding it changes the amount and the volume together. Let $y$ be the liters added:

$$\\frac{${dx(frac(x * p, 100))} + y}{${x} + y} = ${dx(frac(q, 100))} \\quad\\Rightarrow\\quad ${dx(frac(x * p, 100))} + y = ${dx(frac(x * q, 100))} + ${dx(frac(q, 100))}y$$

So $${dx(frac(100 - q, 100))}y = ${dx(frac(x * (q - p), 100))}$ and $y = ${dx(y)}$ liters.

Check: $\\frac{${dx(frac(x * p, 100).add(y))}}{${dx(y.add(x))}} = ${dx(frac(q, 100))}$, that is, ${q} percent.

Trap: $${dx(frac(q - p, 100))} \\times ${x} = ${dx(naive)}$ forgets that the added ${S.s} also adds to the volume, so it falls short of ${q} percent. Rule: pure ${S.s} raises the amount and the total together.`,
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
          explanation: `Two strengths and a target: write the amount of ${S.s} before and after. Let $y$ be the liters of the ${a} percent solution. Amount of ${S.s}: $${dx(frac(a, 100))}y + ${dx(frac(b * x, 100))} = ${dx(frac(c, 100))}(y + ${x})$.

So $${dx(frac(a - c, 100))}y = ${dx(frac(x * (c - b), 100))}$ and $y = ${dx(y)}$ liters.

Quick check by balance: the ${b} percent solution is ${c - b} points below the target and the ${a} percent solution is ${a - c} points above, so the amounts must be in the ratio ${a - c} : ${c - b}, and $${x} \\times \\frac{${c - b}}{${a - c}} = ${dx(y)}$. Trap: flipping the ratio gives $${inv.isTerminating() ? dx(inv) : num(inv)}$, which would put more of the weaker solution than of the stronger one at a target nearer the stronger one. Rule: amounts are in inverse proportion to the distances from the target.`,
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
  mode: 'simple-compound' | 'frequency' | 'unknown-principal' | 'doubling' | 'two-rates' | 'years-unknown';
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

/** "(1.04)" or "(1.04)^{3}": the yearly multiplier raised to n (no exponent 1). */
const mult = (r: number, n: number) => (n === 1 ? `(${dx(frac(100 + r, 100))})` : `(${dx(frac(100 + r, 100))})^{${n}}`);

/** Three ways of naming the same account: the noun of "The ... of" and the subject with its principal. */
const ACCOUNTS = [
  (P: number) => `The value of an investment of ${money(P)}`,
  (P: number) => `The balance of an account opened with ${money(P)}`,
  (P: number) => `The amount in a savings account opened with ${money(P)}`,
];
const DOUBLERS = [
  (k: number) => `The value of an investment doubles every ${k} years.`,
  (k: number) => `The balance of an account doubles every ${k} years.`,
  (k: number) => `A sum of money doubles in value every ${k} years.`,
];

const interestQC: Template<InterestQcParams> = {
  id: 'alg.mixtures-interest.interest-qc',
  skill: 'alg.mixtures-interest',
  format: 'qc',
  style: 'simple versus compound interest, doubling',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1
        ? (['simple-compound', 'simple-compound', 'doubling', 'years-unknown', 'years-unknown'] as const)
        : d === 2
          ? (['frequency', 'unknown-principal', 'unknown-principal', 'doubling', 'simple-compound', 'years-unknown'] as const)
          : (['unknown-principal', 'two-rates', 'frequency', 'years-unknown'] as const),
    );
    const base: InterestQcParams = { mode, P: 0, r: 0, r2: 0, n: 0, swap: false, K: 0, bound: 'none', bv: 0, m: 0 };
    const swap = rng.chance(0.4);
    const side = (a: string, b: string) => (swap ? [b, a] : [a, b]);
    const frame = rng.int(0, ACCOUNTS.length - 1);
    const who = ACCOUNTS[frame];
    const yrs = (n: number) => `${n} year${n === 1 ? '' : 's'}`;
    if (mode === 'simple-compound') {
      const n = d === 1 ? rng.pick([1, 2, 2]) : rng.pick([2, 3, 3]);
      const P = d === 1 ? rng.pick([1000, 2000, 5000]) : n === 3 ? rng.pick([10000, 20000]) : rng.pick([4000, 8000, 10000]);
      const r = d === 1 ? rng.pick([2, 4, 5, 10]) : rng.pick([3, 6, 8, 12]);
      const simple = frac(P).mul(100 + r * n).div(100);
      const comp = grow(frac(P), r, n);
      const cents = !simple.isInt() || !comp.isInt();
      const [qa, qb] = side(`${who(P)} after ${yrs(n)} at ${r} percent simple annual interest`, `${who(P)} after ${yrs(n)} at ${r} percent annual interest, compounded annually`);
      const answer = swap ? qcCompare(comp, simple) : qcCompare(simple, comp);
      const traps: QCQuestion['traps'] = answer !== 'C' ? { C: 'algw-simple-for-compound' } : undefined;
      const gap = comp.sub(simple);
      const first = frac(P).mul(100 + r).div(100);
      return {
        params: { ...base, P, r, n, swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps,
          explanation: `The same sum earns the same rate in both, so only the method differs. Simple interest adds ${r} percent of the original every year: $${num(P)}(1 + ${n} \\times ${dx(frac(r, 100))}) = ${money(simple, cents)}$. Compound interest multiplies by $${dx(frac(100 + r, 100))}$ each year: $${num(P)}${mult(r, n)} = ${money(comp, cents)}$.

${
            n === 1
              ? `Check: after one year the interest has had no time to earn interest, so the two agree. ${qcEnd(answer)}`
              : `Check: after the first year both hold ${money(first, !first.isInt())}. In year 2 simple interest again earns ${money(frac(P * r, 100), !frac(P * r, 100).isInt())}, but compound interest earns ${r} percent of ${money(first, !first.isInt())}, which is ${money(first.mul(r).div(100), !first.mul(r).div(100).isInt())}. ${qcEnd(answer)}`
          }

${
            n === 1
              ? `Trap: assuming compound interest always beats simple interest overlooks the one-year case, where both give ${money(simple, cents)}.`
              : `Trap: treating the two methods as equal because the rate is the same misses ${money(gap, !gap.isInt())}.`
          } Rule: compound exceeds simple only from the second year on.`,
        },
      };
    }
    if (mode === 'frequency') {
      const P = d === 2 ? rng.pick([1000, 2000, 4000]) : rng.pick([5000, 10000, 20000]);
      const r = d === 2 ? rng.pick([4, 6, 8]) : rng.pick([10, 12, 14, 16]);
      const semi = grow(frac(P), r, 1, 2);
      const annual = grow(frac(P), r, 1, 1);
      const cents = !semi.isInt() || !annual.isInt();
      const [qa, qb] = side(`${who(P)} after 1 year at ${r} percent annual interest, compounded annually`, `${who(P)} after 1 year at ${r} percent annual interest, compounded semiannually`);
      const answer = swap ? qcCompare(semi, annual) : qcCompare(annual, semi);
      const half = frac(P).mul(r).div(200);
      return {
        params: { ...base, P, r, swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps: { C: 'algw-compounding-frequency' },
          explanation: `Both quantities use the same yearly rate and differ only in how often interest is credited. Annually: $${num(P)}(${dx(frac(100 + r, 100))}) = ${money(annual, cents)}$. Semiannually, each half year earns $\\frac{${r}}{2} = ${r / 2}$ percent: $${num(P)}(${dx(frac(200 + r, 200))})^2 = ${money(semi, cents)}$.

Check: the first half year already adds ${money(half, !half.isInt())}, and the second half year earns ${r / 2} percent of that too, which is where the extra ${money(semi.sub(annual), !semi.sub(annual).isInt())} comes from. ${qcEnd(answer)}

Trap: assuming "same yearly rate, same value" misses that interest credited at mid-year earns interest. Rule: the more often interest is credited, the larger the value.`,
        },
      };
    }
    if (mode === 'unknown-principal') {
      const r = rng.pick(d === 2 ? [10, 20] : [10, 20, 30]);
      const factor = frac((100 + r) * (100 + r), 10000); // 1.21, 1.44, 1.69
      const gain = factor.sub(1); // 0.21, 0.44, 0.69
      const K = rng.pick(d === 2 ? [100, 200, 300, 400, 500] : [150, 250, 350, 450, 600, 750]);
      const th = frac(K).div(gain);
      const thR = Math.round(th.toNumber());
      const bound: InterestQcParams['bound'] = rng.pick(['none', 'none', 'gt', 'lt']);
      let bv = 0;
      if (bound === 'gt') bv = Math.ceil(th.toNumber() / 100) * 100 + rng.pick([0, 100, 500]);
      if (bound === 'lt') bv = Math.floor(th.toNumber() / 100) * 100 - rng.pick([0, 100]);
      const effBound = bound === 'lt' && bv <= 0 ? 'none' : bound;
      const answer: QCChoice = effBound === 'none' ? 'D' : effBound === 'gt' ? 'A' : 'B';
      const traps: QCQuestion['traps'] = answer === 'D' ? { A: 'algw-single-case', B: 'algw-single-case' } : { D: 'algw-single-case' };
      const small = 100;
      const big = 10000;
      const aSmall = factor.mul(small);
      const aBig = factor.mul(big);
      const subject = frame === 0 ? `An investment of $x$ dollars` : frame === 1 ? `An account opened with $x$ dollars` : `A savings account opened with $x$ dollars`;
      const diffAt = (x: number) => factor.mul(x).sub(x + K);
      return {
        params: { ...base, r, K, bound: effBound, bv },
        q: {
          format: 'qc',
          info: `${subject} earns ${r} percent annual interest, compounded annually.${effBound === 'gt' ? ` $x > ${num(bv)}$` : effBound === 'lt' ? ` $0 < x < ${num(bv)}$` : ''}`,
          quantityA: 'The value, in dollars, after 2 years',
          quantityB: `$x + ${num(K)}$`,
          answer,
          traps,
          explanation: `Quantity A depends on the unknown $x$, so locate where the two quantities cross. After 2 years A is $x(${dx(frac(100 + r, 100))})^2 = ${dx(factor)}x$. Subtracting $x$ from both sides leaves $${dx(gain)}x$ versus $${num(K)}$, so they cross at $x = \\frac{${num(K)}}{${dx(gain)}} \\approx ${num(thR)}$.

${
            effBound === 'none'
              ? `Nothing restricts $x$. Test two values. For $x = ${small}$: A is ${money(aSmall, !aSmall.isInt())} and B is ${money(small + K)}, so B is larger. For $x = ${num(big)}$: A is ${money(aBig)} and B is ${money(big + K)}, so A is larger. Different cases give different answers. ${qcEnd('D')}

Trap: testing only $x = ${small}$ suggests B is always larger, and testing only $x = ${num(big)}$ suggests A is. Rule: if both orders occur, the answer is D.`
              : effBound === 'gt'
                ? `Here $x > ${num(bv)}$, which is beyond the crossing point $${num(thR)}$. Check: at $x = ${num(bv)}$ the difference A $-$ B is $${dx(gain)}(${num(bv)}) - ${num(K)} = ${num(diffAt(bv))}$, and it only grows as $x$ grows. ${qcEnd('A')}

Trap: trying a small investment like $x = ${small}$ makes B larger, but ${small} is not allowed. Rule: test only values the condition permits.`
                : `Here $0 < x < ${num(bv)}$, which stays below the crossing point $${num(thR)}$. Check: at $x = ${num(bv)}$ the difference A $-$ B is $${dx(gain)}(${num(bv)}) - ${num(K)} = ${num(diffAt(bv))}$, and it is more negative for smaller $x$. ${qcEnd('B')}

Trap: a large investment like $x = ${num(big)}$ makes A larger, but it is not allowed. Rule: test only values the condition permits.`
          }`,
        },
      };
    }
    if (mode === 'doubling') {
      const k = rng.pick(d === 1 ? [3, 4, 5] : [6, 8, 10, 12]);
      const n = rng.int(2, d === 1 ? 3 : 4);
      const exact = 2 ** n;
      const m = rng.pick([exact, exact, 2 * n, n + 1, 2 ** (n + 1), 2 ** (n - 1)]);
      const answer = qcCompare(exact, m);
      const trapAns = qcCompare(2 * n, m);
      const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-linear-growth' } : answer === 'C' ? { D: 'algw-single-case' } : undefined;
      const lin = 2 * n;
      return {
        params: { ...base, n, m, K: k },
        q: {
          format: 'qc',
          info: DOUBLERS[frame](k),
          quantityA: `The value after ${n * k} years`,
          quantityB: `${m} times the initial value`,
          answer,
          traps,
          explanation: `${n * k} years is ${n} periods of ${k} years, and the value is multiplied by 2 in each, whatever the starting amount: $2^{${n}} = ${exact}$ times the initial value.

Check by stepping: $1 \\to 2 \\to 4 \\to \\cdots$ after ${n} doublings gives ${exact}. Compare ${exact} with ${m}. ${qcEnd(answer)}

Trap: adding the initial value in each period gives ${lin} times after ${n} periods, short of ${exact}, because every period doubles what is already there. Rule: $n$ doublings multiply by $2^n$.`,
        },
      };
    }
    if (mode === 'years-unknown') {
      const P = rng.pick(d === 1 ? [1000, 2000, 5000] : d === 2 ? [4000, 8000, 10000] : [10000, 20000, 50000]);
      const r = rng.pick(d === 1 ? [2, 4, 5, 10] : d === 2 ? [3, 6, 8, 12] : [14, 15, 16, 20]);
      const bound: InterestQcParams['bound'] = rng.pick(['none', 'gt']);
      const [qa, qb] = side(
        `${who(P)} after $n$ years at ${r} percent annual interest, compounded annually`,
        `${who(P)} after $n$ years at ${r} percent simple annual interest`,
      );
      const answer: QCChoice = bound === 'none' ? 'D' : swap ? 'B' : 'A';
      const one = frac(P).mul(100 + r).div(100);
      const s2 = frac(P).mul(100 + 2 * r).div(100);
      const c2 = grow(frac(P), r, 2);
      const cents = !one.isInt() || !s2.isInt() || !c2.isInt();
      const traps: QCQuestion['traps'] = bound === 'none' ? { [swap ? 'B' : 'A']: 'algw-single-case' } : { D: 'algw-single-case' };
      return {
        params: { ...base, P, r, swap, bound },
        q: {
          format: 'qc',
          info: bound === 'none' ? '$n$ is a positive integer.' : '$n$ is an integer greater than 1.',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps,
          explanation:
            bound === 'none'
              ? `$n$ is not fixed, so test the smallest allowed value and a larger one. For $n = 1$ both methods give $${num(P)}(${dx(frac(100 + r, 100))}) = ${money(one, cents)}$, so the quantities are equal. For $n = 2$ simple interest gives ${money(s2, cents)} and compound interest ${money(c2, cents)}, so the compound value is larger.

Two allowed values, two different relationships. ${qcEnd('D')}

Trap: trying only $n = 2$ suggests the compound value always wins, but after a single year no interest has yet earned interest. Rule: test the boundary value of a variable first.`
              : `$n$ is at least 2, so check the first allowed value. For $n = 2$ simple interest gives $${num(P)}(1 + 2 \\times ${dx(frac(r, 100))}) = ${money(s2, cents)}$ and compound interest $${num(P)}${mult(r, 2)} = ${money(c2, cents)}$, so the compound value is larger by ${money(c2.sub(s2), !c2.sub(s2).isInt())}.

Each further year adds the same ${money(frac(P * r, 100), !frac(P * r, 100).isInt())} under simple interest, but compound interest earns ${r} percent of a balance already above ${money(c2, cents)}, so the gap only widens. The compound value is always larger. ${qcEnd(answer)}

Trap: using $n = 1$ gives a tie at ${money(one, cents)}, but 1 is not allowed. Rule: use only values the condition permits.`,
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
      const yearS = frac(P).mul(frac(Math.round(r1 * 10), 1000));
      const yearC = frac(P).mul(r2).div(100);
      const trapText = compI.gt(simpleI)
        ? r1 > r2
          ? `the simple rate, ${r1} percent, is the higher one, yet it loses: ${money(simpleI, !simpleI.isInt())} against ${money(compI, !compI.isInt())}`
          : `equal rates do not mean equal interest: ${money(simpleI, !simpleI.isInt())} against ${money(compI, !compI.isInt())}`
        : `assuming compounding always wins ignores the higher simple rate: ${money(simpleI, !simpleI.isInt())} beats ${money(compI, !compI.isInt())}`;
      return {
        params: { ...base, P, r: r1, r2, n, swap },
        q: {
          format: 'qc',
          quantityA: qa,
          quantityB: qb,
          answer,
          traps,
          explanation: `The rates differ in kind (simple versus compound), so compute both interests. Simple: $${num(P)} \\times ${dx(frac(Math.round(r1 * 10), 1000))} \\times ${n} = ${money(simpleI, !simpleI.isInt())}$. Compound: $${num(P)}${mult(r2, n)} - ${num(P)} = ${money(compI, !compI.isInt())}$.

Check: simple interest repeats the same ${money(yearS, !yearS.isInt())} every year. Compound interest earns ${money(yearC, !yearC.isInt())} in year 1 and more in each later year, because the balance keeps growing. ${qcEnd(answer)}

Trap: ${trapText}. Rule: compare the amounts, not only the rates.`,
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
    if (prm.mode === 'years-unknown') {
      const samples: [Frac, Frac][] = [];
      for (let n = prm.bound === 'gt' ? 2 : 1; n <= 4; n++) {
        const comp = grow(frac(prm.P), prm.r, n);
        const simple = frac(prm.P).mul(100 + prm.r * n).div(100);
        samples.push(prm.swap ? [simple, comp] : [comp, simple]);
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
  /** For numeric kinds: choice values; for doubling: unused. */
  values: Frac[];
  /** For doubling: the choices as coef * P^pow. */
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
    const frame = rng.int(0, 2);
    for (;;) {
      if (kind === 'doubling-expr') {
        const k = rng.pick([3, 4, 5, 6, 7, 8, 9, 10, 12]);
        const n = rng.int(3, 5);
        // Each wrong form is a named slip; its key orders the choices (coefficient first, powers of P last).
        const key = (f: { coef: number; pow: number }) => (f.pow === 1 ? f.coef : 1e6 * f.pow + f.coef);
        const ftex = (f: { coef: number; pow: number }) => (f.pow === 1 ? `${f.coef}P` : f.coef === 1 ? `P^{${f.pow}}` : `(${f.coef === 2 ** f.pow ? 2 : f.coef}P)^{${f.pow}}`);
        const cands: { value: number; trap: string; why: string; form: { coef: number; pow: number } }[] = [
          { form: { coef: n, pow: 1 }, trap: 'algw-linear-growth', why: `adding $P$ once per period (${n} periods)` },
          { form: { coef: 2 * n, pow: 1 }, trap: 'algw-linear-growth', why: `adding $2P$ once per period (${n} periods)` },
          { form: { coef: 2 ** (n - 1), pow: 1 }, trap: 'algw-geo-exponent', why: 'doubling one time too few' },
          { form: { coef: 1, pow: n }, trap: 'algw-doubling-misplaced', why: `putting the exponent ${n} on $P$ instead of on the 2` },
          { form: { coef: 2 ** (n + 1), pow: 1 }, trap: 'algw-geo-exponent', why: 'doubling one time too many' },
          { form: { coef: 2 ** n, pow: n }, trap: 'algw-doubling-misplaced', why: `raising the whole $2P$ to the power ${n}` },
          { form: { coef: 2 ** k, pow: 1 }, trap: 'algw-doubling-misplaced', why: `using the ${k} years of one period as the number of doublings` },
        ].map((c) => ({ ...c, value: key(c.form) }));
        const correctForm = { coef: 2 ** n, pow: 1 };
        const texts = new Map<number, string>([[key(correctForm), ftex(correctForm)], ...cands.map((c) => [c.value, ftex(c.form)] as [number, string])]);
        const res = trapChoices(rng, key(correctForm), cands, (v) => `$${texts.get(v.toNumber())}$`);
        if (!res) continue;
        const forms = res.values.map((v) => (v.toNumber() === key(correctForm) ? correctForm : cands.find((c) => c.value === v.toNumber())!.form));
        const cited = res.kept[0];
        const chain = Array.from({ length: n + 1 }, (_, i) => 3 * 2 ** i).join(' \\to ');
        const atThree = cited.form.coef * 3 ** cited.form.pow;
        return {
          params: { ...base, k, n, forms },
          q: {
            format: 'mcs',
            stem:
              frame === 0
                ? `${nm} invested $P$ dollars in an account. The value of the account doubles every ${k} years. If ${nm} makes no deposits or withdrawals, which of the following represents the value of the account, in dollars, after ${n * k} years?`
                : frame === 1
                  ? `The balance of an account that starts at $P$ dollars doubles every ${k} years, with no deposits or withdrawals. Which of the following represents the balance, in dollars, after ${n * k} years?`
                  : `A fund worth $P$ dollars doubles in value every ${k} years. If nothing is added or withdrawn, which of the following represents its value, in dollars, after ${n * k} years?`,
            choices: res.choices,
            answer: res.answer,
            explanation: `"Doubles every ${k} years" over ${n * k} years means $\\frac{${n * k}}{${k}} = ${n}$ doublings, and each one multiplies the current value by 2: $P \\to 2P \\to 4P \\to \\cdots$, so the value is $2^{${n}}P = ${2 ** n}P$.

Check with $P = 3$: $${chain}$, and the last value is $${3 * 2 ** n} = ${2 ** n} \\times 3$.

Trap: $${ftex(cited.form)}$ comes from ${cited.why}; for $P = 3$ it equals $${num(atThree)}$, not $${3 * 2 ** n}$. Rule: $n$ doublings multiply by $2^n$.`,
          },
        };
      }
      let correct: Frac;
      let cands: { value: Frac; trap: string; why: string }[] = [];
      let stem: string;
      let explanation: (cited: { value: Frac; why: string }) => string;
      let fmt: (x: Frac) => string;
      let params: GrowthParams;
      if (kind === 'compound-value') {
        const P = rng.pick(d === 1 ? [1000, 2000, 2500, 5000] : [4000, 8000, 10000, 20000]);
        const r = rng.pick(d === 1 ? [2, 4, 5, 10] : [3, 6, 8, 12]);
        const n = d === 3 ? 3 : 2;
        const v = grow(frac(P), r, n);
        const whole = (x: Frac) => x.mul(100).isInt();
        if (!whole(v)) continue;
        correct = v;
        const simple = frac(P).mul(100 + r * n).div(100);
        const one = frac(P).mul(100 + r).div(100);
        const chain = Array.from({ length: n }, (_, i) => grow(frac(P), r, i + 1));
        cands = [
          { value: simple, trap: 'algw-simple-for-compound', why: 'using simple interest, which ignores the interest earned on interest' },
          { value: v.sub(P), trap: 'algw-interest-vs-value', why: 'giving only the interest earned' },
          { value: grow(frac(P), r, n - 1), trap: 'algw-years-off-by-one', why: 'compounding for one year too few' },
          { value: grow(frac(P), r, n + 1), trap: 'algw-years-off-by-one', why: 'compounding for one year too many' },
          { value: one.mul(n), trap: 'algw-value-times-years', why: `multiplying the one-year value by the ${n} years` },
          { value: simple.sub(P), trap: 'algw-interest-vs-value', why: 'giving only the simple interest' },
        ].filter((c) => whole(c.value));
        const cents = !v.isInt() || cands.some((c) => !c.value.isInt()) || chain.some((x) => !x.isInt());
        fmt = (x) => money(x, cents);
        params = { ...base, P, r, n, cents };
        stem =
          frame === 0
            ? `${nm} deposited ${money(P)} in an account that earns ${r} percent annual interest, compounded annually. If no other deposits or withdrawals are made, what will the value of the account be at the end of ${n} years?`
            : frame === 1
              ? `An account opened with ${money(P)} earns ${r} percent annual interest, compounded annually, and nothing else is deposited or withdrawn. What is the value of the account, in dollars, after ${n} years?`
              : `${nm} invests ${money(P)} at ${r} percent annual interest, compounded annually. What is the investment worth, in dollars, after ${n} years?`;
        explanation = (c) => `Interest is compounded, so each year's interest is earned on the whole balance and the balance is multiplied by $1 + ${dx(frac(r, 100))} = ${dx(frac(100 + r, 100))}$ every year: ${chain.map((x, i) => `${money(x, cents)} after year ${i + 1}`).join(', ')}.

Check: the one-step product $${num(P)}${mult(r, n)} = ${money(v, cents)}$ agrees with the last yearly balance.

Trap: ${money(c.value, cents)} comes from ${c.why}, which is ${money(c.value.sub(v).abs(), cents)} away from the true balance. Rule: after $n$ years the balance is $P(1 + r)^n$, not $P(1 + nr)$.`;
      } else if (kind === 'principal') {
        const r = rng.pick(d === 1 ? [2, 4, 5] : [3, 6, 8]);
        const n = rng.int(2, 6);
        const P = rng.int(2, 40) * 500;
        const I = frac(P * r * n, 100);
        if (!I.isInt()) continue;
        correct = frac(P);
        const earn = (x: Frac) => x.mul(r * n).div(100);
        const whole = (x: Frac) => x.mul(100).isInt();
        cands = [
          { value: I.mul(100).div(r), trap: 'algw-interest-years', why: 'leaving out the number of years' },
          { value: frac(P).add(I), trap: 'algw-interest-vs-value', why: 'adding the interest to the principal' },
          { value: frac(P, 100), trap: 'algw-percent-not-decimal', why: `using ${r} instead of ${dx(frac(r, 100))} as the rate` },
          { value: I.div(n), trap: 'algw-yearly-interest', why: 'stopping at the interest of one year' },
          { value: I.mul(100 * n).div(r), trap: 'algw-rate-divided-by-years', why: 'dividing the rate by the number of years instead of multiplying' },
          { value: I.mul(100).div(r * (n - 1)), trap: 'algw-years-off-by-one', why: `using ${n - 1} years instead of ${n}` },
          { value: I.mul(100).div(r * (n + 1)), trap: 'algw-years-off-by-one', why: `using ${n + 1} years instead of ${n}` },
        ].filter((c) => whole(c.value));
        fmt = (x) => money(x);
        params = { ...base, P, r, n, I: I.toNumber() };
        stem =
          frame === 0
            ? `How many dollars must be invested at ${r} percent simple annual interest to earn ${money(I)} in interest in ${n} years?`
            : frame === 1
              ? `${nm} wants to earn ${money(I)} in interest over ${n} years from an account that pays ${r} percent simple annual interest. How many dollars must ${nm} deposit?`
              : `An account pays ${r} percent simple annual interest. What principal, in dollars, earns ${money(I)} in interest in ${n} years?`;
        explanation = (c) => `The interest, the rate and the time are known and the starting sum is not. Simple interest repeats the same share of the original sum every year: $I = Prt$, so $${num(I)} = P \\times ${dx(frac(r, 100))} \\times ${n} = ${dx(frac(r * n, 100))}P$, and $P = \\frac{${num(I)}}{${dx(frac(r * n, 100))}} = ${num(P)}$.

Check: ${money(P)} earns ${money(frac(P * r, 100))} a year, and ${n} years give ${money(I)}.

Trap: ${money(c.value)} comes from ${c.why}; it would earn ${money(earn(c.value), !earn(c.value).isInt())} in ${n} years, not ${money(I)}. Rule: principal = interest $\\div$ (rate $\\times$ years).`;
      } else {
        // quarterly: closest value after 1 year
        const P = rng.pick([10000, 20000, 40000]);
        const r = rng.pick([8, 12]);
        const exact = grow(frac(P), r, 1, 4);
        const round = (x: Frac) => frac(Math.round(x.toNumber()));
        correct = round(exact);
        cands = [
          { value: round(frac(P).mul(100 + r).div(100)), trap: 'algw-simple-for-compound', why: 'applying the yearly rate once, with no quarterly compounding' },
          { value: round(grow(frac(P), r, 1, 2)), trap: 'algw-compounding-frequency', why: 'compounding only twice a year' },
          { value: round(grow(frac(P), r, 4, 1)), trap: 'algw-compound-rate-split', why: `using the full ${r} percent in each of the 4 quarters` },
          { value: frac(Math.round(P * (1 + r / 1200) ** 12)), trap: 'algw-compounding-frequency', why: 'compounding monthly' },
          { value: round(grow(frac(P), r / 4, 3)), trap: 'algw-periods-off-by-one', why: 'compounding for 3 quarters only' },
          { value: round(grow(frac(P), r / 4, 5)), trap: 'algw-periods-off-by-one', why: 'compounding for 5 quarters' },
        ];
        fmt = (x) => money(x);
        params = { ...base, P, r, n: 1, k: 4 };
        stem =
          frame === 0
            ? `${nm} deposits ${money(P)} in an account that earns ${r} percent annual interest, compounded quarterly. If no other deposits or withdrawals are made, which of the following is closest to the value of the account at the end of 1 year?`
            : frame === 1
              ? `An account opened with ${money(P)} earns ${r} percent annual interest, compounded quarterly, with no other deposits or withdrawals. Which of the following is closest to the value of the account after 1 year?`
              : `${nm} invests ${money(P)} at ${r} percent annual interest, compounded quarterly. Which of the following is closest to the investment's value, in dollars, after 1 year?`;
        explanation = (c) => `Quarterly compounding at ${r} percent a year means ${r / 4} percent per quarter, applied 4 times: $${num(P)}(${dx(frac(400 + r, 400))})^4 \\approx ${dx(frac(Math.round(exact.toNumber() * 100), 100))}$, so the closest choice is ${money(correct)}.

Check: the first quarter alone adds ${money(frac(P * r, 400))}, and each later quarter adds ${r / 4} percent of a larger balance, so the total beats ${money(frac(P).mul(100 + r).div(100))}.

Trap: ${money(c.value)} comes from ${c.why}. Rule: split the annual rate by the number of periods and compound each period.`;
      }
      const res = trapChoices(rng, correct!, cands, fmt!);
      if (!res) continue;
      params!.values = res.values;
      return { params: params!, q: { format: 'mcs', stem: stem!, choices: res.choices, answer: res.answer, explanation: explanation!(res.kept[0]) } };
    }
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
        uniqueIndex(prm.forms, (f) => f.coef * P ** f.pow === v),
      );
    }
    const fmt = (x: Frac) => money(x, prm.cents);
    const err = choiceValuesMatch(q, prm.values, prm.kind === 'compound-value' ? fmt : (x) => money(x));
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
    addC(cond === 'more-high' ? rng.int(p + 1, Math.floor(mean) - 1) : Math.min(99, Math.ceil(mean) + rng.int(1, 4)), 'algw-condition-reversed');
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
    const example = items.find((it) => it.correct)!;
    const wrongEx = items.find((it) => !it.correct && it.trap)!;
    const condShort = cond === 'more-low' ? '$x > y$, more of solution A' : cond === 'more-high' ? '$y > x$, more of solution B' : '$x \\ge 2y$, at least twice as much A';
    const wrongWhy =
      wrongEx.trap === 'algw-average-percents'
        ? 'the plain average needs $x = y$, which the condition rules out'
        : wrongEx.trap === 'algw-condition-reversed'
          ? `it needs ${wrongEx.c < mean ? 'more of solution A' : 'more of solution B'}, the opposite of the condition`
          : wrongEx.c <= p
            ? `a mixture cannot reach or go below the weaker solution, ${p} percent`
            : `a mixture cannot reach or go above the stronger solution, ${q} percent`;
    return {
      params: { p, q, cond, values: items.map((it) => it.c) },
      q: {
        format: 'mcm',
        stem: `Solution A is ${pct(p)} ${S.s} and solution B is ${pct(q)} ${S.s}. A mixture is made by combining $x$ liters of solution A with $y$ liters of solution B, where $x$ and $y$ are positive ${condText}. Which of the following could be the percent of ${S.s} in the mixture?`,
        instruction: 'Indicate all such percents.',
        choices,
        answer,
        explanation: `The mixture's percent is a weighted average of ${p} and ${q}: $\\frac{${p}x + ${q}y}{x + y}$. It is strictly between ${p} and ${q}, and it equals the plain average ${num(mean)} only when $x = y$. More of solution ${cond === 'more-high' ? 'B pulls it above' : 'A pulls it below'} ${num(mean)}${
          cond === 'twice-low' ? `; with $x = 2y$ it is $\\frac{2(${p}) + ${q}}{3} = ${num(frac(2 * p + q, 3))}$, and with even more A it is lower still` : ''
        }. So the possible percents are ${range}.

Check: ${num(example.c)} percent needs $x : y = ${q - example.c} : ${example.c - p}$, which meets the condition (${condShort}).

Trap: ${num(wrongEx.c)} percent is not possible, because ${wrongWhy}. Rule: a mixture lands strictly between the two percents, nearer the one used more.`,
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
