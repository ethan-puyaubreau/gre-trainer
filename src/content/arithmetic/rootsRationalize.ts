import { textChoices } from '../../engine/build';
import { gcd } from '../../engine/math';
import type { Template, Trap } from '../../engine/types';

export const rootsRationalizeTraps: Record<string, Trap> = {
  'root-rationalize-no-divide': {
    label: 'Multiplied the top by $\\sqrt{r}$ and forgot the denominator',
    fix: 'Multiplying top and bottom by $\\sqrt{r}$ turns the denominator into $\\sqrt{r}\\cdot\\sqrt{r} = r$. Keep that denominator: $\\frac{5}{\\sqrt{3}} = \\frac{5\\sqrt{3}}{3}$.',
  },
  'root-rationalize-dropped': {
    label: 'Dropped the radical from the numerator',
    fix: 'The numerator gets the factor $\\sqrt{r}$ as well: $\\frac{5}{\\sqrt{3}}\\cdot\\frac{\\sqrt{3}}{\\sqrt{3}} = \\frac{5\\sqrt{3}}{3}$, not $\\frac{5}{3}$.',
  },
  'root-rationalize-bottom-only': {
    label: 'Multiplied only the denominator by $\\sqrt{r}$',
    fix: 'To keep the value, multiply top AND bottom by the same number. Changing only the bottom changes the fraction.',
  },
  'root-conjugate-sign': {
    label: 'Used the wrong sign in the conjugate',
    fix: 'The conjugate of $\\sqrt{a} + b$ is $\\sqrt{a} - b$: only the sign between the terms changes, and the product $a - b^2$ has no radical.',
  },
  'root-conjugate-no-divide': {
    label: 'Forgot to divide by the new denominator',
    fix: 'After multiplying by the conjugate the denominator is a difference of squares, such as $a - b^2$. Divide the numerator by it.',
  },
  'root-conjugate-denominator-sum': {
    label: 'Added the squares in the new denominator',
    fix: '$(\\sqrt{a} + b)(\\sqrt{a} - b) = a - b^2$, a DIFFERENCE of squares. The middle terms cancel, the squares do not add.',
  },
  'root-distribute-miss': {
    label: 'Multiplied only one term by the numerator factor',
    fix: 'When the numerator factor is $m$, it multiplies every term of the bracket: $m(\\sqrt{a} - b) = m\\sqrt{a} - mb$.',
  },
};

type Terms = [number, number][]; // [coefficient, radicand]; radicand 1 is a plain number

interface Cand {
  text: string;
  value: number;
  trap?: string;
}

interface Params {
  /** the original expression: num / (sign1 sqrt(a) + sign2 sqrt(b) or constant) */
  num: number;
  a: number;
  b: number; // radicand of the second term, or 1 for a constant
  c: number; // constant (second term when b = 1); 0 when absent
  sign: 1 | -1;
  kind: 'single' | 'const' | 'radical';
  /** values of the five choices, in display order */
  values: number[];
  answer: number;
}

const rad = (c: number, r: number) => (r === 1 ? `${c}` : c === 1 ? `\\sqrt{${r}}` : `${c}\\sqrt{${r}}`);
function exTex(terms: Terms, den = 1): string {
  const ts = [...terms].sort((x, y) => (x[1] === 1 ? 1 : 0) - (y[1] === 1 ? 1 : 0));
  const s = ts.map(([c, r], i) => `${i === 0 ? (c < 0 ? '-' : '') : c < 0 ? ' - ' : ' + '}${rad(Math.abs(c), r)}`).join('');
  return den > 1 ? `\\frac{${s}}{${den}}` : s;
}
const exVal = (terms: Terms, den = 1) => terms.reduce((s, [c, r]) => s + c * Math.sqrt(r), 0) / den;
const cand = (terms: Terms, den: number, trap?: string): Cand => ({ text: `$${exTex(terms, den)}$`, value: exVal(terms, den), trap });

const R1 = [2, 3, 5, 6, 7, 10, 11, 13];
const R2 = [3, 5, 6, 7, 10, 11, 13, 14, 15];

