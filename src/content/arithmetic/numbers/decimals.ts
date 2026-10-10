import { flaggedChoices, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { factorize, gcd } from '../../../engine/math';
import { decimal, num, usd } from '../../../engine/tex';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { decimalExpansion } from '../cycles';
import { expectMCM, expectMCS, expectNE, expectQC, F, fd, pickWeighted, qcEnd, relClose, swapQC, usdF } from './util';

/* ================================================================== 1. Which fractions terminate (MCM) */

interface TermParams {
  fracs: [number, number][];
}

const TERM_DENS = [2, 4, 5, 8, 10, 16, 20, 25, 40, 50, 80, 125];
const REPEAT_DENS = [3, 6, 7, 9, 11, 12, 13, 15, 18, 21, 22, 24];
const LOOKALIKE_DENS = [15, 30, 60, 75, 120, 150, 35, 70, 140, 45, 90];

function factorTex(n: number): string {
  return factorize(n)
    .map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`))
    .join(' \\cdot ');
}

/** "$40 = 2^{3} \\cdot 5$", or just "$7$" for a prime. */
function factorEq(n: number): string {
  const f = factorTex(n);
  return f === String(n) ? `$${n}$` : `$${n} = ${f}$`;
}

function repeatingTex(p: number, q: number): string {
  const whole = Math.floor(p / q);
  const { prefix, cycle } = decimalExpansion(p % q, q);
  return `${whole}.${prefix.join('')}\\overline{${cycle.join('')}}`;
}

function coprimeNumerator(rng: { int(a: number, b: number): number }, q: number, max = q - 1): number {
  for (;;) {
    const p = rng.int(1, max);
    if (gcd(p, q) === 1) return p;
  }
}

const terminatingMCM: Template<TermParams> = {
  id: 'arith.decimals.terminating',
  skill: 'arith.decimals',
  format: 'mcm',
  style: 'which fractions have terminating decimals',
  generate(rng, d) {
    const n = d === 1 ? 4 : d === 2 ? 5 : 6;
    for (;;) {
      const nTrue = rng.int(1, n - 1);
      const items: { p: number; q: number; kind: 'term' | 'disguised' | 'repeat' | 'lookalike' }[] = [];
      for (let i = 0; i < nTrue; i++) {
        if (d > 1 && rng.chance(d === 2 ? 0.4 : 0.6)) {
          const q0 = rng.pick(TERM_DENS.filter((x) => x <= 25));
          const p0 = coprimeNumerator(rng, q0);
          const m = rng.pick([3, 7, 9]);
          items.push({ p: p0 * m, q: q0 * m, kind: 'disguised' });
        } else {
          const q = rng.pick(TERM_DENS);
          items.push({ p: coprimeNumerator(rng, q), q, kind: 'term' });
        }
      }
      for (let i = nTrue; i < n; i++) {
        if (d > 1 && rng.chance(0.55)) {
          const q = rng.pick(LOOKALIKE_DENS);
          items.push({ p: coprimeNumerator(rng, q), q, kind: 'lookalike' });
        } else {
          const q = rng.pick(REPEAT_DENS);
          items.push({ p: coprimeNumerator(rng, q), q, kind: 'repeat' });
        }
      }
      const vals = items.map((it) => it.p / it.q);
      if (new Set(vals.map((v) => v.toFixed(9))).size !== n) continue;
      if (new Set(items.map((it) => it.q)).size < n - 1) continue;
      items.sort((a, b) => a.p / a.q - b.p / b.q);
      const { choices, answer } = flaggedChoices(
        items.map((it) => {
          const ok = it.kind === 'term' || it.kind === 'disguised';
          return { text: `$\\frac{${it.p}}{${it.q}}$`, correct: ok, ...(it.kind === 'lookalike' ? { trap: 'num-terminating-test' } : {}) };
        }),
      );
      const lines = items.map((it) => {
        const red = F(it.p, it.q);
        const f = `\\frac{${it.p}}{${it.q}}`;
        if (it.kind === 'disguised')
          return `- $${f} = ${red.toTex()}$, and ${factorEq(red.d)} has no prime factors other than 2 and 5 ✓ ($${decimal(red)}$)`;
        if (it.kind === 'term') return `- $${f}$: ${factorEq(it.q)} has no prime factors other than 2 and 5 ✓ ($${decimal(red)}$)`;
        const bad = factorize(red.d)
          .map(([p]) => p)
          .filter((p) => p !== 2 && p !== 5);
        return `- $${f}$: ${factorEq(red.d)} has the prime factor${bad.length > 1 ? 's' : ''} ${bad.join(' and ')} ✗ ($${repeatingTex(red.n, red.d)}$)`;
      });
      const hasDisguised = items.some((it) => it.kind === 'disguised');
      const hasLook = items.some((it) => it.kind === 'lookalike');
      return {
        params: { fracs: items.map((it) => [it.p, it.q] as [number, number]) },
        q: {
          format: 'mcm',
          stem: 'Which of the following fractions are equal to terminating decimals?',
          instruction: 'Indicate all such fractions.',
          choices,
          answer,
          explanation: `A fraction in lowest terms is a terminating decimal exactly when its denominator has no prime factors other than 2 and 5. Reduce first, then factor the denominator:
${lines.join('\n')}${
            hasDisguised || hasLook
              ? `\n\n${hasDisguised ? 'Reducing matters: a factor such as 3 or 7 in the denominator can cancel with the numerator. ' : ''}${
                  hasLook ? 'A denominator that contains 2 or 5 is not enough: every other prime factor must be gone.' : ''
                }`
              : ''
          }`,
        },
      };
    }
  },
  check(q, { fracs }) {
    // Long division: the decimal terminates iff a remainder of 0 shows up before a remainder repeats.
    const terminates = (p: number, den: number) => {
      const seen = new Set<number>();
      let r = p % den;
      while (r !== 0) {
        if (seen.has(r)) return false;
        seen.add(r);
        r = (r * 10) % den;
      }
      return true;
    };
    return expectMCM(
      q,
      fracs.flatMap(([p, den], i) => (terminates(p, den) ? [i] : [])),
    );
  },
};

/* ================================================================== 2. Rounding (QC) */

type RoundCase = 'eq' | 'inside' | 'below' | 'above';

interface RoundParams {
  mode: 'interval' | 'double';
  /** interval: places k, rounded value R (as integer in units of 10^-k), c as Frac. double: x * 1000. */
  k: number;
  R: number;
  c: Frac;
  xi: number;
  swap: boolean;
}

const PLACE = ['', 'tenth', 'hundredth', 'thousandth'];

/** Round a nonnegative integer `xi` given in units of 10^-from to units of 10^-to (half up). */
function roundUnits(xi: number, from: number, to: number): number {
  const f = 10 ** (from - to);
  return Math.floor((xi + f / 2) / f);
}

const roundingQC: Template<RoundParams> = {
  id: 'arith.decimals.rounding-qc',
  skill: 'arith.decimals',
  format: 'qc',
  style: 'what a rounded value says about the number',
  generate(rng, d) {
    const mode: RoundParams['mode'] = d === 1 ? 'interval' : rng.chance(d === 2 ? 0.3 : 0.4) ? 'double' : 'interval';
    const swap = rng.chance(0.4);
    if (mode === 'double') {
      const bCase = rng.chance(0.55);
      let xi: number;
      do {
        const whole = rng.int(1, 19);
        const t = rng.int(0, 8);
        const h = bCase ? 4 : rng.int(0, 9);
        const th = bCase ? rng.int(5, 9) : rng.int(1, 9);
        xi = whole * 1000 + t * 100 + h * 10 + th;
      } while (!bCase && Math.floor(xi / 10) % 10 === 4 && xi % 10 >= 5);
      const direct = roundUnits(xi, 3, 1);
      const twice = roundUnits(roundUnits(xi, 3, 2), 2, 1);
      const rel: QCChoice = direct > twice ? 'A' : direct < twice ? 'B' : 'C';
      const answer = swap ? swapQC(rel) : rel;
      const traps: QCQuestion['traps'] = rel !== 'C' ? { C: 'num-double-rounding' } : undefined;
      const x = F(xi, 1000);
      const h2 = F(roundUnits(xi, 3, 2), 100);
      const qa = `$x$ rounded to the nearest tenth`;
      const qb = `The number obtained by rounding $x$ to the nearest hundredth and then rounding that result to the nearest tenth`;
      return {
        params: { mode, k: 1, R: 0, c: F(0), xi, swap },
        q: {
          format: 'qc',
          info: `$x = ${decimal(x)}$`,
          quantityA: swap ? qb : qa,
          quantityB: swap ? qa : qb,
          answer,
          traps,
          explanation: `Rounding $${decimal(x)}$ to the nearest tenth looks only at the hundredths digit, ${Math.floor(xi / 10) % 10}: the result is $${decimal(
            F(direct, 10),
          )}$.

Rounding to the nearest hundredth first gives $${decimal(h2)}$, and rounding that to the nearest tenth gives $${decimal(F(twice, 10))}$.${
            rel !== 'C' ? ' The first rounding pushed the hundredths digit up to 5, which then rounded up again: two-step rounding can differ from rounding once.' : ''
          }

${qcEnd(answer)}`,
        },
      };
    }
    // interval mode
    const k = d === 1 ? 1 : d === 2 ? 2 : rng.pick([2, 3]);
    let R: number;
    do R = rng.int(11 * 10 ** k, 99 * 10 ** k) / 10;
    while (!Number.isInteger(R) || R % 10 === 0);
    // R is an integer number of units 10^-k with a nonzero last digit.
    const kase = pickWeighted<RoundCase>(rng, [
      ['eq', 3],
      ['inside', 2.5],
      ['below', 2],
      ['above', 2.5],
    ]);
    // c in units of 10^-(k+1)
    let j: number;
    if (kase === 'eq') j = 0;
    else if (kase === 'inside') j = rng.pick(d === 3 ? [-4, 4, -3, 3] : [-3, -2, -1, 1, 2, 3, 4]);
    else if (kase === 'below') j = rng.pick(d === 3 ? [-6, -7] : [-10, -6, -8]);
    else j = rng.pick(d === 3 ? [6, 7] : [6, 8, 10]);
    const c = F(R * 10 + j, 10 ** (k + 1));
    const rel: QCChoice = kase === 'below' ? 'A' : kase === 'above' ? 'B' : 'D';
    const answer = swap ? swapQC(rel) : rel;
    const Rv = F(R, 10 ** k);
    const naive: QCChoice = qcFromSamples([[Rv, c]]);
    const naiveAns = swap ? swapQC(naive) : naive;
    const traps: QCQuestion['traps'] = naiveAns !== answer ? { [naiveAns]: 'num-rounding-exact' } : undefined;
    const lo = F(R * 10 - 5, 10 ** (k + 1));
    const hi = F(R * 10 + 5, 10 ** (k + 1));
    const where =
      rel === 'A'
        ? `Every possible $x$ is at least $${decimal(lo)}$, which is greater than $${decimal(c)}$.`
        : rel === 'B'
          ? `Every possible $x$ is less than $${decimal(hi)}$, which is less than $${decimal(c)}$.`
          : `$${decimal(c)}$ is inside this interval, so $x$ can be on either side of $${decimal(c)}$: for example $x = ${decimal(
              F(R * 100 - 40, 10 ** (k + 2)),
            )}$ and $x = ${decimal(F(R * 100 + 40, 10 ** (k + 2)))}$ both round to $${decimal(Rv)}$.`;
    const qx = '$x$';
    const qc = `$${decimal(c)}$`;
    return {
      params: { mode, k, R, c, xi: 0, swap },
      q: {
        format: 'qc',
        info: `When the positive number $x$ is rounded to the nearest ${PLACE[k]}, the result is $${decimal(Rv)}$.`,
        quantityA: swap ? qc : qx,
        quantityB: swap ? qx : qc,
        answer,
        traps,
        explanation: `A number rounds to $${decimal(Rv)}$ exactly when $${decimal(lo)} \\le x < ${decimal(hi)}$. ${where}

${rel === 'D' ? `Treating $x$ as exactly $${decimal(Rv)}$ is the trap. ` : ''}${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, k, R, c, xi, swap }) {
    if (mode === 'double') {
      // Digit-by-digit rounding on the decimal string.
      const roundStr = (s: string, places: number): string => {
        const [w, frac = ''] = s.split('.');
        const digits = (w + frac.padEnd(places + 1, '0')).split('').map(Number);
        const cut = w.length + places;
        const up = digits[cut] >= 5;
        const kept = digits.slice(0, cut);
        if (up) {
          let i = kept.length - 1;
          while (i >= 0 && kept[i] === 9) kept[i--] = 0;
          if (i < 0) kept.unshift(1);
          else kept[i]++;
        }
        const ws = kept.length - places;
        return `${kept.slice(0, ws).join('')}.${kept.slice(ws).join('')}`;
      };
      const s = (xi / 1000).toFixed(3);
      const a = Number(roundStr(s, 1));
      const b = Number(roundStr(roundStr(s, 2), 1));
      const rel: QCChoice = a > b ? 'A' : a < b ? 'B' : 'C';
      return expectQC(q, swap ? swapQC(rel) : rel);
    }
    // Scan x on a fine grid (units of 10^-(k+3)) and keep the values that round to R.
    const unit = 10 ** (k + 3);
    const samples: [Frac, Frac][] = [];
    const start = (R - 2) * 1000;
    const end = (R + 2) * 1000;
    for (let x = Math.max(1, start); x <= end; x++) {
      if (Math.floor((x + 500) / 1000) !== R) continue;
      const xv = F(x, unit);
      samples.push(swap ? [c, xv] : [xv, c]);
    }
    return expectQC(q, qcFromSamples(samples));
  },
};

