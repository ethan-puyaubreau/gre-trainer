import { textChoices } from '../../../engine/build';
import type { Template, Trap } from '../../../engine/types';

export const exponentsConvertTraps: Record<string, Trap> = {
  'int-base-not-converted': {
    label: 'Added or subtracted exponents of different bases',
    fix: 'Exponents combine only when the bases match. Write each base as a power of the same prime first: $4^{3} = (2^{2})^{3} = 2^{6}$, not $2^{3}$.',
  },
  'int-power-added-not-multiplied': {
    label: '$(a^{m})^{n} = a^{m + n}$',
    fix: 'A power of a power multiplies the exponents: $(2^{3})^{2} = 2^{6}$, while $2^{3} \\cdot 2^{2} = 2^{5}$.',
  },
  'int-denominator-added': {
    label: 'Added the exponent of the denominator',
    fix: 'Dividing powers of the same base subtracts exponents: $\\frac{2^{9}}{2^{4}} = 2^{5}$, not $2^{13}$.',
  },
  'int-subtraction-order': {
    label: 'Subtracted the exponents in the wrong order',
    fix: 'The numerator exponent comes first: $\\frac{2^{4}}{2^{9}} = 2^{4 - 9} = 2^{-5}$. A negative exponent means the denominator has more factors.',
  },
  'int-multiplied-exponents': {
    label: 'Multiplied exponents of a product',
    fix: 'A product of powers with the same base ADDS exponents: $2^{3} \\cdot 2^{4} = 2^{7}$, not $2^{12}$.',
  },
  'int-power-first-factor': {
    label: 'Applied the outer exponent to the first factor only',
    fix: 'An exponent outside brackets applies to every factor inside: $(2^{3} \\cdot 2^{4})^{2} = 2^{14}$.',
  },
};

interface Factor {
  /** the base is beta^l */
  l: number;
  e: number;
}
interface Params {
  beta: number;
  N: Factor[];
  D: Factor[];
  p: number;
  q: number;
  exps: number[];
  answer: number;
}

const pow = (beta: number, k: number) => (k === 1 ? `${beta}` : `${beta}^{${k}}`);
const baseOf = (beta: number, l: number) => beta ** l;
const side = (beta: number, fs: Factor[], outer: number) => {
  const inner = fs.map((f) => `${baseOf(beta, f.l)}^{${f.e}}`).join(' \\cdot ');
  return outer > 1 ? `\\left(${inner}\\right)^{${outer}}` : inner;
};
const total = (fs: Factor[]) => fs.reduce((s, f) => s + f.l * f.e, 0);