const rationalize: Template<Params> = {
  id: 'arith.roots.rationalize-mcs',
  skill: 'arith.roots',
  format: 'mcs',
  style: 'remove the radical from a denominator',
  generate(rng, d) {
    let stemExpr: string;
    let correct: Cand;
    let wrong: Cand[];
    let params: Omit<Params, 'values' | 'answer'>;
    let work: string;
    let trapNote: string;
    if (d === 1) {
      const r = rng.pick(R1);
      const p = rng.int(2, 19);
      const g = gcd(p, r);
      const pr = p / g;
      const rr = r / g;
      stemExpr = `\\frac{${p}}{\\sqrt{${r}}}`;
      const fracTex = rr === 1 ? exTex([[pr, r]]) : exTex([[pr, r]], rr);
      correct = { text: `$${fracTex}$`, value: p / Math.sqrt(r) };
      wrong = [
        cand([[p, r]], 1, 'root-rationalize-no-divide'),
        { text: `$${rr === 1 ? pr : `\\frac{${pr}}{${rr}}`}$`, value: p / r, trap: 'root-rationalize-dropped' },
        { text: `$\\frac{${p}}{${r}\\sqrt{${r}}}$`, value: p / (r * Math.sqrt(r)), trap: 'root-rationalize-bottom-only' },
        { text: `$\\frac{\\sqrt{${p * r}}}{${r}}$`, value: Math.sqrt(p * r) / r, trap: 'radical-coefficient' },
      ];
      params = { num: p, a: r, b: 1, c: 0, sign: 1, kind: 'single' };
      work = `Multiply top and bottom by $\\sqrt{${r}}$, which multiplies the fraction by 1 and turns the denominator into $\\sqrt{${r}}\\cdot\\sqrt{${r}} = ${r}$: $\\frac{${p}}{\\sqrt{${r}}} = \\frac{${p}\\sqrt{${r}}}{${r}}$${g > 1 ? `, which reduces to $${fracTex}$` : ''}.`;
      trapNote = `Stopping at $${exTex([[p, r]])}$ forgets the denominator ${r}.`;
    } else if (d === 2) {
      const r = rng.pick(R2);
      const s = rng.int(1, 4);
      if (r <= s * s) return rationalize.generate(rng, d);
      const m = rng.int(2, 6);
      const sg = rng.sign();
      const k = r - s * s;
      const p = m * k;
      stemExpr = `\\frac{${p}}{\\sqrt{${r}} ${sg > 0 ? '+' : '-'} ${s}}`;
      correct = cand([[m, r], [-sg * m * s, 1]], 1);
      wrong = [
        cand([[m, r], [sg * m * s, 1]], 1, 'root-conjugate-sign'),
        cand([[p, r], [-sg * p * s, 1]], 1, 'root-conjugate-no-divide'),
        cand([[p, r], [-sg * p * s, 1]], r + s * s, 'root-conjugate-denominator-sum'),
        cand([[m, r], [-sg * s, 1]], 1, 'root-distribute-miss'),
      ];
      params = { num: p, a: r, b: 1, c: s, sign: sg, kind: 'const' };
      work = `Multiply top and bottom by the conjugate $\\sqrt{${r}} ${sg > 0 ? '-' : '+'} ${s}$. The denominator becomes $${r} - ${s * s} = ${k}$, with no radical. Since $${p} \\div ${k} = ${m}$, the result is $${m}\\left(\\sqrt{${r}} ${sg > 0 ? '-' : '+'} ${s}\\right) = ${exTex([[m, r], [-sg * m * s, 1]])}$.`;
      trapNote = `The new denominator is a difference of squares, ${r} minus ${s * s}, and the factor ${m} multiplies both terms.`;
    } else {
      const pairs: [number, number][] = [];
      for (const a of R2) for (const b of R2) if (a > b && a - b <= 9) pairs.push([a, b]);
      const [a, b] = rng.pick(pairs);
      const m = rng.int(2, 6);
      const sg = rng.sign();
      const k = a - b;
      const p = m * k;
      stemExpr = `\\frac{${p}}{\\sqrt{${a}} ${sg > 0 ? '+' : '-'} \\sqrt{${b}}}`;
      correct = cand([[m, a], [-sg * m, b]], 1);
      wrong = [
        cand([[m, a], [sg * m, b]], 1, 'root-conjugate-sign'),
        cand([[p, a], [-sg * p, b]], 1, 'root-conjugate-no-divide'),
        cand([[p, a], [-sg * p, b]], a + b, 'root-conjugate-denominator-sum'),
        cand([[m, a], [-sg, b]], 1, 'root-distribute-miss'),
      ];
      params = { num: p, a, b, c: 0, sign: sg, kind: 'radical' };
      work = `Multiply top and bottom by the conjugate $\\sqrt{${a}} ${sg > 0 ? '-' : '+'} \\sqrt{${b}}$. The denominator becomes $${a} - ${b} = ${k}$, with no radical. Since $${p} \\div ${k} = ${m}$, the result is $${exTex([[m, a], [-sg * m, b]])}$.`;
      trapNote = `The new denominator is ${a} minus ${b}, not ${a} plus ${b}, and the factor ${m} multiplies both terms.`;
    }
    // Four distinct, different-from-key wrong values or start over.
    const same = (x: number, y: number) => Math.abs(x - y) < 1e-9;
    const uniq: Cand[] = [];
    for (const c of wrong) if (!same(c.value, correct.value) && !uniq.some((u) => same(u.value, c.value) || u.text === c.text)) uniq.push(c);
    if (uniq.length < 4 || uniq.some((c) => c.text === correct.text)) return rationalize.generate(rng, d);
    const { choices, answer } = textChoices(
      rng,
      correct.text,
      uniq.map((c) => ({ text: c.text, trap: c.trap! })),
    );
    const byText = new Map<string, number>([[correct.text, correct.value], ...uniq.map((c) => [c.text, c.value] as [string, number])]);
    const values = choices.map((c) => byText.get(c.text)!);
    const approx = (x: number) => x.toFixed(2);
    return {
      params: { ...params, values, answer },
      q: {
        format: 'mcs',
        stem: `Which of the following is equal to $${stemExpr}$?`,
        choices,
        answer,
        explanation: `A radical in a denominator can be cleared by multiplying by 1 in a useful form.

${work}

Check: $${stemExpr} \\approx ${approx(correct.value)}$ and the result is also about ${approx(correct.value)}.

Trap: ${trapNote}

Rule: use $\\sqrt{r}$ for a lone radical, or the conjugate for a sum or difference.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    const den = p.kind === 'single' ? Math.sqrt(p.a) : p.kind === 'const' ? Math.sqrt(p.a) + p.sign * p.c : Math.sqrt(p.a) + p.sign * Math.sqrt(p.b);
    const original = p.num / den;
    const ok = p.values.map((v, i) => [i, Math.abs(v - original) < 1e-9] as const).filter(([, hit]) => hit);
    if (ok.length !== 1) return `${ok.length} choices equal the expression`;
    return ok[0][0] === q.answer ? null : `answer should be ${ok[0][0]}`;
  },
};

export const rootsRationalizeTemplates = [rationalize];
