import { flaggedChoices } from '../../../engine/build';
import { paren } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Which listed points lie inside, outside, or inside-or-on a circle given by its equation (MCM). */

export const insidePointsTraps: Record<string, Trap> = {
  'geom-circle-boundary': {
    label: 'Counted a point on the circle as inside (or as outside)',
    fix: 'A point ON the circle is at distance exactly $r$ from the center: it is neither inside nor outside. Only "inside or on" includes it.',
  },
  'geom-circle-origin-center': {
    label: 'Measured the distance from the origin instead of from the center',
    fix: 'In $(x - h)^2 + (y - k)^2 = R$ the center is $(h, k)$. Subtract the center from the point before squaring.',
  },
  'geom-circle-center-sign': {
    label: 'Used $(-h, -k)$ as the center',
    fix: '$(x - 3)^2$ means the center has $x = 3$, and $(x + 3)^2$ means $x = -3$. The sign in the equation is the opposite of the coordinate.',
  },
  'geom-circle-rhs-radius': {
    label: 'Took the number on the right side as the radius',
    fix: 'The right side of $(x - h)^2 + (y - k)^2 = R$ is the radius SQUARED. The radius is $\\sqrt{R}$, so compare squared distances with $R$, not distances with $R$.',
  },
};

type Stem = 'inside' | 'outside' | 'incl';
type Method = 'geom-circle-boundary' | 'geom-circle-origin-center' | 'geom-circle-center-sign' | 'geom-circle-rhs-radius';
interface Params {
  h: number;
  k: number;
  R: number;
  stem: Stem;
  pts: [number, number][];
}

const sq = (v: string, c: number) => (c === 0 ? `${v}^2` : c > 0 ? `(${v} - ${c})^2` : `(${v} + ${-c})^2`);
const eq = (h: number, k: number, R: number) => `${sq('x', h)} + ${sq('y', k)} = ${R}`;

/** Does a student using `m` pick this point? */
function picks(m: Method, stem: Stem, h: number, k: number, R: number, x: number, y: number): boolean {
  const dd = (x - h) ** 2 + (y - k) ** 2;
  const test = (v: number, lim: number) => (stem === 'inside' ? v < lim : stem === 'outside' ? v > lim : v <= lim);
  switch (m) {
    case 'geom-circle-boundary':
      return stem !== 'incl' && dd === R;
    case 'geom-circle-origin-center':
      return test(x * x + y * y, R);
    case 'geom-circle-center-sign':
      return test((x + h) ** 2 + (y + k) ** 2, R);
    default:
      return stem !== 'outside' && test(dd, R * R);
  }
}

const truth = (stem: Stem, dd: number, R: number) => (stem === 'inside' ? dd < R : stem === 'outside' ? dd > R : dd <= R);

