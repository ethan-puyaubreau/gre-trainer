import { Frac } from '../../../engine/frac';
import { num, paren } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template, Trap } from '../../../engine/types';
import { QC_WORDS, qcEnd, qcSamples } from './util';

/** Adding the same amount to numerator and denominator of a/b (QC). */
type Cond = 'none' | 'pos' | 'neg' | 'any' | 'right' | 'left' | 'across' | 'free';
interface ShiftParams {
  kind: 'num' | 'one' | 'two';
  a: number;
  b: number;
  s: number;
  cond: Cond;
  letters: [string, string];
}

const frac = (n: Frac) => n.toTex();
const g = (a: number, b: number, s: Frac) => new Frac(a).add(s).div(s.add(b));

/** Allowed (shift, shift) values on a grid, as exact fractions. */
function gridPairs(p: ShiftParams): [Frac, Frac][] {
  const m = Math.min(p.a, p.b);
  if (p.kind === 'num') return [[new Frac(p.s), new Frac(p.s)]];
  if (p.kind === 'one') {
    const ks: Frac[] = [];
    for (let i = 1; i <= 7; i++) ks.push(new Frac(-m * i, 8));
    for (const v of [new Frac(1, 2), new Frac(1), new Frac(3), new Frac(9)]) ks.push(v);
    const ok = (k: Frac) => (p.cond === 'pos' ? k.n > 0 : p.cond === 'neg' ? k.n < 0 : true);
    return ks.filter(ok).map((k) => [k, k]);
  }
  const b = p.b;
  const G = [-b - 4, -b - 2, -b - 0.5, -b + 0.5, -b + 1, 0, 1, 3, 8].map((v) => new Frac(Math.round(v * 2), 2));
  const out: [Frac, Frac][] = [];
  for (const s of G)
    for (const t of G) {
      if (!s.gt(t)) continue;
      const ok =
        p.cond === 'right' ? t.gt(-b) : p.cond === 'left' ? s.lt(-b) : p.cond === 'across' ? t.lt(-b) && s.gt(-b) : true;
      if (ok) out.push([s, t]);
    }
  return out;
}

function infoOf(p: ShiftParams): string | undefined {
  const [x, y] = p.letters;
  const m = Math.min(p.a, p.b);
  switch (p.cond) {
    case 'pos': return `$${x} > 0$`;
    case 'neg': return `$${num(-m)} < ${x} < 0$`;
    case 'any': return `$${x} > ${num(-m)}$ and $${x} \\ne 0$`;
    case 'right': return `$${x} > ${y} > ${num(-p.b)}$`;
    case 'left': return `$${y} < ${x} < ${num(-p.b)}$`;
    case 'across': return `$${y} < ${num(-p.b)} < ${x}$`;
    case 'free': return `$${x} > ${y}$`;
    default: return undefined;
  }
}

function build(p: ShiftParams): QCQuestion {
  const { a, b } = p;
  const [x, y] = p.letters;
  const fr = (top: string, bot: string) => `\\frac{${top}}{${bot}}`;
  const sh = (v: string) => fr(`${a} + ${v}`, `${b} + ${v}`);
  const base = fr(String(a), String(b));
  let A: string;
  let B: string;
  if (p.kind === 'num') {
    A = base;
    B = fr(`${a + p.s}`, `${b + p.s}`);
  } else if (p.kind === 'one') {
    A = base;
    B = sh(x);
  } else {
    A = sh(x);
    B = sh(y);
  }
  const pairs = gridPairs(p);
  const outcomes = new Set<QCChoice>(
    pairs.map(([s, t]) => {
      const lhs = p.kind === 'two' ? g(a, b, s) : new Frac(a, b);
      const rhs = p.kind === 'two' ? g(a, b, t) : g(a, b, s);
      return lhs.gt(rhs) ? 'A' : lhs.lt(rhs) ? 'B' : 'C';
    }),
  );
  const answer: QCChoice = outcomes.size === 1 ? [...outcomes][0] : 'D';
  const d = b - a;
  const word = (v: number) => (v > 0 ? 'positive' : 'negative');
  const val = (v: Frac | number) => (v instanceof Frac ? v : new Frac(v));
  const eg = (k: number) => `for $${x} = ${num(k)}$, A is $${frac(new Frac(a, b))}$ and B is $${frac(g(a, b, val(k)))}$`;
  let body: string;
  const traps: QCQuestion['traps'] = {};
  if (p.kind !== 'two') {
    const S = p.kind === 'num' ? String(p.s) : x;
    const head = `Cross-multiplying, $(${a} + ${S})\\cdot ${b} - ${a}(${b} + ${S}) = ${S}\\cdot ${paren(d)}$, and both denominators are positive, so $B - A$ has the sign of $${S}\\cdot ${paren(d)}$.`;
    if (p.cond === 'any') body = `${head} Here $${x}$ can be positive or negative, so test both: ${eg(1)}; ${eg(-1)}.`;
    else {
      const sg = p.kind === 'num' || p.cond === 'pos' ? 1 : -1;
      body = `${head} The shift is ${word(sg)} and $${num(d)}$ is ${word(d)}, so $B - A$ is ${word(sg * d)}. Check: ${p.kind === 'num' ? `with a shift of $${p.s}$, A is $${frac(new Frac(a, b))}$ and B is $${frac(g(a, b, new Frac(p.s)))}$` : eg(sg)}.`;
    }
  } else {
    const head = `Subtracting, $A - B = \\frac{(${x} - ${y})\\cdot ${paren(d)}}{(${b} + ${x})(${b} + ${y})}$.`;
    const pair = (s: number, t: number) => `for $${x} = ${num(s)}$, $${y} = ${num(t)}$, A is $${frac(g(a, b, new Frac(s)))}$ and B is $${frac(g(a, b, new Frac(t)))}$`;
    if (p.cond === 'free') body = `${head} The factors $${b} + ${x}$ and $${b} + ${y}$ may have the same or opposite signs, so test both: ${pair(2, 0)}; ${pair(1 - b, -1 - b)}.`;
    else {
      const den = p.cond === 'across' ? -1 : 1;
      body = `${head} Here $${x} - ${y}$ is positive, $${num(d)}$ is ${word(d)} and the product of the denominators is ${word(den)}, so $A - B$ is ${word(d * den)}. Check: ${p.cond === 'right' ? pair(2, 0) : p.cond === 'left' ? pair(-b - 1, -b - 2) : pair(1 - b, -1 - b)}.`;
    }
  }
  if (answer === 'D') {
    traps.C = 'alg-qcshift-unchanged';
    traps[p.kind === 'two' ? 'A' : b > a ? 'B' : 'A'] = 'alg-qcshift-one-sign';
  } else {
    traps.D = 'alg-qcshift-d-unneeded';
    if (p.kind !== 'two') traps.C = 'alg-qcshift-unchanged';
    else traps[answer === 'A' ? 'B' : 'A'] = 'alg-qcshift-wrong-branch';
  }
  const explanation = `The same amount is added to the numerator and the denominator, so compare by subtracting.

${body} ${qcEnd(answer)}

Trap: adding the same number to both parts of a fraction does not leave it unchanged. Rule: compare $\\frac{a+s}{b+s}$ with $\\frac{a}{b}$ through the sign of $s(b-a)$ over positive denominators.`;
  return { format: 'qc', info: infoOf(p), quantityA: `$${A}$`, quantityB: `$${B}$`, answer, traps, explanation };
}

