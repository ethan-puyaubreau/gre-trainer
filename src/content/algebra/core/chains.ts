import { Frac, frac } from '../../../engine/frac';
import { lin, num, paren } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { intExcept } from './util';

// New question styles for alg.systems and alg.linear-equations, with their traps.
export const chainTraps: Record<string, Trap> = {
  'alg-chain-no-divide': {
    label: 'Stopped at the value of the whole term and forgot to divide by the coefficient of $z$',
    fix: 'After substituting you get $iz = r$, not $z = r$. Divide both sides by $i$.',
  },
  'alg-chain-swap': {
    label: 'Swapped the values of $x$ and $y$ when substituting into the third equation',
    fix: 'Write down $x = \\dots$ and $y = \\dots$ first, and read each one off by name when you substitute.',
  },
  'alg-chain-sign': {
    label: 'Added the known terms to the right side instead of subtracting them',
    fix: 'In $gx + hy + iz = j$, the terms $gx$ and $hy$ are subtracted from BOTH sides: $iz = j - gx - hy$.',
  },
  'alg-chain-stopped-early': {
    label: 'Gave $x + y$ and never used the third equation',
    fix: 'Reread what is asked. The sum $x + y + z$ needs $z$, and $z$ comes from the third equation once $x$ and $y$ are known.',
  },
};

/* ================================================================== 3. Chained three-equation system (NE, fraction) */

interface ChainParams {
  eq1: [number, number, number];
  eq2: [number, number, number];
  eq3: [number, number, number, number];
  ask: 'z' | 'sum';
}

/** Solves M v = r (3x3) by Gaussian elimination with partial pivoting in floating point. */
function gauss3(M: number[][], r: number[]): number[] | null {
  const A = M.map((row, i) => [...row, r[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let i = col + 1; i < 3; i++) if (Math.abs(A[i][col]) > Math.abs(A[piv][col])) piv = i;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    for (let i = col + 1; i < 3; i++) {
      const f = A[i][col] / A[col][col];
      for (let j = col; j < 4; j++) A[i][j] -= f * A[col][j];
    }
  }
  const v = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = A[i][3];
    for (let j = i + 1; j < 3; j++) s -= A[i][j] * v[j];
    v[i] = s / A[i][i];
  }
  return v;
}