const pointsMcm: Template<Params> = {
  id: 'geo.circles.points-mcm',
  skill: 'geo.circles',
  format: 'mcm',
  style: 'which points lie inside, outside or on a circle given by its equation',
  generate(rng, d) {
    const r = d === 3 ? rng.int(5, 12) : rng.int(3, 10);
    const R = r * r;
    let h = 0;
    let k = 0;
    if (d > 1) {
      while (h === 0 && k === 0) {
        h = rng.int(-5, 5);
        k = rng.int(-5, 5);
      }
    }
    const stem: Stem = d === 1 ? 'inside' : d === 2 ? rng.pick(['inside', 'outside']) : rng.pick(['inside', 'outside', 'incl', 'incl']);
    const methods: Method[] = ['geom-circle-boundary', 'geom-circle-rhs-radius'];
    if (d > 1) methods.push('geom-circle-origin-center', 'geom-circle-center-sign');
    const grid: [number, number][] = [];
    for (let x = -14; x <= 14; x++) for (let y = -14; y <= 14; y++) grid.push([x, y]);
    const near = grid.filter(([x, y]) => (x - h) ** 2 + (y - k) ** 2 <= 4 * R);
    const right = near.filter(([x, y]) => truth(stem, (x - h) ** 2 + (y - k) ** 2, R));
    const nRight = rng.int(2, 3);
    const nWrong = 6 - nRight;
    const used = new Set<string>();
    const key = (p: [number, number]) => p.join(',');
    const chosen: { p: [number, number]; correct: boolean; trap?: Method }[] = [];
    // wrong points first: each picked by one of the methods
    const order = rng.shuffle(methods);
    for (let i = 0, tried = 0; chosen.length < nWrong && tried < 30; i++, tried++) {
      const m = order[i % order.length];
      const cands = near.filter((p) => !used.has(key(p)) && !truth(stem, (p[0] - h) ** 2 + (p[1] - k) ** 2, R) && picks(m, stem, h, k, R, p[0], p[1]));
      if (!cands.length) continue;
      const p = rng.pick(cands);
      used.add(key(p));
      chosen.push({ p, correct: false, trap: m });
    }
    if (chosen.length < nWrong) throw new Redraw('not enough trapped points');
    // correct points: for "incl" prefer one point on the circle
    const onCircle = right.filter(([x, y]) => (x - h) ** 2 + (y - k) ** 2 === R);
    for (let i = 0; i < nRight; i++) {
      const pool = (stem === 'incl' && i === 0 && onCircle.length ? onCircle : right).filter((p) => !used.has(key(p)));
      if (!pool.length) throw new Redraw('no correct point');
      const p = rng.pick(pool);
      used.add(key(p));
      chosen.push({ p, correct: true });
    }
    const items = rng.shuffle(chosen);
    const { choices, answer } = flaggedChoices(items.map((c) => ({ text: `$(${c.p[0]}, ${c.p[1]})$`, correct: c.correct, ...(c.trap ? { trap: c.trap } : {}) })));
    const where = stem === 'inside' ? 'inside the circle' : stem === 'outside' ? 'outside the circle' : 'inside the circle or on it';
    const cmpWord = (dd: number) => (dd < R ? `less than ${R}, so it is inside` : dd === R ? `equal to ${R}, so it is on the circle` : `greater than ${R}, so it is outside`);
    const lines = items
      .map((c) => {
        const dx = c.p[0] - h;
        const dy = c.p[1] - k;
        const dd = dx * dx + dy * dy;
        return `- $(${c.p[0]}, ${c.p[1]})$: $${paren(dx)}^2 + ${paren(dy)}^2 = ${dd}$, ${cmpWord(dd)}.`;
      })
      .join('\n');
    const notes = trapNotes(
      choices,
      {
        'geom-circle-boundary': (vs) => `${vs} lies exactly on the circle, and a point on the circle is neither inside nor outside it`,
        'geom-circle-origin-center': (vs) => `${vs} comes from measuring from the origin, but the center is $(${h}, ${k})$`,
        'geom-circle-center-sign': (vs) => `${vs} comes from using $(${-h}, ${-k})$ as the center: the sign inside the parentheses is the opposite of the coordinate of the center`,
        'geom-circle-rhs-radius': (vs) => `${vs} comes from reading ${R} as the radius, when it is the radius squared and the radius is ${r}`,
      },
      2,
    );
    return {
      params: { h, k, R, stem, pts: items.map((c) => c.p) },
      q: {
        format: 'mcm',
        stem: `In the $xy$-plane, a circle has the equation $${eq(h, k, R)}$. Which of the following points lie ${where}?`,
        instruction: 'Indicate all such points.',
        choices,
        answer,
        explanation: `The equation $(x - h)^2 + (y - k)^2 = R$ describes a circle with center $(h, k)$ and radius $\\sqrt{R}$. Here the center is $(${h}, ${k})$ and the radius is ${r}, because $${r}^2 = ${R}$. Compare each point's squared distance from the center with ${R}: less means inside, equal means on the circle, more means outside.

${lines}

${notes}

Rule: subtract the center, square, and compare with $R$ itself, never with the radius.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'format';
    const rad = Math.sqrt(p.R);
    const exp = p.pts.flatMap(([x, y], i) => {
      const dist = Math.hypot(x - p.h, y - p.k);
      const on = Math.abs(dist - rad) < 1e-9;
      const ok = p.stem === 'inside' ? dist < rad && !on : p.stem === 'outside' ? dist > rad && !on : dist < rad || on;
      return ok ? [i] : [];
    });
    if (q.choices.some((c, i) => c.text !== `$(${p.pts[i][0]}, ${p.pts[i][1]})$`)) return 'choice order';
    return JSON.stringify(exp) === JSON.stringify(q.answer) ? null : `expected ${exp}`;
  },
};

export const insidePointsTemplates = retryAll([pointsMcm]);
