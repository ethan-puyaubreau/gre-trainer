// Data interpretation family: a table of year-over-year percent changes for five entities (DA-05).

import { flaggedChoices } from '../../../engine/build';
import { frac, Frac } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { decimal, num, usd } from '../../../engine/tex';
import type { Difficulty, QuestionBody, TableFigure, Template } from '../../../engine/types';
import { mcmCheck, mcsCheck, neCheckNum, roundFrac, tieDistance, trapOnlyChoices } from './util';

const SKILL = 'data.interpretation';
const SET = 'data.interpretation.percent-change-table';

interface ChangeCtx {
  Entity: string;
  entity: string;
  entities: string;
  TITLE: string;
  measure: string;
  money: boolean;
  unit: string;
}

const CTXS: ChangeCtx[] = [
  { Entity: 'Store', entity: 'store', entities: 'stores', TITLE: 'REVENUE AT FIVE STORES', measure: 'revenue', money: true, unit: '' },
  { Entity: 'Website', entity: 'website', entities: 'websites', TITLE: 'TRAFFIC AT FIVE WEBSITES', measure: 'traffic', money: false, unit: 'visits' },
  { Entity: 'Factory', entity: 'factory', entities: 'factories', TITLE: 'OUTPUT OF FIVE FACTORIES', measure: 'output', money: false, unit: 'units' },
  { Entity: 'Museum', entity: 'museum', entities: 'museums', TITLE: 'ATTENDANCE AT FIVE MUSEUMS', measure: 'attendance', money: false, unit: 'visitors' },
];

const NAMES = ['P', 'Q', 'R', 'S', 'T'];

interface ChangeData {
  ctx: ChangeCtx;
  years: [number, number, number];
  /** Percent changes [first year -> second year, second year -> third year] for P..T. */
  ch: [number, number][];
  /** Index of each feature: cancel (+k, -k), near-cancel (sum +1 but net loss), two decreases, two increases. */
  roles: { cancel: number; near: number; down: number; up: number; free: number };
  figure: TableFigure;
}

const nz = (rng: Rng, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = rng.int(lo, hi);
  return v;
};

/** Shared dataset: the very first rng calls of every template in the family. */
function makeChangeData(rng: Rng, d: Difficulty): ChangeData {
  const ctx = CTXS[rng.int(0, CTXS.length - 1)];
  const y1 = rng.int(2012, 2021);
  const years: [number, number, number] = [y1, y1 + 1, y1 + 2];
  const k = rng.int(5, 20);
  const cancel: [number, number] = rng.chance(0.5) ? [k, -k] : [-k, k];
  const kn = rng.int(11, 20);
  const near: [number, number] = rng.chance(0.5) ? [kn, -(kn - 1)] : [-(kn - 1), kn];
  const down: [number, number] = [-rng.int(3, 20), -rng.int(3, 20)];
  const up: [number, number] = [rng.int(3, 17), rng.int(3, 17)];
  let free: [number, number];
  do free = [nz(rng, -20, 17), nz(rng, -20, 17)];
  while (Math.abs(free[0] + free[1]) < 2);
  const order = rng.shuffle([0, 1, 2, 3, 4]);
  const feats = [cancel, near, down, up, free];
  const ch: [number, number][] = new Array(5);
  order.forEach((slot, i) => (ch[slot] = feats[i]));
  void d;
  const roles = { cancel: order[0], near: order[1], down: order[2], up: order[3], free: order[4] };
  // Plain text with a true minus sign (U+2212), as printed tables do.
  const sp = (p: number) => (p > 0 ? `+${p}%` : `\u2212${-p}%`);
  const figure: TableFigure = {
    kind: 'table',
    title: `PERCENT CHANGE IN ANNUAL ${ctx.TITLE}, ${years[0]} TO ${years[2]}`,
    headers: [ctx.Entity, `${years[0]} to ${years[1]}`, `${years[1]} to ${years[2]}`],
    rows: NAMES.map((n, i) => [n, sp(ch[i][0]), sp(ch[i][1])]),
  };
  return { ctx, years, ch, roles, figure };
}

