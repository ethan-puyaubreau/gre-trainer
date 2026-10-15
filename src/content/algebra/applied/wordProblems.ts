import { flaggedChoices, qcFromSamples, textChoices } from '../../../engine/build';
import { Frac, frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { plural } from '../../../engine/text';
import { lin, num } from '../../../engine/tex';
import type { Choice, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { add, div, type E, evalE, mul, N, subE, tex, V } from './expr';
import { choiceValuesMatch, dx, expectMcm, expectMcs, expectNe, expectQc, money, NAMES, qcEnd, trapChoices, uniqueIndex } from './util';

const cents = (c: number) => money(frac(c, 100));
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TIMES = (k: number) => (k === 2 ? 'twice' : `${WORDS[k] ?? k} times`);

/* =============================================================================================
 * 1. Set up and solve: "k more than twice", fixed fee plus rate, ages, break-even (NE)
 *    [BOOK AL-09 (fixed cost plus per-unit cost); GEN AL-G26, AL-G28]
 * =========================================================================================== */

interface SetupParams {
  kind: 'twice-more' | 'fee' | 'ages' | 'break-even' | 'formula';
  /** formula: Celsius and Fahrenheit values, direction asked */
  cel: number;
  fah: number;
  toF: boolean;
  T: number;
  mult: number;
  k: number;
  ask: 'big' | 'small';
  fee: number;
  rate: number;
  total: number;
  per: number;
  p: number;
  n: number;
  q: number;
  future: boolean;
  fa: number;
  fb: number;
  ca: number;
  cb: number;
}

const PAIR_CONTEXTS = [
  {
    intro: (T: number) => `A bookstore display holds ${T} books, each of which is either fiction or nonfiction.`,
    big: 'fiction books',
    small: 'nonfiction books',
    ask: (w: string) => `How many ${w} are in the display?`,
  },
  {
    intro: (T: number) => `A school club has ${T} members, each of whom is either a junior or a senior.`,
    big: 'juniors',
    small: 'seniors',
    ask: (w: string) => `How many ${w} are in the club?`,
  },
  {
    intro: (T: number) => `A total of ${T} tickets were sold for a play, each of them either an advance ticket or a door ticket.`,
    big: 'advance tickets',
    small: 'door tickets',
    ask: (w: string) => `How many ${w} were sold?`,
  },
  {
    intro: (T: number) => `An orchard has ${T} trees, each of which is either an apple tree or a pear tree.`,
    big: 'apple trees',
    small: 'pear trees',
    ask: (w: string) => `How many ${w} are in the orchard?`,
  },
];

const FEE_CONTEXTS = {
  rental: { per: 1, unit: 'miles' },
  plumber: { per: 2, unit: 'hours' },
  taxi: { per: 5, unit: 'miles' },
};

const setupSolve: Template<SetupParams> = {
  id: 'alg.word-problems.setup-solve',
  skill: 'alg.word-problems',
  format: 'ne',
  style: 'translate a word problem into one equation and solve',
  generate(rng, d) {
    const kind: SetupParams['kind'] =
      d === 1 ? rng.pick(['twice-more', 'fee', 'formula'] as const) : d === 2 ? rng.pick(['twice-more', 'fee', 'ages', 'formula'] as const) : rng.pick(['ages', 'break-even'] as const);
    const base: SetupParams = { kind, T: 0, mult: 0, k: 0, ask: 'big', fee: 0, rate: 0, total: 0, per: 1, p: 0, n: 0, q: 0, future: true, fa: 0, fb: 0, ca: 0, cb: 0, cel: 0, fah: 0, toF: true };
    if (kind === 'formula') {
      // [BOOK AL-30] evaluate a stated formula, or solve it for the other variable
      const toF = d === 1 || rng.chance(0.4);
      const cel = toF ? rng.int(-4, 9) * 5 : rng.int(-3, 8) * 5;
      const fah = (9 * cel) / 5 + 32;
      const ans = toF ? fah : cel;
      const traps: { value: Frac; trap: string }[] = [];
      const slips = toF ? [frac(5 * cel, 9).add(32), frac(9 * (cel + 32), 5)] : [frac(5 * fah, 9).sub(32), frac(9 * (fah - 32), 5)];
      // A slip that lands on the key would make "changes the result" false: draw again.
      if (slips.some((w) => w.eq(ans))) return setupSolve.generate(rng, d);
      for (const w of slips) if (w.isTerminating()) traps.push({ value: w, trap: 'algw-formula-order' });
      const given = toF ? `$${num(cel)}$ degrees Celsius` : `$${num(fah)}$ degrees Fahrenheit`;
      return {
        params: { ...base, cel, fah, toF },
        q: {
          format: 'ne',
          stem: `The formula $F = \\frac{9}{5}C + 32$ gives the temperature $F$, in degrees Fahrenheit, that corresponds to a temperature of $C$ degrees Celsius. What temperature, in degrees ${toF ? 'Fahrenheit' : 'Celsius'}, corresponds to ${given}?`,
          answer: frac(ans),
          suffix: toF ? 'degrees Fahrenheit' : 'degrees Celsius',
          traps,
          explanation: toF
            ? `Substitute $C = ${num(cel)}$: multiply by $\\frac{9}{5}$ first, then add 32. $F = \\frac{9}{5}(${num(cel)}) + 32 = ${num((9 * cel) / 5)} + 32 = ${num(fah)}$.

Using $\\frac{5}{9}$ instead of $\\frac{9}{5}$, or adding 32 before multiplying, changes the result.`
            : `Substitute $F = ${num(fah)}$ and undo the steps in reverse order: $${num(fah)} = \\frac{9}{5}C + 32$, so $\\frac{9}{5}C = ${num(fah - 32)}$ and $C = \\frac{5}{9}(${num(fah - 32)}) = ${num(cel)}$.

Subtract 32 FIRST, then multiply by $\\frac{5}{9}$; doing it in the other order gives a different number.`,
        },
      };
    }
    if (kind === 'twice-more') {
      const ctx = rng.pick(PAIR_CONTEXTS);
      const mult = d === 1 ? 2 : rng.pick([2, 3]);
      const k = rng.int(3, 15) * (rng.chance(0.7) ? 1 : -1);
      const Y = rng.int(k < 0 ? 19 : 12, 60); // keeps X well above Y
      const X = mult * Y + k;
      const T = X + Y;
      const ask: 'big' | 'small' = rng.chance(0.6) ? 'big' : 'small';
      const ans = ask === 'big' ? X : Y;
      const traps: { value: Frac; trap: string }[] = [{ value: frac(ask === 'big' ? Y : X), trap: 'algw-answered-other-unknown' }];
      if ((T - mult * k) % (mult + 1) === 0) {
        const Yw = (T - mult * k) / (mult + 1);
        const v = ask === 'big' ? T - Yw : Yw;
        if (v > 0 && v !== ans) traps.push({ value: frac(v), trap: 'algw-more-than-order' });
      }
      const rel = `${Math.abs(k)} ${k > 0 ? 'more' : 'fewer'} than ${TIMES(mult)} the number of ${ctx.small}`;
      return {
        params: { ...base, T, mult, k, ask },
        q: {
          format: 'ne',
          stem: `${ctx.intro(T)} The number of ${ctx.big} is ${rel}. ${ctx.ask(ask === 'big' ? ctx.big : ctx.small)}`,
          answer: frac(ans),
          traps,
          explanation: `Let $y$ be the number of ${ctx.small}. "${rel.charAt(0).toUpperCase() + rel.slice(1)}" is $${mult}y ${k > 0 ? '+' : '-'} ${Math.abs(k)}$, so

$$y + (${mult}y ${k > 0 ? '+' : '-'} ${Math.abs(k)}) = ${T} \\quad\\Rightarrow\\quad ${mult + 1}y = ${T - k} \\quad\\Rightarrow\\quad y = ${Y}$$

There are ${Y} ${ctx.small} and $${mult}(${Y}) ${k > 0 ? '+' : '-'} ${Math.abs(k)} = ${X}$ ${ctx.big}. The question asks for the ${ask === 'big' ? ctx.big : ctx.small}: ${ans}.

"${Math.abs(k)} ${k > 0 ? 'more' : 'fewer'} than ${TIMES(mult)} $y$" is $${mult}y ${k > 0 ? '+' : '-'} ${Math.abs(k)}$, not $${mult}(y ${k > 0 ? '+' : '-'} ${Math.abs(k)})$.`,
        },
      };
    }
    if (kind === 'fee') {
      const which = d === 1 ? 'rental' : rng.pick(['plumber', 'taxi'] as const);
      const per = FEE_CONTEXTS[which].per;
      let fee: number;
      let rate: number;
      let n: number;
      let stem: string;
      if (which === 'rental') {
        fee = rng.pick([2500, 3000, 3500, 4000, 4500]);
        rate = rng.pick([15, 20, 25, 30, 35, 40]);
        n = rng.int(6, 30) * 10;
      } else if (which === 'plumber') {
        fee = rng.pick([4000, 4500, 5000, 6000, 7500]);
        rate = rng.pick([2000, 2500, 3000, 3500]);
        n = rng.int(3, 13);
      } else {
        fee = rng.pick([250, 300, 350, 400]);
        rate = rng.pick([40, 50, 60]);
        n = rng.int(8, 45);
      }
      const total = fee + n * rate;
      const ans = frac(n, per);
      if (which === 'rental')
        stem = `A truck rental company charges ${cents(fee)} per day plus ${cents(rate)} for each mile the truck is driven. For a one-day rental, the total charge was ${cents(total)}. How many miles was the truck driven?`;
      else if (which === 'plumber')
        stem = `A plumber charges a fixed fee of ${cents(fee)} for each job plus ${cents(rate)} for each half hour of work. If the total charge for a job was ${cents(total)}, for how many hours did the plumber work?`;
      else stem = `A taxi ride costs ${cents(fee)} plus ${cents(rate)} for each $\\frac{1}{5}$ mile traveled. If a taxi ride cost ${cents(total)}, how many miles long was the ride?`;
      const traps: { value: Frac; trap: string }[] = [];
      const noFee = frac(total, rate * per);
      if (noFee.isTerminating()) traps.push({ value: noFee, trap: 'algw-forgot-fixed-fee' });
      if (per > 1) traps.push({ value: frac(n), trap: 'algw-units-mismatch' });
      const unitWord = which === 'rental' ? 'miles' : which === 'plumber' ? 'half hours' : 'fifths of a mile';
      return {
        params: { ...base, fee, rate, total, per },
        q: {
          format: 'ne',
          stem,
          answer: ans,
          suffix: FEE_CONTEXTS[which].unit,
          traps,
          explanation: `Subtract the fixed part first: ${cents(total)} − ${cents(fee)} = ${cents(total - fee)} was charged at ${cents(rate)} per ${which === 'rental' ? 'mile' : which === 'plumber' ? 'half hour' : '$\\frac{1}{5}$ mile'}, which is $\\frac{${dx(frac(total - fee, 100))}}{${dx(frac(rate, 100))}} = ${n}$ ${unitWord}.${
            per > 1 ? ` That is $\\frac{${n}}{${per}} = ${dx(ans)}$ ${FEE_CONTEXTS[which].unit}.` : ''
          }

Dividing the whole charge by the rate ignores the fixed ${which === 'taxi' ? 'fare' : 'fee'}, which is paid once whatever the length.${per > 1 ? ` And ${n} is the number of ${unitWord}, not of ${FEE_CONTEXTS[which].unit}.` : ''}`,
        },
      };
    }
    if (kind === 'ages') {
      for (;;) {
        const [na, nb] = rng.sample(NAMES, 2);
        const B = rng.int(4, 25);
        const p = rng.pick([2, 3]);
        const k = rng.pick([0, 0, rng.int(1, 9), -rng.int(1, 5)]);
        const A = p * B + k;
        if (A <= B + 2) continue;
        const opts: { n: number; future: boolean; q: number }[] = [];
        for (let n = 2; n <= 20; n++) {
          if ((A + n) % (B + n) === 0) opts.push({ n, future: true, q: (A + n) / (B + n) });
          if (B - n >= 1 && (A - n) % (B - n) === 0) opts.push({ n, future: false, q: (A - n) / (B - n) });
        }
        const good = opts.filter((o) => o.q >= 2 && o.q <= 5 && o.q !== p);
        if (!good.length) continue;
        const { n, future, q } = rng.pick(good);
        const ask: 'big' | 'small' = rng.chance(0.65) ? 'small' : 'big';
        const ans = ask === 'small' ? B : A;
        const sgn = future ? 1 : -1;
        const traps: { value: Frac; trap: string }[] = [{ value: frac(ask === 'small' ? A : B), trap: 'algw-answered-other-unknown' }];
        // offset applied to one person only: p b + k + s n = q b
        if (q !== p && (k + sgn * n) % (q - p) === 0) {
          const bw = (k + sgn * n) / (q - p);
          const v = ask === 'small' ? bw : p * bw + k;
          if (bw > 0 && v !== ans) traps.push({ value: frac(v), trap: 'algw-age-offset-one' });
        }
        const rel = k === 0 ? `${na} is ${TIMES(p)} as old as ${nb}.` : `${na}'s age is ${plural(Math.abs(k), 'year')} ${k > 0 ? 'more' : 'less'} than ${TIMES(p)} ${nb}'s age.`;
        const nW = WORDS[n] ?? String(n);
        const when = future
          ? `In ${nW} years, ${na} will be ${TIMES(q)} as old as ${nb} will be then.`
          : `${nW.charAt(0).toUpperCase() + nW.slice(1)} years ago, ${na} was ${TIMES(q)} as old as ${nb} was then.`;
        const s = future ? '+' : '-';
        const aExpr = `${p}b${k === 0 ? '' : k > 0 ? ` + ${k}` : ` - ${-k}`}`;
        return {
          params: { ...base, p, k, n, q, future, ask },
          q: {
            format: 'ne',
            stem: `${rel} ${when} How old is ${ask === 'small' ? nb : na} now?`,
            answer: frac(ans),
            suffix: 'years old',
            traps,
            explanation: `Let $b$ be ${nb}'s age now, so ${na}'s age is $${aExpr}$. ${future ? `In ${n} years` : `${n} years ago`} BOTH ages ${future ? 'increase' : 'decrease'} by ${n}:

$$${aExpr} ${s} ${n} = ${q}(b ${s} ${n})$$

So $${lin([[p, 'b'], [k + sgn * n, '']])} = ${lin([[q, 'b'], [sgn * q * n, '']])}$, which gives $b = ${B}$. ${nb} is ${B} and ${na} is $${p}(${B})${k === 0 ? '' : k > 0 ? ` + ${k}` : ` - ${-k}`} = ${A}$.${
              ask === 'big' ? ` The question asks for ${na}'s age: ${A}.` : ''
            }

Check: ${future ? `in ${n} years they will be ${A + n} and ${B + n}` : `${n} years ago they were ${A - n} and ${B - n}`}, and $${future ? A + n : A - n} = ${q} \\times ${future ? B + n : B - n}$.`,
          },
        };
      }
    }
    // break-even between two phone plans
    for (;;) {
      const ca = rng.pick([3, 4, 5, 6, 8, 10]);
      const cb = ca + rng.pick([2, 4, 5, 10]);
      const diff = rng.pick([10, 12, 15, 20, 24, 30]);
      if ((100 * diff) % (cb - ca) !== 0) continue;
      const fb = rng.pick([5, 10, 15, 20]);
      const fa = fb + diff;
      const m = (100 * diff) / (cb - ca);
      if (m > 2000) continue;
      const wrong = frac(diff, cb - ca);
      return {
        params: { ...base, fa, fb, ca, cb },
        q: {
          format: 'ne',
          stem: `Phone plan A costs ${cents(fa * 100)} per month plus ${ca} cents per minute of calls. Phone plan B costs ${cents(fb * 100)} per month plus ${cb} cents per minute of calls. For how many minutes of calls in a month do the two plans cost the same?`,
          answer: frac(m),
          suffix: 'minutes',
          traps: wrong.isTerminating() && !wrong.eq(m) ? [{ value: wrong, trap: 'algw-units-cents' }] : [],
          explanation: `Work in cents. For $m$ minutes, plan A costs $${num(fa * 100)} + ${ca}m$ cents and plan B costs $${num(fb * 100)} + ${cb}m$ cents. Setting them equal:

$$${num(fa * 100)} + ${ca}m = ${num(fb * 100)} + ${cb}m \\quad\\Rightarrow\\quad ${cb - ca}m = ${num(diff * 100)} \\quad\\Rightarrow\\quad m = ${num(m)}$$

Each minute, plan B costs ${cb - ca} cents more, and it must make up the ${cents(diff * 100)} difference in monthly fees: ${num(diff * 100)} cents ÷ ${cb - ca} cents per minute. Mixing dollars and cents gives ${dx(wrong)}.`,
        },
      };
    }
  },
  check(q, prm) {
    if (prm.kind === 'formula') {
      // Search the integer temperatures for the one that satisfies the formula.
      const sols: number[] = [];
      for (let t = -500; t <= 500; t++) {
        if (prm.toF && 5 * (t - 32) === 9 * prm.cel) sols.push(t);
        if (!prm.toF && 5 * (prm.fah - 32) === 9 * t) sols.push(t);
      }
      return sols.length === 1 ? expectNe(q, sols[0]) : `${sols.length} solutions`;
    }
    if (prm.kind === 'twice-more') {
      const sols: number[] = [];
      for (let y = 0; y <= prm.T; y++) if (prm.mult * y + prm.k + y === prm.T) sols.push(prm.ask === 'big' ? prm.T - y : y);
      return sols.length === 1 ? expectNe(q, sols[0]) : `${sols.length} solutions`;
    }
    if (prm.kind === 'fee') {
      const sols: number[] = [];
      for (let n = 0; n <= 3000; n++) if (prm.fee + n * prm.rate === prm.total) sols.push(n);
      return sols.length === 1 ? expectNe(q, frac(sols[0], prm.per)) : `${sols.length} solutions`;
    }
    if (prm.kind === 'ages') {
      const sols: number[] = [];
      for (let b = 1; b <= 150; b++) {
        const a = prm.p * b + prm.k;
        const s = prm.future ? prm.n : -prm.n;
        if (b + s >= 1 && a + s === prm.q * (b + s)) sols.push(prm.ask === 'small' ? b : a);
      }
      return sols.length === 1 ? expectNe(q, sols[0]) : `${sols.length} solutions`;
    }
    const sols: number[] = [];
    for (let m = 0; m <= 100000; m++) if (100 * prm.fa + prm.ca * m === 100 * prm.fb + prm.cb * m) sols.push(m);
    return sols.length === 1 ? expectNe(q, sols[0]) : `${sols.length} solutions`;
  },
};

/* =============================================================================================
 * 2. Two item types: count equation + value equation (MCS) [BOOK AL-31]
 * =========================================================================================== */

interface TwoTypesParams {
  T: number;
  U: number;
  lo: number;
  hi: number;
  askHi: boolean;
  /** The question asks for the value of one kind (price times count) instead of the count. */
  valueAsk: boolean;
  values: Frac[];
}

const twoTypes: Template<TwoTypesParams> = {
  id: 'alg.word-problems.two-types',
  skill: 'alg.word-problems',
  format: 'mcs',
  style: 'two kinds of items: a count and a total value',
  generate(rng, d) {
    const ctx = rng.pick(d === 1 ? (['tickets', 'animals'] as const) : (['tickets', 'coins', 'animals', 'quiz'] as const));
    let lo: number;
    let hi: number;
    let x: number; // number of hi items
    let y: number; // number of lo items
    do {
      x = rng.int(3, d === 1 ? 20 : 40);
      y = rng.int(3, d === 1 ? 20 : 40);
    } while (x === y);
    let stem: string;
    let names: [string, string];
    let unitTotal: string;
    const askHi = rng.chance(0.55);
    const valueAsk = rng.chance(0.3); // ask for the value of one kind instead of how many there are
    if (ctx === 'tickets') {
      lo = rng.pick([4, 5, 6, 8]);
      hi = lo + rng.pick([2, 3, 4, 5, 6]);
      names = ['student tickets', 'adult tickets'];
      const T = x + y;
      const U = hi * x + lo * y;
      stem = `A theater sold ${T} tickets for a show. Adult tickets cost ${money(hi)} each and student tickets cost ${money(lo)} each. If the total from ticket sales was ${money(U)}, ${valueAsk ? `how many dollars were collected from the sale of ${askHi ? 'adult' : 'student'} tickets?` : `how many ${askHi ? 'adult' : 'student'} tickets were sold?`}`;
      unitTotal = `${money(U)}`;
    } else if (ctx === 'coins') {
      lo = 10;
      hi = 25;
      names = ['dimes', 'quarters'];
      const T = x + y;
      const U = hi * x + lo * y;
      stem = `A jar contains ${T} coins, all of them dimes or quarters, with a total value of ${money(frac(U, 100), true)}. ${valueAsk ? `What is the total value, in cents, of the ${askHi ? 'quarters' : 'dimes'} in the jar?` : `How many ${askHi ? 'quarters' : 'dimes'} are in the jar?`}`;
      unitTotal = `${num(U)} cents`;
    } else if (ctx === 'animals') {
      lo = 2;
      hi = 4;
      names = ['chickens', 'goats'];
      const T = x + y;
      const U = hi * x + lo * y;
      stem = `A farm has only chickens and goats. Together the animals have ${T} heads and ${U} legs. ${valueAsk ? `How many of the legs belong to the ${askHi ? 'goats' : 'chickens'}?` : `How many ${askHi ? 'goats' : 'chickens'} are on the farm?`}`;
      unitTotal = `${U} legs`;
    } else {
      lo = rng.pick([2, 3]);
      hi = lo + rng.pick([2, 3]);
      names = [`${lo}-point questions`, `${hi}-point questions`];
      const T = x + y;
      const U = hi * x + lo * y;
      const nm = rng.pick(NAMES);
      stem = `Each question on a quiz is worth either ${lo} points or ${hi} points. ${nm} answered ${T} questions correctly and earned a total of ${U} points. ${valueAsk ? `How many of ${nm}'s points came from the ${askHi ? hi : lo}-point questions?` : `How many ${askHi ? hi : lo}-point questions did ${nm} answer correctly?`}`;
      unitTotal = `${U} points`;
    }
    const T = x + y;
    const U = hi * x + lo * y;
    const price = askHi ? hi : lo;
    const count = askHi ? x : y;
    const ans = valueAsk ? price * count : count;
    const other = askHi ? y : x;
    const lowTotal = lo * T;
    const wrongs: { value: Frac; trap: string; why: string }[] = valueAsk
      ? [
          { value: frac(count), trap: 'algw-answered-count-not-value', why: `giving how many ${askHi ? names[1] : names[0]} there are, not their value` },
          { value: frac((askHi ? lo : hi) * other), trap: 'algw-answered-other-unknown', why: `giving the value of the ${askHi ? names[0] : names[1]}, the other kind` },
          { value: frac(U), trap: 'algw-answered-total-value', why: 'giving the total value of both kinds' },
          { value: frac(price * T), trap: 'algw-all-at-one-price', why: `valuing all ${T} items at ${price} each` },
        ]
      : [
      { value: frac(other), trap: 'algw-answered-other-unknown', why: `giving the number of ${askHi ? names[0] : names[1]}, the other unknown` },
      { value: frac(askHi ? U - lowTotal : hi * T - U), trap: 'algw-forgot-divide-difference', why: `stopping at the extra value ${num(askHi ? U - lowTotal : hi * T - U)} without dividing by the difference ${hi - lo} between the two values` },
      { value: frac(ans * (askHi ? hi : lo)), trap: 'algw-answered-value-not-count', why: `giving the value of the ${askHi ? names[1] : names[0]}, not their number` },
      { value: frac(T), trap: 'algw-answered-total', why: 'giving the total number of items' },
    ];
    if (T % 2 === 0) wrongs.push({ value: frac(T / 2), trap: 'algw-assumed-equal-split', why: 'assuming the items split evenly between the two kinds' });
    wrongs.push({ value: frac(hi - lo), trap: 'algw-intermediate-step', why: `giving the difference ${hi - lo} between the two values, a number from the middle of the solution` });
    if (!valueAsk) {
      const extra = askHi ? U - lowTotal : hi * T - U;
      for (const den of [askHi ? hi : lo, hi + lo]) if (extra % den === 0) wrongs.push({ value: frac(extra / den), trap: 'algw-wrong-divisor', why: `dividing the extra value ${num(extra)} by ${den} instead of by the difference ${hi - lo} of the two values` });
      wrongs.push({ value: frac(Math.abs(x - y)), trap: 'algw-difference-of-counts', why: 'giving the difference between the two counts' });
    }
    const onePrice = rng.chance(0.5) ? lo : hi;
    wrongs.push({ value: frac(onePrice), trap: 'algw-intermediate-step', why: `giving the value ${onePrice} of one item, a number from the middle of the solution` });
    const res = trapChoices(rng, ans, wrongs, (v) => `$${num(v)}$`);
    if (!res) return twoTypes.generate(rng, d);
    const { choices, answer } = res;
    const values = res.values;
    const cited = res.kept[0];
    const u = ctx === 'coins' ? ' cents' : ctx === 'tickets' ? ' dollars' : ctx === 'animals' ? ' legs' : ' points';
    return {
      params: { T, U, lo, hi, askHi, valueAsk, values },
      q: {
        format: 'mcs',
        stem,
        choices,
        answer,
        explanation: `Two kinds of items with a count and a total value: use the count to leave a single unknown. Let $h$ be the number of ${names[1]}; then there are $${T} - h$ ${names[0]}, and

$$${hi}h + ${lo}(${T} - h) = ${num(U)}$$

so $${hi - lo}h = ${num(U)} - ${num(lowTotal)} = ${num(U - lowTotal)}$ and $h = ${x}$. (Shortcut: if all ${T} were ${names[0]}, the total would be ${num(lowTotal)}${u}; each swap to the other kind adds ${hi - lo}.) So there are ${x} ${names[1]} and ${y} ${names[0]}${valueAsk ? `. The question asks for their value: $${price} \\times ${count} = ${num(ans)}$` : askHi ? '' : `, and the question asks for ${y}`}.

Check: $${hi}(${x}) + ${lo}(${y}) = ${num(U)}$ (${unitTotal}) and $${x} + ${y} = ${T}$.

Trap: ${num(cited.value)} comes from ${cited.why}.

Rule: let one unknown be the count of one kind, write the other kind as total minus it, then use the value equation.`,
      },
    };
  },
  check(q, { T, U, lo, hi, askHi, valueAsk, values }) {
    const err = choiceValuesMatch(q, values, (v) => `$${num(v)}$`);
    if (err) return err;
    const sols: number[] = [];
    for (let h = 0; h <= T; h++) if (hi * h + lo * (T - h) === U) sols.push(valueAsk ? (askHi ? hi * h : lo * (T - h)) : askHi ? h : T - h);
    if (sols.length !== 1) return `${sols.length} solutions`;
    return expectMcs(
      q,
      uniqueIndex(values, (v) => v.eq(sols[0])),
    );
  },
};

/* =============================================================================================
 * 3. Translate both quantities and compare (QC) [BOOK AL-13, AL-28, AL-01]
 * =========================================================================================== */

interface TransParams {
  mode: 'members' | 'unit-cost' | 'order';
  /** members: given count is of the bigger group? difference k, B = 2c + delta */
  givenBig: boolean;
  k: number;
  delta: number;
  /** unit-cost: L = mult*S + sgn*c; A = n S + n L; B = m L */
  mult: number;
  c: number;
  sgn: -1 | 0 | 1;
  n: number;
  m: number;
  /** order: Y = X + j (j = 0 means only "younger" is known); A = mult X; bound on X */
  j: number;
  bound: 'none' | 'gt' | 'lt';
  bv: number;
}

const GROUPS = [
  { big: 'members', small: 'nonmembers', where: 'at a club meeting', total: 'The total number of people at the meeting' },
  { big: 'cars', small: 'trucks', where: 'in a parking lot', total: 'The total number of cars and trucks in the lot' },
  { big: 'adults', small: 'children', where: 'on a museum tour', total: 'The total number of people on the tour' },
  { big: 'paperback books', small: 'hardcover books', where: 'on a shelf', total: 'The total number of books on the shelf' },
];

const ITEMS = [
  { s: 'small box', l: 'large box', S: 'small boxes', L: 'large boxes' },
  { s: 'notebook', l: 'binder', S: 'notebooks', L: 'binders' },
  { s: 'muffin', l: 'cake', S: 'muffins', L: 'cakes' },
];

const translateQC: Template<TransParams> = {
  id: 'alg.word-problems.translate-qc',
  skill: 'alg.word-problems',
  format: 'qc',
  style: 'translate the words, then compare',
  generate(rng, d) {
    const mode = rng.pick(d === 1 ? (['members', 'order'] as const) : d === 2 ? (['members', 'unit-cost', 'order'] as const) : (['unit-cost', 'order', 'members'] as const));
    const base: TransParams = { mode, givenBig: true, k: 0, delta: 0, mult: 0, c: 0, sgn: 0, n: 0, m: 0, j: 0, bound: 'none', bv: 0 };
    if (mode === 'members') {
      const g = rng.pick(GROUPS);
      const k = rng.int(3, 15);
      const givenBig = rng.chance(0.65);
      const letter = rng.pick(['c', 'n', 'm', 'p']);
      // total = 2c - k (given big) or 2c + k (given small)
      const exactDelta = givenBig ? -k : k;
      const delta = rng.pick([exactDelta, exactDelta, -exactDelta, givenBig ? -2 * k : 2 * k, 0]);
      const answer: QCChoice = delta === exactDelta ? 'C' : exactDelta > delta ? 'A' : 'B';
      const wrongDelta = -exactDelta; // the other group written with the wrong sign
      const trapAns: QCChoice = wrongDelta === delta ? 'C' : wrongDelta > delta ? 'A' : 'B';
      const traps: QCQuestion['traps'] = trapAns !== answer ? { [trapAns]: 'algw-more-than-direction' } : undefined;
      const Btex = `2${letter}${delta === 0 ? '' : delta > 0 ? ` + ${delta}` : ` - ${-delta}`}`;
      return {
        params: { ...base, givenBig, k, delta },
        q: {
          format: 'qc',
          info: `There are ${k} more ${g.big} than ${g.small} ${g.where}. The number of ${givenBig ? g.big : g.small} is $${letter}$.`,
          quantityA: g.total,
          quantityB: `$${Btex}$`,
          answer,
          traps,
          explanation: `${givenBig ? `There are $${letter}$ ${g.big}, and ${k} more ${g.big} than ${g.small}, so there are $${letter} - ${k}$ ${g.small}.` : `There are $${letter}$ ${g.small}, and ${k} more ${g.big}, so there are $${letter} + ${k}$ ${g.big}.`} The total is $${letter} + (${letter} ${givenBig ? '-' : '+'} ${k}) = 2${letter} ${givenBig ? '-' : '+'} ${k}$.

Compare $2${letter} ${givenBig ? '-' : '+'} ${k}$ with $${Btex}$: the $2${letter}$ cancels, leaving $${num(exactDelta)}$ versus $${num(delta)}$. ${qcEnd(answer)}

Check the direction with numbers: if there were 20 ${givenBig ? g.big : g.small}, there would be ${givenBig ? 20 - k : 20 + k} ${givenBig ? g.small : g.big}.`,
        },
      };
    }
    if (mode === 'unit-cost') {
      const it = rng.pick(ITEMS);
      const mult = rng.pick([2, 3, 4]);
      const c = rng.int(1, 4);
      const j = rng.int(1, 2);
      const n = mult * j;
      const m0 = (mult + 1) * j;
      const variant = rng.pick(d === 3 ? (['less', 'more', 'exact', 'extra', 'extra'] as const) : (['less', 'more', 'exact', 'less'] as const));
      const sgn: -1 | 0 | 1 = variant === 'more' ? 1 : variant === 'exact' ? 0 : -1;
      const m = variant === 'extra' ? m0 + 1 : m0;
      // A - B = n S + n L - m L, with L = mult S + sgn c
      const answer: QCChoice = variant === 'extra' ? 'D' : sgn < 0 ? 'A' : sgn > 0 ? 'B' : 'C';
      const traps: QCQuestion['traps'] = variant === 'extra' ? { A: 'algw-single-case' } : sgn !== 0 ? { C: 'algw-cost-exact-multiple' } : undefined;
      const rel = sgn === 0 ? `exactly ${TIMES(mult)} the price of a ${it.s}` : `${cents(c * 100)} ${sgn < 0 ? 'less' : 'more'} than ${TIMES(mult)} the price of a ${it.s}`;
      const Lexpr = `${mult}s${sgn === 0 ? '' : sgn < 0 ? ` - ${c}` : ` + ${c}`}`;
      const diffTex = variant === 'extra' ? '' : sgn === 0 ? '0' : `${sgn < 0 ? '' : '-'}${num(frac(n * c, mult))}`;
      return {
        params: { ...base, mult, c, sgn, n, m },
        q: {
          format: 'qc',
          info: `At a store, the price of a ${it.l} is ${rel}.`,
          quantityA: `The total price of ${n} ${it.S} and ${n} ${it.L}`,
          quantityB: `The total price of ${m} ${it.L}`,
          answer,
          traps,
          explanation:
            variant === 'extra'
              ? `Let a ${it.s} cost $s$ dollars, so a ${it.l} costs $${Lexpr}$. Quantity A is $${n}s + ${n}(${Lexpr}) = ${n * (mult + 1)}s ${sgn < 0 ? '-' : '+'} ${n * c}$ and Quantity B is $${m}(${Lexpr}) = ${m * mult}s ${sgn < 0 ? '-' : '+'} ${m * c}$.

B − A $= ${m * mult - n * (mult + 1)}s - ${(m - n) * c}$. A ${it.l} must have a positive price, so $s > ${num(frac(c, mult))}$; B − A is negative when $s < ${num(frac((m - n) * c, m * mult - n * (mult + 1)))}$ and positive when $s$ is larger, and both kinds of prices are allowed. ${qcEnd('D')}`
              : `Let a ${it.s} cost $s$ dollars, so a ${it.l} costs $${Lexpr}$. Both quantities contain ${n} ${it.L}; remove them. What remains is ${n} ${it.S} (Quantity A) versus ${m - n} ${m - n === 1 ? it.l : it.L} (Quantity B):

$$${n}s \\quad\\text{versus}\\quad ${m - n === 1 ? '' : m - n}(${Lexpr}) = ${n}s ${sgn === 0 ? '' : sgn < 0 ? `- ${(m - n) * c}` : `+ ${(m - n) * c}`}$$

${sgn === 0 ? 'They are equal.' : `Quantity A minus Quantity B is $${diffTex}$.`} ${qcEnd(answer)}${sgn !== 0 ? ` Treating the ${it.l} as exactly ${TIMES(mult)} the price would wrongly give C.` : ''}`,
        },
      };
    }
    // order of two ages, compare a multiple of one with the other
    const [nx, ny] = rng.sample(NAMES, 2);
    const mult = d === 1 ? 2 : rng.pick([2, 3]);
    const known = rng.chance(d === 1 ? 0.4 : 0.8);
    const j = known ? rng.int(8, 30) : 0;
    let bound: TransParams['bound'] = known ? rng.pick(['none', 'gt', 'lt'] as const) : 'none';
    // threshold: mult X vs X + j  <=>  X vs j/(mult - 1)
    const th = frac(j, mult - 1);
    let bv = 0;
    if (bound === 'gt') bv = Math.ceil(th.toNumber()) + rng.int(0, 4);
    if (bound === 'lt') bv = Math.floor(th.toNumber()) - rng.int(0, 2);
    if (bound === 'lt' && bv < 4) bound = 'none';
    const answer: QCChoice = bound === 'none' ? 'D' : bound === 'gt' ? 'A' : 'B';
    const traps: QCQuestion['traps'] = answer === 'D' ? { [rng.pick(['A', 'B'] as const)]: 'algw-single-case' } : { D: 'algw-single-case' };
    const info = `${nx} is ${known ? `${j} years ` : ''}younger than ${ny}.${bound === 'gt' ? ` ${nx} is more than ${bv} years old.` : bound === 'lt' ? ` ${nx} is less than ${bv} years old.` : ''}`;
    const why = known
      ? `Let ${nx}'s age be $x$, so ${ny}'s age is $x + ${j}$. Compare $${mult}x$ with $x + ${j}$: subtract $x$ from both to get $${mult - 1 === 1 ? '' : mult - 1}x$ versus ${j}, that is, $x$ versus $${num(th)}$.

${
          bound === 'none'
            ? `Nothing says whether ${nx} is older or younger than $${num(th)}$: at age ${Math.max(1, Math.floor(th.toNumber()) - 1)} Quantity B is greater, at age ${Math.ceil(th.toNumber()) + 2} Quantity A is greater. ${qcEnd('D')}`
            : bound === 'gt'
              ? `Since $x > ${bv} \\ge ${num(th)}$, $${mult}x > x + ${j}$. ${qcEnd('A')}`
              : `Since $x < ${bv} \\le ${num(th)}$, $${mult}x < x + ${j}$. ${qcEnd('B')}`
        }`
      : `Try ages. If ${nx} is 6 and ${ny} is 10, then ${mult} × 6 = ${mult * 6} is greater than 10. If ${nx} is 4 and ${ny} is ${mult * 4 + 6}, then ${mult} × 4 = ${mult * 4} is less. ${qcEnd('D')}`;
    return {
      params: { ...base, mult, j, bound, bv },
      q: {
        format: 'qc',
        info,
        quantityA: `${mult === 2 ? 'Twice' : 'Three times'} ${nx}'s age`,
        quantityB: `${ny}'s age`,
        answer,
        traps,
        explanation: why,
      },
    };
  },
  check(q, prm, rng) {
    const samples: [Frac, Frac][] = [];
    if (prm.mode === 'members') {
      for (let c = prm.k + 1; c < prm.k + 200; c++) {
        // build the two groups explicitly
        const big = prm.givenBig ? c : c + prm.k;
        const small = prm.givenBig ? c - prm.k : c;
        if (big - small !== prm.k || small < 0) return 'bad group sizes';
        samples.push([frac(big + small), frac(2 * c + prm.delta)]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    if (prm.mode === 'unit-cost') {
      for (let i = 0; i < 400; i++) {
        const s = frac(rng.int(1, 4000), 100); // price in dollars, cents precision
        const L = s.mul(prm.mult).add(prm.sgn * prm.c);
        if (L.sign() <= 0) continue;
        let A = frac(0);
        for (let t = 0; t < prm.n; t++) A = A.add(s).add(L);
        let B = frac(0);
        for (let t = 0; t < prm.m; t++) B = B.add(L);
        samples.push([A, B]);
      }
      return expectQc(q, qcFromSamples(samples));
    }
    for (let x = 1; x <= 120; x++) {
      if (prm.bound === 'gt' && !(x > prm.bv)) continue;
      if (prm.bound === 'lt' && !(x < prm.bv)) continue;
      const ys = prm.j > 0 ? [x + prm.j] : [x + 1, x + 2, x + 5, x + 20, x + 60];
      for (const y of ys) samples.push([frac(prm.mult * x), frac(y)]);
    }
    return expectQc(q, qcFromSamples(samples));
  },
};

/* =============================================================================================
 * 4. Story with successive changes: select all equivalent expressions (MCM) [BOOK AL-23]
 * =========================================================================================== */

interface EquivParams {
  f: Frac;
  p: number;
  g: number;
  exprs: E[];
}

const CONTAINERS = [
  { what: 'A water tank', unit: 'gallons', stuff: 'water', used: 'is used' },
  { what: 'A storage bin', unit: 'pounds', stuff: 'rice', used: 'is sold' },
  { what: 'A fuel tank', unit: 'liters', stuff: 'fuel', used: 'is used' },
];

const FP: [Frac, number][] = [
  [frac(3, 4), 20],
  [frac(2, 3), 25],
  [frac(1, 2), 40],
  [frac(4, 5), 25],
  [frac(3, 5), 50],
  [frac(3, 4), 40],
  [frac(5, 6), 40],
];

const equivalentExpressions: Template<EquivParams> = {
  id: 'alg.word-problems.equivalent-expressions',
  skill: 'alg.word-problems',
  format: 'mcm',
  style: 'which expressions model a story (select all)',
  generate(rng, d) {
    const ctx = rng.pick(CONTAINERS);
    const [f, p] = rng.pick(d === 1 ? FP.slice(0, 3) : FP);
    const g = rng.int(3, 15) * (d === 1 ? 1 : rng.pick([1, 5]));
    const P = frac(p, 100);
    const keep = frac(1).sub(P);
    const cf = keep.mul(f);
    const x = V('x');
    const fx = mul(N(f), x);
    const correct: { e: E }[] = [
      { e: add(mul(N(cf), x), N(g)) },
      { e: add(subE(fx, mul(N(P, true), fx)), N(g)) },
      { e: add(mul(N(keep, true), fx), N(g)) },
    ];
    const wrongs: { e: E; trap: string }[] = [
      { e: add(subE(fx, mul(N(P, true), x)), N(g)), trap: 'algw-percent-of-wrong-base' },
      { e: add(mul(N(P.mul(f)), x), N(g)), trap: 'algw-used-vs-left' },
      { e: subE(mul(N(cf), x), N(g)), trap: 'algw-added-subtracted' },
      { e: mul(N(keep, true), add(fx, N(g))), trap: 'algw-order-of-steps' },
    ];
    // A wrong form can coincide with the right one for some numbers (e.g. 50 percent used = 50 percent left).
    const value = (e: E) => evalE(e, { x: frac(120) });
    const target = value(correct[0].e);
    const usable = wrongs.filter((w) => !value(w.e).eq(target));
    const nCorrect = d === 3 ? rng.int(2, 3) : 2;
    const pickC = [correct[0], ...rng.sample(correct.slice(1), nCorrect - 1)];
    const pickW = rng.sample(usable, Math.min(usable.length, 5 - nCorrect));
    const items = rng.shuffle([...pickC.map((c) => ({ e: c.e, correct: true, trap: undefined as string | undefined })), ...pickW.map((w) => ({ e: w.e, correct: false, trap: w.trap as string | undefined }))]);
    const { choices, answer } = flaggedChoices(items.map((it) => ({ text: `$${tex(it.e)}$`, correct: it.correct, ...(it.trap ? { trap: it.trap } : {}) })));
    const fT = num(f);
    const pT = dx(P);
    return {
      params: { f, p, g, exprs: items.map((it) => it.e) },
      q: {
        format: 'mcm',
        stem: `${ctx.what} with a capacity of $x$ ${ctx.unit} is $${fT}$ full of ${ctx.stuff}. After ${p} percent of the ${ctx.stuff} in it ${ctx.used}, ${g} ${ctx.unit} of ${ctx.stuff} are added. Which of the following expressions represent the number of ${ctx.unit} of ${ctx.stuff} in it now?`,
        instruction: 'Indicate all such expressions.',
        choices,
        answer,
        explanation: `Follow the story in order.
- At first: $${fT}x$ ${ctx.unit}.
- ${p} percent of THAT amount is removed: $${fT}x - ${pT}\\left(${fT}x\\right) = ${dx(keep)}\\left(${fT}x\\right) = ${num(cf)}x$.
- Then ${g} ${ctx.unit} are added: $${num(cf)}x + ${g}$.

Every choice that simplifies to $${num(cf)}x + ${g}$ is correct, simplified or not. The percent applies to the ${ctx.stuff} in the container, not to the capacity $x$, and the ${g} ${ctx.unit} are added after the ${p} percent is removed.`,
      },
    };
  },
  check(q, { f, p, g, exprs }, rng) {
    if (q.format !== 'mcm') return 'wrong format';
    for (let i = 0; i < exprs.length; i++) if (q.choices[i].text !== `$${tex(exprs[i])}$`) return 'choice text mismatch';
    // Simulate the story for several capacities and compare with each expression.
    const flags = exprs.map(() => true);
    for (let t = 0; t < 6; t++) {
      const cap = frac(rng.int(10, 5000));
      let amount = cap.mul(f);
      const removed = amount.mul(p).div(100);
      amount = amount.sub(removed);
      amount = amount.add(g);
      exprs.forEach((e, i) => {
        if (!evalE(e, { x: cap }).eq(amount)) flags[i] = false;
      });
    }
    return expectMcm(q, flags);
  },
};

/* =============================================================================================
 * 5. Express a quantity in terms of a variable (MCS) [BOOK AL-17, AL-20; GEN]
 * =========================================================================================== */

interface TermsOfParams {
  mode: 'unit-rate' | 'unit-rate-hours' | 'exactly-one' | 'twice-more' | 'fare';
  /** Variable names used by the expressions. */
  vars: string[];
  /** Numbers in the story. */
  nums: number[];
  exprs: E[];
}

const RATE_STORIES: { text: (n: string, x: string, y: string) => string; unit: string }[] = [
  { unit: 'dollars', text: (n, x, y) => `If $${n}$ pencils cost $${x}$ dollars, then at the same price per pencil, how many dollars do $${y}$ pencils cost?` },
  { unit: 'liters', text: (n, x, y) => `A car uses $${x}$ liters of fuel to travel $${n}$ kilometers. At this rate, how many liters of fuel does the car use to travel $${y}$ kilometers?` },
  { unit: 'minutes', text: (n, x, y) => `A machine fills $${n}$ bottles in $${x}$ minutes. Working at the same rate, how many minutes does it take the machine to fill $${y}$ bottles?` },
  { unit: 'cups', text: (n, x, y) => `A recipe uses $${x}$ cups of flour for $${n}$ loaves of bread. At this rate, how many cups of flour are needed for $${y}$ loaves?` },
  { unit: 'gallons', text: (n, x, y) => `A hose delivers $${x}$ gallons of water in $${n}$ minutes. At this rate, how many gallons does it deliver in $${y}$ minutes?` },
  { unit: 'widgets', text: (n, x, y) => `Working together, $${n}$ workers produce $${x}$ widgets in a day. At the same rate per worker, how many widgets do $${y}$ workers produce in a day?` },
  { unit: 'dollars', text: (n, x, y) => `A store sells $${n}$ notebooks for $${x}$ dollars. At the same price per notebook, what is the cost, in dollars, of $${y}$ notebooks?` },
  { unit: 'words', text: (n, x, y) => `A typist types $${x}$ words in $${n}$ minutes. At this rate, how many words does the typist type in $${y}$ minutes?` },
];

const LETTER_SETS = [['n', 'x', 'y'], ['k', 'c', 'm'], ['b', 't', 'w'], ['p', 'q', 'r'], ['a', 's', 'u']];

const HOUR_STORIES = [
  (p: string, m: string, h: string) => `A printer prints $${p}$ pages every $${m}$ minutes. At this rate, how many pages does it print in $${h}$ hours?`,
  (p: string, m: string, h: string) => `A factory machine makes $${p}$ parts every $${m}$ minutes. At this rate, how many parts does it make in $${h}$ hours?`,
  (p: string, m: string, h: string) => `A cyclist rides $${p}$ kilometers every $${m}$ minutes. At this rate, how many kilometers does the cyclist ride in $${h}$ hours?`,
  (p: string, m: string, h: string) => `A tap fills $${p}$ liters of water every $${m}$ minutes. At this rate, how many liters does it fill in $${h}$ hours?`,
];

const inTermsOf: Template<TermsOfParams> = {
  id: 'alg.word-problems.in-terms-of',
  skill: 'alg.word-problems',
  format: 'mcs',
  style: 'write the answer as an expression in the given letters',
  generate(rng, d) {
    const mode = rng.pick(d === 1 ? (['unit-rate', 'twice-more'] as const) : d === 2 ? (['unit-rate', 'twice-more', 'twice-more'] as const) : (['unit-rate-hours', 'exactly-one', 'fare'] as const));
    let correct: E;
    let wrong: { e: E; trap: string; why: string }[];
    let stem: string;
    let method: string;
    let rule: string;
    let vars: string[];
    let nums: number[] = [];
    let envs: Record<string, number>[];
    if (mode === 'unit-rate') {
      const st = rng.pick(RATE_STORIES);
      const [n, x, y] = rng.pick(LETTER_SETS);
      vars = [n, x, y];
      const [Nn, X, Y] = [V(n), V(x), V(y)];
      correct = div(mul(X, Y), Nn);
      wrong = [
        { e: div(mul(Nn, Y), X), trap: 'algw-rate-inverted', why: `inverting the unit rate: $\\frac{${n}}{${x}}$ per unit instead of $\\frac{${x}}{${n}}$` },
        { e: div(mul(Nn, X), Y), trap: 'algw-wrong-pairing', why: `multiplying $${n}$ by $${x}$ and dividing by $${y}$` },
        { e: div(Nn, mul(X, Y)), trap: 'algw-wrong-pairing', why: `putting the product $${x}${y}$ in the denominator` },
        { e: div(X, mul(Nn, Y)), trap: 'algw-rate-inverted', why: `dividing the unit rate by $${y}$ instead of multiplying` },
      ];
      stem = st.text(n, x, y);
      method = `Find the amount for one unit, then multiply by the number of units. One unit corresponds to $\\frac{${x}}{${n}}$, so $${y}$ units correspond to $\\frac{${x}}{${n}} \\cdot ${y} = \\frac{${x}${y}}{${n}}$.`;
      rule = 'amount per unit times number of units gives the amount.';
      envs = [{ [n]: 2, [x]: 6, [y]: 5 }, { [n]: 4, [x]: 6, [y]: 10 }, { [n]: 3, [x]: 12, [y]: 7 }];
    } else if (mode === 'unit-rate-hours') {
      const [p, m, h] = rng.pick([['p', 'm', 'h'], ['c', 's', 't'], ['a', 'b', 'k']]);
      vars = [p, m, h];
      const [P, M, H] = [V(p), V(m), V(h)];
      correct = div(mul(N(60), mul(P, H)), M);
      wrong = [
        { e: div(mul(P, H), M), trap: 'algw-units-mismatch', why: `forgetting to convert $${h}$ hours to $60${h}$ minutes` },
        { e: div(mul(N(60), mul(M, H)), P), trap: 'algw-rate-inverted', why: 'inverting the rate' },
        { e: div(mul(P, H), mul(N(60), M)), trap: 'algw-units-mismatch', why: `dividing by 60 where hours must be turned into minutes by multiplying` },
        { e: div(mul(N(60), P), mul(M, H)), trap: 'algw-wrong-pairing', why: `putting $${h}$ in the denominator` },
      ];
      stem = rng.pick(HOUR_STORIES)(p, m, h);
      method = `The rate is $\\frac{${p}}{${m}}$ per minute, and $${h}$ hours is $60${h}$ minutes. The amount is $\\frac{${p}}{${m}} \\cdot 60${h} = \\frac{60${p}${h}}{${m}}$.`;
      rule = 'put the time in the unit of the rate before multiplying.';
      envs = [{ [p]: 3, [m]: 2, [h]: 4 }, { [p]: 5, [m]: 10, [h]: 2 }];
    } else if (mode === 'exactly-one') {
      const total = rng.pick([800, 1200, 1500, 2000, 2400, 3000, 3600, 4000]);
      const pct = rng.pick([20, 25, 30, 35, 40, 45, 15, 12]);
      const ex = (total * pct) / 100;
      nums = [total, pct];
      vars = ['r'];
      const r = V('r');
      correct = subE(N(ex), r);
      wrong = [
        { e: subE(N(total), r), trap: 'algw-exactly-one-total', why: `using all ${num(total).replace('{,}', ',')} people instead of the ${pct} percent who own exactly one` },
        { e: mul(N(frac(pct, 100), true), subE(N(total), r)), trap: 'algw-percent-of-wrong-base', why: `taking ${pct} percent of what remains after $r$ is removed` },
        { e: subE(r, N(ex)), trap: 'alg-sign-slip', why: 'subtracting in the wrong order' },
        { e: add(N(ex), r), trap: 'algw-added-subtracted', why: 'adding $r$ where the people already counted must be taken away' },
      ];
      const [s1, s2] = rng.pick([
        ['a cat', 'a dog'],
        ['a bicycle', 'a car'],
        ['a savings account', 'a retirement account'],
        ['a tablet', 'a laptop'],
      ]);
      stem = `In a survey, ${num(total).replace('{,}', ',')} people were asked whether they own ${s1} and whether they own ${s2}. Of those surveyed, ${pct} percent own exactly one of the two. If $r$ of the people surveyed own ${s1} but not ${s2}, which of the following represents the number who own ${s2} but not ${s1}?`;
      method = `Exactly one of the two: ${pct} percent of ${num(total).replace('{,}', ',')}, that is, ${num(ex).replace('{,}', ',')} people. They split into "${s1} only" ($r$ people) and "${s2} only", so the second group has $${num(ex)} - r$ people.`;
      rule = 'find the size of the group that is split before naming its parts.';
      envs = [{ r: Math.floor(ex / 4) }, { r: Math.floor(ex / 2) }];
    } else if (mode === 'twice-more') {
      const k = rng.int(2, 12);
      const sg = rng.chance(0.65) ? 1 : -1;
      const [na, nb] = rng.sample(NAMES, 2);
      const a = rng.pick(['a', 'b', 'n', 's']);
      vars = [a];
      nums = [sg * k];
      const A = V(a);
      correct = sg > 0 ? add(mul(N(3), A), N(k)) : subE(mul(N(3), A), N(k));
      const flipSign = (c: number) => (sg > 0 ? subE(mul(N(3), A), N(c * k)) : add(mul(N(3), A), N(c * k)));
      wrong = [
        { e: sg > 0 ? add(mul(N(2), A), N(k)) : subE(mul(N(2), A), N(k)), trap: 'algw-answered-other-unknown', why: `giving ${na}'s number alone and leaving out ${nb}'s` },
        { e: sg > 0 ? add(mul(N(3), A), N(2 * k)) : subE(mul(N(3), A), N(2 * k)), trap: 'algw-more-than-order', why: `reading the phrase as $2(${a} ${sg > 0 ? '+' : '-'} ${k})$` },
        { e: flipSign(1), trap: 'algw-more-than-direction', why: `adding where the phrase says ${sg > 0 ? 'more' : 'fewer'} (the wrong sign on ${k})` },
        { e: sg > 0 ? add(mul(N(2), A), N(2 * k)) : subE(mul(N(2), A), N(2 * k)), trap: 'algw-more-than-order', why: `reading the phrase as $2(${a} ${sg > 0 ? '+' : '-'} ${k})$ and forgetting ${nb}'s number` },
      ];
      const thing = rng.pick(['stamps', 'baseball cards', 'books', 'coins', 'stickers']);
      stem = `${na} has ${k} ${sg > 0 ? 'more' : 'fewer'} than twice as many ${thing} as ${nb}. If ${nb} has $${a}$ ${thing}, how many ${thing} do ${na} and ${nb} have together, in terms of $${a}$?`;
      method = `${na} has "${k} ${sg > 0 ? 'more' : 'fewer'} than twice $${a}$": $2${a} ${sg > 0 ? '+' : '-'} ${k}$. Together: $${a} + (2${a} ${sg > 0 ? '+' : '-'} ${k}) = 3${a} ${sg > 0 ? '+' : '-'} ${k}$.`;
      rule = 'twice first, then the "more than" or "fewer than"; and the question may ask for both people.';
      envs = [{ [a]: 5 }, { [a]: 10 }];
    } else {
      // fare: d dollars for the first mile, c cents for each additional 1/q mile, trip of m miles
      const q = rng.pick([2, 4, 5, 10, 20]);
      const [dn, cn, mn] = rng.pick([['d', 'c', 'm'], ['f', 'p', 'k'], ['a', 'r', 'n']]);
      vars = [dn, cn, mn];
      nums = [q];
      const [Dd, C, M] = [V(dn), V(cn), V(mn)];
      const m1 = subE(M, N(1));
      const g = gcd(q, 100);
      const per = (e: E) => (q / g === 1 ? div(e, N(100 / g)) : div(mul(N(q / g), e), N(100 / g)));
      correct = add(Dd, per(mul(C, m1)));
      wrong = [
        { e: add(Dd, mul(N(q), mul(C, m1))), trap: 'algw-units-cents', why: `adding cents to dollars without dividing by 100` },
        { e: add(Dd, per(mul(C, M))), trap: 'algw-first-unit-twice', why: `charging the first mile at the extra rate too, with $${mn}$ instead of $${mn} - 1$` },
        { e: add(Dd, div(mul(C, m1), N(100))), trap: 'algw-units-mismatch', why: `treating $${cn}$ cents as the price of a whole mile instead of ${q === 2 ? 'a half' : `one ${q}th of a`} mile` },
        { e: div(add(Dd, mul(N(q), mul(C, m1))), N(100)), trap: 'algw-units-cents', why: `dividing the dollars $${dn}$ by 100 as well` },
      ];
      stem = `A taxi charges $${dn}$ dollars for the first mile of a trip and $${cn}$ cents for each additional $\\frac{1}{${q}}$ mile. Which of the following represents the charge, in dollars, for a trip of $${mn}$ miles, where $${mn}$ is an integer greater than 1?`;
      method = `After the first mile there are $${mn} - 1$ miles, that is, $${q}(${mn} - 1)$ pieces of $\\frac{1}{${q}}$ mile, each costing $${cn}$ cents: $${q}${cn}(${mn} - 1)$ cents, or $\\frac{${q}${cn}(${mn} - 1)}{100}$ dollars${g > 1 || q / g === 1 ? ` $= \\frac{${q / g === 1 ? '' : q / g}${cn}(${mn} - 1)}{${100 / g}}$` : ''}. The total is $${tex(correct)}$ dollars.`;
      rule = 'convert cents to dollars once, and count only the miles after the first.';
      envs = [{ [dn]: 3, [cn]: 50, [mn]: 3 }, { [dn]: 4, [cn]: 25, [mn]: 5 }];
    }
    const all = [{ e: correct, ok: true }, ...wrong.map((w) => ({ ...w, ok: false }))];
    const { choices, answer } = textChoices(
      rng,
      `$${tex(correct)}$`,
      wrong.map((w): Choice => ({ text: `$${tex(w.e)}$`, trap: w.trap })),
      'random',
    );
    const exprs = choices.map((c) => all.find((a) => `$${tex(a.e)}$` === c.text)!.e);
    // A numeric example that separates the right expression from the first wrong one.
    const cited = wrong[0];
    const env = envs.find((en) => !evalE(cited.e, Object.fromEntries(Object.entries(en).map(([k, v]) => [k, frac(v)]))).eq(evalE(correct, Object.fromEntries(Object.entries(en).map(([k, v]) => [k, frac(v)])))));
    const fr = (en: Record<string, number>) => Object.fromEntries(Object.entries(en).map(([k, v]) => [k, frac(v)]));
    const envTex = env ? Object.entries(env).map(([k, v]) => `$${k} = ${num(v)}$`).join(', ') : '';
    const check = env
      ? `Check with ${envTex}: the story gives $${num(evalE(correct, fr(env)))}$, and $${tex(correct)}$ agrees. The choice $${tex(cited.e)}$ gives $${num(evalE(cited.e, fr(env)))}$.`
      : '';
    return {
      params: { mode, vars, nums, exprs },
      q: {
        format: 'mcs',
        stem,
        choices,
        answer,
        explanation: `${method}

${check}

Trap: $${tex(cited.e)}$ comes from ${cited.why}.

Rule: ${rule}`,
      },
    };
  },
  check(q, { mode, vars, nums, exprs }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    for (let i = 0; i < exprs.length; i++) if (q.choices[i].text !== `$${tex(exprs[i])}$`) return 'choice text mismatch';
    // Story simulated with concrete numbers, independently of the expressions.
    const ok = exprs.map(() => true);
    for (let t = 0; t < 8; t++) {
      const vals: Record<string, Frac> = {};
      let truth: Frac;
      if (mode === 'unit-rate') {
        const [n, x, y] = vars;
        vals[n] = frac(rng.int(2, 50));
        vals[x] = frac(rng.int(1, 90));
        vals[y] = frac(rng.int(2, 70));
        const perUnit = vals[x].div(vals[n]);
        truth = frac(0);
        for (let i = 0; i < vals[y].toNumber(); i++) truth = truth.add(perUnit);
      } else if (mode === 'unit-rate-hours') {
        const [p, m, h] = vars;
        vals[p] = frac(rng.int(2, 50));
        vals[m] = frac(rng.int(1, 30));
        vals[h] = frac(rng.int(1, 9));
        const minutes = vals[h].toNumber() * 60;
        truth = vals[p].div(vals[m]).mul(minutes);
      } else if (mode === 'exactly-one') {
        const [total, pct] = nums;
        const r = rng.int(0, (total * pct) / 100);
        vals.r = frac(r);
        // The "exactly one" group is pct percent of everyone; it splits into the two "only" groups.
        const exactlyOne = frac(total * pct, 100);
        truth = exactlyOne.sub(r);
      } else if (mode === 'twice-more') {
        const a = rng.int(1, 100);
        vals[vars[0]] = frac(a);
        truth = frac(a + 2 * a + nums[0]);
      } else {
        const dd = frac(rng.int(100, 900), 100);
        const c = rng.int(10, 90);
        const m = rng.int(2, 30);
        vals[vars[0]] = dd;
        vals[vars[1]] = frac(c);
        vals[vars[2]] = frac(m);
        let centsTotal = 0;
        for (let qm = 0; qm < nums[0] * (m - 1); qm++) centsTotal += c;
        truth = dd.add(frac(centsTotal, 100));
      }
      exprs.forEach((e, i) => {
        if (!evalE(e, vals).eq(truth)) ok[i] = false;
      });
    }
    return expectMcs(
      q,
      uniqueIndex(ok, (b) => b),
    );
  },
};

export const wordProblemTemplates: Template<any>[] = [setupSolve, twoTypes, translateQC, equivalentExpressions, inTermsOf];

