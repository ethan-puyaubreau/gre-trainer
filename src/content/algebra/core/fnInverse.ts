import { textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { lin, num } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';

/** Which expression is the inverse of a linear or fractional function (select one). */
type M = [number, number, number, number]; // (a x + b) / (c x + d)

interface InvParams {
  name: string;
  f: M;
  choices: M[];
}

const same = (p: M, q: M) => {
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (p[i] * q[j] - p[j] * q[i] !== 0) return false;
  return true;
};
/** Positive leading coefficient in the denominator, so the text is unique. */
const norm = (m: M): M => {
  const lead = m[2] !== 0 ? m[2] : m[3];
  return lead < 0 ? [-m[0], -m[1], -m[2], -m[3]] : m;
};
const texOf = (m0: M): string => {
  const [a, b, c, d] = norm(m0);
  const top = lin([[a, 'x'], [b, '']]);
  if (c === 0 && d === 1) return top;
  return `\\frac{${top}}{${lin([[c, 'x'], [d, '']])}}`;
};
const inverse = ([a, b, c, d]: M): M => [d, -b, -c, a];
const apply = ([a, b, c, d]: M, x: Frac): Frac | null => {
  const den = x.mul(c).add(d);
  return den.n === 0 ? null : x.mul(a).add(b).div(den);
};

const TRAP_TEXT: Record<string, string> = {
  'alg-fninv-reciprocal': 'taking the reciprocal $1/f(x)$ is not the inverse, because it does not undo $f$',
  'alg-fninv-order': 'undoing the operations in the wrong order leaves the constant in the wrong place',
  'alg-fninv-sign': 'moving a term across without changing its sign leaves the wrong constant',
  'alg-fninv-itself': 'renaming $y$ as $x$ without solving gives back $f$ itself',
  'alg-fninv-denominator': 'changing the sign of the constant in the numerator but not in the denominator breaks the swap',
};

const inverseMCS: Template<InvParams> = {
  id: 'alg.functions.inverse-mcs',
  skill: 'alg.functions',
  format: 'mcs',
  style: 'find the inverse function of a linear or fractional function',
  generate(rng, d) {
    for (;;) {
      const name = rng.pick(['f', 'g', 'h']);
      let f: M;
      const sg = () => rng.pick([-1, 1]);
      if (d === 1) f = [sg() * rng.int(2, 9), sg() * rng.int(1, 12), 0, 1];
      else if (d === 2) f = [sg() * rng.int(2, 7), sg() * rng.int(1, 9), 0, rng.int(2, 6)];
      else f = [sg() * rng.int(1, 5), sg() * rng.int(1, 8), rng.int(1, 3), sg() * rng.int(1, 6)];
      const [a, b, c, dd] = f;
      if (a * dd - b * c === 0) continue;
      if (d < 3 && Math.abs(a) === dd) continue;
      const good = inverse(f);
      const cand: [string, M | null][] = [
        ['alg-fninv-sign', [dd, b, -c, a]],
        ['alg-fninv-reciprocal', [c, dd, a, b]],
        ['alg-fninv-order', c === 0 ? [dd, -a * b, 0, a] : null],
        ['alg-fninv-denominator', c !== 0 ? [dd, -b, c, a] : null],
        ['alg-fninv-itself', f],
      ];
      const wrong: { trap: string; m: M }[] = [];
      for (const [trap, m] of cand) {
        if (!m) continue;
        if (m[0] * m[3] - m[1] * m[2] === 0 || same(m, good) || wrong.some((w) => same(w.m, m)) || texOf(m) === texOf(good)) continue;
        wrong.push({ trap, m });
      }
      if (wrong.length < 4) continue;
      const kept = wrong.slice(0, 4);
      const goodTex = `$${texOf(good)}$`;
      const ch = textChoices(rng, goodTex, kept.map((w): Choice => ({ text: `$${texOf(w.m)}$`, trap: w.trap })));
      const mats = ch.choices.map((c0) => (c0.text === goodTex ? good : kept.find((w) => `$${texOf(w.m)}$` === c0.text)!.m));
      // a worked check at a value where everything is defined
      let x0 = 2;
      let v: Frac | null = null;
      for (x0 = 2; x0 <= 9; x0++) {
        v = apply(good, new Frac(x0));
        if (v && apply(f, v)) break;
        v = null;
      }
      if (!v) continue;
      const fx = (m: M) => texOf(m);
      const steps =
        c === 0
          ? `Write $y = ${fx(f)}$. ${dd === 1 ? '' : `Multiply by $${dd}$ to get $${dd}y = ${lin([[a, 'x'], [b, '']])}$. `}${b > 0 ? `Subtract $${b}$` : `Add $${-b}$`} on both sides, then divide by $${num(a)}$: $x = ${texOf([dd, -b, 0, a]).replace(/x/g, 'y')}$.`
          : `Write $y = ${fx(f)}$ and clear the denominator: $y(${lin([[c, 'x'], [dd, '']])}) = ${lin([[a, 'x'], [b, '']])}$. Collect the $x$ terms and factor: $x(${lin([[c, 'y'], [-a, '']])}) = ${lin([[-dd, 'y'], [b, '']])}$. Divide: $x = ${texOf(good).replace(/x/g, 'y')}$.`;
      const cited = kept[0];
      const explanation = `The inverse undoes $${name}$, so solve $y = ${name}(x)$ for $x$ and then rename $y$ as $x$.

${steps} Renaming gives $${name}^{-1}(x) = ${texOf(good)}$.

Check at $x = ${x0}$: $${name}^{-1}(${x0}) = ${v.toTex()}$ and $${name}(${v.toTex()}) = ${x0}$.

Trap: ${TRAP_TEXT[cited.trap]}. Rule: the inverse swaps the roles of input and output, and $${name}(${name}^{-1}(x)) = x$ confirms it.`;
      return {
        q: {
          format: 'mcs',
          stem: `If $${name}(x) = ${texOf(f)}$, which of the following is the inverse function $${name}^{-1}(x)$?`,
          choices: ch.choices,
          answer: ch.answer,
          explanation,
        },
        params: { name, f, choices: mats },
      };
    }
  },
  check(q, { f, choices }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (choices.some((m, i) => q.choices[i].text !== `$${texOf(m)}$`)) return 'choice text mismatch';
    const hits: number[] = [];
    choices.forEach((m, i) => {
      let ok = true;
      let tested = 0;
      for (const t of [-7, -3, 2, 5, 11]) {
        const x = new Frac(t, 3);
        const y = apply(m, x);
        const back = y && apply(f, y);
        if (!back) continue;
        tested++;
        if (!back.eq(x)) ok = false;
      }
      if (ok && tested >= 3) hits.push(i);
    });
    return hits.length === 1 && hits[0] === q.answer ? null : `inverse hits ${hits}, key ${q.answer}`;
  },
};

export const inverseTemplates = [inverseMCS];

export const inverseTraps: Record<string, Trap> = {
  'alg-fninv-reciprocal': {
    label: 'Took the reciprocal instead of the inverse',
    fix: 'The inverse function undoes $f$: $f^{-1}(f(x)) = x$. The reciprocal $\\frac{1}{f(x)}$ is a different function.',
  },
  'alg-fninv-order': {
    label: 'Undid the operations of $f$ in the wrong order',
    fix: 'To undo "multiply, then add" subtract first, then divide. Solve $y = f(x)$ step by step, or test $f(f^{-1}(x)) = x$.',
  },
  'alg-fninv-sign': {
    label: 'Kept the sign of a constant when moving it across',
    fix: 'Undoing $+b$ means subtracting $b$ from both sides. Test the answer with $f(f^{-1}(x)) = x$.',
  },
  'alg-fninv-itself': {
    label: 'Gave back $f$ itself instead of solving for $x$',
    fix: 'Swapping the names $x$ and $y$ is the last step. First solve $y = f(x)$ for $x$.',
  },
  'alg-fninv-denominator': {
    label: 'Changed the sign in the numerator but not in the denominator',
    fix: 'For $y = \\frac{ax + b}{cx + d}$ the inverse is $\\frac{dy - b}{-cy + a}$: both the constant on top and the $x$ term below change sign.',
  },
};