/** Percent changes read back from the table (used by the checks). */
function readChanges(q: QuestionBody): [number, number][] {
  const f = q.figure as TableFigure;
  const val = (c: string) => Number(c.replace('\u2212', '-').replace(/[^0-9-]/g, ''));
  return f.rows.map((r) => [val(r[1]), val(r[2])]);
}

const ent = (D: ChangeData, i: number) => `${D.ctx.Entity} ${NAMES[i]}`;
const amount = (D: ChangeData, v: number) => (D.ctx.money ? usd(v) : `${v.toLocaleString('en-US')} ${D.ctx.unit}`);
const pctAbs = (p: number) => `${Math.abs(p)} percent`;
const mult = (p: number) => decimal(frac(100 + p, 100));
/** Signed percent / number in math mode, safe in text: $+10\%$, $-8\%$. */
const spct = (p: number) => `$${p > 0 ? '+' : ''}${p}\\%$`;
const snum = (p: number) => `$${p > 0 ? '+' : ''}${p}$`;

/* ------------------------------------------------------------------ A1. Value after two changes (MCS) */

interface ValueParams {
  i: number;
  /** 'forward2': base in year 1, ask year 3. 'forward1': ask year 2. 'backward': give year 3, ask year 1. */
  mode: 'forward1' | 'forward2' | 'backward';
  base: number;
}

