import { Frac } from '../../../engine/frac';
import { gcd } from '../../../engine/math';
import { lin, poly } from '../../../engine/tex';
import type { Choice, Template, Trap } from '../../../engine/types';
import { intExcept } from './util';

export const quadraticBuildTraps: Record<string, Trap> = {
  'alg-quad-build-factor-sign': {
    label: 'Wrote $(x + r)$ for the solution $r$',
    fix: 'A solution $r$ comes from the factor $(x - r)$: substituting $x = r$ must make the factor 0.',
  },
  'alg-quad-build-product-sign': {
    label: 'Gave the constant term the wrong sign',
    fix: 'The constant term is the PRODUCT of the solutions (for a monic equation), with its own sign.',
  },
  'alg-quad-build-both-signs': {
    label: 'Mixed up the sign of the sum and of the product',
    fix: 'For $x^2 + bx + c = 0$: $b = -(\\text{sum})$ and $c = \\text{product}$. Substitute a solution to catch a wrong sign.',
  },
  'alg-quad-build-difference': {
    label: 'Used the difference of the solutions where the sum belongs',
    fix: 'The coefficient of $x$ comes from $r + s$, not $r - s$.',
  },
  'alg-quad-build-inverted-root': {
    label: 'Inverted a fractional solution when building the factor',
    fix: 'The solution $\\frac{q}{p}$ comes from the factor $(px - q)$: $p \\cdot \\frac{q}{p} - q = 0$.',
  },
  'alg-quad-build-middle-term': {
    label: 'Expanded the product of two factors without all four products',
    fix: 'In $(px - q)(rx - s)$ the middle term collects BOTH cross products: $-(ps + qr)x$.',
  },
  'alg-quad-build-disc-two': {
    label: 'Used $b^2 = 2ac$ instead of $b^2 = 4ac$ for exactly one solution',
    fix: 'One solution means the discriminant $b^2 - 4ac$ is 0, so $b^2 = 4ac$ with a 4.',
  },
  'alg-quad-build-forgot-a': {
    label: 'Forgot the leading coefficient when completing the square',
    fix: 'For $ax^2 + bx + c$ the perfect-square condition is $c = \\frac{b^2}{4a}$, not $\\left(\\frac{b}{2}\\right)^2$.',
  },
  'alg-quad-build-near-miss': {
    label: 'Accepted a nearly perfect square',
    fix: 'Exactly one solution needs the discriminant to be exactly 0: a constant that is one off gives zero or two solutions.',
  },
  'alg-quad-build-b-half': {
    label: 'Halved the middle coefficient',
    fix: 'In $(px + q)^2$ the middle term is the double product $2pq\,x$; halving it leaves a quadratic with no repeated solution.',
  },
};

type Co = [number, number, number];

interface Params {
  kind: 'roots' | 'sum-product' | 'one-solution';
  /** Intended solutions as fractions [n, d] (roots, sum-product) -- empty for one-solution. */
  sols: [number, number][];
  /** Coefficients [a, b, c] of the choices, in display order. */
  eqs: Co[];
}

const ff = (a: number, b: number) => `(${lin([[a, 'x'], [b, '']])})`;
const fl = (r: number) => `(x ${r < 0 ? '-' : '+'} ${Math.abs(r)})`;
const eqTex = ([a, b, c]: Co) => `$${poly([a, b, c])} = 0$`;