/* ================================================================== 3. Powers of ten and scientific notation (MCS) */

interface SciParams {
  mode: 'decimal' | 'sci';
  a: Frac;
  b: Frac;
  c: Frac;
  m: number;
  n: number;
  p: number;
  /** Choice values as mantissa (Frac) and exponent. */
  values: { r: Frac; e: number }[];
}

const MANT = [1.2, 1.5, 2, 2.4, 2.5, 3, 3.2, 4, 4.5, 5, 6, 7.5, 8].map(fd);
const DIVS = [1.5, 2, 2.5, 3, 4, 5, 6, 8].map(fd);

function normalize(r: Frac, e: number): { r: Frac; e: number } {
  while (!r.lt(10)) {
    r = r.div(10);
    e++;
  }
  while (r.lt(1)) {
    r = r.mul(10);
    e--;
  }
  return { r, e };
}

const sigDigits = (r: Frac) => (r.isTerminating() ? r.toDecimalString().replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length : 99);
const pow10 = (e: number) => (e >= 0 ? F(10 ** e) : F(1, 10 ** -e));

const sciNotation: Template<SciParams> = {
  id: 'arith.decimals.sci-notation',
  skill: 'arith.decimals',
  format: 'mcs',
  style: 'products and quotients with powers of 10',
  generate(rng, d) {
    const mode: SciParams['mode'] = d === 1 ? 'decimal' : d === 2 ? rng.pick(['decimal', 'sci'] as const) : 'sci';
    if (mode === 'decimal') {
      for (;;) {
        const A0 = rng.pick([12, 15, 16, 18, 24, 25, 32, 36, 45, 48, 64, 72, 75]);
        const B0 = rng.pick([2, 3, 4, 5, 6, 8]);
        const cands = [2, 3, 4, 5, 6, 8, 9, 12, 15, 16, 18, 24, 25, 32, 36].filter((x) => (A0 * B0) % x === 0 && x !== A0 && x !== B0);
        if (!cands.length) continue;
        const C0 = rng.pick(cands);
        const i = rng.int(1, d === 1 ? 3 : 4);
        const j = rng.int(1, 3);
        const l = rng.int(0, 3);
        const a = F(A0).mul(pow10(-i));
        const b = F(B0).mul(pow10(j));
        const c = F(C0).mul(pow10(-l));
        const val = a.mul(b).div(c);
        if (val.lt(F(1, 100)) || val.gt(F(100000))) continue;
        const okS = [0, 1, 2, 3, 4].filter((s) => !val.mul(pow10(-s)).lt(F(1, 1000)) && !val.mul(pow10(4 - s)).gt(F(10 ** 7)));
        if (!okS.length) continue;
        const s = rng.pick(okS);
        const values = [0, 1, 2, 3, 4].map((t) => normalize(val.mul(pow10(t - s)), 0));
        const fmt = (v: Frac) => (v.isInt() ? num(v.toNumber()) : decimal(v));
        const choices = values.map((v, t) => ({ text: `$${fmt(v.r.mul(pow10(v.e)))}$`, ...(Math.abs(t - s) === 1 ? { trap: 'num-decimal-shift' } : {}) }));
        const ab = a.mul(b);
        return {
          params: { mode, a, b, c, m: 0, n: 0, p: 0, values },
          q: {
            format: 'mcs',
            stem: `$$\\frac{${decimal(a)} \\times ${num(b.toNumber())}}{${decimal(c)}}$$

What is the value of the expression above?`,
            choices,
            answer: s,
            explanation: `The numerator is $${decimal(a)} \\times ${num(b.toNumber())} = ${decimal(ab)}$. ${
              l > 0
                ? `To divide by $${decimal(c)}$, move the decimal point ${l} place${l > 1 ? 's' : ''} to the right in both numbers: $${decimal(ab)} \\div ${decimal(c)} = ${decimal(
                    ab.mul(10 ** l),
                  )} \\div ${C0} = ${fmt(val)}$.`
                : `Then $${decimal(ab)} \\div ${C0} = ${fmt(val)}$.`
            }

The choices differ only by powers of 10, so the whole question is where the decimal point goes. The choices next to the right one come from moving it one place too far.`,
          },
        };
      }
    }
    for (;;) {
      const a = rng.pick(MANT);
      const b = rng.pick(MANT);
      const c = rng.pick(DIVS);
      const raw = a.mul(b).div(c);
      if (sigDigits(raw) > 3) continue;
      const m = rng.int(d === 3 ? -8 : -4, 9);
      const n = rng.int(d === 3 ? -9 : -5, 8);
      const p = d === 3 ? rng.int(-7, 6) : rng.int(-4, 6);
      if (p === 0 || m === 0 || n === 0) continue;
      const e0 = m + n - p;
      const correct = normalize(raw, e0);
      const cands: { r: Frac; e: number; trap?: string }[] = [
        correct,
        { r: correct.r, e: correct.e + 1, trap: 'num-decimal-shift' },
        { r: correct.r, e: correct.e - 1, trap: 'num-decimal-shift' },
        { ...normalize(raw, m + n + p), trap: 'num-exponent-sign' },
        normalize(a.mul(b).mul(c), e0),
        { r: correct.r, e: correct.e + 2 },
        { r: correct.r, e: correct.e - 2 },
      ];
      const uniq: typeof cands = [];
      for (const x of cands) if (!uniq.some((u) => u.r.eq(x.r) && u.e === x.e)) uniq.push(x);
      const picked = uniq.slice(0, 5);
      if (picked.length < 5) continue;
      const valueOf = (x: { r: Frac; e: number }) => x.r.toNumber() * 10 ** x.e;
      const ordered = [...picked].sort((x, y) => valueOf(x) - valueOf(y));
      const answer = ordered.findIndex((x) => x === picked[0]);
      const tex = (x: { r: Frac; e: number }) => `${decimal(x.r)} \\times 10^{${x.e}}`;
      const choices = ordered.map((x) => ({ text: `$${tex(x)}$`, ...(x.trap ? { trap: x.trap } : {}) }));
      const p10 = (e: number) => `10^{${e}}`;
      const shift =
        correct.e === e0
          ? ''
          : ` Then write it in scientific notation: $${decimal(raw)} \\times ${p10(e0)} = ${tex(correct)}$.`;
      return {
        params: { mode, a, b, c, m, n, p, values: ordered.map(({ r, e }) => ({ r, e })) },
        q: {
          format: 'mcs',
          stem: `$$\\frac{(${decimal(a)} \\times 10^{${m}})(${decimal(b)} \\times 10^{${n}})}{${decimal(c)} \\times 10^{${p}}}$$

Which of the following is equal to the expression above?`,
          choices,
          answer,
          explanation: `Handle the decimal parts and the powers of 10 separately. Decimal parts: $\\frac{${decimal(a)} \\times ${decimal(b)}}{${decimal(c)}} = ${decimal(
            raw,
          )}$. Powers of 10: $10^{${m} + ${n < 0 ? `(${n})` : n} - ${p < 0 ? `(${p})` : p}} = ${p10(e0)}$.${shift}

Dividing by $10^{${p}}$ subtracts ${p < 0 ? `$${p}$ (that is, adds ${-p})` : p} from the exponent; adding it instead gives $${tex(normalize(raw, m + n + p))}$.`,
        },
      };
    }
  },
  check(q, { mode, a, b, c, m, n, p, values }) {
    const v =
      mode === 'decimal'
        ? (a.toNumber() * b.toNumber()) / c.toNumber()
        : ((a.toNumber() * 10 ** m) * (b.toNumber() * 10 ** n)) / (c.toNumber() * 10 ** p);
    const hits = values.flatMap((x, i) => (relClose(x.r.toNumber() * 10 ** x.e, v, 1e-9) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 4. Money with decimals (NE) */

interface MoneyParams {
  mode: 'total' | 'change' | 'how-many';
  prices: number[];
  qty: number[];
  bill: number;
  budget: number;
}

/** [singular, plural, possible prices in cents] */
const ITEMS: [string, string, number[]][] = [
  ['notebook', 'notebooks', [235, 260, 295, 340, 425]],
  ['pen', 'pens', [35, 45, 65, 85, 95, 115]],
  ['folder', 'folders', [65, 75, 85, 95, 115, 135]],
  ['marker', 'markers', [85, 95, 115, 125, 149]],
  ['greeting card', 'greeting cards', [235, 260, 295, 340, 425]],
  ['bagel', 'bagels', [85, 95, 115, 125, 135]],
  ['muffin', 'muffins', [175, 189, 235, 260, 295]],
  ['candle', 'candles', [340, 425, 560, 675]],
  ['binder', 'binders', [340, 425, 560, 675]],
  ['postcard', 'postcards', [35, 45, 65, 75, 85]],
];
const NAMES = ['Ravi', 'Maria', 'Chen', 'Alicia', 'Tomás', 'Priya', 'Jordan', 'Keiko'];

const moneyNE: Template<MoneyParams> = {
  id: 'arith.decimals.money-total',
  skill: 'arith.decimals',
  format: 'ne',
  style: 'shopping arithmetic with decimals',
  generate(rng, d) {
    const mode: MoneyParams['mode'] = d === 1 ? 'total' : d === 2 ? rng.pick(['total', 'change'] as const) : rng.pick(['change', 'how-many'] as const);
    const name = rng.pick(NAMES);
    const nItems = mode === 'how-many' ? 2 : d === 1 ? 2 : rng.pick([2, 3]);
    let items: typeof ITEMS;
    let cents: number[];
    do {
      items = rng.sample(ITEMS, nItems);
      cents = items.map((it) => rng.pick(it[2]));
    } while ((mode === 'how-many' && cents[1] > 150) || new Set(cents).size < nItems);
    const qty = items.map(() => rng.int(2, 9));
    const priceTex = (c: number) => usd(c / 100, c % 100 === 0 ? undefined : 2);
    if (mode === 'how-many') {
      // Buy one of item 0, then as many of item 1 as possible.
      const budget = rng.pick([10, 15, 20, 25, 30]);
      const left = budget * 100 - cents[0];
      let count = Math.floor(left / cents[1]);
      if (left % cents[1] === 0) {
        cents[1] += 10;
        count = Math.floor(left / cents[1]);
      }
      const ceilCount = Math.ceil(left / cents[1]);
      const remainder = left - count * cents[1];
      return {
        params: { mode, prices: cents, qty: [1, count], bill: 0, budget },
        q: {
          format: 'ne',
          stem: `${name} has ${usd(budget)} to spend. After buying one ${items[0][0]} for ${priceTex(cents[0])}, ${name} wants to spend the rest on ${items[1][1]}, which cost ${priceTex(
            cents[1],
          )} each. What is the greatest number of ${items[1][1]} ${name} can buy?`,
          answer: F(count),
          suffix: items[1][1],
          traps: ceilCount !== count ? [{ value: F(ceilCount), trap: 'num-round-up-count' }] : [],
          explanation: `After the ${items[0][0]}, ${name} has $${usd(budget, 2)} - ${priceTex(cents[0])} = ${usd(left / 100, 2)}$ left. Then $${usd(left / 100, 2)} \\div ${priceTex(
            cents[1],
          )} \\approx ${(left / cents[1]).toFixed(2)}$, so ${name} can buy ${count} ${items[1][1]} (they cost ${usd((count * cents[1]) / 100, 2)}, leaving ${usd(
            remainder / 100,
            2,
          )}).

Rounding ${(left / cents[1]).toFixed(2)} up to ${ceilCount} would cost more money than ${name} has: round down.`,
        },
      };
    }
    const total = cents.reduce((s, c, i) => s + c * qty[i], 0);
    const swapped = nItems === 2 ? cents[0] * qty[1] + cents[1] * qty[0] : cents[0] * qty[1] + cents[1] * qty[0] + cents[2] * qty[2];
    const list = items.map((it, i) => `${qty[i]} ${it[1]} at ${priceTex(cents[i])} each`);
    const bought = list.length === 2 ? `${list[0]} and ${list[1]}` : `${list[0]}, ${list[1]}, and ${list[2]}`;
    const andList = (xs: string[]) => (xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs[0]}, ${xs[1]}, and ${xs[2]}`);
    const sells = andList(items.map((it, i) => `${it[1]} for ${priceTex(cents[i])} each`));
    const amounts = andList(items.map((it, i) => `${qty[i]} ${it[1]}`));
    const parts = cents.map((c, i) => `${qty[i]} \\times ${priceTex(c)} = ${usd((qty[i] * c) / 100, 2)}`);
    const sumLine = `$${parts.join('$, $')}$. Total: ${usd(total / 100, 2)}.`;
    if (mode === 'total') {
      return {
        params: { mode, prices: cents, qty, bill: 0, budget: 0 },
        q: {
          format: 'ne',
          stem: `A store sells ${sells}. What is the total cost, in dollars, of ${amounts}?`,
          answer: F(total, 100),
          prefix: '\\$',
          traps: swapped !== total ? [{ value: F(swapped, 100), trap: 'num-wrong-pairs' }] : [],
          explanation: `Multiply each quantity by its own price, then add: ${sumLine}${
            swapped !== total ? `\n\nPairing the quantities with the wrong prices gives ${usd(swapped / 100, 2)}.` : ''
          }`,
        },
      };
    }
    const bill = [20, 50, 100, 200].find((b) => b * 100 > total + 50) ?? 200;
    const change = bill * 100 - total;
    return {
      params: { mode, prices: cents, qty, bill, budget: 0 },
      q: {
        format: 'ne',
        stem: `${name} bought ${bought}, and paid with a ${usd(bill)} bill. If there was no sales tax, how much change did ${name} receive, in dollars?`,
        answer: F(change, 100),
        prefix: '\\$',
        explanation: `${sumLine}

Change: $${usd(bill, 2)} - ${usd(total / 100, 2)} = ${usdF(F(change, 100), true)}$.`,
      },
    };
  },
  check(q, { mode, prices, qty, bill, budget }) {
    if (mode === 'how-many') {
      // Buy items one at a time while the money lasts.
      let money = budget * 100 - prices[0];
      let count = 0;
      while (money >= prices[1]) {
        money -= prices[1];
        count++;
      }
      return expectNE(q, count);
    }
    let total = 0;
    prices.forEach((p, i) => {
      for (let k = 0; k < qty[i]; k++) total += p / 100;
    });
    return expectNE(q, mode === 'total' ? total : bill - total, 1e-9);
  },
};

export const decimalTemplates = [terminatingMCM, roundingQC, sciNotation, moneyNE];

export type { Difficulty };