const valueAfterChanges: Template<ValueParams> = {
  id: 'data.interpretation.pct-change-value',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'apply two successive percent changes to a given amount',
  generate(rng, d) {
    const D = makeChangeData(rng, d);
    for (;;) {
      const mode: ValueParams['mode'] = d === 1 ? rng.pick(['forward1', 'forward2'] as const) : d === 2 ? 'forward2' : rng.pick(['backward', 'forward2'] as const);
      const i = d === 1 ? rng.pick([D.roles.cancel, D.roles.up, D.roles.down, D.roles.free]) : rng.int(0, 4);
      const [a, b] = D.ch[i];
      const unit = D.ctx.money ? 50000 : 10000;
      const v1 = rng.int(D.ctx.money ? 8 : 3, D.ctx.money ? 18 : 9) * unit;
      const v2 = (v1 * (100 + a)) / 100;
      const v3 = (v1 * (100 + a) * (100 + b)) / 10000;
      const [y1, y2, y3] = D.years;
      const round = (x: number) => Math.round(x);
      const shown = (v: number) => (D.ctx.money ? usd(v) : v.toLocaleString('en-US'));
      let stem: string;
      let correct: number;
      let explanation: string;
      let check: string;
      let rule: string;
      const traps: { value: number; trap: string; why: (v: string) => string }[] = [];
      const T = (value: number, trap: string, why: (v: string) => string) => traps.push({ value, trap, why });
      if (mode === 'forward1') {
        correct = v2;
        stem = `If ${ent(D, i)}'s ${D.ctx.measure} in ${y1} was ${amount(D, v1)}, what was its ${D.ctx.measure} in ${y2}?`;
        T(v3, 'prob-di-wrong-column', (v) => `using the ${y2} to ${y3} change as well gives ${v}, which is the ${y3} amount`);
        T(round((v1 * (100 + b)) / 100), 'prob-di-wrong-column', (v) => `applying the ${y2} to ${y3} change to the ${y1} amount gives ${v}`);
        T(round((v1 * (100 - a)) / 100), 'prob-di-sign', (v) => `applying the change in the wrong direction gives ${v}`);
        T(v1, 'prob-di-not-applied', (v) => `${v} is the ${y1} amount: the change was not applied`);
        T(round((v1 * Math.abs(a)) / 100), 'prob-di-change-only', (v) => `${v} is the size of the change, not the new amount`);
        explanation = `Read the ${y1} to ${y2} column for ${NAMES[i]}: ${spct(a)}. So the ${y2} ${D.ctx.measure} was $${num(v1)} \\times ${mult(a)} = ${num(v2)}$.`;
        check = `$${num(v2)} - ${num(v1)} = ${num(v2 - v1)}$, which is ${Math.abs(a)} percent of ${num(v1)}.`;
        rule = 'A percent change applies to the amount it starts from.';
      } else if (mode === 'forward2') {
        correct = v3;
        stem = `If ${ent(D, i)}'s ${D.ctx.measure} in ${y1} was ${amount(D, v1)}, what was its ${D.ctx.measure} in ${y3}?`;
        T(round((v1 * (100 + a + b)) / 100), 'prob-add-percents', (v) => `adding the percents, ${snum(a)} and ${snum(b)}, gives ${v}, which ignores that the second change applies to the ${y2} amount`);
        T(v2, 'prob-di-one-step', (v) => `${v} is the ${y2} amount: only the first change was applied`);
        T(round((v1 * (100 + b)) / 100), 'prob-di-one-step', (v) => `applying only the second change gives ${v}`);
        T(round((v1 * (100 - a) * (100 - b)) / 10000), 'prob-di-sign', (v) => `applying both changes in the wrong direction gives ${v}`);
        T(round((v1 * (100 + a) * (100 + a)) / 10000), 'prob-di-wrong-column', (v) => `applying the first change twice gives ${v}`);
        T(round((v1 * (100 + b) * (100 + b)) / 10000), 'prob-di-wrong-column', (v) => `applying the second change twice gives ${v}`);
        if (a * b < 0) T(v1, 'prob-percent-cancel', (v) => `assuming the increase and the decrease cancel gives ${v}, but the second percent applies to a different base`);
        explanation = `Apply the two changes one after the other: $${num(v1)} \\times ${mult(a)} = ${num(v2)}$, then $${num(v2)} \\times ${mult(b)} = ${num(v3)}$.`;
        check = `$${num(v3)} \\div ${mult(b)} \\div ${mult(a)} = ${num(v1)}$, the ${y1} amount.`;
        rule = 'Successive percent changes multiply: each one applies to the amount left by the one before.';
      } else {
        correct = v1;
        stem = `If ${ent(D, i)}'s ${D.ctx.measure} in ${y3} was ${amount(D, v3)}, what was its ${D.ctx.measure} in ${y1}?`;
        T(round((v3 * (100 - a) * (100 - b)) / 10000), 'prob-percent-reverse', (v) => `undoing each change with the opposite percent gives ${v}, but that does not undo it`);
        T(round((v3 * (100 - a - b)) / 100), 'prob-add-percents', (v) => `adding the percents and reversing them gives ${v}`);
        T(round((v3 * 100) / (100 + b)), 'prob-di-one-step', (v) => `undoing only the second change gives ${v}, the ${y2} amount`);
        T(round((v3 * 100) / (100 + a)), 'prob-di-one-step', (v) => `undoing only the first change gives ${v}`);
        T(round((v3 * 10000) / ((100 - a) * (100 - b))), 'prob-di-sign', (v) => `dividing by the wrong growth factors gives ${v}`);
        T(v3, 'prob-di-not-applied', (v) => `${v} is the ${y3} amount: the changes were not undone`);
        explanation = `Work backward by dividing: the ${y2} amount was $${num(v3)} \\div ${mult(b)} = ${num(v2)}$, and the ${y1} amount was $${num(v2)} \\div ${mult(a)} = ${num(v1)}$.`;
        check = `$${num(v1)} \\times ${mult(a)} \\times ${mult(b)} = ${num(v3)}$.`;
        rule = 'To undo a percent change, divide by its growth factor; do not apply the opposite percent.';
      }
      const built = trapOnlyChoices(
        rng,
        correct,
        rng.shuffle(traps.filter((t) => t.value > 0)),
        (v) => (D.ctx.money ? usd(v.n) : v.n.toLocaleString('en-US')),
      );
      if (!built) continue;
      const cite = rng.pick(built.used);
      return {
        params: { i, mode, base: mode === 'backward' ? v3 : v1 },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem,
          choices: built.choices,
          answer: built.answer,
          explanation: `${explanation}

Check: ${check}

Trap: ${cite.why(shown(cite.value))}.

${rule}`,
        },
      };
    }
  },
  check(q, { i, mode, base }) {
    const [a, b] = readChanges(q)[i];
    let v: number;
    if (mode === 'forward1') v = base * (1 + a / 100);
    else if (mode === 'forward2') v = base * (1 + a / 100) * (1 + b / 100);
    else v = base / (1 + b / 100) / (1 + a / 100);
    const money = q.format === 'mcs' && q.choices[0].text.includes('\\$');
    const r = Math.round(v);
    return mcsCheck(q, money ? usd(r) : r.toLocaleString('en-US'));
  },
};

