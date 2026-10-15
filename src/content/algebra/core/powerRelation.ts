import { textChoices } from '../../../engine/build';
import { lin, num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { close } from './util';

/* Several powers of the same base hidden behind different bases: which relation between the exponents must hold? (MCS) */

type Form = 'product' | 'quotient' | 'pow' | 'mixed';
type Key = 'X' | 'Y' | 'Z' | 'XY' | '';
type Term = [number, Key];

interface Eq {
  l: Term[];
  r: Term[];
}

interface P {
  form: Form;
  g: number;
  es: number[];
  names: string[];
  options: Eq[];
}

interface Opt extends Eq {
  trap: string;
  why: string;
}

const NAMES = [['a', 'b', 'c'], ['x', 'y', 'z'], ['m', 'n', 'p'], ['j', 'k', 'l'], ['r', 's', 't'], ['u', 'v', 'w']];
const FORMS = { 1: ['product'], 2: ['product', 'quotient', 'quotient'], 3: ['pow', 'mixed', 'quotient', 'mixed', 'pow'] } as const;

const mono = (k: Key, v: { X: number; Y: number; Z: number }) => (k === '' ? 1 : k === 'XY' ? v.X * v.Y : v[k]);
const evalEq = (e: Eq, v: { X: number; Y: number; Z: number }) => e.l.reduce((s, [c, k]) => s + c * mono(k, v), 0) - e.r.reduce((s, [c, k]) => s + c * mono(k, v), 0);

function eqTex(e: Eq, names: string[]): string {
  const nm = (k: Key) => (k === 'X' ? names[0] : k === 'Y' ? names[1] : k === 'Z' ? names[2] : k === 'XY' ? names[0] + names[1] : '');
  const side = (ts: Term[]) => lin(ts.map(([c, k]) => [c, nm(k)] as [number, string]));
  return `${side(e.l)} = ${side(e.r)}`;
}

/** The unique z that makes the original equation true for given x and y, computed from the actual bases with logarithms. */
function solveZ(form: Form, g: number, es: number[], x: number, y: number): number {
  const B = es.map((e) => Math.log(g ** e));
  if (form === 'product') return (x * B[0] + y * B[1]) / B[2];
  if (form === 'quotient') return (x * B[0] - y * B[1]) / B[2];
  if (form === 'pow') return (x * y * B[0]) / B[2];
  return (x * B[0] + y * B[1] - es[3] * Math.log(g)) / B[2];
}

const powerRelationMCS: Template<P> = {
  id: 'alg.exponent-equations.relation-mcs',
  skill: 'alg.exponent-equations',
  format: 'mcs',
  style: 'which relation between the exponents follows from an equation of powers',
  generate(rng, d) {
    for (;;) {
      const form = rng.pick(FORMS[d]) as Form;
      const g = d === 1 ? 2 : rng.pick([2, 2, 3]);
      const emax = g === 2 ? 4 : 3;
      const es = Array.from({ length: form === 'mixed' ? 4 : 3 }, () => rng.int(1, d === 1 ? 3 : emax));
      if (es[0] === es[1] && form !== 'pow') continue;
      if (es.slice(0, 3).every((e) => e === 1)) continue;
      if (form === 'mixed' && (es[3] < 2 || es[3] > 5)) continue;
      if (form === 'pow' && es[0] === 1) continue;
      if (d === 1 && new Set(es).size < 3) continue;
      const [e1, e2, e3] = es;
      const e4 = es[3];
      const [X, Y, Z] = rng.pick(NAMES);
      const names = [X, Y, Z];
      const correct: Eq =
        form === 'product'
          ? { l: [[e1, 'X'], [e2, 'Y']], r: [[e3, 'Z']] }
          : form === 'quotient'
            ? { l: [[e1, 'X'], [-e2, 'Y']], r: [[e3, 'Z']] }
            : form === 'pow'
              ? { l: [[e1, 'XY']], r: [[e3, 'Z']] }
              : { l: [[e1, 'X'], [e2, 'Y'], [-e3, 'Z']], r: [[e4, '']] };
      const cand: Opt[] = [];
      const B = (e: number) => g ** e;
      if (form === 'product' || form === 'quotient') {
        const s = form === 'product' ? 1 : -1;
        cand.push({ l: [[1, 'X'], [s, 'Y']], r: [[1, 'Z']], trap: 'alg-ignore-base', why: 'equating the exponents although the bases differ' });
        cand.push({ l: [[e1, 'X'], [s * e2, 'Y']], r: [[1, 'Z']], trap: 'alg-relation-rhs-unconverted', why: `converting the left side to base ${g} but leaving the right-hand exponent as it is` });
        cand.push({ l: [[e1, 'X'], [s, 'Y']], r: [[e3, 'Z']], trap: 'alg-relation-lhs-unconverted', why: `converting only the first left-hand base to base ${g}` });
        cand.push({ l: [[1, 'X'], [s * e2, 'Y']], r: [[e3, 'Z']], trap: 'alg-relation-lhs-unconverted', why: `converting only the second left-hand base to base ${g}` });
        if (form === 'product') {
          cand.push({ l: [[e1 * e2, 'XY']], r: [[e3, 'Z']], trap: 'alg-relation-exponents-multiplied', why: 'multiplying the exponents of the two factors instead of adding them' });
          cand.push({ l: [[e3 * e1, 'X'], [e3 * e2, 'Y']], r: [[1, 'Z']], trap: 'alg-relation-wrong-side', why: `multiplying the left side by ${e3}, although the factor ${e3} belongs with the right-hand exponent` });
        } else {
          cand.push({ l: [[e1, 'X'], [e2, 'Y']], r: [[e3, 'Z']], trap: 'alg-relation-sign', why: 'adding the exponents although the powers are divided' });
          cand.push({ l: [[e3 * e1, 'X'], [-e3 * e2, 'Y']], r: [[1, 'Z']], trap: 'alg-relation-wrong-side', why: `multiplying the left side by ${e3}, although the factor ${e3} belongs with the right-hand exponent` });
        }
      } else if (form === 'pow') {
        cand.push({ l: [[1, 'XY']], r: [[1, 'Z']], trap: 'alg-ignore-base', why: 'equating the exponents although the bases differ' });
        cand.push({ l: [[e1, 'XY']], r: [[1, 'Z']], trap: 'alg-relation-rhs-unconverted', why: `converting the left side to base ${g} but leaving the right-hand exponent as it is` });
        cand.push({ l: [[1, 'XY']], r: [[e3, 'Z']], trap: 'alg-relation-lhs-unconverted', why: `converting the right side but not the base on the left` });
        cand.push({ l: [[e1, 'X'], [e1, 'Y']], r: [[e3, 'Z']], trap: 'alg-power-of-power-added', why: 'adding the two exponents of a power of a power instead of multiplying them' });
      } else {
        cand.push({ l: [[1, 'X'], [1, 'Y'], [-1, 'Z']], r: [[B(e4), '']], trap: 'alg-ignore-base', why: 'equating the exponents although the bases differ' });
        cand.push({ l: [[e1, 'X'], [e2, 'Y'], [-e3, 'Z']], r: [[B(e4), '']], trap: 'alg-relation-rhs-unconverted', why: `leaving ${B(e4)} as it is instead of writing it as $${g}^{${e4}}$` });
        cand.push({ l: [[e1, 'X'], [e2, 'Y'], [e3, 'Z']], r: [[e4, '']], trap: 'alg-relation-sign', why: 'adding the exponent of the denominator instead of subtracting it' });
        cand.push({ l: [[e1, 'X'], [1, 'Y'], [-e3, 'Z']], r: [[e4, '']], trap: 'alg-relation-lhs-unconverted', why: 'converting only the first factor of the numerator' });
        cand.push({ l: [[1, 'X'], [e2, 'Y'], [-e3, 'Z']], r: [[e4, '']], trap: 'alg-relation-lhs-unconverted', why: 'converting only the second factor of the numerator' });
        cand.push({ l: [[e1, 'X'], [e2, 'Y'], [-e3, 'Z']], r: [], trap: 'alg-relation-constant-dropped', why: `dropping the ${B(e4)} on the right side` });
      }
      // keep the wrong equations that really fail, are distinct, and carry different traps first
      const pts = [[1.3, 0.7], [2.1, 3.4], [0.6, 1.9]];
      const holds = (e: Eq) => pts.every(([x, y]) => close(evalEq(e, { X: x, Y: y, Z: solveZ(form, g, es, x, y) }), 0, 1e-9));
      if (!holds(correct)) throw new Error('correct relation does not hold');
      const texts = new Set([eqTex(correct, names)]);
      const kept: Opt[] = [];
      const ordered = rng.shuffle(cand);
      for (const pass of [0, 1]) {
        for (const c of ordered) {
          if (kept.length === 4) break;
          const t = eqTex(c, names);
          if (texts.has(t) || holds(c)) continue;
          if (pass === 0 && kept.some((k) => k.trap === c.trap)) continue;
          texts.add(t);
          kept.push(c);
        }
      }
      if (kept.length < 4) continue;
      const { choices, answer } = textChoices(
        rng,
        `$${eqTex(correct, names)}$`,
        kept.map((k) => ({ text: `$${eqTex(k, names)}$`, trap: k.trap })),
      );
      // an integer solution, to show the trap concretely
      let sol: [number, number, number] | null = null;
      const baseOf = (e: number) => BigInt(g) ** BigInt(e);
      for (let x = 1; x <= 8 && !sol; x++)
        for (let y = 1; y <= 8 && !sol; y++)
          for (let z = 1; z <= 24 && !sol; z++) {
            const lhs = form === 'product' ? baseOf(e1) ** BigInt(x) * baseOf(e2) ** BigInt(y) : form === 'quotient' ? baseOf(e1) ** BigInt(x) : form === 'pow' ? baseOf(e1) ** BigInt(x * y) : baseOf(e1) ** BigInt(x) * baseOf(e2) ** BigInt(y);
            const rhs = form === 'product' || form === 'pow' ? baseOf(e3) ** BigInt(z) : form === 'quotient' ? baseOf(e3) ** BigInt(z) * baseOf(e2) ** BigInt(y) : baseOf(e3) ** BigInt(z) * baseOf(e4);
            if (lhs === rhs) sol = [x, y, z];
          }
      const cited = kept[0];
      const fmt = (t: Term[], v: { X: number; Y: number; Z: number }) => t.reduce((s, [c, k]) => s + c * mono(k, v), 0);
      const trapNote = sol
        ? ` For $${X} = ${sol[0]}$, $${Y} = ${sol[1]}$, $${Z} = ${sol[2]}$ the original equation is true, but the sides of this choice are $${num(fmt(cited.l, { X: sol[0], Y: sol[1], Z: sol[2] }))}$ and $${num(fmt(cited.r, { X: sol[0], Y: sol[1], Z: sol[2] }))}$.`
        : '';
      const nb = (e: number) => `${B(e)}`;
      const eList = [...new Set(form === 'mixed' ? [e1, e2, e3, e4] : [e1, e2, e3])].filter((e) => e !== 1);
      const convs = eList.map((e) => `$${B(e)} = ${g}^{${e}}$`);
      const stem =
        form === 'product'
          ? `If $${nb(e1)}^{${X}} \\cdot ${nb(e2)}^{${Y}} = ${nb(e3)}^{${Z}}$, which of the following must be true?`
          : form === 'quotient'
            ? `If $\\dfrac{${nb(e1)}^{${X}}}{${nb(e2)}^{${Y}}} = ${nb(e3)}^{${Z}}$, which of the following must be true?`
            : form === 'pow'
              ? `If $\\left(${nb(e1)}^{${X}}\\right)^{${Y}} = ${nb(e3)}^{${Z}}$, which of the following must be true?`
              : `If $\\dfrac{${nb(e1)}^{${X}} \\cdot ${nb(e2)}^{${Y}}}{${nb(e3)}^{${Z}}} = ${nb(e4)}$, which of the following must be true?`;
      const how =
        form === 'product'
          ? 'Multiplying powers of the same base adds the exponents'
          : form === 'quotient'
            ? 'Dividing powers of the same base subtracts the exponents'
            : form === 'pow'
              ? 'A power of a power multiplies the exponents'
              : `Multiplying adds the exponents, dividing subtracts them, and $${nb(e4)} = ${g}^{${e4}}$`;
      return {
        params: { form, g, es, names, options: [correct, ...kept].map(({ l, r }) => ({ l, r })) },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer,
          explanation: `The bases differ, so write every power with base ${g}: ${convs.join(', ')}.

${how}, so the equation becomes $${g}^{${form === 'quotient' ? `${lin([[e1, X], [-e2, Y]])}` : form === 'pow' ? lin([[e1, X + Y]]) : form === 'product' ? lin([[e1, X], [e2, Y]]) : lin([[e1, X], [e2, Y], [-e3, Z]])}} = ${g}^{${form === 'mixed' ? e4 : lin([[e3, Z]])}}$. Equal powers of ${g} have equal exponents, which gives $${eqTex(correct, names)}$.

Trap: $${eqTex(cited, names)}$ comes from ${cited.why}.${trapNote}

Rule: write every power with one base, combine with the exponent rules, then equate the exponents.`,
        },
      };
    }
  },
  check(q, { form, g, es, names, options }, rng) {
    if (q.format !== 'mcs') return 'wrong format';
    if (q.choices.length !== 5) return 'five choices expected';
    const holding: number[] = [];
    q.choices.forEach((c, i) => {
      // find the option with this text
      const opt = options.find((o) => `$${eqTex(o, names)}$` === c.text);
      if (!opt) return;
      let ok = true;
      for (let j = 0; j < 6 && ok; j++) {
        const x = 0.4 + 3 * rng.next();
        const y = 0.4 + 3 * rng.next();
        const z = solveZ(form, g, es, x, y);
        ok = close(evalEq(opt, { X: x, Y: y, Z: z }), 0, 1e-9);
      }
      if (ok) holding.push(i);
    });
    if (q.choices.some((c) => !options.some((o) => `$${eqTex(o, names)}$` === c.text))) return 'choice not in params';
    if (holding.length !== 1) return `${holding.length} choices hold`;
    return holding[0] === q.answer ? null : `expected ${holding[0]}`;
  },
};

