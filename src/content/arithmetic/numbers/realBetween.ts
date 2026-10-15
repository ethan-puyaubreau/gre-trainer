import { textChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import type { Template, Trap } from '../../../engine/types';

export const realBetweenTraps: Record<string, Trap> = {
  'num-endpoint-between': {
    label: 'Counted an endpoint as "between"',
    fix: '"Between $a$ and $b$" excludes $a$ and $b$. A number equal to an endpoint, even written differently ($0.30$ for $0.3$, $\\frac{2}{6}$ for $\\frac{1}{3}$), is not between.',
  },
  'num-decimal-longer-larger': {
    label: 'Thought the decimal with more digits is larger',
    fix: 'Line up the decimal places before comparing: $0.25 < 0.3$ because $0.25 < 0.30$, even though $25 > 3$.',
  },
  'num-larger-denominator-larger': {
    label: 'Misjudged fractions that have the same numerator',
    fix: 'With the same numerator, a LARGER denominator means a SMALLER fraction: $\\frac{1}{5} < \\frac{1}{3}$. Convert to decimals or a common denominator to compare.',
  },
};

interface Params {
  L: [number, number];
  U: [number, number];
  vals: [number, number][];
}

const dec2 = (n: number, s: 1 | -1) => `${s < 0 ? '-' : ''}0.${n < 10 ? '0' : ''}${n}`;
const dec1 = (n: number, s: 1 | -1) => `${s < 0 ? '-' : ''}0.${n}`;
const ft = (n: number, d: number) => `\\frac{${n}}{${d}}`;

const between: Template<Params> = {
  id: 'arith.real-numbers.between-mcs',
  skill: 'arith.real-numbers',
  format: 'mcs',
  style: 'which number lies strictly between two given numbers',
  generate(rng, d) {
    const frame = rng.pick(['Which of the following numbers is between', 'Which of the following lies between']);
    if (d !== 2) {
      const s: 1 | -1 = d === 3 ? -1 : 1;
      const l = rng.int(1, 7);
      const u = rng.int(10 * l + 3, 89);
      if (u % 10 === 0) return between.generate(rng, d);
      let n = rng.int(10 * l + 1, u - 1);
      while (n % 10 === 0) n = rng.int(10 * l + 1, u - 1);
      let m = rng.int(l + 1, 10 * l - 1);
      while (m % 10 === 0) m = rng.int(l + 1, 10 * l - 1);
      const t = Math.floor(u / 10) + 1;
      if (m <= l || m >= 10 * l || t > 9) return between.generate(rng, d);
      const lowTex = s > 0 ? dec1(l, s) : dec2(u, s);
      const highTex = s > 0 ? dec2(u, s) : dec1(l, s);
      const wrong = [
        { text: `$${dec2(10 * l, s)}$`, trap: 'num-endpoint-between', v: new Frac(s * 10 * l, 100) },
        { text: `$${dec2(u, s)}$`, trap: 'num-endpoint-between', v: new Frac(s * u, 100) },
        { text: `$${dec2(m, s)}$`, trap: 'num-decimal-longer-larger', v: new Frac(s * m, 100) },
        { text: `$${dec1(t, s)}$`, trap: 'num-decimal-longer-larger', v: new Frac(s * t, 10) },
      ];
      const right = { text: `$${dec2(n, s)}$`, v: new Frac(s * n, 100) };
      if (wrong.some((w) => w.text === right.text)) return between.generate(rng, d);
      const { choices, answer } = textChoices(rng, right.text, wrong.map(({ text, trap }) => ({ text, trap })));
      const byText = new Map([[right.text, right.v], ...wrong.map((w) => [w.text, w.v] as [string, Frac])]);
      const lo = new Frac(s > 0 ? 10 * l : -u, 100);
      const hi = new Frac(s > 0 ? u : -10 * l, 100);
      return {
        params: { L: [lo.n, lo.d], U: [hi.n, hi.d], vals: choices.map((c) => [byText.get(c.text)!.n, byText.get(c.text)!.d]) },
        q: {
          format: 'mcs',
          stem: `${frame} $${lowTex}$ and $${highTex}$?`,
          choices,
          answer,
          explanation: `Write every number with the same number of decimal places, then compare. The endpoints are $${dec2(s > 0 ? 10 * l : u, s)}$ and $${dec2(s > 0 ? u : 10 * l, s)}$, and "between" leaves both of them out.

In hundredths ${s > 0 ? '' : 'on the negative side '}the numbers are $${dec2(n, s)}$ (inside), $${dec2(10 * l, s)}$ and $${dec2(u, s)}$ (the endpoints), $${dec2(m, s)}$ and $${dec1(t, s)} = ${dec2(10 * t, s)}$ (both outside).

Trap: $${dec2(m, s)}$ is outside, but comparing ${m} with ${l} as whole numbers makes it look as if it belongs inside.

Rule: same decimal places, then compare; endpoints do not count.`,
        },
      };
    }
    for (;;) {
      const a = rng.int(1, 5);
      const b = rng.int(3, 12);
      const c = rng.int(1, 5);
      const e = rng.int(3, 12);
      if (gcd(a, b) !== 1 || gcd(c, e) !== 1) continue;
      const L = new Frac(a, b);
      const U = new Frac(c, e);
      if (!U.sub(L).gt(new Frac(1, 20))) continue;
      const insides: Frac[] = [];
      for (let y = 3; y <= 15; y++) for (let x = 1; x < 2 * y; x++) {
        const f = new Frac(x, y);
        if (gcd(x, y) === 1 && f.gt(L) && f.lt(U)) insides.push(f);
      }
      if (!insides.length) continue;
      const inside = rng.pick(insides);
      const k = rng.int(1, 3);
      const k2 = rng.int(1, e - 2);
      const w = new Frac(a, b + k);
      const v = new Frac(c, e - k2);
      if (!v.gt(U) || !w.lt(L)) continue;
      const j = rng.int(2, 3);
      const endpoints = [
        { text: `$${ft(a * j, b * j)}$`, v: L },
        { text: `$${ft(c * j, e * j)}$`, v: U },
      ];
      const wrong = [
        { ...endpoints[0], trap: 'num-endpoint-between' },
        { ...endpoints[1], trap: 'num-endpoint-between' },
        { text: `$${ft(a, b + k)}$`, v: w, trap: 'num-larger-denominator-larger' },
        { text: `$${ft(c, e - k2)}$`, v: v, trap: 'num-larger-denominator-larger' },
      ];
      const right = { text: `$${ft(inside.n, inside.d)}$`, v: inside };
      const all = [right, ...wrong];
      if (new Set(all.map((x) => x.text)).size < 5 || all.some((x, i) => all.some((y, j2) => j2 > i && x.v.eq(y.v)))) continue;
      const { choices, answer } = textChoices(rng, right.text, wrong.map(({ text, trap }) => ({ text, trap })));
      const byText = new Map(all.map((x) => [x.text, x.v]));
      const lines = choices
        .map((c) => {
          const val = byText.get(c.text)!;
          return `- $${c.text.slice(1, -1)} \\approx ${val.toNumber().toFixed(3)}$: ${val.gt(L) && val.lt(U) ? 'between' : 'not between'}`;
        })
        .join('\n');
      return {
        params: { L: [L.n, L.d], U: [U.n, U.d], vals: choices.map((c) => [byText.get(c.text)!.n, byText.get(c.text)!.d]) },
        q: {
          format: 'mcs',
          stem: `${frame} $${ft(a, b)}$ and $${ft(c, e)}$?`,
          choices,
          answer,
          explanation: `Turn everything into decimals. The endpoints are $${ft(a, b)} \\approx ${L.toNumber().toFixed(3)}$ and $${ft(c, e)} \\approx ${U.toNumber().toFixed(3)}$, so a number between them is greater than the first and less than the second.

${lines}

Trap: with the same numerator, a larger denominator makes the fraction smaller, and a smaller denominator makes it larger. Endpoints written in another form do not count.`,
        },
      };
    }
  },
  check(q, { L, U, vals }) {
    if (q.format !== 'mcs') return 'wrong format';
    const lo = L[0] / L[1];
    const hi = U[0] / U[1];
    const hits = vals.map(([n, dd], i) => [i, n / dd > lo + 1e-12 && n / dd < hi - 1e-12] as const).filter(([, ok]) => ok);
    if (hits.length !== 1) return `${hits.length} choices are between`;
    return hits[0][0] === q.answer ? null : `answer should be ${hits[0][0]}`;
  },
};

export const realBetweenTemplates = [between];