/* ------------------------------------------------------------------ A2. One year as a percent of another (NE) */

interface PercentOfParams {
  i: number;
  /** [numerator year index, denominator year index] (0, 1, 2). */
  num: number;
  den: number;
}

const percentOfYear: Template<PercentOfParams> = {
  id: 'data.interpretation.pct-change-percent-of',
  skill: SKILL,
  set: SET,
  format: 'ne',
  style: 'one year as a percent of another, to the nearest 0.1 percent',
  generate(rng, d) {
    const D = makeChangeData(rng, d);
    const pairs: [number, number][] = d === 1 ? [[2, 0]] : d === 2 ? [[1, 2]] : [[0, 2], [1, 2]];
    // Pick an entity and pair whose exact value is not a rounding tie.
    const cands: { i: number; nm: number; dn: number; v: Frac }[] = [];
    for (const [nm, dn] of pairs)
      for (let i = 0; i < 5; i++) {
        const lvl = (y: number) => (y === 0 ? frac(1) : y === 1 ? frac(100 + D.ch[i][0], 100) : frac((100 + D.ch[i][0]) * (100 + D.ch[i][1]), 10000));
        const v = lvl(nm).div(lvl(dn)).mul(100);
        if (roundFrac(v, 1) && (v.mul(10).isInt() || tieDistance(v, 1) > 0.02)) cands.push({ i, nm, dn, v });
      }
    const pool = cands.length ? cands : [{ i: D.roles.up, nm: 1, dn: 0, v: frac(100 + D.ch[D.roles.up][0]) }];
    const trapVals = (c: { i: number; nm: number; dn: number }): Frac[] => {
      const [ca, cb] = D.ch[c.i];
      if (c.nm === 1 && c.dn === 0) return [frac(ca)];
      if (c.nm === 2 && c.dn === 0) return [frac(100 + ca + cb)];
      if (c.nm === 1 && c.dn === 2) return [frac(100 - cb), frac(100 + cb)];
      return [frac(100 - ca - cb), frac((100 + ca) * (100 + cb), 100)];
    };
    // a mistake that gives the answer is not a mistake: prefer rows where all of them differ
    const okPool = pool.filter((c) => !trapVals(c).some((t) => t.eq(roundFrac(c.v, 1) ?? c.v)));
    const { i, nm, dn, v } = rng.pick(okPool.length ? okPool : pool);
    const answer = roundFrac(v, 1) ?? v;
    const [a, b] = D.ch[i];
    const y = D.years;
    const traps: { value: Frac; trap: string }[] = [];
    let explanation: string;
    if (nm === 1 && dn === 0) {
      traps.push({ value: frac(a), trap: 'prob-percent-wrong-base' });
      explanation = `From ${y[0]} to ${y[1]} the change was ${spct(a)}, so the ${y[1]} amount was $100 ${a > 0 ? '+' : '-'} ${Math.abs(a)} = ${100 + a}$ percent of the ${y[0]} amount.`;
    } else if (nm === 2 && dn === 0) {
      traps.push({ value: frac(100 + a + b), trap: 'prob-add-percents' });
      explanation = `Let the ${y[0]} amount be 100. Then ${y[1]}: $100 \\times ${mult(a)} = ${decimal(frac(100 + a))}$, and ${y[2]}: $${decimal(frac(100 + a))} \\times ${mult(b)} = ${decimal(v)}$. So the ${y[2]} amount was ${decimal(v)}% of the ${y[0]} amount, which rounds to ${decimal(answer)}%.

Adding the changes would give $100 ${a + b >= 0 ? '+' : '-'} ${Math.abs(a + b)} = ${100 + a + b}$%, but the second change applies to the ${y[1]} amount, not to the ${y[0]} amount.`;
    } else if (nm === 1 && dn === 2) {
      traps.push({ value: frac(100 - b), trap: 'prob-percent-reverse' }, { value: frac(100 + b), trap: 'prob-percent-wrong-base' });
      explanation = `From ${y[1]} to ${y[2]} the change was ${spct(b)}, so ${y[2]} = ${mult(b)} × ${y[1]}. Then ${y[1]} as a percent of ${y[2]} is $\\frac{1}{${mult(b)}} \\times 100 \\approx ${decimal(roundFrac(v, 3) ?? v)}$, which rounds to ${decimal(answer)}%.

$${100 - b}$ undoes the change by flipping its sign, and $${100 + b}$ is ${y[2]} as a percent of ${y[1]} (the wrong base).`;
    } else {
      const lvl3 = frac((100 + a) * (100 + b), 100);
      traps.push({ value: frac(100 - a - b), trap: 'prob-percent-reverse' }, { value: lvl3, trap: 'prob-percent-wrong-base' });
      explanation = `Let the ${y[0]} amount be 100. Then ${y[2]} is $100 \\times ${mult(a)} \\times ${mult(b)} = ${decimal(lvl3)}$. The ${y[0]} amount as a percent of the ${y[2]} amount: $\\frac{100}{${decimal(lvl3)}} \\times 100 \\approx ${decimal(roundFrac(v, 3) ?? v)}$, which rounds to ${decimal(answer)}%.

$${100 - a - b}$ just flips and adds the percents; it is not the same as dividing.`;
    }
    const yn = y[nm];
    const yd = y[dn];
    return {
      params: { i, num: nm, den: dn },
      q: {
        format: 'ne',
        figure: D.figure,
        stem: `For ${ent(D, i)}, the ${D.ctx.measure} in ${yn} was what percent of the ${D.ctx.measure} in ${yd}?\n\nGive your answer to the nearest 0.1 percent.`,
        answer,
        suffix: '%',
        traps: traps.filter((t) => !t.value.eq(answer)),
        explanation,
      },
    };
  },
  check(q, { i, num: nm, den: dn }) {
    const [a, b] = readChanges(q)[i];
    const lv = [1000, 0, 0];
    lv[1] = lv[0] * (1 + a / 100);
    lv[2] = lv[1] * (1 + b / 100);
    const expected = Math.round((lv[nm] / lv[dn]) * 1000) / 10;
    return neCheckNum(q, expected, 1e-9);
  },
};