export const powerRelationTemplate = powerRelationMCS;
export const powerRelationTraps: Record<string, Trap> = {
  'alg-relation-rhs-unconverted': {
    label: 'Converted one side to a common base but not the other',
    fix: 'Every power in the equation must be written with the same base, including the one on the right: $4^{c} = 2^{2c}$, so the right-hand exponent is $2c$, not $c$.',
  },
  'alg-relation-lhs-unconverted': {
    label: 'Left one base unconverted',
    fix: 'Convert EVERY base: in $2^{a} \\cdot 8^{b}$ the second factor is $2^{3b}$, so the exponent sum is $a + 3b$, not $a + b$.',
  },
  'alg-relation-exponents-multiplied': {
    label: 'Multiplied the exponents of two factors',
    fix: 'For $g^{m} \\cdot g^{n}$ the exponents are added. Exponents multiply only for a power of a power, $(g^{m})^{n}$.',
  },
  'alg-relation-wrong-side': {
    label: 'Put the conversion factor on the wrong side',
    fix: 'If $4^{c} = 2^{2c}$, the equation $2^{a + 3b} = 2^{2c}$ gives $a + 3b = 2c$; do not multiply the left side by 2.',
  },
  'alg-relation-sign': {
    label: 'Added the exponent of a divisor',
    fix: 'Dividing powers of the same base subtracts the exponents: $\\frac{2^{a}}{8^{c}} = 2^{a - 3c}$.',
  },
  'alg-power-of-power-added': {
    label: '$(g^{m})^{n} = g^{m + n}$',
    fix: 'A power of a power multiplies the exponents: $(g^{m})^{n} = g^{mn}$. Test: $(2^{2})^{3} = 64 = 2^{6}$, not $2^{5}$.',
  },
  'alg-relation-constant-dropped': {
    label: 'Lost the constant on the other side',
    fix: 'A constant such as 16 is also a power ($2^{4}$): it adds 4 to the exponent equation and cannot be dropped.',
  },
};
