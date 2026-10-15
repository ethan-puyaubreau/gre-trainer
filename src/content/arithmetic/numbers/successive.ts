import { flaggedChoices, qcCompare } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num, plain, usd } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { close, dec, expectMCM, expectMCS, expectNE, expectQC, F, numChoices, pct, pickWeighted, qcEnd, qcFromFloatSamples, spreadFillers, swapQC, usdF, usdM } from './util';

/** Multiplier for a signed percent change: +25 -> 1.25, -20 -> 0.8. */
const mult = (p: Frac | number) => F(1).add((p instanceof Frac ? p : F(p)).div(100));
const changeWord = (p: Frac | number) => ((p instanceof Frac ? p.sign() : Math.sign(p)) > 0 ? 'increased' : 'decreased');
const absPct = (p: Frac | number) => pct((p instanceof Frac ? p : F(p)).abs());

/* ================================================================== 1. Net effect of two changes (QC) */

type NetMode = 'same' | 'undo' | 'order' | 'vs-sum' | 'unknown-pq' | 'k';

interface NetParams {
  mode: NetMode;
  a: number;
  b: number;
  price: number;
  swap: boolean;
}

const netChangeQC: Template<NetParams> = {
  id: 'arith.successive-percent.net-change-qc',
  skill: 'arith.successive-percent',
  format: 'qc',
  style: 'net effect of two successive percent changes',
  generate(rng, d) {
    const mode = pickWeighted<NetMode>(
      rng,
      d === 1
        ? [
            ['same', 3],
            ['undo', 2.5],
            ['vs-sum', 3],
            ['order', 1.5],
          ]
        : d === 2
          ? [
              ['same', 1.5],
              ['undo', 2],
              ['vs-sum', 2.5],
              ['order', 1.5],
              ['unknown-pq', 2],
              ['k', 1],
            ]
          : [
              ['undo', 2],
              ['vs-sum', 2.5],
              ['order', 1],
              ['unknown-pq', 2.5],
              ['k', 2],
            ],
    );
    const swap = rng.chance(0.4);
    const price = rng.pick([40, 60, 80, 120, 150, 200, 250, 400]);
    let a = 0;
    let b = 0;
    let info: string;
    let qa: string;
    let qb: string;
    let rel: QCChoice;
    let trapRel: QCChoice | null = null;
    let trapId = 'num-add-percents';
    let orderTraps = false;
    let why: string;
    const P = usd(price);
    if (mode === 'same') {
      const x = rng.pick([10, 20, 25, 30, 40, 50]);
      [a, b] = rng.chance(0.5) ? [x, -x] : [-x, x];
      const fin = mult(a).mul(mult(b)).mul(price);
      info = `The price of a chair was ${P}. The price was ${changeWord(a)} by ${x}%, and then the new price was ${changeWord(b)} by ${x}%.`;
      qa = 'The final price of the chair';
      qb = P;
      rel = 'B';
      trapRel = 'C';
      trapId = 'num-percent-cancel';
      why = `Multiply: ${P} $\\times ${dec(mult(a))} \\times ${dec(mult(b))} = ${usdF(fin, !fin.isInt())}$. In general $(1 + x)(1 - x) = 1 - x^2 < 1$: the ${b < 0 ? 'decrease is taken on the larger, increased price' : 'increase is taken on the smaller, decreased price'}.`;
    } else if (mode === 'undo') {
      const pairs: [number, number][] = [
        [25, -20],
        [-20, 25],
        [100, -50],
        [-50, 100],
        [60, -37.5],
        [150, -60],
        [-60, 150],
        [25, -25],
        [20, -25],
        [-25, 20],
        [50, -40],
        [-40, 50],
      ];
      [a, b] = rng.pick(pairs);
      const m = mult(fdec(a)).mul(mult(fdec(b)));
      info = `A number $N$ is positive. It is ${changeWord(a)} by ${Math.abs(a)}%, and the result is then ${changeWord(b)} by ${Math.abs(b)}%.`;
      qa = 'The final number';
      qb = '$N$';
      rel = qcCompare(m, 1);
      const naive: QCChoice = a + b > 0 ? 'A' : a + b < 0 ? 'B' : 'C';
      trapRel = naive;
      trapId = a + b === 0 ? 'num-percent-cancel' : 'num-add-percents';
      why = `The final number is $${dec(mult(fdec(a)))} \\times ${dec(mult(fdec(b)))} \\times N = ${m.eq(1) ? '' : dec(m)}N$.${
        m.eq(1) ? ` The ${Math.abs(b)}% ${b < 0 ? 'decrease' : 'increase'} exactly undoes the ${Math.abs(a)}% ${a > 0 ? 'increase' : 'decrease'}, because it is taken on the new amount.` : ''
      } Since $N > 0$, compare $${dec(m)}$ with 1.`;
    } else if (mode === 'order') {
      a = 5 * rng.int(2, 8);
      b = -5 * rng.int(2, 8);
      info = `Two stores sold a lamp for ${P}. Store X raised its price by ${a}% and later lowered the new price by ${-b}%. Store Y lowered its price by ${-b}% and later raised the new price by ${a}%.`;
      qa = "Store X's final price";
      qb = "Store Y's final price";
      rel = 'C';
      trapRel = null;
      orderTraps = true;
      const fin = mult(a).mul(mult(b)).mul(price);
      why = `Store X: ${P} $\\times ${dec(mult(a))} \\times ${dec(mult(b))}$. Store Y: ${P} $\\times ${dec(mult(b))} \\times ${dec(mult(a))}$. The same three numbers are multiplied, so both final prices are ${usdF(fin, !fin.isInt())}. The order of successive percent changes does not matter.`;
    } else if (mode === 'vs-sum') {
      const sgn = rng.chance(0.5) ? 1 : -1;
      a = sgn * 5 * rng.int(2, 8);
      b = sgn * 5 * rng.int(2, 6);
      const m = mult(a).mul(mult(b));
      const total = a + b;
      info = `The value of an investment was ${usd(price * 10)}. It ${changeWord(a)} by ${Math.abs(a)}% in the first year, and the new value ${changeWord(b)} by ${Math.abs(b)}% in the second year.`;
      qa = 'The value of the investment at the end of the second year';
      qb = `The value of ${usd(price * 10)} after a single ${sgn > 0 ? 'increase' : 'decrease'} of ${Math.abs(total)}%`;
      rel = 'A';
      trapRel = 'C';
      const v1 = m.mul(price * 10);
      const v2 = mult(total).mul(price * 10);
      why = `Two years: ${usd(price * 10)} $\\times ${dec(mult(a))} \\times ${dec(mult(b))} = ${usdM(v1, !v1.isInt())}$. One change of ${Math.abs(total)}%: ${usd(price * 10)} $\\times ${dec(mult(total))} = ${usdM(v2, !v2.isInt())}$.

${sgn > 0 ? 'The second increase is taken on a larger amount, so two increases add up to more than their sum.' : 'The second decrease is taken on a smaller amount, so two decreases remove less than their sum.'}`;
    } else if (mode === 'unknown-pq') {
      info = `The price of a coat was increased by $p\\%$, and then the new price was decreased by $q\\%$, where $p > q > 0$.`;
      qa = 'The final price of the coat';
      qb = 'The original price of the coat';
      rel = 'D';
      trapRel = 'A';
      why = `The final price is $(1 + \\frac{p}{100})(1 - \\frac{q}{100})$ times the original. With $p = 10$ and $q = 5$: $1.1 \\times 0.95 = 1.045$, so the price went up. With $p = 50$ and $q = 40$: $1.5 \\times 0.6 = 0.9$, so it went down. Thinking "the net change is $p - q > 0$" adds percents that have different bases.`;
    } else {
      info = `$0 < k < 100$. The price of a coat was increased by $k\\%$, and then the new price was decreased by $k\\%$.`;
      qa = 'The final price of the coat';
      qb = 'The original price of the coat';
      rel = 'B';
      trapRel = 'C';
      trapId = 'num-percent-cancel';
      why = `The final price is $(1 + \\frac{k}{100})(1 - \\frac{k}{100}) = 1 - \\left(\\frac{k}{100}\\right)^2$ times the original, which is less than 1 for every allowed $k$. For example $k = 20$: $1.2 \\times 0.8 = 0.96$.`;
    }
    const answer = swap ? swapQC(rel) : rel;
    const tr = trapRel && trapRel !== rel ? (swap ? swapQC(trapRel) : trapRel) : null;
    const traps: QCQuestion['traps'] = orderTraps ? { A: 'num-order-of-changes', B: 'num-order-of-changes' } : tr ? { [tr]: trapId } : undefined;
    return {
      params: { mode, a, b, price, swap },
      q: {
        format: 'qc',
        info,
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        traps,
        explanation: `${why}

${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, a, b, price, swap }) {
    // Simulate the changes step by step on sample values.
    const step = (v: number, pc: number) => v + (v * pc) / 100;
    let samples: [number, number][] = [];
    if (mode === 'same' || mode === 'undo') for (const v of mode === 'same' ? [price] : [1, 37, 500]) samples.push([step(step(v, a), b), v]);
    else if (mode === 'order') samples.push([step(step(price, a), b), step(step(price, b), a)]);
    else if (mode === 'vs-sum') samples.push([step(step(price * 10, a), b), step(price * 10, a + b)]);
    else if (mode === 'unknown-pq') {
      for (let p = 1; p < 100; p += 7) for (let qq = 0.5; qq < p; qq += 6) samples.push([step(step(100, p), -qq), 100]);
    } else for (let k = 0.5; k < 100; k += 3.5) samples.push([step(step(100, k), -k), 100]);
    if (swap) samples = samples.map(([x, y]) => [y, x]);
    return expectQC(q, qcFromFloatSamples(samples, 1e-9));
  },
};

/** Frac from a percent that may be 37.5. */
function fdec(x: number): Frac {
  return new Frac(Math.round(x * 10), 10);
}

/* ================================================================== 2. Value after two or three changes (MCS) */

type FVMode = 'population' | 'discount-tax' | 'three';

interface FVParams {
  mode: FVMode;
  start: number;
  changes: number[];
  values: Frac[];
}

const finalValueMCS: Template<FVParams> = {
  id: 'arith.successive-percent.final-value-mcs',
  skill: 'arith.successive-percent',
  format: 'mcs',
  style: 'value after successive changes (discount then tax, rise then fall)',
  generate(rng, d) {
    const mode: FVMode = d === 1 ? rng.pick(['population', 'discount-tax'] as const) : d === 2 ? rng.pick(['population', 'discount-tax'] as const) : rng.pick(['three', 'discount-tax'] as const);
    for (;;) {
      let start: number;
      let changes: number[];
      let stem: string;
      let money: boolean;
      if (mode === 'population') {
        start = 1000 * rng.int(8, 60);
        changes = [5 * rng.int(1, 6), -5 * rng.int(1, 6)];
        if (rng.chance(0.5)) changes.reverse();
        const y = 2010 + rng.int(0, 10);
        money = false;
        stem = `The population of a town was ${plain(start)} in ${y}. From ${y} to ${y + 1} the population ${changeWord(changes[0])} by ${Math.abs(changes[0])}%, and from ${y + 1} to ${
          y + 2
        } it ${changeWord(changes[1])} by ${Math.abs(changes[1])}%. What was the population of the town in ${y + 2}?`;
      } else if (mode === 'discount-tax') {
        start = d === 1 ? 10 * rng.int(4, 30) : 5 * rng.int(8, 60);
        const disc = rng.pick([15, 20, 25, 30, 40]);
        const tax = rng.pick([5, 6, 8, 10]);
        changes = [-disc, tax];
        money = true;
        stem = `A bicycle has a regular price of ${usd(start)}. During a sale, the price is reduced by ${disc}%, and then ${tax === 8 ? 'an' : 'a'} ${tax}% sales tax is added to the sale price. What is the total cost of the bicycle during the sale, including tax?`;
      } else {
        start = 100 * rng.int(20, 90);
        changes = [10 * rng.int(1, 4), -10 * rng.int(1, 4), 5 * rng.int(1, 4)];
        money = true;
        stem = `The value of a stock portfolio was ${usd(start)} at the beginning of a three-year period. The value ${changeWord(changes[0])} by ${Math.abs(changes[0])}% in the first year, ${changeWord(
          changes[1],
        )} by ${Math.abs(changes[1])}% in the second year, and ${changeWord(changes[2])} by ${Math.abs(changes[2])}% in the third year. What was the value at the end of the third year?`;
      }
      const ms = changes.map(mult);
      const fin = ms.reduce((v, m) => v.mul(m), F(start));
      if (!fin.mul(100).isInt()) continue;
      if (!money && !fin.isInt()) continue;
      const sum = changes.reduce((s, c) => s + c, 0);
      const added = mult(sum).mul(start);
      // For discount-then-tax, "adding the percents" and "tax on the regular price" give the same number.
      const traps: { value: Frac; trap: string }[] = [{ value: added, trap: mode === 'discount-tax' ? 'num-second-on-original' : 'num-add-percents' }];
      if (changes.length === 2 && changes[0] === -changes[1]) traps.push({ value: F(start), trap: 'num-percent-cancel' });
      // stopped after the first change(s), the last change applied to the starting value, one change in the wrong direction
      const early = ms.slice(0, -1).reduce((v, m) => v.mul(m), F(start));
      const lastOnly = ms[ms.length - 1].mul(start);
      const flipped = ms.reduce((v, m, i) => v.mul(i === 1 ? mult(-changes[i]) : m), F(start));
      traps.push({ value: early, trap: 'num-stopped-early' }, { value: lastOnly, trap: 'num-second-on-original' }, { value: flipped, trap: 'num-change-direction' });
      const oneStep = ms[0].mul(start);
      const fmt = (v: Frac) => (money ? `$${usdM(v, !v.isInt())}$` : `$${num(v.toNumber())}$`);
      const { choices, answer, values } = numChoices(rng, {
        correct: fin,
        traps: traps.filter((t) => t.value.mul(100).isInt()),
        fillers: (() => {
          const delta = money ? F(start >= 1000 ? 100 : 10) : F(1000);
          const pool = [oneStep, F(start), ms[1].mul(start), ...[1, 2, 3].flatMap((k) => [fin.add(delta.mul(k)), fin.sub(delta.mul(k))])].filter((x) => x.sign() > 0);
          return spreadFillers(
            rng,
            fin,
            traps.map((t) => t.value),
            pool.filter((x) => x.lt(fin)),
            pool.filter((x) => x.gt(fin)),
          );
        })(),
        format: fmt,
        order: 'shuffled',
      });
      const shown = (v: Frac) => !v.eq(fin) && values.some((x) => x.eq(v));
      const chain = ms.map((m) => dec(m)).join(' \\times ');
      const startTex = money ? usdM(F(start)) : num(start);
      const bits = [
        shown(added)
          ? mode === 'discount-tax'
            ? `${fmt(added)} puts the tax on the regular price (or adds the percents, a net change of −${Math.abs(sum)}%), but the tax applies to the sale price`
            : `${fmt(added)} adds the percents first (a net change of ${sum >= 0 ? '+' : '−'}${Math.abs(sum)}%), but each change applies to the new amount`
          : '',
        shown(early) ? `${fmt(early)} stops before the last change` : '',
        shown(flipped) ? `${fmt(flipped)} treats the second change as the opposite of what it is` : '',
        shown(F(start)) ? `${fmt(F(start))} assumes the changes cancel` : '',
      ].filter(Boolean);
      return {
        params: { mode, start, changes, values },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `Each change applies to the amount produced by the previous one, so turn every change into a multiplier (${changes.map((c) => `${c > 0 ? '+' : '−'}${Math.abs(c)}% → $${dec(mult(c))}$`).join(', ')}) and multiply: $${startTex} \\times ${chain} = ${money ? usdM(fin, !fin.isInt()) : num(fin.toNumber())}$.

Check the direction: ${changes.map((c) => (c > 0 ? 'a rise' : 'a fall')).join(' then ')}, so the result ${fin.gt(start) ? 'ends above' : 'ends below'} ${fmt(F(start))}, as it should.

Trap: ${bits.slice(0, 2).join('; ')}.`,
        },
      };
    }
  },
  check(q, { start, changes, values }) {
    let v = start;
    for (const c of changes) v += (v * c) / 100;
    const hits = values.flatMap((x, i) => (close(x.toNumber(), v) ? [i] : []));
    return expectMCS(q, hits.length === 1 ? hits[0] : -1);
  },
};

/* ================================================================== 3. Overall percent, or the original from the final (NE) */

type OVMode = 'percent-of' | 'net' | 'original';

interface OVParams {
  mode: OVMode;
  changes: number[];
  paid: Frac;
}

const overallNE: Template<OVParams> = {
  id: 'arith.successive-percent.overall-ne',
  skill: 'arith.successive-percent',
  format: 'ne',
  style: 'overall percent change, or the original before two changes',
  generate(rng, d) {
    const mode: OVMode = d === 1 ? 'percent-of' : d === 2 ? rng.pick(['percent-of', 'net'] as const) : rng.pick(['net', 'original'] as const);
    if (mode === 'original') {
      for (;;) {
        const P0 = 10 * rng.int(5, 60);
        const disc = rng.pick([10, 15, 20, 25, 30]);
        const tax = rng.pick([5, 6, 8, 10]);
        const paid = F(P0).mul(mult(-disc)).mul(mult(tax));
        if (!paid.mul(100).isInt()) continue;
        const naive = paid.div(mult(tax - disc));
        const traps = naive.isTerminating() && !naive.eq(P0) ? [{ value: naive, trap: 'num-add-percents' }] : [];
        return {
          params: { mode, changes: [-disc, tax], paid },
          q: {
            format: 'ne',
            stem: `A store took ${disc}% off the regular price of a jacket, and then a ${tax}% sales tax was added to the reduced price. With the tax, a customer paid ${usdF(paid, true)} for the jacket. What was the regular price of the jacket?`,
            answer: F(P0),
            prefix: '\\$',
            traps,
            explanation: `If the regular price is $x$, the customer paid $x \\times ${dec(mult(-disc))} \\times ${dec(mult(tax))} = ${dec(mult(-disc).mul(mult(tax)))}x$. So $x = \\frac{${dec(paid)}}{${dec(mult(-disc).mul(mult(tax)))}} = ${P0}$.

Do not combine the two changes into a single ${Math.abs(tax - disc)}% ${tax > disc ? 'increase' : 'decrease'}: the tax is computed on the reduced price, so the multipliers must be multiplied.`,
          },
        };
      }
    }
    const a = rng.pick([10, 12, 15, 20, 25, 30, 35, 40, 50]) * (rng.chance(0.5) ? 1 : -1);
    const b = rng.pick([5, 8, 10, 12, 15, 18, 20, 25, 30]) * (a > 0 ? -1 : 1) * (d === 3 && rng.chance(0.3) ? -1 : 1);
    // Each level has its own objects, so the same numbers never give the same question at two levels.
    const item = rng.pick(d === 1 ? ['television', 'bicycle', 'jacket', 'guitar'] : ['laptop', 'camera', 'sofa', 'watch']);
    const group = rng.pick(d === 2 ? ['members of a club', 'students in a choir', 'players on a team', 'subscribers to a magazine'] : ['visitors to a museum', 'cars in a parking lot', 'books in a library', 'riders on a bus line']);
    const m = mult(a).mul(mult(b));
    const added = 100 + a + b;
    if (mode === 'percent-of') {
      const ans = m.mul(100);
      return {
        params: { mode, changes: [a, b], paid: F(0) },
        q: {
          format: 'ne',
          stem: `The price of a ${item} was ${changeWord(a)} by ${Math.abs(a)}%, and then the new price was ${changeWord(b)} by ${Math.abs(b)}%. The final price was what percent of the original price?`,
          answer: ans,
          suffix: '%',
          traps: ans.eq(added) ? [] : [{ value: F(added), trap: 'num-add-percents' }],
          explanation: `Multiply the multipliers: $${dec(mult(a))} \\times ${dec(mult(b))} = ${dec(m)}$, so the final price is $${dec(ans)}\\%$ of the original.

Adding the percents gives ${added}%, which ignores that the second change is applied to the new price.`,
        },
      };
    }
    const net = m.sub(1).mul(100);
    if (net.sign() === 0) return overallNE.generate(rng, d);
    const up = net.sign() > 0;
    const naive = Math.abs(a + b);
    return {
      params: { mode, changes: [a, b], paid: F(0) },
      q: {
        format: 'ne',
        stem: `The number of ${group} ${changeWord(a)} by ${Math.abs(a)}% in one year and then ${changeWord(b)} by ${Math.abs(b)}% the next year. Over the two years, by what percent did the number ${up ? 'increase' : 'decrease'}?`,
        answer: net.abs(),
        suffix: '%',
        traps: naive !== 0 && !net.abs().eq(naive) ? [{ value: F(naive), trap: 'num-add-percents' }] : [],
        explanation: `Overall multiplier: $${dec(mult(a))} \\times ${dec(mult(b))} = ${dec(m)}$. The number is $${dec(m.mul(100))}\\%$ of the original, so it ${up ? 'increased' : 'decreased'} by $${dec(net.abs())}\\%$.

Adding the percents gives ${a + b > 0 ? 'an increase' : 'a decrease'} of ${naive}%, but the second change applies to the new number, not the original.`,
      },
    };
  },
  check(q, { mode, changes, paid }) {
    if (q.format !== 'ne') return 'wrong format';
    if (mode === 'original') {
      // forward check: apply the changes to the answer
      let v = q.answer.toNumber();
      for (const c of changes) v += (v * c) / 100;
      return close(v, paid.toNumber()) ? null : `regular price ${q.answer} leads to ${v}, not ${paid}`;
    }
    let v = 100;
    for (const c of changes) v += (v * c) / 100;
    return expectNE(q, mode === 'percent-of' ? v : Math.abs(v - 100), 1e-9);
  },
};

/* ================================================================== 4. Which pairs of changes undo each other (MCM) */

interface RTParams {
  pairs: [Frac, Frac][];
}

const TRUE_PAIRS: [Frac, Frac][] = [
  [F(25), F(-20)],
  [F(-20), F(25)],
  [F(100), F(-50)],
  [F(-50), F(100)],
  [F(60), F(-75, 2)],
  [F(150), F(-60)],
  [F(-60), F(150)],
  [F(300), F(-75)],
  [F(-75), F(300)],
  [F(50), F(-100, 3)],
  [F(-100, 3), F(50)],
  [F(-25), F(100, 3)],
  [F(20), F(-50, 3)],
];
const FALSE_PAIRS: { pair: [Frac, Frac]; trap: string }[] = [
  { pair: [F(10), F(-10)], trap: 'num-percent-cancel' },
  { pair: [F(20), F(-20)], trap: 'num-percent-cancel' },
  { pair: [F(-25), F(25)], trap: 'num-percent-cancel' },
  { pair: [F(50), F(-50)], trap: 'num-percent-cancel' },
  { pair: [F(-50), F(50)], trap: 'num-percent-cancel' },
  { pair: [F(20), F(-25)], trap: 'num-undo-same-percent' },
  { pair: [F(-25), F(20)], trap: 'num-undo-same-percent' },
  { pair: [F(50), F(-25)], trap: 'num-undo-same-percent' },
  { pair: [F(-40), F(40)], trap: 'num-percent-cancel' },
  { pair: [F(10), F(-9)], trap: 'num-undo-same-percent' },
  { pair: [F(-20), F(20)], trap: 'num-percent-cancel' },
];

const pairText = ([a, b]: [Frac, Frac]) =>
  `${a.sign() > 0 ? 'An increase' : 'A decrease'} of $${absPct(a)}$ followed by ${b.sign() > 0 ? 'an increase' : 'a decrease'} of $${absPct(b)}$`;

const roundTripMCM: Template<RTParams> = {
  id: 'arith.successive-percent.round-trip-mcm',
  skill: 'arith.successive-percent',
  format: 'mcm',
  style: 'which pairs of changes return to the starting value',
  generate(rng, d) {
    const n = d === 1 ? 3 : d === 2 ? 4 : 5;
    const tPool = d === 1 ? TRUE_PAIRS.slice(0, 4) : TRUE_PAIRS;
    const nTrue = rng.int(1, n - 1);
    const picks = [...rng.sample(tPool, nTrue).map((pair) => ({ pair, ok: true as const })), ...rng.sample(FALSE_PAIRS, n - nTrue).map((f) => ({ ...f, ok: false as const }))];
    const items = rng.shuffle(picks);
    const { choices, answer } = flaggedChoices(items.map((it) => ({ text: pairText(it.pair), correct: it.ok, ...(!it.ok ? { trap: it.trap } : {}) })));
    const lines = items.map((it) => {
      const m = mult(it.pair[0]).mul(mult(it.pair[1]));
      const tex = (x: Frac) => (x.isTerminating() ? dec(x) : x.toTex());
      return `- $${tex(mult(it.pair[0]))} \\times ${tex(mult(it.pair[1]))} = ${tex(m)}$ ${it.ok ? '✓' : '✗'}`;
    });
    return {
      params: { pairs: items.map((it) => it.pair) },
      q: {
        format: 'mcm',
        stem: 'A quantity is changed by the first percent in a pair, and the resulting quantity is then changed by the second percent. For which of the following pairs is the final quantity equal to the original quantity?',
        instruction: 'Indicate all such pairs.',
        choices,
        answer,
        explanation: `The quantity returns to its starting value exactly when the product of the two multipliers is 1:
${lines.join('\n')}

An increase and a decrease of the same percent never cancel (they leave $1 - x^2$ of the original), and to undo a ${'$25\\%$'} increase you need a ${'$20\\%$'} decrease, because the decrease is taken on the larger amount.`,
      },
    };
  },
  check(q, { pairs }) {
    // Simulate on a price of $80 in floating point.
    const expected = pairs.flatMap(([a, b], i) => {
      let v = 80;
      v += (v * a.toNumber()) / 100;
      v += (v * b.toNumber()) / 100;
      return close(v, 80) ? [i] : [];
    });
    return expectMCM(q, expected);
  },
};

export const successiveTemplates = [netChangeQC, finalValueMCS, overallNE, roundTripMCM];