/* ------------------------------------------------------------------ A3. Must be true (MCM) */

type Stmt =
  | { kind: 'abs'; i: number; j: number; year: number }
  | { kind: 'more-less'; i: number; thr: number }
  | { kind: 'more-greater'; i: number; thr: number }
  | { kind: 'same'; i: number }
  | { kind: 'net'; i: number; up: boolean }
  | { kind: 'year'; i: number; col: 0 | 1; up: boolean };

interface MustParams {
  stmts: Stmt[];
}

/** Truth of a statement for actual yearly levels lv[entity][year]. */
function stmtHolds(s: Stmt, lv: number[][]): boolean {
  const eps = 1e-9;
  switch (s.kind) {
    case 'abs':
      return lv[s.i][s.year] > lv[s.j][s.year] + eps;
    case 'more-less':
      return lv[s.i][2] < lv[s.i][0] * (1 - s.thr / 100) - eps;
    case 'more-greater':
      return lv[s.i][2] > lv[s.i][0] * (1 + s.thr / 100) + eps;
    case 'same':
      return Math.abs(lv[s.i][2] - lv[s.i][0]) < eps * lv[s.i][0];
    case 'net':
      return s.up ? lv[s.i][2] > lv[s.i][0] + eps : lv[s.i][2] < lv[s.i][0] - eps;
    case 'year':
      return s.up ? lv[s.i][s.col + 1] > lv[s.i][s.col] + eps : lv[s.i][s.col + 1] < lv[s.i][s.col] - eps;
  }
}