const shiftQC: Template<ShiftParams> = {
  id: 'alg.qc-algebra.shift-fraction-qc',
  skill: 'alg.qc-algebra',
  format: 'qc',
  style: 'add the same amount to numerator and denominator',
  generate(rng, d) {
    for (;;) {
      let a = rng.int(2, 20);
      let b = rng.int(2, 20);
      if (a === b) continue;
      let p: ShiftParams;
      if (d === 1) {
        p = { kind: 'num', a, b, s: rng.int(1, 9), cond: 'none', letters: ['k', 'k'] };
      } else if (d === 2) {
        p = { kind: 'one', a, b, s: 0, cond: rng.pick(['pos', 'neg', 'any', 'pos', 'neg']), letters: rng.pick([['k', 'k'], ['t', 't'], ['x', 'x']]) as [string, string] };
      } else {
        a = rng.int(1, 12);
        b = rng.int(1, 12);
        if (a === b) continue;
        p = { kind: 'two', a, b, s: 0, cond: rng.pick(['right', 'left', 'across', 'free', 'free']), letters: rng.pick([['s', 't'], ['p', 'q'], ['m', 'n']]) as [string, string] };
      }
      return { q: build(p), params: p };
    }
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const m = Math.min(p.a, p.b);
    const f = (v: number) => (p.a + v) / (p.b + v);
    const samples: [number, number][] = [];
    for (let i = 0; i < 400; i++) {
      const u = rng.next() * 0.98 + 0.01;
      const w = rng.next() * 0.98 + 0.01;
      if (p.kind === 'num') samples.push([p.a / p.b, f(p.s)]);
      else if (p.kind === 'one') {
        const k = p.cond === 'pos' ? u * 30 : p.cond === 'neg' ? -u * m : rng.chance(0.5) ? u * 30 : -u * m;
        samples.push([p.a / p.b, f(k)]);
      } else {
        const L = -p.b;
        let s: number;
        let t: number;
        if (p.cond === 'right') [s, t] = [L + 0.01 + u * 30 + w * 30, L + 0.01 + u * 30];
        else if (p.cond === 'left') [s, t] = [L - 0.01 - u * 30, L - 0.01 - u * 30 - w * 30];
        else if (p.cond === 'across') [s, t] = [L + 0.01 + u * 30, L - 0.01 - w * 30];
        else {
          const x = (u - 0.5) * 80 + L;
          const y = (w - 0.5) * 80 + L;
          [s, t] = x > y ? [x, y] : [y, x];
        }
        samples.push([f(s), f(t)]);
      }
    }
    const truth = qcSamples(samples, 1e-9);
    return truth === q.answer ? null : `expected ${truth} (${QC_WORDS[truth]})`;
  },
};

export const shiftTemplates = [shiftQC];

export const shiftTraps: Record<string, Trap> = {
  'alg-qcshift-unchanged': {
    label: 'Believed that adding the same amount to top and bottom leaves the fraction unchanged',
    fix: 'Only multiplying (or dividing) both parts by the same number keeps a fraction equal. Adding moves it toward 1 or away from it: compare with $s(b-a)$.',
  },
  'alg-qcshift-one-sign': {
    label: 'Tested only one sign of the shift',
    fix: 'If the shift can be positive or negative, test one of each: the fraction moves toward 1 for one sign and away from 1 for the other.',
  },
  'alg-qcshift-d-unneeded': {
    label: 'Chose D although the conditions fix the sign',
    fix: 'Read the conditions on the shift and on $b - a$: when both signs are fixed, the comparison is fixed too.',
  },
  'alg-qcshift-wrong-branch': {
    label: 'Ignored that the denominators may have opposite signs',
    fix: 'For shifts on the two sides of $-b$, the denominators have opposite signs and the order reverses.',
  },
};