const quadraticBuildMCS: Template<Params> = {
  id: 'alg.quadratics.build-mcs',
  skill: 'alg.quadratics',
  format: 'mcs',
  style: 'choose the equation with given solutions, or with exactly one solution',
  generate(rng, d) {
    for (;;) {
      const kind: Params['kind'] = d === 1 ? 'roots' : d === 2 ? rng.pick(['sum-product', 'roots', 'sum-product']) : rng.pick(['one-solution', 'roots', 'one-solution']);
      let stem: string;
      let key: Co;
      let wrong: { eq: Co; trap: string; why: string }[];
      let steps: string;
      let rule: string;
      let sols: [number, number][] = [];
      if (kind === 'roots') {
        // integer solutions (d = 1) or one fractional solution (d = 2, 3)
        const r = intExcept(rng, -9, 9, 0);
        const s = intExcept(rng, -9, 9, 0, r);
        if (d === 1) {
          if (r + s === 0) continue;
          key = [1, -(r + s), r * s];
          sols = [[r, 1], [s, 1]];
          stem = rng.chance(0.5)
            ? `Which of the following is an equation whose solutions are $x = ${r}$ and $x = ${s}$?`
            : `Which of the following equations has exactly the two solutions $${r}$ and $${s}$?`;
          steps = `A solution $r$ comes from the factor $(x - r)$, so the equation is $(x ${r < 0 ? '+' : '-'} ${Math.abs(r)})(x ${s < 0 ? '+' : '-'} ${Math.abs(s)}) = 0$. Expanding gives $${poly(key)} = 0$: the middle coefficient is minus the sum of the solutions, $-(${r + s})$, and the constant is their product, $${r * s}$.

Check: at $x = ${r}$ the left side is $${r * r} ${key[1] * r < 0 ? '-' : '+'} ${Math.abs(key[1] * r)} ${key[2] < 0 ? '-' : '+'} ${Math.abs(key[2])} = 0$.`;
          rule = 'For a monic quadratic: $x^2 - (\\text{sum})x + (\\text{product}) = 0$.';
          wrong = [
            { eq: [1, r + s, r * s], trap: 'alg-quad-build-factor-sign', why: `$${poly([1, r + s, r * s])} = 0$ is built from the factors $${fl(r)}${fl(s)}$, whose solutions are $${-r}$ and $${-s}$.` },
            { eq: [1, -(r + s), -(r * s)], trap: 'alg-quad-build-product-sign', why: `$${poly([1, -(r + s), -(r * s)])} = 0$ has the right sum but the wrong sign of the product, so $x = ${r}$ does not solve it.` },
            { eq: [1, r + s, -(r * s)], trap: 'alg-quad-build-both-signs', why: `$${poly([1, r + s, -(r * s)])} = 0$ flips both signs and is not satisfied by $x = ${r}$.` },
            { eq: [1, -(r - s), r * s], trap: 'alg-quad-build-difference', why: `$${poly([1, -(r - s), r * s])} = 0$ uses $${r} - ${s < 0 ? `(${s})` : s}$ instead of the sum.` },
            { eq: [1, -(r + s), r + s], trap: 'alg-sum-for-product', why: `$${poly([1, -(r + s), r + s])} = 0$ puts the sum where the product belongs.` },
          ];
        } else {
          // one fractional solution q/p and an integer solution s
          const p = rng.pick(d === 2 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 7]);
          const q = intExcept(rng, -9, 9, 0);
          if (gcd(Math.abs(q), p) !== 1) continue;
          const s2 = intExcept(rng, -6, 6, 0);
          key = [p, -(q + p * s2), q * s2];
          sols = [[q, p], [s2, 1]];
          stem = `Which of the following is an equation whose solutions are $x = ${new Frac(q, p).toTex()}$ and $x = ${s2}$?`;
          steps = `The solution $${new Frac(q, p).toTex()}$ comes from the factor $(${p}x ${q < 0 ? '+' : '-'} ${Math.abs(q)})$, since it is 0 at that $x$, and $s = ${s2}$ comes from $(x ${s2 < 0 ? '+' : '-'} ${Math.abs(s2)})$. Multiply: $(${p}x ${q < 0 ? '+' : '-'} ${Math.abs(q)})(x ${s2 < 0 ? '+' : '-'} ${Math.abs(s2)}) = ${poly(key)}$.

Check: at $x = ${s2}$ the second factor is 0, and at $x = ${new Frac(q, p).toTex()}$ the first factor is 0.`;
          rule = 'A fractional solution $\\frac{q}{p}$ comes from the factor $(px - q)$, not $(qx - p)$.';
          wrong = [
            { eq: [q, -(p + q * s2), p * s2], trap: 'alg-quad-build-inverted-root', why: `$${poly([q, -(p + q * s2), p * s2])} = 0$ is built with the factor $${ff(q, -p)}$, whose solution is $${new Frac(p, q).toTex()}$, the inverse.` },
            { eq: [p, q + p * s2, q * s2], trap: 'alg-quad-build-factor-sign', why: `$${poly([p, q + p * s2, q * s2])} = 0$ uses the factors $${ff(p, q)}${fl(s2)}$, whose solutions have the opposite signs.` },
            { eq: [p, -(q + s2), q * s2], trap: 'alg-quad-build-middle-term', why: `$${poly([p, -(q + s2), q * s2])} = 0$ forgets that the $${p}$ multiplies the $${s2}$ in the middle term.` },
            { eq: [p, -(q + p * s2), -(q * s2)], trap: 'alg-quad-build-product-sign', why: `$${poly([p, -(q + p * s2), -(q * s2)])} = 0$ gets the sign of the constant term wrong.` },
            { eq: [p, q + p * s2, -(q * s2)], trap: 'alg-quad-build-both-signs', why: `$${poly([p, q + p * s2, -(q * s2)])} = 0$ flips two signs.` },
          ];
        }
      } else if (kind === 'sum-product') {
        const r = intExcept(rng, -9, 9, 0);
        const s = intExcept(rng, -9, 9, 0, r);
        const S = r + s;
        const P = r * s;
        if (S === 0) continue;
        key = [1, -S, P];
        sols = [[r, 1], [s, 1]];
        stem = `The sum of the solutions of a quadratic equation is $${S}$ and their product is $${P}$. Which of the following could be that equation?`;
        steps = `For $x^2 + bx + c = 0$ with solutions $r$ and $s$, $(x - r)(x - s) = x^2 - (r + s)x + rs$. So $b = -(${S}) = ${-S}$ and $c = ${P}$: $${poly(key)} = 0$.

Check: the solutions are $${r}$ and $${s}$ (they add to $${S}$ and multiply to $${P}$).`;
        rule = 'The coefficient of $x$ is minus the sum; the constant is the product (when the leading coefficient is 1).';
        wrong = [
          { eq: [1, S, P], trap: 'alg-quad-build-factor-sign', why: `$${poly([1, S, P])} = 0$ keeps the sum with its own sign, so its solutions add to $${-S}$.` },
          { eq: [1, -S, -P], trap: 'alg-quad-build-product-sign', why: `$${poly([1, -S, -P])} = 0$ negates the product, so its solutions multiply to $${-P}$.` },
          { eq: [1, S, -P], trap: 'alg-quad-build-both-signs', why: `$${poly([1, S, -P])} = 0$ flips both signs.` },
          { eq: [1, -P, S], trap: 'alg-sum-for-product', why: `$${poly([1, -P, S])} = 0$ swaps the sum and the product.` },
          { eq: [1, -(r - s), P], trap: 'alg-quad-build-difference', why: `$${poly([1, -(r - s), P])} = 0$ uses the difference of the solutions.` },
        ];
      } else {
        // exactly one solution: (px + q)^2 scaled by t
        const pp = rng.pick([1, 1, 2, 3]);
        const qq = intExcept(rng, -5, 5, 0);
        const t = rng.pick([1, 2, 3]);
        const a = t * pp * pp;
        const b = 2 * t * pp * qq;
        const c = t * qq * qq;
        if (a === 1 && d === 3 && rng.chance(0.5)) continue;
        key = [a, b, c];
        stem = 'Which of the following equations has exactly one solution?';
        steps = `Exactly one solution means the discriminant is 0: $b^2 - 4ac = 0$. For $${poly(key)} = 0$, $b^2 = ${b * b}$ and $4ac = 4 \\cdot ${a} \\cdot ${c} = ${4 * a * c}$, which are equal. (Equivalently, the left side is $${t === 1 ? '' : t}(${pp === 1 ? '' : pp}x ${qq < 0 ? '-' : '+'} ${Math.abs(qq)})^2$.)

Check: each other choice has $b^2 \\ne 4ac$, so it has two solutions or none.`;
        rule = 'One solution: $b^2 = 4ac$, a perfect square.';
        wrong = [
          { eq: [a, b, 2 * c], trap: 'alg-quad-build-disc-two', why: `$${poly([a, b, 2 * c])} = 0$ has $b^2 = ${b * b}$ but $4ac = ${8 * a * c}$; the constant was found with $b^2 = 2ac$.` },
          { eq: [a, b, -c], trap: 'alg-quad-build-product-sign', why: `$${poly([a, b, -c])} = 0$ has the right size of constant but the wrong sign: $b^2 - 4ac = ${b * b + 4 * a * c} > 0$, two solutions.` },
          { eq: [a, b, c + 1], trap: 'alg-quad-build-near-miss', why: `$${poly([a, b, c + 1])} = 0$ is one off: $b^2 - 4ac = ${-4 * a}$, no solution.` },
          { eq: [a, b / 2, c], trap: 'alg-quad-build-b-half', why: `$${poly([a, b / 2, c])} = 0$ halves the middle term: $b^2 - 4ac = ${(b * b) / 4 - 4 * a * c}$, no solution.` },
          ...(a !== 1 && (b * b) / 4 !== c ? [{ eq: [a, b, (b * b) / 4] as Co, trap: 'alg-quad-build-forgot-a', why: `$${poly([a, b, (b * b) / 4])} = 0$ takes $c = (\\frac{b}{2})^2 = ${(b * b) / 4}$ and ignores the leading coefficient $${a}$.` }] : []),
        ];
      }
      const keyKey = key.join(',');
      const seen = new Set([keyKey]);
      for (const w of wrong) if (w.eq[0] < 0) w.eq = [-w.eq[0], -w.eq[1], -w.eq[2]]; // same solutions, leading coefficient positive like the key
      const pool = rng.shuffle(wrong).filter((w) => {
        const k2 = w.eq.join(',');
        if (seen.has(k2) || !Number.isInteger(w.eq[1]) || !Number.isInteger(w.eq[2]) || w.eq[0] === 0) return false;
        seen.add(k2);
        return true;
      });
      if (pool.length < 4) continue;
      const chosen = pool.slice(0, 4);
      const all = rng.shuffle([{ eq: key, trap: '', why: '' }, ...chosen]);
      const choices: Choice[] = all.map((x) => ({ text: eqTex(x.eq), ...(x.trap ? { trap: x.trap } : {}) }));
      const cited = chosen[0];
      return {
        params: { kind, sols, eqs: all.map((x) => x.eq) },
        q: {
          format: 'mcs',
          stem,
          choices,
          answer: all.findIndex((x) => x.trap === ''),
          explanation: `${kind === 'one-solution' ? 'Exactly one solution is a statement about the discriminant.' : 'Build the equation from its solutions, then test it.'}

${steps!}

Trap: ${cited.why}

Rule: ${rule!}`,
        },
      };
    }
  },
  check(q, { kind, sols, eqs }) {
    if (q.format !== 'mcs') return 'wrong format';
    if (eqs.some((e, i) => q.choices[i].text !== eqTex(e))) return 'choice text mismatch';
    const good = eqs.flatMap((e, i) => {
      const [a, b, c] = e;
      if (kind === 'one-solution') {
        // the vertex must be a solution (the parabola touches the axis)
        const v = new Frac(-b, 2 * a);
        return v.mul(v).mul(a).add(v.mul(b)).add(c).eq(0) ? [i] : [];
      }
      // every intended solution must satisfy the equation (two distinct solutions fix a quadratic up to scale)
      const ok = sols.every(([n, dd]) => {
        const x = new Frac(n, dd);
        return x.mul(x).mul(a).add(x.mul(b)).add(c).eq(0);
      });
      return ok ? [i] : [];
    });
    if (good.length !== 1) return `${good.length} choices fit`;
    return good[0] === q.answer ? null : `expected ${good[0]}`;
  },
};

export const quadraticBuildTemplates = [quadraticBuildMCS];