const mustBeTrue: Template<MustParams> = {
  id: 'data.interpretation.pct-change-must',
  skill: SKILL,
  set: SET,
  format: 'mcm',
  style: 'which statements must be true (sizes vs rates, adding percents)',
  generate(rng, d) {
    const D = makeChangeData(rng, d);
    const { cancel, near, down, up } = D.roles;
    const y = D.years;
    const m = D.ctx.measure;
    const items: { s: Stmt; text: string; truth: boolean; trap?: string; why: string }[] = [];
    // 1. Sizes cannot be inferred from percent changes.
    const [i, j] = rng.sample([0, 1, 2, 3, 4], 2).sort((p, q) => D.ch[q][0] - D.ch[p][0]);
    items.push({
      s: { kind: 'abs', i, j, year: 1 },
      text: `In ${y[1]}, the ${m} of ${ent(D, i)} was greater than the ${m} of ${ent(D, j)}.`,
      truth: false,
      trap: 'prob-di-rates-not-sizes',
      why: `The table gives only percent changes, not amounts, so it says nothing about which ${D.ctx.entity} had more ${m}. ${NAMES[i]} grew faster from ${y[0]} to ${y[1]}, but it may have started much smaller.`,
    });
    // 2. Two decreases: not the sum.
    const [da, db] = D.ch[down];
    const actualDown = -(da + db) - (da * db) / 100; // positive percent decrease
    if (rng.chance(0.5)) {
      items.push({
        s: { kind: 'more-less', i: down, thr: -(da + db) },
        text: `The ${m} of ${ent(D, down)} in ${y[2]} was more than ${pctAbs(da + db)} less than its ${m} in ${y[0]}.`,
        truth: false,
        trap: 'prob-add-percents',
        why: `For ${NAMES[down]}: $${mult(da)} \\times ${mult(db)} = ${decimal(frac((100 + da) * (100 + db), 10000))}$, a decrease of ${decimal(frac(Math.round(actualDown * 100), 100))}%, which is less than ${-(da + db)}%. Successive decreases do not add.`,
      });
    } else {
      const thr = Math.ceil(actualDown) - 1;
      items.push({
        s: { kind: 'more-less', i: down, thr },
        text: `The ${m} of ${ent(D, down)} in ${y[2]} was more than ${thr} percent less than its ${m} in ${y[0]}.`,
        truth: true,
        why: `For ${NAMES[down]}: $${mult(da)} \\times ${mult(db)} = ${decimal(frac((100 + da) * (100 + db), 10000))}$, a decrease of ${decimal(frac(Math.round(actualDown * 100), 100))}%, which is more than ${thr}%.`,
      });
    }
    // 3. Two increases compound to more than the sum.
    const [ua, ub] = D.ch[up];
    const actualUp = ua + ub + (ua * ub) / 100;
    const upTrue = rng.chance(0.6);
    const thrUp = upTrue ? ua + ub : Math.floor(actualUp) + 1;
    items.push({
      s: { kind: 'more-greater', i: up, thr: thrUp },
      text: `The ${m} of ${ent(D, up)} in ${y[2]} was more than ${thrUp} percent greater than its ${m} in ${y[0]}.`,
      truth: upTrue,
      ...(upTrue ? {} : { trap: 'prob-di-compound-overshoot' }),
      why: `For ${NAMES[up]}: $${mult(ua)} \\times ${mult(ub)} = ${decimal(frac((100 + ua) * (100 + ub), 10000))}$, an increase of ${decimal(frac(Math.round(actualUp * 100), 100))}%, which is ${upTrue ? 'more' : 'less'} than ${thrUp}%.`,
    });
    // 4. An increase and an equal decrease do not cancel (or a near-cancel is a net loss).
    if (rng.chance(0.5)) {
      const [ca, cb] = D.ch[cancel];
      const sameForm = rng.chance(0.5);
      items.push({
        s: sameForm ? { kind: 'same', i: cancel } : { kind: 'net', i: cancel, up: false },
        text: sameForm ? `The ${m} of ${ent(D, cancel)} was the same in ${y[2]} as in ${y[0]}.` : `The ${m} of ${ent(D, cancel)} was less in ${y[2]} than in ${y[0]}.`,
        truth: !sameForm,
        ...(sameForm ? { trap: 'prob-percent-cancel' } : {}),
        why: `For ${NAMES[cancel]}: $${mult(ca)} \\times ${mult(cb)} = ${decimal(frac((100 + ca) * (100 + cb), 10000))}$, so its ${m} ended ${Math.abs(ca) ** 2 / 100}% lower.${sameForm ? ' The two changes do not cancel.' : ''}`,
      });
    } else {
      const [na, nb] = D.ch[near];
      items.push({
        s: { kind: 'net', i: near, up: true },
        text: `The ${m} of ${ent(D, near)} was greater in ${y[2]} than in ${y[0]}.`,
        truth: false,
        trap: 'prob-add-percents',
        why: `For ${NAMES[near]}: $${mult(na)} \\times ${mult(nb)} = ${decimal(frac((100 + na) * (100 + nb), 10000))} < 1$: a net decrease, even though $${na} + ${nb > 0 ? nb : `(${nb})`} = +1$.`,
      });
    }
    // Choose 3 statements (4 at difficulty 3) with at least one true and one false one.
    // Items 1 (sizes) is always false; keep at least one true item in the sample.
    const trues = items.filter((c) => c.truth);
    const falses = items.filter((c) => !c.truth);
    let ordered: typeof items;
    if (!trues.length) {
      // No true statement yet: replace the increase statement by its true form.
      const upItem = items[2];
      upItem.s = { kind: 'more-greater', i: up, thr: ua + ub };
      upItem.text = `The ${m} of ${ent(D, up)} in ${y[2]} was more than ${ua + ub} percent greater than its ${m} in ${y[0]}.`;
      upItem.truth = true;
      upItem.why = `For ${NAMES[up]}: $${mult(ua)} \\times ${mult(ub)} = ${decimal(frac((100 + ua) * (100 + ub), 10000))}$, an increase of ${decimal(frac(Math.round(actualUp * 100), 100))}%, which is more than ${ua + ub}%.`;
      ordered = items.slice(0, d === 3 ? 4 : 3);
    } else {
      const n = d === 3 ? 4 : 3;
      const t = rng.int(Math.max(1, n - falses.length), Math.min(trues.length, n - 1));
      ordered = rng.shuffle([...rng.sample(trues, t), ...rng.sample(falses, n - t)]);
    }
    const { choices, answer } = flaggedChoices(ordered.map((c) => ({ text: c.text, correct: c.truth, ...(c.trap && !c.truth ? { trap: c.trap } : {}) })));
    const explanation = ordered.map((c, k) => `- ${String.fromCharCode(65 + k)}: ${c.truth ? 'true' : 'not necessarily true'}. ${c.why}`).join('\n');
    return {
      params: { stmts: ordered.map((c) => c.s) },
      q: {
        format: 'mcm',
        figure: D.figure,
        stem: 'Which of the following statements must be true, according to the data?',
        instruction: 'Indicate all such statements.',
        choices,
        answer,
        explanation: `Check each statement against the percent changes; a statement about amounts must follow for every possible starting amount.\n\n${explanation}`,
      },
    };
  },
  check(q, { stmts }, rng) {
    // Simulate many possible starting amounts and keep the statements that hold every time.
    const ch = readChanges(q);
    const truth = stmts.map(() => true);
    for (let t = 0; t < 120; t++) {
      const lv = ch.map(([a, b]) => {
        const v0 = 10 + rng.next() * 990;
        const v1 = v0 * (1 + a / 100);
        return [v0, v1, v1 * (1 + b / 100)];
      });
      stmts.forEach((s, k) => {
        if (!stmtHolds(s, lv)) truth[k] = false;
      });
    }
    return mcmCheck(q, truth);
  },
};

