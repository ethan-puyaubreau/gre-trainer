import { qcCompare, qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { num, plain, usd } from '../../../engine/tex';
import { plural } from '../../../engine/text';
import type { Difficulty, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { expectMCS, expectNE, expectQC, F, numChoices, pickWeighted, qcEnd, swapQC } from './util';

/* ================================================================== 1. A fraction of the total, then a ratio split of the rest (NE) */

interface FTRParams {
  ctx: number;
  N: number;
  a: number;
  b: number;
  r: number;
  s: number;
  ask: 2 | 3;
}

interface FTRCtx {
  range: [number, number];
  money: boolean;
  unit: string;
  text: (N: string, f: string, rel: string) => string;
  names: [string, string, string];
  ask: (g: string) => string;
}

const FTR_CTX: FTRCtx[] = [
  {
    range: [600, 3600],
    money: false,
    unit: 'students',
    names: ['arts', 'sciences', 'business'],
    text: (N, f, rel) =>
      `Each of the ${N} students at a college is enrolled in exactly one of three programs: arts, sciences, or business. Of these students, ${f} are in arts, and ${rel}.`,
    ask: (g) => `How many students are in ${g}?`,
  },
  {
    range: [120, 960],
    money: false,
    unit: 'trees',
    names: ['apple', 'pear', 'plum'],
    text: (N, f, rel) => `An orchard has ${N} trees, all of which are apple, pear, or plum trees. Of the trees, ${f} are apple trees, and ${rel}.`,
    ask: (g) => `How many ${g} trees are in the orchard?`,
  },
  {
    range: [60000, 480000],
    money: true,
    unit: '',
    names: ['maintenance', 'programs', 'new equipment'],
    text: (N, f, rel) => `A city divided a budget of ${N} among maintenance, programs, and new equipment. Of the budget, ${f} went to maintenance, and ${rel}.`,
    ask: (g) => `How many dollars went to ${g}?`,
  },
  {
    range: [2400, 12000],
    money: false,
    unit: 'books',
    names: ['fiction', 'nonfiction', 'reference'],
    text: (N, f, rel) => `A library has ${N} books, each classified as fiction, nonfiction, or reference. Of the books, ${f} are fiction, and ${rel}.`,
    ask: (g) => `How many ${g} books does the library have?`,
  },
];

const FTR_FRACS: Record<Difficulty, [number, number][]> = {
  1: [
    [1, 2],
    [1, 3],
    [1, 4],
    [2, 5],
    [1, 5],
  ],
  2: [
    [3, 8],
    [2, 5],
    [3, 5],
    [5, 8],
    [1, 6],
    [2, 3],
    [3, 4],
  ],
  3: [
    [3, 8],
    [2, 5],
    [3, 5],
    [5, 12],
    [1, 6],
    [3, 10],
    [7, 12],
  ],
};

function relText(ctx: FTRCtx, r: number, s: number): string {
  const [, g2, g3] = ctx.names;
  const w = ctx.money ? (x: string) => `the amount for ${x}` : (x: string) => (ctx.unit === 'students' ? `the number in ${x}` : `the number of ${x} ${ctx.unit}`);
  if (s === 1) return `${w(g2)} is ${r === 2 ? 'twice' : r === 3 ? 'three times' : `${r} times`} ${w(g3)}`;
  return `the ratio of ${w(g2)} to ${w(g3)} is ${r} to ${s}`;
}

const fractionThenRatio: Template<FTRParams> = {
  id: 'arith.ratios.fraction-then-ratio',
  skill: 'arith.ratios',
  format: 'ne',
  style: 'take a fraction of a total, split the rest by a ratio',
  generate(rng, d) {
    const ctxIdx = rng.int(0, FTR_CTX.length - 1);
    const ctx = FTR_CTX[ctxIdx];
    const [a, b] = rng.pick(FTR_FRACS[d]);
    let r: number;
    let s: number;
    if (d === 3) {
      do [r, s] = [rng.int(2, 7), rng.int(2, 7)];
      while (r === s || gcd(r, s) !== 1);
    } else [r, s] = [rng.pick(d === 1 ? [2, 3] : [2, 3, 4]), 1];
    const unit = b * (r + s) * (ctx.money ? 1000 : 1);
    const opts: number[] = [];
    for (let N = unit; N <= ctx.range[1]; N += unit) if (N >= ctx.range[0] && (ctx.money || N % 10 === 0 || ctx.unit === 'trees')) opts.push(N);
    if (!opts.length) return fractionThenRatio.generate(rng, d);
    const N = rng.pick(opts.filter((x) => x !== 6000).length ? opts.filter((x) => x !== 6000) : opts);
    const ask: 2 | 3 = rng.chance(0.6) ? 2 : 3;
    const rest = (N * (b - a)) / b;
    const g2 = (rest * r) / (r + s);
    const g3 = (rest * s) / (r + s);
    const ans = ask === 2 ? g2 : g3;
    const whole = (N * (ask === 2 ? r : s)) / (r + s);
    const wrongPart = ask === 2 ? g3 : g2;
    const traps: { value: Frac; trap: string }[] = [];
    if (wrongPart === ans || (Number.isInteger(whole) && whole === ans)) return fractionThenRatio.generate(rng, d); // a slip that gives the right answer is no trap
    if (Number.isInteger(whole)) traps.push({ value: F(whole), trap: 'num-ratio-whole' });
    traps.push({ value: F(wrongPart), trap: 'num-ratio-wrong-part' });
    const Ntext = ctx.money ? usd(N) : plain(N);
    const f = F(a, b).toTex();
    const stem = `${ctx.text(Ntext, `$${f}$`, relText(ctx, r, s))} ${ctx.ask(ctx.names[ask - 1])}`;
    const share = ask === 2 ? r : s;
    return {
      params: { ctx: ctxIdx, N, a, b, r, s, ask },
      q: {
        format: 'ne',
        stem,
        answer: F(ans),
        ...(ctx.money ? { prefix: '\\$' } : { suffix: ctx.unit === 'trees' ? `${ctx.names[ask - 1]} trees` : ctx.unit === 'books' ? `${ctx.names[ask - 1]} books` : ctx.unit }),
        traps,
        explanation: `First take out the known fraction: $${f} \\times ${num(N)} = ${num((N * a) / b)}$, which leaves $${num(N)} - ${num((N * a) / b)} = ${num(rest)}$.

The rest is split ${r} : ${s} between ${ctx.names[1]} and ${ctx.names[2]}, that is, into ${r + s} equal parts of $${num(rest)} \\div ${r + s} = ${num(rest / (r + s))}$. ${ctx.names[ask - 1].charAt(0).toUpperCase() + ctx.names[ask - 1].slice(1)} ${share === 1 ? 'is 1 part' : `is ${share} parts`}: $${share} \\times ${num(rest / (r + s))} = ${num(ans)}$.

Splitting the whole ${ctx.money ? usd(N) : plain(N)} by the ratio ignores the part already taken out.`,
      },
    };
  },
  check(q, { N, a, b, r, s, ask }) {
    // Brute force: try every size for the third group.
    const g1 = (N * a) / b;
    const sols: number[][] = [];
    for (let g3 = 0; g3 <= N; g3++) {
      if ((g3 * r) % s !== 0) continue;
      const g2 = (g3 * r) / s;
      if (g1 + g2 + g3 === N) sols.push([g2, g3]);
    }
    if (sols.length !== 1) return `${sols.length} solutions`;
    return expectNE(q, ask === 2 ? sols[0][0] : sols[0][1]);
  },
};

/* ================================================================== 2. Combine two ratios with a shared term (MCS) */

interface CRParams {
  mode: 'count' | 'ratio';
  p: number;
  q: number;
  s: number;
  t: number;
  total: number;
  values: Frac[];
}

const CR_CTX = [
  { names: ['red', 'blue', 'green'], noun: 'marbles', where: 'In a bag of red, blue, and green marbles' },
  { names: ['oak', 'maple', 'pine'], noun: 'trees', where: 'In a park that has only oak, maple, and pine trees' },
  { names: ['adult', 'student', 'child'], noun: 'tickets', where: 'Of the adult, student, and child tickets sold for a play' },
];

const combineRatios: Template<CRParams> = {
  id: 'arith.ratios.combine-mcs',
  skill: 'arith.ratios',
  format: 'mcs',
  style: 'combine two ratios that share a term',
  generate(rng, d) {
    const ctx = rng.pick(CR_CTX);
    for (;;) {
      const p = rng.int(1, 7);
      const q = rng.int(2, 7);
      const s = rng.int(2, 7);
      const t = rng.int(1, 7);
      if (gcd(p, q) !== 1 || gcd(s, t) !== 1 || q === s || p === q || s === t) continue;
      // a : b : c = p s : q s : q t
      let A = p * s;
      let B = q * s;
      let C = q * t;
      const g = gcd(gcd(A, B), C);
      [A, B, C] = [A / g, B / g, C / g];
      const parts = A + B + C;
      if (parts > 60) continue;
      const mode: CRParams['mode'] = d === 1 ? 'count' : rng.chance(d === 2 ? 0.4 : 0.6) ? 'ratio' : 'count';
      const [na, nb, nc] = ctx.names;
      const intro = `${ctx.where}, the ratio of ${na} ${ctx.noun} to ${nb} ${ctx.noun} is ${p} to ${q}, and the ratio of ${nb} ${ctx.noun} to ${nc} ${ctx.noun} is ${s} to ${t}.`;
      const combine = `Make the ${nb} terms match: $${p} : ${q} = ${p * s} : ${q * s}$ and $${s} : ${t} = ${q * s} : ${q * t}$, so ${na} : ${nb} : ${nc} $= ${p * s} : ${q * s} : ${q * t}${g > 1 ? ` = ${A} : ${B} : ${C}` : ''}$.`;
      if (mode === 'count') {
        const m = rng.int(2, Math.max(2, Math.floor(240 / parts)));
        const total = parts * m;
        const ans = F(C * m);
        // naive: p : q : t
        const naiveParts = p + q + t;
        const traps: { value: Frac; trap: string }[] = [];
        const chainVal = (total * t) % naiveParts === 0 ? F((total * t) / naiveParts) : null;
        if (chainVal) traps.push({ value: chainVal, trap: 'num-ratio-chain' });
        traps.push({ value: F(m), trap: 'num-ratio-parts' });
        traps.push({ value: F(A * m), trap: 'num-ratio-wrong-part' }, { value: F(B * m), trap: 'num-ratio-wrong-part' });
        if ((total * t) % (s + t) === 0) traps.push({ value: F((total * t) / (s + t)), trap: 'num-ratio-chain' });
        traps.push({ value: ans.add(m), trap: 'num-ratio-part-count' }, { value: ans.sub(m), trap: 'num-ratio-part-count' });
        const { choices, answer, values } = numChoices(rng, {
          correct: ans,
          traps: traps.filter((t2) => t2.value.sign() > 0),
          fillers: [],
          format: (v) => `$${num(v.toNumber())}$`,
          order: 'shuffled',
        });
        const shownV = (v: Frac) => !v.eq(ans) && values.some((x) => x.eq(v));
        return {
          params: { mode, p, q, s, t, total, values },
          q: {
            format: 'mcs',
            stem: `${intro} If there are ${plain(total)} ${ctx.noun} in all, how many of them are ${nc} ${ctx.noun}?`,
            choices,
            answer,
            explanation: `${combine}

There are $${A} + ${B} + ${C} = ${parts}$ parts, so one part is $${plain(total)} \\div ${parts} = ${m}$ ${ctx.noun}, and the ${nc} ${ctx.noun} are $${C} \\times ${m} = ${C * m}$.

Check: $${A} \\times ${m} + ${B} \\times ${m} + ${C} \\times ${m} = ${plain(total)}$.

Trap: ${[
              chainVal && shownV(chainVal) ? `writing the ratio as $${p} : ${q} : ${t}$ mixes two different scales for the ${nb} ${ctx.noun}` : '',
              shownV(F(m)) ? `${m} is the size of one part, not the number of ${nc} ${ctx.noun}` : '',
              shownV(F(A * m)) || shownV(F(B * m)) ? `${shownV(F(A * m)) ? A * m : B * m} is the share of another group` : '',
            ]
              .filter(Boolean)
              .slice(0, 2)
              .join('; ')}.`,
          },
        };
      }
      // ratio of first to third
      const correct = F(A, C);
      const fmt = (v: Frac) => `$${v.n} \\text{ to } ${v.d}$`;
      const { choices, answer, values } = numChoices(rng, {
        correct,
        traps: [
          { value: F(p, t), trap: 'num-ratio-chain' },
          { value: F(C, A), trap: 'num-ratio-order' },
          { value: F(p * q, s * t), trap: 'num-ratio-chain' },
          { value: F(p + s, q + t), trap: 'num-ratio-chain' },
          { value: F(A, B), trap: 'num-ratio-wrong-part' },
          { value: F(B, C), trap: 'num-ratio-wrong-part' },
        ],
        fillers: [],
        format: fmt,
        order: 'shuffled',
      });
      const shownR = (v: Frac) => !v.eq(correct) && values.some((x) => x.eq(v));
      return {
        params: { mode, p, q, s, t, total: 0, values },
        q: {
          format: 'mcs',
          stem: `${intro} What is the ratio of ${na} ${ctx.noun} to ${nc} ${ctx.noun}?`,
          choices,
          answer,
          explanation: `${combine}

So the ratio of ${na} to ${nc} is $${A} \\text{ to } ${C}$.

Check: with ${nb} $= ${B}$ parts, ${na} $= ${A}$ parts and ${nc} $= ${C}$ parts, both given ratios hold.

Trap: ${[
            shownR(F(p, t)) ? `reading $${p}$ and $${t}$ off the two given ratios ignores that the ${nb} terms, $${q}$ and $${s}$, are different` : '',
            shownR(F(C, A)) ? `$${C} \\text{ to } ${A}$ has the order reversed` : '',
          ]
            .filter(Boolean)
            .join('; ') || 'the ratio must be built on one common value of the middle term'}.`,
        },
      };
    }
  },
  check(q, { mode, p, q: qq, s, t, total, values }) {
    // Brute force: search the smallest whole-number triple with the two ratios (and the total).
    const N = mode === 'count' ? total : 400;
    for (let a = 1; a <= N; a++)
      for (let b = 1; a + b <= N; b++) {
        if (a * qq !== b * p) continue;
        if ((b * t) % s !== 0) continue;
        const c = (b * t) / s;
        if (mode === 'count') {
          if (a + b + c !== total) continue;
          const hits = values.flatMap((v, i) => (v.eq(c) ? [i] : []));
          return expectMCS(q, hits.length === 1 ? hits[0] : -1);
        }
        const hits = values.flatMap((v, i) => (v.mul(c).eq(a) ? [i] : []));
        return expectMCS(q, hits.length === 1 ? hits[0] : -1);
      }
    return 'no solution found';
  },
};

/* ================================================================== 3. Ratio after a change (NE) */

const cm = (k: number) => (k === 1 ? 'm' : `${k}m`);

interface RCParams {
  ctx: number;
  p: number;
  q: number;
  r: number;
  s: number;
  change: number; // added to group 1 (negative = removed)
  ask: 'other' | 'changed-after' | 'total-before';
}

const RC_CTX = [
  { g: ['boys', 'girls'], sing: ['boy', 'girl'], where: 'In a class', join: (n: number) => `${n} more boys join the class`, leave: (n: number) => `${n} boys leave the class`, unit: ['boys', 'girls'] },
  { g: ['red marbles', 'blue marbles'], sing: ['red marble', 'blue marble'], where: 'In a bag', join: (n: number) => `${n} red marbles are added to the bag`, leave: (n: number) => `${n} red marbles are removed from the bag`, unit: ['red marbles', 'blue marbles'] },
  { g: ['cats', 'dogs'], sing: ['cat', 'dog'], where: 'At an animal shelter', join: (n: number) => `${n} more cats arrive at the shelter`, leave: (n: number) => `${n} cats are adopted`, unit: ['cats', 'dogs'] },
];

const ratioChange: Template<RCParams> = {
  id: 'arith.ratios.change-ne',
  skill: 'arith.ratios',
  format: 'ne',
  style: 'ratio before and after adding or removing items',
  generate(rng, d) {
    const ctxIdx = rng.int(0, RC_CTX.length - 1);
    const ctx = RC_CTX[ctxIdx];
    for (;;) {
      const p = rng.int(1, 7);
      const q = rng.int(2, 9);
      if (gcd(p, q) !== 1 || p === q) continue;
      const m = rng.int(2, d === 1 ? 8 : 15);
      const change = (rng.chance(d === 1 ? 0.8 : 0.55) ? 1 : -1) * rng.int(2, 12);
      const g1 = p * m + change;
      const g2 = q * m;
      if (g1 <= 0) continue;
      const g = gcd(g1, g2);
      const r = g1 / g;
      const s = g2 / g;
      if (r > 12 || s > 12 || (r === p && s === q)) continue;
      // uniqueness: m = s*change / (r*q - s*p) must be the only solution
      if (r * q - s * p === 0) continue;
      const ask: RCParams['ask'] = d === 1 ? 'other' : d === 2 ? rng.pick(['other', 'changed-after'] as const) : rng.pick(['changed-after', 'total-before', 'other'] as const);
      const ans = ask === 'other' ? g2 : ask === 'changed-after' ? g1 : p * m + q * m;
      const traps: { value: Frac; trap: string }[] = [{ value: F(m), trap: 'num-ratio-parts' }];
      if (ask === 'changed-after') traps.push({ value: F(p * m), trap: 'num-before-after' });
      if (ask === 'total-before') traps.push({ value: F(g1 + g2), trap: 'num-before-after' });
      if (traps.some((t) => t.value.eq(ans))) continue; // a slip that gives the right answer is no trap
      const [n1, n2] = ctx.g;
      const event = change > 0 ? ctx.join(change) : ctx.leave(-change);
      const question =
        ask === 'other'
          ? `How many ${n2} are there?`
          : ask === 'changed-after'
            ? `How many ${n1} are there after the change?`
            : `How many ${n1} and ${n2} were there in all before the change?`;
      return {
        params: { ctx: ctxIdx, p, q, r, s, change, ask },
        q: {
          format: 'ne',
          stem: `${ctx.where}, the ratio of the number of ${n1} to the number of ${n2} is ${p} to ${q}. If ${event}, the ratio of ${n1} to ${n2} becomes ${r} to ${s}. (No other changes are made.) ${question}`,
          answer: F(ans),
          suffix: ask === 'other' ? ctx.unit[1] : ask === 'changed-after' ? ctx.unit[0] : `${n1} and ${n2}`,
          traps,
          explanation: `Write the counts with one unknown: ${n1} $= ${cm(p)}$ and ${n2} $= ${cm(q)}$. After the change, $\\frac{${cm(p)} ${change > 0 ? '+' : '-'} ${Math.abs(change)}}{${cm(q)}} = ${s === 1 ? r : `\\frac{${r}}{${s}}`}$, so ${s === 1 ? `$${cm(p)} ${change > 0 ? '+' : '-'} ${Math.abs(change)} = ${cm(r * q)}$` : `$${s}(${cm(p)} ${change > 0 ? '+' : '-'} ${Math.abs(change)}) = ${cm(r * q)}$, that is, $${cm(s * p)} ${change > 0 ? '+' : '-'} ${s * Math.abs(change)} = ${cm(r * q)}$`}, which gives $m = ${m}$.

So there were ${p * m} ${n1} and ${q * m} ${n2}${ask === 'changed-after' ? `, and after the change there are ${plural(g1, ctx.sing[0], n1)}` : ''}. Check: $${g1} : ${g2} = ${r} : ${s}$. The answer is ${ans}, not $m = ${m}$ (the size of one part).`,
        },
      };
    }
  },
  check(q, { p, q: qq, r, s, change, ask }) {
    // Brute force over initial counts.
    const sols: number[] = [];
    for (let m = 1; m <= 200; m++) {
      const g1 = p * m;
      const g2 = qq * m;
      const after = g1 + change;
      if (after < 0) continue;
      if (after * s === g2 * r) sols.push(ask === 'other' ? g2 : ask === 'changed-after' ? after : g1 + g2);
    }
    if (sols.length !== 1) return `${sols.length} solutions`;
    return expectNE(q, sols[0]);
  },
};

/* ================================================================== 4. Ratio comparisons (QC) */

type RQMode = 'sign' | 'part-whole' | 'count';

interface RQParams {
  mode: RQMode;
  p: number;
  q: number;
  cond: 'nonzero' | 'positive' | 'negative';
  value: Frac;
  total: number;
  swap: boolean;
}

const ratioQC: Template<RQParams> = {
  id: 'arith.ratios.ratio-qc',
  skill: 'arith.ratios',
  format: 'qc',
  style: 'what a ratio does and does not determine',
  generate(rng, d) {
    const mode = pickWeighted<RQMode>(
      rng,
      d === 1
        ? [
            ['count', 4],
            ['part-whole', 3],
            ['sign', 2],
          ]
        : [
            ['count', 2],
            ['part-whole', 3],
            ['sign', 4],
          ],
    );
    const swap = rng.chance(0.4);
    let p: number;
    let q: number;
    do [p, q] = [rng.int(1, 9), rng.int(1, 9)];
    while (p === q || gcd(p, q) !== 1 || (mode !== 'count' && q === 1));
    if (mode === 'sign') {
      const cond = pickWeighted<RQParams['cond']>(rng, [
        ['nonzero', 4],
        ['positive', 2.5],
        ['negative', d === 1 ? 1 : 3.5],
      ]);
      const posRel: QCChoice = p > q ? 'A' : 'B';
      const rel: QCChoice = cond === 'nonzero' ? 'D' : cond === 'positive' ? posRel : swapQC(posRel);
      const answer = swap ? swapQC(rel) : rel;
      const trapRel = cond === 'positive' ? null : swap ? swapQC(posRel) : posRel;
      const traps: QCQuestion['traps'] = trapRel && trapRel !== answer ? { [trapRel]: 'num-ratio-sign' } : undefined;
      const info =
        cond === 'nonzero'
          ? `$x$ and $y$ are nonzero numbers, and $\\frac{x}{y} = \\frac{${p}}{${q}}$.`
          : cond === 'positive'
            ? `$\\frac{x}{y} = \\frac{${p}}{${q}}$ and $y > 0$.`
            : `$\\frac{x}{y} = \\frac{${p}}{${q}}$ and $y < 0$.`;
      const why =
        cond === 'nonzero'
          ? `The ratio fixes $x = \\frac{${p}}{${q}}y$ but not the sign. If $x = ${p}$ and $y = ${q}$, then $x ${p > q ? '>' : '<'} y$. If $x = -${p}$ and $y = -${q}$, the ratio is the same but $x ${p > q ? '<' : '>'} y$.`
          : cond === 'positive'
            ? `Since $y > 0$, $x = \\frac{${p}}{${q}}y$ is positive too, and it is ${p > q ? 'larger' : 'smaller'} than $y$ because $\\frac{${p}}{${q}} ${p > q ? '>' : '<'} 1$.`
            : `Since $y < 0$, $x = \\frac{${p}}{${q}}y$ is negative too. For example $y = -${q}$ gives $x = -${p}$, and $-${p} ${p > q ? '<' : '>'} -${q}$. Multiplying a negative number by $\\frac{${p}}{${q}}$ ${p > q ? 'moves it farther below 0' : 'moves it closer to 0'}.`;
      return {
        params: { mode, p, q, cond, value: F(0), total: 0, swap },
        q: {
          format: 'qc',
          info,
          quantityA: swap ? '$y$' : '$x$',
          quantityB: swap ? '$x$' : '$y$',
          answer,
          traps,
          explanation: `${why}

${qcEnd(answer)}`,
        },
      };
    }
    if (mode === 'part-whole') {
      const kase = rng.pick(['pp', 'pw', 'other'] as const);
      const frac = F(p, p + q);
      const value = kase === 'pp' ? F(p, q) : kase === 'pw' ? frac : F(q, p + q);
      const rel = qcCompare(frac, value);
      const answer = swap ? swapQC(rel) : rel;
      const traps: QCQuestion['traps'] = kase === 'pp' && rel !== 'C' ? { C: 'num-ratio-part-whole' } : undefined;
      const colors = rng.pick([
        ['red', 'blue', 'marbles', 'jar'],
        ['white', 'black', 'tiles', 'box'],
        ['green', 'yellow', 'beads', 'bag'],
      ]);
      const qa = `The fraction of the ${colors[2]} in the ${colors[3]} that are ${colors[0]}`;
      const qb = `$${value.toTex()}$`;
      return {
        params: { mode, p, q, cond: 'positive', value, total: 0, swap },
        q: {
          format: 'qc',
          info: `A ${colors[3]} contains only ${colors[0]} ${colors[2]} and ${colors[1]} ${colors[2]}. The ratio of ${colors[0]} ${colors[2]} to ${colors[1]} ${colors[2]} is ${p} to ${q}.`,
          quantityA: swap ? qb : qa,
          quantityB: swap ? qa : qb,
          answer,
          traps,
          explanation: `A ratio of ${p} to ${q} means ${p} ${colors[0]} for every ${q} ${colors[1]}, so ${p} of every $${p} + ${q} = ${p + q}$ ${colors[2]} are ${colors[0]}: the fraction is $${frac.toTex()}$.

Compare $${frac.toTex()}$ with $${value.toTex()}$.${kase === 'pp' ? ` ($\\frac{${p}}{${q}}$ compares ${colors[0]} with ${colors[1]}, not with all the ${colors[2]}.)` : ''} ${qcEnd(answer)}`,
        },
      };
    }
    // count
    const m = rng.int(3, 12) * (d === 1 ? 1 : rng.int(1, 5));
    const total = (p + q) * m;
    const exact = p * m;
    const kase = rng.pick(['C', 'near', 'trap'] as const);
    let value: Frac;
    let trapC = false;
    if (kase === 'C') value = F(exact);
    else if (kase === 'trap' && (total * p) % q === 0 && (total * p) / q !== exact) {
      value = F((total * p) / q); // p/q of the total: part-to-part used as part-to-whole
      trapC = true;
    } else value = F(exact + (rng.chance(0.5) ? 1 : -1) * rng.int(1, 3));
    const rel = qcCompare(exact, value);
    const answer = swap ? swapQC(rel) : rel;
    const traps: QCQuestion['traps'] = trapC && rel !== 'C' ? { C: 'num-ratio-part-whole' } : undefined;
    const names = rng.pick([
      ['juniors', 'seniors', 'members of a club'],
      ['fiction books', 'nonfiction books', 'books on a shelf'],
      ['cars', 'trucks', 'vehicles in a parking lot'],
    ]);
    const qa = `The number of ${names[0]}`;
    const qb = `$${num(value.toNumber())}$`;
    return {
      params: { mode, p, q, cond: 'positive', value, total, swap },
      q: {
        format: 'qc',
        info: `The ${plain(total)} ${names[2]} are all ${names[0]} or ${names[1]}, and the ratio of ${names[0]} to ${names[1]} is ${p} to ${q}.`,
        quantityA: swap ? qb : qa,
        quantityB: swap ? qa : qb,
        answer,
        traps,
        explanation: `The ratio splits the total into $${p} + ${q} = ${p + q}$ equal parts of $${num(total)} \\div ${p + q} = ${m}$. The ${names[0]} are ${p === 1 ? '1 part' : `${p} parts`}: $${p} \\times ${m} = ${exact}$.

Compare ${exact} with ${num(value.toNumber())}. ${qcEnd(answer)}`,
      },
    };
  },
  check(q, { mode, p, q: qq, cond, value, total, swap }) {
    let samples: [Frac, Frac][] = [];
    if (mode === 'sign') {
      const ys = [1, 2, 7, 100, F(1, 3)].map((y) => (y instanceof Frac ? y : F(y)));
      const allowed = cond === 'nonzero' ? [...ys, ...ys.map((y) => y.neg())] : cond === 'positive' ? ys : ys.map((y) => y.neg());
      samples = allowed.map((y) => [y.mul(p).div(qq), y] as [Frac, Frac]);
    } else if (mode === 'part-whole') {
      for (let m = 1; m <= 30; m++) samples.push([F(p * m, p * m + qq * m), value]);
    } else {
      // brute force the split of the total
      for (let a = 0; a <= total; a++) if (a * qq === (total - a) * p) samples.push([F(a), value]);
    }
    if (!samples.length) return 'no samples';
    if (swap) samples = samples.map(([a, b]) => [b, a]);
    return expectQC(q, qcFromSamples(samples));
  },
};

export const ratioTemplates = [fractionThenRatio, combineRatios, ratioChange, ratioQC];