const convert: Template<Params> = {
  id: 'arith.exponents.convert-base-mcs',
  skill: 'arith.exponents',
  format: 'mcs',
  style: 'write a quotient of powers with different bases as one power',
  generate(rng, d) {
    const beta = rng.pick([2, 2, 3]);
    const maxL = beta === 2 ? 4 : 3;
    const mk = (n: number, eMax: number): Factor[] => {
      const ls = rng.sample(Array.from({ length: maxL }, (_, i) => i + 1), n);
      return ls.map((l) => ({ l, e: rng.int(2, eMax) }));
    };
    let N: Factor[];
    let D: Factor[];
    let p = 1;
    let q = 1;
    if (d === 1) {
      N = mk(2, 6);
      D = mk(1, 6);
    } else if (d === 2) {
      if (rng.chance(0.5)) {
        N = mk(2, 5);
        D = mk(1, 5);
        p = rng.int(2, 3);
      } else {
        N = mk(1, 5);
        D = mk(2, 5);
        p = rng.int(2, 3);
      }
    } else {
      N = mk(2, 4);
      D = mk(rng.int(1, 2), 4);
      p = rng.int(2, 3);
      q = rng.int(2, 3);
    }
    const SN = total(N);
    const SD = total(D);
    const k = p * SN - q * SD;
    if (k === 0 || Math.abs(k) > 36 || p * SN > 40) return convert.generate(rng, d);
    const pool: { x: number; trap: string }[] = [
      { x: p * N.reduce((s, f) => s + f.e, 0) - q * D.reduce((s, f) => s + f.e, 0), trap: 'int-base-not-converted' },
      { x: SN + p - (SD + q), trap: 'int-power-added-not-multiplied' },
      { x: p * SN + q * SD, trap: 'int-denominator-added' },
      { x: -k, trap: 'int-subtraction-order' },
      { x: p * N.reduce((s, f) => s * f.l * f.e, 1) - q * SD, trap: 'int-multiplied-exponents' },
      { x: p * N[0].l * N[0].e + (SN - N[0].l * N[0].e) - q * SD, trap: 'int-power-first-factor' },
    ];
    const seen = new Set<number>([k, 0]);
    const wrong: { x: number; trap: string }[] = [];
    for (const c of rng.shuffle(pool)) {
      if (Math.abs(c.x) > 40 || seen.has(c.x)) continue;
      seen.add(c.x);
      wrong.push(c);
    }
    if (wrong.length < 4) return convert.generate(rng, d);
    const picked = wrong.slice(0, 4);
    const { choices, answer } = textChoices(
      rng,
      `$${pow(beta, k)}$`,
      picked.map((c) => ({ text: `$${pow(beta, c.x)}$`, trap: c.trap })),
    );
    const exps = choices.map((c) => [k, ...picked.map((w) => w.x)].find((x) => `$${pow(beta, x)}$` === c.text)!);
    const used = Array.from(new Set([...N, ...D].map((f) => f.l))).filter((l) => l > 1);
    const conv = used.map((l) => `$${baseOf(beta, l)} = ${beta}^{${l}}$`).join(', ');
    const part = (fs: Factor[], outer: number) => {
      const terms = fs.map((f) => (f.l === 1 ? `${beta}^{${f.e}}` : `(${beta}^{${f.l}})^{${f.e}}`)).join(' \\cdot ');
      const s = total(fs);
      return `$${terms === `${beta}^{${s}}` ? terms : `${terms} = ${beta}^{${s}}`}$${outer > 1 ? `, and $(${beta}^{${s}})^{${outer}} = ${beta}^{${outer * s}}$` : ''}`;
    };
    const slip = picked[0];
    const slipText: Record<string, string> = {
      'int-base-not-converted': 'adding exponents of different bases',
      'int-power-added-not-multiplied': 'adding a power-of-a-power exponent',
      'int-denominator-added': 'adding the denominator exponent',
      'int-subtraction-order': 'subtracting in the wrong order',
      'int-multiplied-exponents': 'multiplying exponents of a product',
      'int-power-first-factor': 'raising only the first factor to the outer power',
    };
    return {
      params: { beta, N, D, p, q, exps, answer },
      q: {
        format: 'mcs',
        stem: `Which of the following is equal to $\\frac{${side(beta, N, p)}}{${side(beta, D, q)}}$?`,
        choices,
        answer,
        explanation: `The bases differ, so write each one as a power of ${beta}: ${conv}.

Numerator: ${part(N, p)}. Denominator: ${part(D, q)}. Dividing subtracts exponents: $${beta}^{${p * SN} - ${q * SD}} = ${pow(beta, k)}$.

Check: $${p * SN}$ factors of ${beta} on top and $${q * SD}$ on the bottom leave $${k}$ net factors of ${beta} on top.

Trap: ${slipText[slip.trap]} leads to $${pow(beta, slip.x)}$.

Rule: same base first, then add, multiply or subtract exponents.`,
      },
    };
  },
  check(q, { beta, N, D, p, q: qq, exps }) {
    if (q.format !== 'mcs') return 'wrong format';
    const big = (fs: Factor[], outer: number) => fs.reduce((v, f) => v * BigInt(beta ** f.l) ** BigInt(f.e), 1n) ** BigInt(outer);
    const Nv = big(N, p);
    const Dv = big(D, qq);
    const hits = exps.map((x, i) => [i, x >= 0 ? Nv === Dv * BigInt(beta) ** BigInt(x) : Nv * BigInt(beta) ** BigInt(-x) === Dv] as const).filter(([, ok]) => ok);
    if (hits.length !== 1) return `${hits.length} choices equal the quotient`;
    return hits[0][0] === q.answer ? null : `answer should be ${hits[0][0]}`;
  },
};

export const exponentsConvertTemplates = [convert];
