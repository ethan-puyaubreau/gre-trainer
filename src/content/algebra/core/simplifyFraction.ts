import { textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { N, V, add, close, div, evalEx, evalFrac, mul, pow, sameFunction, texEx, type Ex } from './util';

/* Simplify an algebraic fraction: which choice is equal to it for every allowed value? (MCS) */

type Family = 'diffsq' | 'common' | 'sqover' | 'complex';

interface P {
  target: Ex;
  vars: string[];
  options: Ex[];
}

interface WF {
  e: Ex;
  trap: string;
  why: string;
}

interface Fam {
  target: Ex;
  correct: Ex;
  wrongs: WF[];
  vars: string[];
  domain: string;
  method: string;
  rule: string;
  points: Record<string, number>[];
}

const gcd = (x: number, y: number): number => (y === 0 ? x : gcd(y, x % y));
const term = (c: number, v: Ex): Ex => (c === 1 ? v : mul(N(c), v));
/** v + c (c signed) */
const vPlus = (v: string, c: number): Ex => add(V(v), N(c));

function build(f: Family, d: 1 | 2 | 3, rng: Parameters<Template<P>['generate']>[0]): Fam {
  const v = rng.pick(['x', 't', 'n', 'z', 'u']);
  if (f === 'diffsq') {
    const a = rng.int(2, d === 1 ? 6 : 9);
    const s = rng.sign();
    const m = d === 1 ? 1 : rng.int(2, 4);
    const den = vPlus(v, s * a);
    const num0 = add(term(m, pow(V(v), 2)), N(-m * a * a));
    const target = div(num0, den);
    const correct = term(m, vPlus(v, -s * a));
    const wrongs: WF[] = [
      { e: term(m, vPlus(v, s * a)), trap: 'alg-cancel-wrong-factor', why: `keeping the factor $${texEx(den)}$ that was cancelled, instead of the other one` },
      { e: term(m, add(V(v), N(-s * a * a))), trap: 'alg-fraction-term-cancel', why: `cancelling $${v}$ against $${v}^{2}$ and leaving $${a * a}$ alone` },
      { e: add(term(m, pow(V(v), 2)), N(-m * s * a)), trap: 'alg-divide-one-term', why: `dividing only the constant term of the numerator` },
      { e: term(m, add(N(s * a), mul(N(-1), V(v)))), trap: 'alg-reversed-factor', why: `writing the leftover factor as $(${num(s * a)} - ${v})$ instead of $(${v} - ${num(s * a)})$` },
    ];
    if (m > 1) {
      wrongs.splice(1, 0, { e: vPlus(v, -s * a), trap: 'alg-dropped-factor', why: `dropping the common factor ${m}` });
      wrongs.push({ e: add(term(m, V(v)), N(-s * a)), trap: 'alg-distribute-partial', why: `multiplying the ${m} into the first term only` });
    }
    return {
      target,
      correct,
      wrongs,
      vars: [v],
      domain: `every $${v} \\ne ${num(-s * a)}$`,
      method: `${m > 1 ? `Take out the common factor: $${texEx(num0)} = ${m}(${v}^{2} - ${a * a})$. ` : ''}Then factor the difference of squares, $${v}^{2} - ${a * a} = (${v} - ${a})(${v} + ${a})$. The factor $${texEx(den)}$ is also the denominator, so it cancels (it is not 0 when $${v} \\ne ${num(-s * a)}$), and what is left is $${texEx(correct)}$.`,
      rule: 'Factor the numerator completely, then cancel a whole factor, never a single term.',
      points: [1, 2, 4, 5, 7].map((x) => ({ [v]: x })),
    };
  }
  if (f === 'common') {
    const r = rng.int(2, d === 1 ? 3 : 5);
    const p = rng.int(d === 1 ? 1 : 2, d === 1 ? 3 : 5);
    const q = rng.int(1, d === 1 ? 4 : 7) * rng.sign();
    const target = div(add(mul(N(r * p), pow(V(v), 2)), mul(N(r * q), V(v))), mul(N(r), V(v)));
    const correct = add(term(p, V(v)), N(q));
    const wrongs: WF[] = [
      { e: add(term(p, V(v)), N(r * q)), trap: 'alg-divide-one-term', why: `dividing only the first term by ${r}` },
      { e: add(term(r * p, V(v)), N(q)), trap: 'alg-divide-one-term', why: `dividing only the second term by ${r}` },
      { e: add(term(p, V(v)), mul(N(q), V(v))), trap: 'alg-cancel-one-term', why: `cancelling $${v}$ in the first term only` },
      { e: add(term(p, pow(V(v), 2)), N(q)), trap: 'alg-cancel-one-term', why: `cancelling $${v}$ in the second term only` },
      { e: add(term(r * p, V(v)), N(r * q)), trap: 'alg-forgot-divide', why: `cancelling $${v}$ but forgetting to divide by ${r}` },
    ];
    return {
      target,
      correct,
      wrongs: rng.shuffle(wrongs),
      vars: [v],
      domain: `every nonzero $${v}$`,
      method: `Factor the numerator: $${texEx(target.k === 'div' ? target.a : target)} = ${r}${v}(${texEx(correct)})$. The factor $${r}${v}$ is also the whole denominator, so it cancels (it is not 0 when $${v} \\ne 0$), leaving $${texEx(correct)}$.`,
      rule: 'Factor out what the numerator shares with the denominator before cancelling.',
      points: [1, 2, 3, 5].map((x) => ({ [v]: x })),
    };
  }
  if (f === 'sqover') {
    const a = rng.int(2, d === 2 ? 6 : 9);
    const s = rng.sign();
    const target = div(pow(vPlus(v, s * a), 2), add(pow(V(v), 2), N(-a * a)));
    const correct = div(vPlus(v, s * a), vPlus(v, -s * a));
    const wrongs: WF[] = [
      { e: div(vPlus(v, -s * a), vPlus(v, s * a)), trap: 'alg-fraction-inverted', why: `cancelling the wrong factors, so the fraction ends up upside down` },
      { e: div(add(pow(V(v), 2), N(a * a)), add(pow(V(v), 2), N(-a * a))), trap: 'alg-sq-no-cross-term', why: `expanding $(${texEx(vPlus(v, s * a))})^{2}$ as $${v}^{2} + ${a * a}$` },
      { e: div(vPlus(v, s * a), add(pow(V(v), 2), N(-a * a))), trap: 'alg-lost-square', why: `dropping the square of the numerator without cancelling anything` },
      { e: vPlus(v, s * a), trap: 'alg-dropped-denominator-factor', why: `forgetting that the factor $${texEx(vPlus(v, -s * a))}$ stays in the denominator` },
    ];
    return {
      target,
      correct,
      wrongs,
      vars: [v],
      domain: `every $${v} \\ne \\pm ${a}$`,
      method: `Factor the denominator: $${v}^{2} - ${a * a} = (${v} - ${a})(${v} + ${a})$. The numerator is the square $(${texEx(vPlus(v, s * a))})^{2} = (${texEx(vPlus(v, s * a))})(${texEx(vPlus(v, s * a))})$, so one copy of $${texEx(vPlus(v, s * a))}$ cancels with the denominator, which leaves $${texEx(correct)}$.`,
      rule: 'A squared factor cancels once against a single copy of itself; the other copy stays.',
      points: [3, 4, 5, 6, 8, 10].map((x) => ({ [v]: x })),
    };
  }
  // complex fraction
  const [x, y] = rng.shuffle(rng.pick([['x', 'y'], ['m', 'n'], ['s', 't'], ['u', 'w']]));
  const a = rng.int(1, 4);
  const b = rng.int(1, 4);
  const frac = (c: number, w: string): Ex => div(N(c), V(w));
  const target = div(add(frac(a, x), mul(N(-1), frac(b, y))), add(frac(a, x), frac(b, y)));
  const ay = term(a, V(y));
  const bx = term(b, V(x));
  const dn = add(ay, bx);
  const correct = div(add(ay, mul(N(-1), bx)), dn);
  const wrongs: WF[] = [
    { e: div(add(bx, mul(N(-1), ay)), dn), trap: 'alg-complex-sign-order', why: `reversing the subtraction in the numerator` },
    { e: div(add(term(a, V(x)), mul(N(-1), term(b, V(y)))), add(term(a, V(x)), term(b, V(y)))), trap: 'alg-multiply-wrong-factor', why: `multiplying $\\frac{${a}}{${x}}$ by $${x}$ instead of by $${y}$` },
    { e: div(dn, add(ay, mul(N(-1), bx))), trap: 'alg-fraction-inverted', why: `turning the fraction upside down` },
  ];
  if (a !== b) wrongs.push({ e: (() => { const g = gcd(Math.abs(a - b), a + b); const nn = (a - b) / g; const dd = (a + b) / g; return dd === 1 ? N(nn) : div(N(nn), N(dd)); })(), trap: 'alg-fraction-ignore-variables', why: `forgetting that the denominators ${x} and ${y} are different` });
  else wrongs.push({ e: div(add(bx, ay), add(ay, mul(N(-1), bx))), trap: 'alg-fraction-inverted', why: `swapping numerator and denominator` });
  return {
    target,
    correct,
    wrongs,
    vars: [x, y],
    domain: `all nonzero $${x}$ and $${y}$ for which the denominator of the big fraction is not 0`,
    method: `Clear the small fractions: multiply the numerator and the denominator of the big fraction by $${x}${y}$, the common denominator. Then $\\frac{${a}}{${x}} \\cdot ${x}${y} = ${texEx(ay)}$ and $\\frac{${b}}{${y}} \\cdot ${x}${y} = ${texEx(bx)}$, so the expression becomes $${texEx(correct)}$.`,
    rule: 'Multiply the top and the bottom of a stacked fraction by the common denominator of the small fractions.',
    points: [
      { [x]: 1, [y]: 2 },
      { [x]: 2, [y]: 3 },
      { [x]: 3, [y]: 1 },
      { [x]: 5, [y]: 2 },
    ],
  };
}

const FAMILIES: Record<1 | 2 | 3, Family[]> = {
  1: ['diffsq', 'common'],
  2: ['diffsq', 'common', 'sqover'],
  3: ['complex', 'sqover', 'complex', 'diffsq'],
};

function refute(wrong: Ex, right: Ex, points: Record<string, number>[]): string {
  for (const p of points) {
    const env = Object.fromEntries(Object.entries(p).map(([k, x]) => [k, new Frac(x)]));
    try {
      const a = evalFrac(wrong, env);
      const b = evalFrac(right, env);
      if (!a.eq(b))
        return `At ${Object.entries(p)
          .map(([k, x]) => `$${k} = ${x}$`)
          .join(', ')} the choice gives $${a.toTex()}$ but the right value is $${b.toTex()}$.`;
    } catch {
      /* undefined at this point: try the next one */
    }
  }
  return '';
}

const simplifyFractionMCS: Template<P> = {
  id: 'alg.expressions.simplify-fraction-mcs',
  skill: 'alg.expressions',
  format: 'mcs',
  style: 'simplify an algebraic fraction by factoring and cancelling',
  generate(rng, d) {
    for (;;) {
      const fam = build(rng.pick(FAMILIES[d]), d, rng);
      const kept: WF[] = [];
      const texts = new Set([texEx(fam.correct)]);
      for (const wf of fam.wrongs) {
        if (kept.length === 4) break;
        if (texts.has(texEx(wf.e))) continue;
        if (sameFunction(wf.e, fam.correct, fam.vars, rng, 1.2, 9)) continue;
        if (kept.some((k) => sameFunction(k.e, wf.e, fam.vars, rng, 1.2, 9))) continue;
        texts.add(texEx(wf.e));
        kept.push(wf);
      }
      if (kept.length < 4) continue;
      const { choices, answer } = textChoices(
        rng,
        `$${texEx(fam.correct)}$`,
        kept.map((wf) => ({ text: `$${texEx(wf.e)}$`, trap: wf.trap })),
      );
      const all = [fam.correct, ...kept.map((k) => k.e)];
      const options = choices.map((c) => all.find((e) => `$${texEx(e)}$` === c.text)!);
      const cited = kept[0];
      const note = refute(cited.e, fam.correct, fam.points);
      return {
        params: { target: fam.target, vars: fam.vars, options },
        q: {
          format: 'mcs',
          stem: `Which of the following is equal to $${texEx(fam.target)}$ for ${fam.domain}?`,
          choices,
          answer,
          explanation: `${fam.vars.length === 2 ? 'A stacked fraction simplifies by clearing the small fractions with their common denominator.' : 'A fraction simplifies only by cancelling common factors, so factor first.'}

${fam.method}

Trap: $${texEx(cited.e)}$ comes from ${cited.why}. ${note}

Rule: ${fam.rule}`,
        },
      };
    }
  },
  check(q, { target, vars, options }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    if (options.some((o, i) => q.choices[i].text !== `$${texEx(o)}$`)) return 'choice text mismatch';
    const matches = options.flatMap((o, i) => {
      let tested = 0;
      for (let j = 0; j < 40 && tested < 8; j++) {
        const env = Object.fromEntries(vars.map((w) => [w, 1.3 + 9 * rng.next()]));
        const t = evalEx(target, env);
        const val = evalEx(o, env);
        if (!Number.isFinite(t) || !Number.isFinite(val)) continue;
        tested++;
        if (!close(t, val, 1e-8)) return [];
      }
      return tested > 0 ? [i] : [];
    });
    if (matches.length !== 1) return `${matches.length} matching choices`;
    return matches[0] === q.answer ? null : `expected ${matches[0]}`;
  },
};

export const simplifyFractionTemplate = simplifyFractionMCS;
export const simplifyFractionTraps: Record<string, Trap> = {
  'alg-fraction-term-cancel': {
    label: 'Cancelled a term against a term',
    fix: 'Only a factor that multiplies the whole numerator and the whole denominator can cancel. In $\\frac{x^2 - 9}{x + 3}$ the $x$ is a term, not a factor: factor $x^2 - 9 = (x - 3)(x + 3)$ first.',
  },
  'alg-divide-one-term': {
    label: 'Divided only one term of a sum',
    fix: 'Dividing a sum by a number divides EVERY term: $\\frac{6x^2 + 12x}{6x} = x + 2$, not $x + 12$.',
  },
  'alg-cancel-one-term': {
    label: 'Cancelled a factor from only one term',
    fix: 'A common factor of the denominator divides every term of the numerator: $\\frac{x^2 + 3x}{x} = x + 3$, not $x^2 + 3$ or $x + 3x$.',
  },
  'alg-forgot-divide': {
    label: 'Cancelled the variable but left the number',
    fix: 'Cancel the whole common factor, number included: in $\\frac{4x^2 + 8x}{4x}$ the 4 cancels too, giving $x + 2$.',
  },
  'alg-fraction-inverted': {
    label: 'Turned the fraction upside down',
    fix: 'After cancelling, the factor that is left in the numerator stays in the numerator. Test one value: $\\frac{(x + 2)^2}{x^2 - 4}$ at $x = 4$ is $\\frac{36}{12} = 3$, while $\\frac{x - 2}{x + 2}$ gives $\\frac{1}{3}$.',
  },
  'alg-lost-square': {
    label: 'Dropped a square without cancelling',
    fix: 'A square is two copies of a factor. Cancelling removes one copy; you cannot delete the other copy as well.',
  },
  'alg-dropped-denominator-factor': {
    label: 'Lost the factor that stays in the denominator',
    fix: 'After cancelling one factor, the other factor of the denominator remains: $\\frac{(x + 2)^2}{(x - 2)(x + 2)} = \\frac{x + 2}{x - 2}$.',
  },
  'alg-complex-sign-order': {
    label: 'Reversed the order of a subtraction',
    fix: '$\\frac{a}{x} - \\frac{b}{y}$ times $xy$ is $ay - bx$: each fraction is multiplied by the OTHER variable. Test with numbers to check the order.',
  },
  'alg-multiply-wrong-factor': {
    label: 'Multiplied a fraction by its own denominator\'s variable',
    fix: 'To clear $\\frac{a}{x}$ with the common denominator $xy$, multiply by $xy$: $x$ cancels and $y$ is left, so the result is $ay$, not $ax$.',
  },
  'alg-fraction-ignore-variables': {
    label: 'Ignored the variables in the denominators',
    fix: '$\\frac{a}{x}$ and $\\frac{b}{y}$ have different denominators, so they cannot be combined as $a$ and $b$. Use the common denominator $xy$.',
  },
};
