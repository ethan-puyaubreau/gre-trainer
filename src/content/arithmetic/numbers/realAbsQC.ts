import { qcFromSamples } from '../../../engine/build';
import type { QCChoice, Template, Trap } from '../../../engine/types';
import { pickWeighted, swapQC } from './util';

export const realAbsQCTraps: Record<string, Trap> = {
  'num-abs-distribute': {
    label: '$|a \\pm b| = |a| \\pm |b|$',
    fix: 'Absolute value does not distribute over sums. $|a + b| \\le |a| + |b|$, with equality only when $a$ and $b$ have the same sign (or one is 0): $|3 + (-2)| = 1$ but $|3| + |-2| = 5$.',
  },
};

type Cls = 'same' | 'opp' | 'samez' | 'oppz' | 'abseq' | 'any';
type Form = 'sum' | 'diff' | 'cross';

interface Cond {
  /** TeX with {a} and {b} for the variable names */
  tex: string;
  cls: Cls;
  pred: (a: number, b: number) => boolean;
  d: 1 | 2 | 3;
}

const CONDS: Cond[] = [
  { tex: '{a} > 0 \\text{ and } {b} > 0', cls: 'same', pred: (a, b) => a > 0 && b > 0, d: 1 },
  { tex: '{a} < 0 \\text{ and } {b} < 0', cls: 'same', pred: (a, b) => a < 0 && b < 0, d: 1 },
  { tex: '{a} > 0 \\text{ and } {b} < 0', cls: 'opp', pred: (a, b) => a > 0 && b < 0, d: 1 },
  { tex: '{a} < 0 \\text{ and } {b} > 0', cls: 'opp', pred: (a, b) => a < 0 && b > 0, d: 1 },
  { tex: '{a} \\ge 0 \\text{ and } {b} > 0', cls: 'samez', pred: (a, b) => a >= 0 && b > 0, d: 1 },
  { tex: '{a} \\le 0 \\text{ and } {b} < 0', cls: 'samez', pred: (a, b) => a <= 0 && b < 0, d: 1 },
  { tex: '{a} \\le 0 \\text{ and } {b} > 0', cls: 'oppz', pred: (a, b) => a <= 0 && b > 0, d: 1 },
  { tex: '{a} \\ge 0 \\text{ and } {b} < 0', cls: 'oppz', pred: (a, b) => a >= 0 && b < 0, d: 1 },
  { tex: '{a}{b} > 0', cls: 'same', pred: (a, b) => a * b > 0, d: 2 },
  { tex: '{a}{b} < 0', cls: 'opp', pred: (a, b) => a * b < 0, d: 2 },
  { tex: '{a}{b} \\ge 0', cls: 'samez', pred: (a, b) => a * b >= 0, d: 2 },
  { tex: '{a}{b} \\le 0', cls: 'oppz', pred: (a, b) => a * b <= 0, d: 2 },
  { tex: '\\frac{{a}}{{b}} > 0', cls: 'same', pred: (a, b) => b !== 0 && a / b > 0, d: 2 },
  { tex: '\\frac{{a}}{{b}} < 0', cls: 'opp', pred: (a, b) => b !== 0 && a / b < 0, d: 2 },
  { tex: '{a} \\ne 0 \\text{ and } {b} \\ne 0', cls: 'any', pred: (a, b) => a !== 0 && b !== 0, d: 2 },
  { tex: '{a}^3{b} > 0', cls: 'same', pred: (a, b) => a ** 3 * b > 0, d: 3 },
  { tex: '{a}{b}^3 < 0', cls: 'opp', pred: (a, b) => a * b ** 3 < 0, d: 3 },
  { tex: '{a}{b}^3 \\ge 0', cls: 'samez', pred: (a, b) => a * b ** 3 >= 0, d: 3 },
  { tex: '{a}^3{b} \\le 0', cls: 'oppz', pred: (a, b) => a ** 3 * b <= 0, d: 3 },
  { tex: '\\frac{{a}}{{b}^3} > 0', cls: 'same', pred: (a, b) => b !== 0 && a / b ** 3 > 0, d: 3 },
  { tex: '{a}^2 = {b}^2 \\text{ and } {a} \\ne 0', cls: 'abseq', pred: (a, b) => a * a === b * b && a !== 0, d: 3 },
];

const ANSWER: Record<Form, Record<Cls, QCChoice>> = {
  sum: { same: 'C', opp: 'B', samez: 'C', oppz: 'D', abseq: 'D', any: 'D' },
  diff: { same: 'B', opp: 'C', samez: 'D', oppz: 'C', abseq: 'D', any: 'D' },
  cross: { same: 'A', opp: 'B', samez: 'D', oppz: 'D', abseq: 'D', any: 'D' },
};
const TRAP_LETTER: Record<Form, QCChoice> = { sum: 'C', diff: 'B', cross: 'A' };

const fill = (s: string, a: string, b: string) => s.replace(/\{a\}/g, a).replace(/\{b\}/g, b);
const quantities = (f: Form, a: string, b: string): [string, string] =>
  f === 'sum' ? [`|${a} + ${b}|`, `|${a}| + |${b}|`] : f === 'diff' ? [`|${a} - ${b}|`, `|${a}| + |${b}|`] : [`|${a} + ${b}|`, `|${a} - ${b}|`];
const evalForm = (f: Form, a: number, b: number): [number, number] =>
  f === 'sum' ? [Math.abs(a + b), Math.abs(a) + Math.abs(b)] : f === 'diff' ? [Math.abs(a - b), Math.abs(a) + Math.abs(b)] : [Math.abs(a + b), Math.abs(a - b)];