const chainedNE: Template<ChainParams> = {
  id: 'alg.systems.chained-ne',
  skill: 'alg.systems',
  format: 'ne',
  style: 'solve two equations for x and y, then use them in a third equation',
  generate(rng, d) {
    for (;;) {
      const R = d === 1 ? 9 : d === 2 ? 9 : 12;
      const x0 = intExcept(rng, -R, R, 0);
      const y0 = intExcept(rng, -R, R, 0, x0);
      let a = 1;
      let b = 1;
      let dd = 1;
      let e = -1;
      if (d === 1) {
        if (x0 < 0 || y0 < 0) continue; // easy level: positive solution
      } else {
        a = intExcept(rng, -6, 6, 0);
        b = intExcept(rng, -6, 6, 0);
        dd = intExcept(rng, -6, 6, 0);
        e = intExcept(rng, -6, 6, 0);
        if (Math.abs(a * e - b * dd) < 2 || a * e === b * dd) continue;
        if (a === dd && b === e) continue;
      }
      const c = a * x0 + b * y0;
      const f = dd * x0 + e * y0;
      const i = d === 1 ? rng.int(2, 5) : rng.int(2, 9);
      const g = d === 3 && rng.chance(0.5) ? 0 : intExcept(rng, d === 1 ? 1 : -6, d === 1 ? 4 : 6, 0);
      const h = intExcept(rng, d === 1 ? 1 : -6, d === 1 ? 4 : 6, 0);
      let r = intExcept(rng, -14, 14, 0);
      if (d === 1) r = rng.int(1, 14);
      if (r % i === 0) continue;
      const j = g * x0 + h * y0 + r;
      const z0 = new Frac(r, i);
      const ask: 'z' | 'sum' = d === 3 ? 'sum' : 'z';
      const answer = ask === 'z' ? z0 : z0.add(x0 + y0);
      const traps: { value: Frac; trap: string }[] = [];
      const noDiv = ask === 'z' ? frac(r) : frac(r + x0 + y0);
      if (noDiv.eq(0)) continue;
      traps.push({ value: noDiv, trap: 'alg-chain-no-divide' });
      const swapZ = new Frac(j - g * y0 - h * x0, i);
      traps.push({ value: ask === 'z' ? swapZ : swapZ.add(x0 + y0), trap: 'alg-chain-swap' });
      const signZ = new Frac(j + g * x0 + h * y0, i);
      traps.push({ value: ask === 'z' ? signZ : signZ.add(x0 + y0), trap: 'alg-chain-sign' });
      traps.push(ask === 'z' ? { value: frac(y0), trap: 'alg-answered-one-variable' } : { value: frac(x0 + y0), trap: 'alg-chain-stopped-early' });
      const tr = traps.filter((t, k) => !t.value.eq(answer) && traps.findIndex((u) => u.value.eq(t.value)) === k);
      const eqTex = (p: number, q: number, rhs: number) => `${lin([[p, 'x'], [q, 'y']])} = ${num(rhs)}`;
      const eq3Tex = `${lin([[g, 'x'], [h, 'y'], [i, 'z']])} = ${num(j)}`;
      const det = a * e - b * dd;
      const xnum = c * e - b * f;
      let solve: string;
      if (d === 1) {
        solve = `Add the first two equations: $${lin([[2, 'x']])} = ${num(c + f)}$, so $x = ${num(x0)}$. Subtract the second from the first: $${lin([[2, 'y']])} = ${num(c - f)}$, so $y = ${num(y0)}$.`;
      } else {
        solve = `To eliminate $y$, multiply the first equation by $${num(e)}$ and the second by $${num(b)}$, then subtract: $${lin([[det, 'x']])} = ${num(xnum)}$, so $x = ${num(x0)}$. From the first equation, $${lin([[b, 'y']])} = ${num(c)} - ${paren(a * x0)} = ${num(c - a * x0)}$, so $y = ${num(y0)}$.`;
      }
      const prod = (p: number, v: number) => (p === 1 ? paren(v) : `${num(p)} \\cdot ${paren(v)}`);
      const known = [g, h].map((p, k) => [p, k === 0 ? x0 : y0] as const).filter(([p]) => p !== 0).map(([p, v], k) => (k === 0 ? prod(p, v) : p < 0 ? ' - ' + prod(-p, v) : ' + ' + prod(p, v))).join('');
      const S = g * x0 + h * y0;
      const explanation = `Two of the equations involve only $x$ and $y$, so solve those first. The third equation then has one unknown left, $z$.

${solve}

Substitute into the third equation: $${known} + ${i}z = ${num(j)}$, so $${lin([[i, 'z']])} = ${num(j)} - ${paren(S)} = ${num(r)}$ and $z = ${z0.toTex()}$.${ask === 'sum' ? ` Then $x + y + z = ${num(x0)} + ${paren(y0)} + ${z0.n < 0 ? `(${z0.toTex()})` : z0.toTex()} = ${answer.toTex()}$.` : ''}

Trap: the number $${num(noDiv)}$ comes from stopping before dividing by the coefficient ${i} of $z$.

Rule: solve the smaller system first, then substitute the values by name into the equation that still has an unknown.`;
      return {
        params: { eq1: [a, b, c], eq2: [dd, e, f], eq3: [g, h, i, j], ask },
        q: {
          format: 'ne',
          stem: `$$${eqTex(a, b, c)}$$
$$${eqTex(dd, e, f)}$$
$$${eq3Tex}$$

If $x$, $y$ and $z$ satisfy the system of equations above, what is the value of $${ask === 'z' ? 'z' : 'x + y + z'}$?`,
          answer,
          fractionBoxes: true,
          traps: tr,
          explanation,
        },
      };
    }
  },
  check(q, { eq1, eq2, eq3, ask }) {
    if (q.format !== 'ne') return 'wrong format';
    const v = gauss3(
      [
        [eq1[0], eq1[1], 0],
        [eq2[0], eq2[1], 0],
        [eq3[0], eq3[1], eq3[2]],
      ],
      [eq1[2], eq2[2], eq3[3]],
    );
    if (!v) return 'singular system';
    const want = ask === 'z' ? v[2] : v[0] + v[1] + v[2];
    return Math.abs(q.answer.toNumber() - want) < 1e-9 ? null : `expected ${want}`;
  },
};

export const chainTemplates: Template<any>[] = [chainedNE];