/* ------------------------------------------------------------------ A4. For how many entities (MCS) */

interface CountParams {
  up: boolean;
}

const countEntities: Template<CountParams> = {
  id: 'data.interpretation.pct-change-count',
  skill: SKILL,
  set: SET,
  format: 'mcs',
  style: 'for how many entities was the last year above (below) the first',
  generate(rng, d) {
    const D = makeChangeData(rng, d);
    const y = D.years;
    let lastUp = false;
    for (let tries = 0; ; tries++) {
      // counting the entities that went up is often 0 or 1: ask it less often than the (larger) count of those that went down
      const countUp = D.ch.filter(([a, b]) => (100 + a) * (100 + b) > 10000).length;
      const up: boolean = tries % 2 === 0 ? rng.chance(countUp >= 2 ? 0.5 : 0.27) : !lastUp;
      lastUp = up;
      const dir = up ? 'higher' : 'lower';
      const ok = ([a, b]: [number, number]) => (up ? (100 + a) * (100 + b) > 10000 : (100 + a) * (100 + b) < 10000);
      const rows = D.ch;
      const count = rows.filter(ok).length;
      const mk = (value: number, trap: string, why: (v: string) => string) => ({ value, trap, why });
      const naive = rows.filter(([a, b]) => (up ? a + b > 0 : a + b < 0)).length;
      const first = rows.filter(([a]) => (up ? a > 0 : a < 0)).length;
      const last = rows.filter(([, b]) => (up ? b > 0 : b < 0)).length;
      const both = rows.filter(([a, b]) => (up ? a > 0 && b > 0 : a < 0 && b < 0)).length;
      const either = rows.filter(([a, b]) => (up ? a > 0 || b > 0 : a < 0 || b < 0)).length;
      const opposite = rows.filter((r) => !ok(r)).length;
      const traps = [
        mk(naive, 'prob-add-percents', (v) => `adding the two percents for each ${D.ctx.entity} gives ${v}, but a decrease after an increase of the same size is a net loss`),
        mk(first, 'prob-di-one-step', (v) => `looking only at the ${y[0]} to ${y[1]} change gives ${v}`),
        mk(last, 'prob-di-wrong-column', (v) => `looking only at the ${y[1]} to ${y[2]} change gives ${v}`),
        mk(both, 'prob-di-both-changes', (v) => `requiring both changes to go the same way gives ${v}, but one big change can outweigh a small one`),
        mk(either, 'prob-di-both-changes', (v) => `accepting any one change in that direction gives ${v}, but the two changes must be combined`),
        mk(opposite, 'prob-wrong-event', (v) => `${v} counts the ${D.ctx.entities} that are ${up ? 'lower' : 'higher'}, the other direction`),
      ];
      const generic = [0, 1, 2, 3, 4, 5].map((n) => mk(n, 'prob-di-miscount', (v) => `${v} comes from a miscount: only ${count} of the five ${D.ctx.entities} qualify`));
      const built = trapOnlyChoices(rng, count, [...rng.shuffle(traps), ...generic], (v) => `$${v.n}$`, 5, 0, true);
      if (!built) continue;
      const cite = rng.pick(built.used);
      const lines = D.ch
        .map(([a, b], k) => `- ${NAMES[k]}: $${mult(a)} \\times ${mult(b)} = ${decimal(frac((100 + a) * (100 + b), 10000))}$ (${ok([a, b]) ? dir : up ? 'lower' : 'higher'}${ok([a, b]) ? ' ✓' : ''})`)
        .join('\n');
      return {
        params: { up },
        q: {
          format: 'mcs',
          figure: D.figure,
          stem: `For how many of the five ${D.ctx.entities} was the ${D.ctx.measure} in ${y[2]} ${up ? 'greater' : 'less'} than the ${D.ctx.measure} in ${y[0]}?`,
          choices: built.choices,
          answer: built.answer,
          explanation: `Multiply the two growth factors for each ${D.ctx.entity}: a product ${up ? 'above' : 'below'} 1 means the ${y[2]} amount was ${up ? 'higher' : 'lower'} than the ${y[0]} amount.

${lines}

So the answer is $${count}$.

Trap: ${cite.why(`$${cite.value}$`)}.

Successive percent changes multiply; compare the product with 1.`,
        },
      };
    }
  },
  check(q, { up }) {
    const ch = readChanges(q);
    let count = 0;
    for (const [a, b] of ch) {
      const v3 = 500 * (1 + a / 100) * (1 + b / 100);
      if (up ? v3 > 500 + 1e-9 : v3 < 500 - 1e-9) count++;
    }
    return mcsCheck(q, `$${count}$`);
  },
};

export const changeTemplates: Template<any>[] = [valueAfterChanges, percentOfYear, mustBeTrue, countEntities];