interface Params {
  cond: number;
  form: Form;
  swap: boolean;
}

const GRID: [number, number][] = [];
for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) GRID.push([i / 2, j / 2]);

const absQC: Template<Params> = {
  id: 'arith.real-numbers.abs-sum-qc',
  skill: 'arith.real-numbers',
  format: 'qc',
  style: 'absolute value of a sum or difference against the sum of absolute values',
  generate(rng, d) {
    const [a, b] = rng.pick([
      ['a', 'b'],
      ['x', 'y'],
      ['m', 'n'],
      ['s', 't'],
      ['p', 'q'],
    ]);
    const forms: Form[] = ['sum', 'diff', 'cross'];
    const options = CONDS.flatMap((c, ci) => (c.d === d ? forms.map((form) => ({ ci, form, ans: ANSWER[form][c.cls] })) : []));
    const target = pickWeighted<QCChoice>(
      rng,
      (
        [
          ['A', 2.5],
          ['B', 3],
          ['C', 2.5],
          ['D', 2.2],
        ] as [QCChoice, number][]
      ).filter(([r]) => options.some((o) => o.ans === r)),
    );
    const opt = rng.pick(options.filter((o) => o.ans === target));
    const swap = rng.chance(0.5);
    const cond = CONDS[opt.ci];
    const [qa, qb] = quantities(opt.form, a, b);
    const answer = swap ? swapQC(opt.ans) : opt.ans;
    const trapLetter = swap ? swapQC(TRAP_LETTER[opt.form]) : TRAP_LETTER[opt.form];
    const pairs = GRID.filter(([x, y]) => cond.pred(x, y));
    const relAt = ([x, y]: [number, number]): QCChoice => {
      const [u, v] = evalForm(opt.form, x, y);
      return u === v ? 'C' : u > v ? 'A' : 'B';
    };
    const show = ([x, y]: [number, number]) => {
      const [u, v] = evalForm(opt.form, x, y);
      return `for $${a} = ${x}$ and $${b} = ${y}$, $${qa}$ is ${u} and $${qb}$ is ${v}`;
    };
    const reasonByForm: Record<Form, string> = {
      sum: `$|${a} + ${b}|$ equals $|${a}| + |${b}|$ when $${a}$ and $${b}$ have the same sign (or one is 0), and is smaller when the signs differ.`,
      diff: `$|${a} - ${b}|$ equals $|${a}| + |${b}|$ when $${a}$ and $${b}$ have opposite signs (or one is 0), and is smaller when the signs agree.`,
      cross: `$|${a} + ${b}|$ is larger than $|${a} - ${b}|$ when $${a}$ and $${b}$ have the same sign, smaller when they differ, and equal when one is 0.`,
    };
    const SIGN_PATTERN: Record<Cls, string> = {
      same: 'have the same sign',
      opp: 'have opposite signs',
      samez: 'have the same sign (or one is 0)',
      oppz: 'have opposite signs (or one is 0)',
      abseq: '',
      any: '',
    };
    const signStep =
      d !== 3
        ? ''
        : cond.cls === 'abseq'
          ? `Since $${a}^2 = ${b}^2$, either $${b} = ${a}$ or $${b} = -${a}$, with $${a} \\ne 0$, so both sign patterns occur. `
          : `An odd power keeps the sign, so $${a}^3$ has the sign of $${a}$ and $${b}^3$ the sign of $${b}$. The condition therefore says that $${a}$ and $${b}$ ${SIGN_PATTERN[cond.cls]}. `;
    let verdict: string;
    if (opt.ans === 'D') {
      const x1 = pairs.find((p) => relAt(p) === 'C') ?? pairs[0];
      const x2 = pairs.find((p) => relAt(p) !== relAt(x1)) ?? pairs[1];
      verdict = `The condition allows different cases: ${show(x1)}; ${show(x2)}. Two relations, so it cannot be determined.`;
    } else {
      verdict = `Under the condition every allowed pair gives the same relation, for example ${show((pairs.filter(([x, y]) => x !== 0 && y !== 0 && Math.abs(x) !== Math.abs(y))[0] ?? pairs[0]))}, so the answer is fixed.`;
    }
    return {
      params: { cond: opt.ci, form: opt.form, swap },
      q: {
        format: 'qc',
        info: `$${fill(cond.tex, a, b)}$`,
        quantityA: `$${swap ? qb : qa}$`,
        quantityB: `$${swap ? qa : qb}$`,
        answer,
        ...(trapLetter !== answer ? { traps: { [trapLetter]: 'num-abs-distribute' } } : {}),
        explanation: `Compare with the triangle inequality, not with a plug-in guess. ${signStep}${reasonByForm[opt.form]}

${verdict}

Trap: treating $|${a} \\pm ${b}|$ as $|${a}| \\pm |${b}|$ ignores the signs.

Rule: the sign pattern of $${a}$ and $${b}$, including zero, decides each case.`,
      },
    };
  },
  check(q, { cond, form, swap }) {
    if (q.format !== 'qc') return 'wrong format';
    const c = CONDS[cond];
    const raw = qcFromSamples(GRID.filter(([x, y]) => c.pred(x, y)).map(([x, y]) => evalForm(form, x, y)));
    const want: QCChoice = swap && (raw === 'A' || raw === 'B') ? swapQC(raw) : raw;
    return q.answer === want ? null : `expected ${want}`;
  },
};

export const realAbsQCTemplates = [absQC];
