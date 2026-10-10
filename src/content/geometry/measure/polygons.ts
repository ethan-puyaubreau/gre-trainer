import { flaggedChoices, qcCompare, qcCompareNum, qcFromSamples, QC_TEXT } from '../../../engine/build';
import { Frac, frac, type FracLike } from '../../../engine/frac';
import type { Rng } from '../../../engine/rng';
import { lin, num, paren, plain } from '../../../engine/tex';
import type { Choice, MCSQuestion, QCChoice, QCQuestion, Template } from '../../../engine/types';
import { angleAt, checkChoiceValue, dist, Ex, exChoices, pathLength, shoelace, type ExData } from './ex';
import { Fig, onCircle, type P2 } from './fig';

const deg = (v: number | string) => `${v}^\\circ`;
const relText = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');

/* ================================================================== 1. Interior angles (MCS) */

/** Angle measure p·x + q (p = 0: a constant). */
type AngleExpr = [number, number];
const angleTex = ([p, q]: AngleExpr) => (p === 0 ? deg(q) : q === 0 ? `${p === 1 ? '' : p}x^\\circ` : `(${lin([[p, 'x'], [q, '']])})^\\circ`);
const angleVal = ([p, q]: AngleExpr, x: number) => p * x + q;
const POLY_NAME: Record<number, string> = { 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon', 12: 'dodecagon' };

/** Convex polygon (counterclockwise) whose interior angles are `angles`, or null. */
function polygonWithAngles(rng: Rng, angles: number[]): P2[] | null {
  const n = angles.length;
  const dirs = [0];
  for (let i = 1; i < n; i++) dirs.push(dirs[i - 1] + 180 - angles[i]);
  const u = dirs.map((t) => [Math.cos((t * Math.PI) / 180), Math.sin((t * Math.PI) / 180)]);
  for (let attempt = 0; attempt < 80; attempt++) {
    const L = Array.from({ length: n - 2 }, () => 3 + rng.next() * 3);
    let sx = 0;
    let sy = 0;
    L.forEach((l, i) => {
      sx += l * u[i][0];
      sy += l * u[i][1];
    });
    const [ax, ay] = u[n - 2];
    const [bx, by] = u[n - 1];
    const det = ax * by - ay * bx;
    if (Math.abs(det) < 1e-9) continue;
    const a = (-sx * by + sy * bx) / det;
    const b = (-ax * sy + ay * sx) / det;
    if (a < 2.5 || b < 2.5 || a > 8 || b > 8) continue;
    const lens = [...L, a, b];
    const pts: P2[] = [[0, 0]];
    for (let i = 0; i < n - 1; i++) pts.push([pts[i][0] + lens[i] * u[i][0], pts[i][1] + lens[i] * u[i][1]]);
    return pts;
  }
  return null;
}

const regularPolygon = (n: number, R = 5, rot = -90 - 180 / n): P2[] => Array.from({ length: n }, (_, i) => onCircle([0, 0], R, rot + (360 * i) / n));

interface AngleSumParams {
  mode: 'irregular' | 'regular-angle' | 'regular-sum' | 'regular-diagonal';
  n: number;
  exprs: AngleExpr[];
  pts: P2[];
  ask: 'x' | 'largest' | 'each' | 'sum' | 'diag';
  regularAngle: number;
  values: number[];
}

const angleSum: Template<AngleSumParams> = {
  id: 'geo.polygons.angle-sum',
  skill: 'geo.polygons',
  format: 'mcs',
  style: 'interior angles of a polygon (algebraic or regular)',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1
        ? (['irregular', 'irregular', 'regular-angle'] as const)
        : d === 2
          ? (['irregular', 'irregular', 'regular-sum', 'regular-angle'] as const)
          : (['irregular', 'regular-diagonal', 'regular-sum'] as const),
    );
    if (mode === 'irregular') return irregularAngles(rng, d === 1 ? 4 : d === 2 ? rng.pick([4, 5, 5]) : rng.pick([5, 6]), d);
    const n = rng.pick(mode === 'regular-sum' ? [5, 6, 8, 9, 10, 12, 15, 18, 20] : mode === 'regular-diagonal' ? [5, 6, 8] : [5, 6, 8, 10]);
    const I = 180 - 360 / n;
    const S = (n - 2) * 180;
    const name = POLY_NAME[n] ?? `${n}-sided polygon`;
    if (mode === 'regular-sum') {
      const { choices, answer } = numChoices(rng, {
        step: 180,
        correct: S,
        traps: [
          { value: n * 180, trap: 'geom-poly-sum-n180' },
        ],
        fillers: rng.shuffle([(n - 1) * 180, (n - 3) * 180, (n + 1) * 180, 360, (n - 4) * 180]),
        format: (v) => `$${num(v)}^\\circ$`,
      });
      const values = choicesValues(choices);
      return {
        params: { mode, n, exprs: [], pts: [], ask: 'sum', regularAngle: I, values },
        q: {
          format: 'mcs',
          stem: `Each interior angle of a regular polygon has measure $${deg(I)}$. What is the sum of the measures of the interior angles of the polygon?`,
          choices,
          answer,
          explanation: `Each exterior angle is $180^\\circ - ${deg(I)} = ${deg(180 - I)}$, and the exterior angles of any polygon add up to $360^\\circ$, so the polygon has $\\frac{360}{${180 - I}} = ${n}$ sides.

The interior angles then add up to $(${n} - 2) \\cdot 180^\\circ = ${num(S)}^\\circ$ (check: $${n} \\cdot ${I} = ${num(S)}$).

Using $${n} \\cdot 180^\\circ = ${num(n * 180)}^\\circ$ forgets the $-2$: the polygon splits into $${n} - 2$ triangles, not ${n}.`,
        },
      };
    }
    const pts = regularPolygon(n);
    const fig = new Fig();
    const names = 'ABCDEFGHJK'.slice(0, n).split('');
    names.forEach((nm, i) => fig.pt(nm, pts[i]));
    fig.poly(names);
    if (mode === 'regular-angle') {
      fig.hide(...names);
      fig.angle(names[n - 1], names[0], names[1], '$x^\\circ$');
      const { choices, answer } = numChoices(rng, {
        step: 5,
        correct: I,
        traps: [
          { value: 360 / n, trap: 'geom-poly-exterior-angle' },
          { value: S, trap: 'geom-poly-answered-other' },
        ],
        fillers: rng.shuffle([5, 6, 8, 9, 10, 12].filter((m) => m !== n).map((m) => 180 - 360 / m)),
        format: (v) => `$${num(v)}$`,
      });
      return {
        params: { mode, n, exprs: [], pts, ask: 'each', regularAngle: I, values: choicesValues(choices) },
        q: {
          format: 'mcs',
          stem: `The figure above is a regular ${name}. What is the value of $x$?`,
          figure: fig.build(false),
          choices,
          answer,
          explanation: `${/^[aeiou]/.test(name) ? 'An' : 'A'} ${name} has ${n} sides, so its interior angles add up to $(${n} - 2) \\cdot 180^\\circ = ${num(S)}^\\circ$. In a regular polygon all ${n} angles are equal: $x = \\frac{${num(S)}}{${n}} = ${num(I)}$.

Faster: each exterior angle is $\\frac{360^\\circ}{${n}} = ${deg(num(360 / n))}$, so $x = 180 - ${num(360 / n)} = ${num(I)}$. Answering ${plain(360 / n)} gives the exterior angle, not the interior one.`,
        },
      };
    }
    // regular-diagonal: angle between side AB and diagonal AC at vertex A... measured at B? We mark angle BAC.
    fig.seg(names[0], names[2]);
    fig.angle(names[1], names[0], names[2], '$x^\\circ$');
    const x = new Frac(180, n);
    const { choices, answer } = numChoices(rng, {
        step: 5,
      correct: x,
      traps: [
        { value: new Frac(I, 2), trap: 'geom-poly-diagonal-bisects' },
        { value: new Frac(360, n), trap: 'geom-poly-exterior-angle' },
        { value: I, trap: 'geom-poly-answered-other' },
      ],
      fillers: rng.shuffle([x.add(10), x.sub(5), new Frac(I).sub(x), x.add(15), x.mul(2).add(5)]),
      format: (v) => `$${v.isInt() ? num(v.n) : v.toDecimalString()}$`,
    });
    return {
      params: { mode, n, exprs: [], pts, ask: 'diag', regularAngle: I, values: choicesValues(choices) },
      q: {
        format: 'mcs',
        stem: `In the figure above, $${names.join('')}$ is a regular ${name}. What is the value of $x$?`,
        figure: fig.build(false),
        choices,
        answer,
        explanation: `Each interior angle of a regular ${name} is $\\frac{(${n} - 2) \\cdot 180^\\circ}{${n}} = ${deg(num(I))}$, so angle $${names[0]}${names[1]}${names[2]}$ is $${deg(num(I))}$.

Triangle $${names[0]}${names[1]}${names[2]}$ is isosceles ($${names[0]}${names[1]} = ${names[1]}${names[2]}$, two sides of the regular polygon), so its base angles are equal: $x = \\frac{180 - ${num(I)}}{2} = ${x.isInt() ? x.n : x.toDecimalString()}$.

The diagonal does not bisect the angle at $${names[0]}$: $\\frac{${num(I)}}{2}$ is a trap.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    let expected: number;
    if (p.mode === 'irregular') {
      // Measure the drawn polygon: its angles must match the labels, and their sum fixes x.
      const n = p.pts.length;
      const measured = p.pts.map((v, i) => angleAt(p.pts[(i + n - 1) % n], v, p.pts[(i + 1) % n]));
      const total = measured.reduce((s, a) => s + a, 0);
      const xs: number[] = [];
      for (let x = 1; x <= 400; x++) if (Math.abs(p.exprs.reduce((s, e) => s + angleVal(e, x), 0) - total) < 1e-6) xs.push(x);
      if (xs.length !== 1) return `found ${xs.length} values of x`;
      const x = xs[0];
      for (let i = 0; i < n; i++) if (Math.abs(measured[i] - angleVal(p.exprs[i], x)) > 1e-6) return `figure angle ${i} is ${measured[i]}, label says ${angleVal(p.exprs[i], x)}`;
      expected = p.ask === 'x' ? x : Math.max(...p.exprs.map((e) => angleVal(e, x)));
    } else if (p.mode === 'regular-sum') {
      // Find n by trying regular polygons until the measured interior angle matches.
      let found = 0;
      for (let n = 3; n <= 60; n++) {
        const pts = regularPolygon(n);
        if (Math.abs(angleAt(pts[n - 1], pts[0], pts[1]) - p.regularAngle) < 1e-6) found = n;
      }
      if (!found) return 'no regular polygon has that angle';
      const pts = regularPolygon(found);
      expected = Math.round(pts.reduce((s, v, i) => s + angleAt(pts[(i + found - 1) % found], v, pts[(i + 1) % found]), 0) * 1e6) / 1e6;
    } else if (p.mode === 'regular-angle') {
      expected = angleAt(p.pts[p.n - 1], p.pts[0], p.pts[1]);
    } else {
      expected = angleAt(p.pts[1], p.pts[0], p.pts[2]);
    }
    const hits = p.values.flatMap((v, i) => (Math.abs(v - expected) < 1e-6 ? [i] : []));
    if (hits.length !== 1) return `${hits.length} choices equal ${expected}`;
    return hits[0] === q.answer ? null : `expected choice ${hits[0]} (${expected})`;
  },
};

/** Numeric select-one choices with a spread answer position (wrapper over exChoices). */
function numChoices(
  rng: Rng,
  o: { correct: FracLike; traps?: { value: FracLike; trap: string }[]; fillers?: FracLike[]; format: (v: Frac) => string; step: number },
): { choices: Choice[]; answer: number } {
  const r = exChoices(
    rng,
    Ex.of(o.correct),
    (o.traps ?? []).map((t) => ({ v: Ex.of(t.value), trap: t.trap })),
    (o.fillers ?? []).map((f) => Ex.of(f)),
    { step: Ex.of(o.step), fmt: (v) => o.format(v.rational()!), scales: false },
  );
  return { choices: r.choices, answer: r.answer };
}

function choicesValues(choices: Choice[]): number[] {
  return choices.map((c) => {
    const m = /^\$(-?[\d{},.]+)/.exec(c.text);
    if (!m) throw new Error(`cannot read choice ${c.text}`);
    return Number(m[1].replace(/\{,\}/g, ''));
  });
}

function irregularAngles(rng: Rng, n: number, d: number): { q: MCSQuestion; params: AngleSumParams } {
  const S = (n - 2) * 180;
  for (let attempt = 0; ; attempt++) {
    if (attempt > 2000) throw new Error('irregularAngles: no polygon');
    const x = 5 * rng.int(8, 26);
    const exprs: AngleExpr[] = [];
    let constants = 0;
    for (let i = 0; i < n - 1; i++) {
      const kind = rng.pick(['x', 'x+q', 'x+q', '2x+q', 'c'] as const);
      let e: AngleExpr;
      if (kind === 'x') e = [1, 0];
      else if (kind === 'x+q') e = [1, 5 * rng.int(-6, 8) || 15];
      else if (kind === '2x+q') e = [2, 5 * rng.int(-12, 4)];
      else {
        if (constants >= n - 3) {
          i--;
          continue;
        }
        constants++;
        e = [0, 5 * rng.int(13, 31)];
      }
      exprs.push(e);
    }
    const last = S - exprs.reduce((s, e) => s + angleVal(e, x), 0);
    if (last < 55 || last > 165) continue;
    let e: AngleExpr;
    if (Math.abs(last - x) <= 45) e = [1, last - x];
    else if (Math.abs(last - 2 * x) <= 50 && 2 * x < 170) e = [2, last - 2 * x];
    else continue;
    exprs.push(e);
    const values = exprs.map((ex) => angleVal(ex, x));
    if (values.some((v) => v < 55 || v > 165)) continue;
    const sumP = exprs.reduce((s, ex) => s + ex[0], 0);
    if (sumP < 3) continue;
    const sumQ = exprs.reduce((s, ex) => s + ex[1], 0);
    const order = rng.shuffle(exprs.map((_, i) => i));
    const ordered = order.map((i) => exprs[i]);
    const pts = polygonWithAngles(
      rng,
      ordered.map((ex) => angleVal(ex, x)),
    );
    if (!pts) continue;

    const maxV = Math.max(...values);
    const maxIdx = values.filter((v) => v === maxV).length === 1 ? values.indexOf(maxV) : -1;
    const largestOk = maxIdx >= 0 && exprs[maxIdx][0] > 0 && maxV !== x;
    const ask: 'x' | 'largest' = d === 1 || !largestOk ? 'x' : d === 3 || rng.chance(0.5) ? 'largest' : 'x';

    const xWith = (total: number) => (total - sumQ) / sumP;
    const xN180 = xWith(n * 180);
    const x360 = xWith(360);
    const good = (v: number) => Number.isInteger(v) && v > 0;
    let correct: number;
    const traps: { value: number; trap: string }[] = [];
    let fillers: number[];
    if (ask === 'x') {
      correct = x;
      if (good(xN180) && xN180 < 200) traps.push({ value: xN180, trap: 'geom-poly-sum-n180' });
      if (n >= 5 && good(x360)) traps.push({ value: x360, trap: 'geom-poly-sum-360' });
      fillers = rng.shuffle([x + 10, x - 10, x + 5, x + 20, x - 5, x - 15, x + 15, x - 20]);
    } else {
      const big = exprs[maxIdx];
      correct = maxV;
      traps.push({ value: x, trap: 'geom-poly-answered-other' });
      if (good(xN180) && angleVal(big, xN180) < 400) traps.push({ value: angleVal(big, xN180), trap: 'geom-poly-sum-n180' });
      if (n >= 5 && good(x360) && angleVal(big, x360) > 0) traps.push({ value: angleVal(big, x360), trap: 'geom-poly-sum-360' });
      const second = [...values].sort((a, b) => b - a).find((v) => v < maxV);
      fillers = rng.shuffle([maxV + 10, maxV - 10, ...(second ? [second] : []), maxV + 20, maxV - 20, maxV + 5]);
    }
    const { choices, answer } = numChoices(rng, {
        step: 5,
      correct,
      traps,
      fillers,
      format: (v) => (ask === 'x' ? `$${num(v)}$` : `$${num(v)}^\\circ$`),
    });

    const fig = new Fig();
    const names = 'ABCDEF'.slice(0, n).split('');
    names.forEach((nm, i) => fig.pt(nm, pts[i]));
    fig.poly(names).hide(...names);
    ordered.forEach((ex, i) => fig.angleLabel(names[(i + n - 1) % n], names[i], names[(i + 1) % n], `$${angleTex(ex)}$`));

    const eqn = exprs.map((ex) => (ex[0] === 0 ? `${ex[1]}` : ex[1] === 0 ? lin([[ex[0], 'x']]) : `(${lin([[ex[0], 'x'], [ex[1], '']])})`)).join(' + ');
    const big = maxIdx >= 0 ? exprs[maxIdx] : exprs[0];
    const stem =
      ask === 'x'
        ? `In the ${POLY_NAME[n]} above, what is the value of $x$?`
        : `In the ${POLY_NAME[n]} above, what is the measure of the largest angle?`;
    const explanation = `A ${POLY_NAME[n]} has ${n} sides, so its interior angles add up to $(${n} - 2) \\cdot 180^\\circ = ${num(S)}^\\circ$:

$$${eqn} = ${num(S)}$$

$$${lin([[sumP, 'x'], [sumQ, '']])} = ${num(S)} \\quad\\Rightarrow\\quad x = ${x}$$

${
  ask === 'x'
    ? `So $x = ${x}$.`
    : `The angles are then ${values
        .slice()
        .sort((a, b) => a - b)
        .map((v) => `$${deg(v)}$`)
        .join(', ')}; the largest is $${angleTex(big).replace(/\^\\circ$/, '')} = ${maxV}^\\circ$. Do not stop at $x = ${x}$.`
}

The angle sum is $(n - 2) \\cdot 180^\\circ$, not $n \\cdot 180^\\circ$${n >= 5 ? ', and only a quadrilateral has $360^\\circ$' : ''}.`;
    return {
      params: { mode: 'irregular', n, exprs: ordered, pts, ask, regularAngle: 0, values: choicesValues(choices) },
      q: { format: 'mcs', stem, figure: fig.build(false), choices, answer, explanation },
    };
  }
}

/* ================================================================== 2. Rectangle dimensions (MCS) */

interface RectParams {
  mode: 'percent' | 'vertices' | 'diagonal';
  P: number;
  A: number;
  pct: number;
  verts: P2[];
  ask: 'area' | 'perimeter' | 'diagonal';
  values: ExData[];
}

const PCT: [number, number, number][] = [
  // percent, numerator, denominator of w / l
  [25, 1, 4],
  [40, 2, 5],
  [50, 1, 2],
  [60, 3, 5],
  [75, 3, 4],
  [80, 4, 5],
];
const DIAG_RECTS: [number, number][] = [
  [6, 8],
  [5, 12],
  [8, 15],
  [9, 12],
  [12, 16],
  [7, 24],
  [20, 21],
  [10, 24],
  [12, 5],
];

const rectangles: Template<RectParams> = {
  id: 'geo.polygons.rectangles',
  skill: 'geo.polygons',
  format: 'mcs',
  style: 'rectangle from a perimeter constraint or from its vertices',
  generate(rng, d) {
    const mode = rng.pick(d === 1 ? (['vertices', 'percent'] as const) : d === 2 ? (['percent', 'vertices', 'percent'] as const) : (['diagonal', 'percent'] as const));
    if (mode === 'percent') {
      const [pct, a, b] = rng.pick(PCT);
      const k = rng.int(d === 1 ? 2 : 3, d === 3 ? 12 : 8) * (b === 2 ? 2 : 1);
      const l = b * k;
      const w = a * k;
      const P = 2 * (l + w);
      const A = l * w;
      const unit = rng.pick(['meters', 'feet', 'yards']);
      const thing = rng.pick(['lawn', 'garden', 'parking lot', 'playing field']);
      // traps
      const wP = (pct * P) / 100; // width taken as p% of the perimeter
      const lP = P / 2 - wP;
      const traps: { v: Ex; trap: string }[] = [];
      if (Number.isInteger(wP * lP) && lP > 0) traps.push({ v: Ex.of(wP * lP), trap: 'geom-rect-percent-of-perimeter' });
      traps.push({ v: Ex.of(4 * A), trap: 'geom-rect-semiperimeter' });
      if (Number.isInteger(P / 4)) traps.push({ v: Ex.of((P / 4) ** 2), trap: 'geom-rect-assumed-square' });
      const { choices, answer, values } = exChoices(rng, Ex.of(A), rng.sample(traps, Math.min(2, traps.length)), [Ex.of(A / 2), Ex.of(2 * A), Ex.of(l * l), Ex.of(A + l), Ex.of(A - w), Ex.of(A - l), Ex.of(w * w)]);
      return {
        params: { mode, P, A, pct, verts: [], ask: 'area', values },
        q: {
          format: 'mcs',
          stem: `A rectangular ${thing} has a perimeter of ${P} ${unit}, and its width is ${pct} percent of its length. What is the area of the ${thing}, in square ${unit}?`,
          choices,
          answer,
          explanation: `Let the length be $\\ell$. The width is $${frac(pct, 100).toTex()}\\ell$, and half the perimeter is length + width:

$$\\ell + ${frac(pct, 100).toTex()}\\ell = \\frac{${P}}{2} = ${P / 2} \\quad\\Rightarrow\\quad ${frac(100 + pct, 100).toTex()}\\ell = ${P / 2} \\quad\\Rightarrow\\quad \\ell = ${l}$$

So the width is $${w}$ and the area is $${l} \\cdot ${w} = ${num(A)}$.

Traps: the width is ${pct} percent of the LENGTH, not of the perimeter; and $\\ell + w$ is half the perimeter, not the whole perimeter.`,
        },
      };
    }
    if (mode === 'vertices') {
      let x1: number, x2: number, y1: number, y2: number;
      do {
        x1 = -rng.int(1, 7);
        x2 = rng.int(1, 8);
        y1 = -rng.int(1, 6);
        y2 = rng.int(1, 7);
      } while (x2 - x1 === y2 - y1 || x2 === -x1 || y2 === -y1);
      if (rng.chance(0.5)) [y1, y2] = [-y2, -y1];
      const W = x2 - x1;
      const H = y2 - y1;
      const ask: 'area' | 'perimeter' = d === 1 || rng.chance(0.7) ? 'perimeter' : 'area';
      const verts: P2[] = rng.shuffle([
        [x1, y1],
        [x2, y1],
        [x2, y2],
        [x1, y2],
      ] as P2[]);
      const Ws = Math.abs(x2 + x1); // sign slip: x2 - |x1|
      const Hs = Math.abs(y2 + y1);
      const correct = ask === 'perimeter' ? 2 * (W + H) : W * H;
      const traps =
        ask === 'perimeter'
          ? [
              { v: Ex.of(W + H), trap: 'geom-rect-half-perimeter' },
              { v: Ex.of(2 * (Ws + H)), trap: 'geom-rect-coordinate-sign' },
              { v: Ex.of(2 * (W + Hs)), trap: 'geom-rect-coordinate-sign' },
              { v: Ex.of(W * H), trap: 'geom-rect-area-for-perimeter' },
            ]
          : [
              { v: Ex.of(Ws * H), trap: 'geom-rect-coordinate-sign' },
              { v: Ex.of(W * Hs), trap: 'geom-rect-coordinate-sign' },
              { v: Ex.of(2 * (W + H)), trap: 'geom-rect-area-for-perimeter' },
            ];
      const { choices, answer, values } = exChoices(rng, Ex.of(correct), rng.sample(traps, 2), [Ex.of(correct + 2), Ex.of(correct - 2), Ex.of(correct + 4), Ex.of(2 * correct), Ex.of(correct - 4), Ex.of(correct + 6)]);
      const pt = ([x, y]: P2) => `(${num(x)}, ${num(y)})`;
      return {
        params: { mode, P: 2 * (W + H), A: W * H, pct: 0, verts, ask, values },
        q: {
          format: 'mcs',
          stem: `In the $xy$-plane, the points $${verts.map(pt).join('$, $')}$ are the vertices of a rectangle. What is the ${ask} of the rectangle?`,
          choices,
          answer,
          explanation: `The sides are parallel to the axes. The horizontal sides run from $x = ${x1}$ to $x = ${x2}$, length $${x2} - (${x1}) = ${W}$; the vertical sides run from $y = ${y1}$ to $y = ${y2}$, length $${y2} - (${y1}) = ${H}$.

${ask === 'perimeter' ? `Perimeter $= 2(${W} + ${H}) = ${2 * (W + H)}$.` : `Area $= ${W} \\cdot ${H} = ${W * H}$.`}

Subtracting a negative coordinate adds its size: the distance from $${x1}$ to $${x2}$ is ${W}, not ${Ws}.${ask === 'perimeter' ? ` And ${W + H} is only half the perimeter.` : ''}`,
        },
      };
    }
    // diagonal from area and perimeter
    const [a, b] = rng.pick(DIAG_RECTS);
    const A = a * b;
    const P = 2 * (a + b);
    const dg = Math.round(Math.hypot(a, b));
    const { choices, answer, values } = exChoices(
      rng,
      Ex.of(dg),
      [
        { v: Ex.of(a + b), trap: 'geom-rect-added-sides' },
        { v: Ex.sqrt(2, (a + b) / 2), trap: 'geom-rect-assumed-square' },
        { v: Ex.sqrt((a + b) ** 2 + 2 * A), trap: 'geom-rect-square-of-sum' },
      ],
      [Ex.sqrt(A), Ex.of(dg + 2), Ex.of(dg - 2), Ex.sqrt(2 * A)],
    );
    return {
      params: { mode: 'diagonal', P, A, pct: 0, verts: [], ask: 'diagonal', values },
      q: {
        format: 'mcs',
        stem: `A rectangle has area ${A} and perimeter ${P}. What is the length of a diagonal of the rectangle?`,
        choices,
        answer,
        explanation: `Let the sides be $\\ell$ and $w$: $\\ell w = ${A}$ and $\\ell + w = ${P / 2}$. The diagonal is $\\sqrt{\\ell^2 + w^2}$, and

$$\\ell^2 + w^2 = (\\ell + w)^2 - 2\\ell w = ${(a + b) ** 2} - ${2 * A} = ${dg * dg}$$

so the diagonal is $${dg}$. (The sides are ${Math.min(a, b)} and ${Math.max(a, b)}: their sum is ${a + b} and their product ${A}.)

Adding the sides (${a + b}) is not the diagonal, and the rectangle is not a square.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    let target: number;
    if (p.mode === 'percent') {
      // Search integer lengths whose width is pct% of them and whose perimeter is P.
      const hits: number[] = [];
      for (let l = 1; l < p.P; l++) {
        const w = p.P / 2 - l;
        if (w > 0 && Math.abs(w * 100 - p.pct * l) < 1e-9) hits.push(l * w);
      }
      if (hits.length !== 1) return `found ${hits.length} rectangles`;
      target = hits[0];
    } else if (p.mode === 'vertices') {
      const c: P2 = [p.verts.reduce((s, v) => s + v[0], 0) / 4, p.verts.reduce((s, v) => s + v[1], 0) / 4];
      const ring = [...p.verts].sort((u, v) => Math.atan2(u[1] - c[1], u[0] - c[0]) - Math.atan2(v[1] - c[1], v[0] - c[0]));
      target = p.ask === 'perimeter' ? pathLength(ring, true) : shoelace(ring);
    } else {
      const hits: number[] = [];
      for (let l = 1; l <= p.P / 2; l++) {
        const w = p.P / 2 - l;
        if (l <= w && l * w === p.A) hits.push(Math.hypot(l, w));
      }
      if (hits.length !== 1) return `found ${hits.length} rectangles`;
      target = hits[0];
    }
    return checkChoiceValue(p.values, q.answer, target);
  },
};

/* ================================================================== 3. Fence on three sides (MCM) */

interface FenceParams {
  sides: 3 | 4;
  F: number;
  A: number;
  longerAlongWall: boolean;
  choices: number[];
}

const fence: Template<FenceParams> = {
  id: 'geo.polygons.fence',
  skill: 'geo.polygons',
  format: 'mcm',
  style: 'which side lengths fit a fence length and an area',
  generate(rng, d) {
    const g = rng.pick(d === 1 ? [1, 2, 5] : [5, 10, 20]);
    if (d === 1) {
      // fenced on all four sides: 2(x + y) = P, xy = A
      let a: number, b: number;
      do {
        a = rng.int(1, 4);
        b = rng.int(a + 1, 8);
      } while (a * b * g * g > 400);
      const sa = a * g;
      const sb = b * g;
      const P = 2 * (sa + sb);
      const A = sa * sb;
      const start = rng.int(1, a);
      const choices = Array.from({ length: 8 }, (_, i) => (i + start) * g);
      const wrongTrap = (v: number) => (A % v === 0 ? 'geom-rect-factor-only' : undefined);
      const items = choices.map((v) => ({
        text: `$${num(v)}$`,
        correct: v === sa || v === sb,
        ...(v !== sa && v !== sb && wrongTrap(v) ? { trap: wrongTrap(v)! } : {}),
      }));
      const { choices: cs, answer } = flaggedChoices(items);
      const unit = 'meters';
      return {
        params: { sides: 4, F: P, A, longerAlongWall: false, choices },
        q: {
          format: 'mcm',
          stem: `A rectangular pen has an area of ${plain(A)} square ${unit} and is enclosed by ${plain(P)} ${unit} of fencing along its four sides. Which of the following could be the length, in ${unit}, of a side of the pen?`,
          instruction: 'Indicate all such lengths.',
          choices: cs,
          answer,
          explanation: `Let the sides be $x$ and $y$: $2(x + y) = ${P}$ and $xy = ${num(A)}$, so $x + y = ${P / 2}$. Two numbers with sum ${P / 2} and product ${plain(A)} are ${sa} and ${sb} (check: $${sa} + ${sb} = ${P / 2}$, $${sa} \\cdot ${sb} = ${num(A)}$).

The pen is ${sa} by ${sb}, so the possible side lengths are ${sa} and ${sb}.

Other factors of ${plain(A)} give the right area but the wrong amount of fencing: check both conditions.`,
        },
      };
    }
    const PAIRS: [number, number][] = [
      [1, 3],
      [1, 4],
      [2, 3],
      [3, 4],
    ];
    const [m1, m2] = rng.pick(PAIRS);
    const a1 = m1 * g;
    const a2 = m2 * g;
    const F = 2 * (a1 + a2);
    const A = 2 * a1 * a2;
    const longerAlongWall = d === 3;
    // x = side perpendicular to the wall, y = side along the wall (2x + y = F, xy = A)
    const pairs: [number, number][] = [
      [a1, 2 * a2],
      [a2, 2 * a1],
    ].filter(([x, y]) => !longerAlongWall || y > x) as [number, number][];
    const sides = new Set(pairs.flat());
    const lo = Math.min(...sides) / g;
    const hi = Math.max(...sides) / g;
    const start = rng.int(Math.max(1, hi - 7), lo);
    const choices = Array.from({ length: 8 }, (_, i) => (i + start) * g);
    const trapFor = (v: number): string | undefined => (A % v === 0 ? 'geom-rect-factor-only' : undefined);
    const items = choices.map((v) => {
      const t = sides.has(v) ? undefined : trapFor(v);
      return { text: `$${num(v)}$`, correct: sides.has(v), ...(t ? { trap: t } : {}) };
    });
    const { choices: cs, answer } = flaggedChoices(items);
    const what = rng.pick(['garden', 'flower bed', 'storage yard']);
    const lines = [
      [a1, 2 * a2],
      [a2, 2 * a1],
    ]
      .map(([x, y]) => {
        const ok = !longerAlongWall || y > x;
        return `- $x = ${x}$: the side along the wall is $${F} - 2 \\cdot ${x} = ${y}$, and $${x} \\cdot ${y} = ${num(A)}$ ✓${ok ? '' : ` (but ${y} is not longer than ${x}, so this shape is excluded)`}`;
      })
      .join('\n');
    return {
      params: { sides: 3, F, A, longerAlongWall, choices },
      q: {
        format: 'mcm',
        stem: `A rectangular ${what} with an area of ${plain(A)} square feet is built against a long wall, so that fencing is needed on only three of its sides. A total of ${plain(F)} feet of fencing is used.${longerAlongWall ? ' The side along the wall is longer than each of the other sides.' : ''} Which of the following could be the length, in feet, of a side of the ${what}?`,
        instruction: 'Indicate all such lengths.',
        choices: cs,
        answer,
        explanation: `Let $x$ be each side perpendicular to the wall and $y$ the side opposite the wall: $2x + y = ${F}$ and $xy = ${num(A)}$. Substituting $y = ${F} - 2x$:

$$x(${F} - 2x) = ${num(A)} \\quad\\Rightarrow\\quad x^2 - ${F / 2}x + ${num(A / 2)} = 0 \\quad\\Rightarrow\\quad x = ${a1} \\text{ or } x = ${a2}$$

${lines}

So the possible side lengths are ${[...sides]
          .sort((u, v) => u - v)
          .join(', ')}.

A factor of ${plain(A)} gives the right area but not necessarily ${F} feet of fencing, and the fence does not cover all four sides.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'wrong format';
    const ok = (v: number) => {
      const A = new Frac(p.A);
      if (p.sides === 4) {
        const other = A.div(v);
        return other.add(v).mul(2).eq(p.F);
      }
      // v perpendicular to the wall
      const y1 = A.div(v);
      const asPerp = new Frac(2 * v).add(y1).eq(p.F) && (!p.longerAlongWall || y1.gt(v));
      // v along the wall
      const x2 = A.div(v);
      const asAlong = x2.mul(2).add(v).eq(p.F) && (!p.longerAlongWall || x2.lt(v));
      return asPerp || asAlong;
    };
    const expected = p.choices.flatMap((v, i) => (ok(v) ? [i] : []));
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

/* ================================================================== 4. Comparisons (QC) */

interface CompareParams {
  mode: 'coord-square' | 'regular-sides' | 'parallelogram' | 'trapezoid' | 'no-angle';
  a: number;
  b: number;
  h: number;
  off: number;
  k: number;
  kFrac: [number, number];
  n1: number;
  n2: number;
  P1: [number, number];
  P2: [number, number];
}

const TRIPLES: [number, number, number][] = [
  // [slanted side, height, horizontal offset]
  [5, 4, 3],
  [5, 3, 4],
  [10, 8, 6],
  [13, 12, 5],
  [13, 5, 12],
  [15, 12, 9],
  [17, 15, 8],
  [10, 6, 8],
];

const compareQC: Template<CompareParams> = {
  id: 'geo.polygons.compare-qc',
  skill: 'geo.polygons',
  format: 'qc',
  style: 'compare areas or sides of quadrilaterals and regular polygons',
  generate(rng, d) {
    const base: CompareParams = { mode: 'coord-square', a: 0, b: 0, h: 0, off: 0, k: 0, kFrac: [0, 1], n1: 0, n2: 0, P1: [0, 1], P2: [0, 1] };
    const r = rng.next();
    const mode: CompareParams['mode'] = r < 0.25 ? 'coord-square' : r < 0.47 ? 'regular-sides' : r < 0.7 ? 'parallelogram' : r < 0.87 ? 'trapezoid' : 'no-angle';

    if (mode === 'coord-square') {
      let a: number, b: number;
      do {
        a = rng.int(d === 1 ? 0 : -4, 6);
        b = rng.int(d === 1 ? 1 : -3, 9);
      } while (a === b || Math.abs(b - a) > 5);
      const t = (b - a) ** 2;
      const area = 4 * t;
      const options: [number, string | undefined][] = [
        [area, undefined],
        [2 * t, 'geom-quad-center-as-side'],
        [2 * t, 'geom-quad-center-as-side'],
        [8 * t, 'geom-quad-diagonal-as-side'],
        [area + rng.pick([-2, -1, 1, 2]) * Math.max(1, t), undefined],
        [area - t, undefined],
      ];
      const [k, trapId] = rng.pick(options);
      const answer = qcCompare(area, k);
      const traps: QCQuestion['traps'] = trapId && answer !== 'C' ? { C: trapId } : undefined;
      const pt = (v: number) => `(${num(v)}, ${num(v)})`;
      return {
        params: { ...base, mode, a, b, k },
        q: {
          format: 'qc',
          info: `In the $xy$-plane, one vertex of square $S$ is the point $${pt(a)}$, and the diagonals of $S$ intersect at the point $${pt(b)}$.`,
          quantityA: `The area of $S$`,
          quantityB: `$${num(k)}$`,
          answer,
          traps,
          explanation: `The diagonals of a square bisect each other, so the vertex opposite $${pt(a)}$ is $${pt(2 * b - a)}$. Both points lie on the line $y = x$, so this diagonal is at $45^\\circ$ and the sides of $S$ are horizontal and vertical: the other two vertices are $(${num(a)}, ${num(2 * b - a)})$ and $(${num(2 * b - a)}, ${num(a)})$.

Each side has length $|${num(2 * b - a)} - ${paren(a)}| = ${2 * Math.abs(b - a)}$, so the area is $${2 * Math.abs(b - a)}^2 = ${area}$. Compare with ${plain(k)}: ${relText(answer)}. (${answer})

The distance from a vertex to the center is half a diagonal, not a side; squaring it gives ${2 * t}, and squaring the full diagonal gives ${8 * t}.`,
        },
      };
    }
    if (mode === 'regular-sides') {
      const [n1, n2] = rng.sample([3, 4, 5, 6, 8, 10], 2);
      const s = new Frac(rng.int(11, d === 1 ? 30 : 49), 10);
      const rel = rng.pick(['C', 'A', 'A', 'B'] as const);
      const s2 = rel === 'C' ? s : rel === 'A' ? s.sub(new Frac(rng.int(1, 3), 10)) : s.add(new Frac(rng.int(1, 3), 10));
      const P1 = s.mul(n1);
      const P2 = s2.mul(n2);
      const answer = qcCompare(s, s2);
      const byPerim = qcCompare(P1, P2);
      const bySides = qcCompare(n2, n1);
      const traps: QCQuestion['traps'] = {};
      if (byPerim !== answer) traps[byPerim] = 'geom-poly-compared-perimeters';
      if (bySides !== answer && !traps[bySides]) traps[bySides] = 'geom-poly-compared-perimeters';
      const dec = (f: Frac) => f.toDecimalString();
      return {
        params: { ...base, mode, n1, n2, P1: [P1.n, P1.d], P2: [P2.n, P2.d] },
        q: {
          format: 'qc',
          quantityA: `The length of a side of a regular polygon with ${n1} sides and perimeter $${dec(P1)}$`,
          quantityB: `The length of a side of a regular polygon with ${n2} sides and perimeter $${dec(P2)}$`,
          answer,
          traps: Object.keys(traps).length ? traps : undefined,
          explanation: `All sides of a regular polygon are equal, so side = perimeter ÷ number of sides.

Quantity A: $\\frac{${dec(P1)}}{${n1}} = ${dec(s)}$. Quantity B: $\\frac{${dec(P2)}}{${n2}} = ${dec(s2)}$. ${relText(answer)[0].toUpperCase() + relText(answer).slice(1)}. (${answer})

Comparing the perimeters (or the numbers of sides) instead of the sides is the trap.`,
        },
      };
    }
    // parallelogram family
    const [a, hgt, off] = rng.pick(TRIPLES.filter((t) => t[0] <= (d === 1 ? 10 : 17)));
    const bLo = Math.max(off + 3, 6);
    const b = rng.int(bLo, Math.max(bLo + 2, Math.round(Math.min(16, 2.5 * hgt + off))));
    const fig = new Fig();
    if (mode === 'trapezoid') {
      // isosceles trapezoid: bottom b1, top b1 - 2 off
      const b2 = rng.int(3, 10);
      const b1 = b2 + 2 * off;
      fig.pt('A', [0, 0]).pt('B', [b1, 0]).pt('C', [b1 - off, hgt]).pt('D', [off, hgt]).pt('E', [off, 0]);
      fig.hide('E').poly(['A', 'B', 'C', 'D']).seg('A', 'B', `$${b1}$`).seg('D', 'C', `$${b2}$`).seg('B', 'C', `$${a}$`).seg('D', 'E', `$${hgt}$`, true).right('D', 'E', 'B');
      const areaTwice = (b1 + b2) * hgt;
      const area = new Frac(areaTwice, 2);
      const legArea = new Frac((b1 + b2) * a, 2);
      const opts: [Frac, string | undefined][] = [
        [area, undefined],
        [legArea, 'geom-quad-slanted-height'],
        [new Frac(areaTwice), 'geom-quad-trapezoid-no-half'],
        [area.sub(rng.int(1, 4)), undefined],
        [area.sub(rng.int(1, 4)), undefined],
        [area.add(rng.int(1, 3)), undefined],
      ];
      const [kF, trapId] = rng.pick(opts);
      const answer = qcCompare(area, kF);
      return {
        params: { ...base, mode, a, b: b1, h: hgt, off, k: kF.toNumber(), kFrac: [kF.n, kF.d], n1: b2 },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: `$ABCD$ is a trapezoid with $AB$ parallel to $DC$.`,
          quantityA: `The area of $ABCD$`,
          quantityB: `$${kF.isInt() ? num(kF.n) : kF.toDecimalString()}$`,
          answer,
          traps: trapId && answer !== 'C' ? { C: trapId } : undefined,
          explanation: `Trapezoid area $= \\frac{1}{2}(b_1 + b_2)h$, where $h$ is the perpendicular distance between the parallel sides (the dashed segment), not the slanted side:

$$\\frac{1}{2}(${b1} + ${b2})(${hgt}) = ${area.isInt() ? area.n : area.toDecimalString()}$$

Compare with ${kF.isInt() ? kF.n : kF.toDecimalString()}: ${relText(answer)}. (${answer})

Using the slanted side ${a} as the height gives ${legArea.isInt() ? legArea.n : legArea.toDecimalString()}; forgetting the $\\frac{1}{2}$ gives ${areaTwice}.`,
        },
      };
    }
    const drawOff = mode === 'no-angle' ? a * Math.cos((rng.int(55, 72) * Math.PI) / 180) : off;
    const drawH = mode === 'no-angle' ? Math.sqrt(a * a - drawOff * drawOff) : hgt;
    fig.pt('A', [0, 0]).pt('B', [b, 0]).pt('C', [b + drawOff, drawH]).pt('D', [drawOff, drawH]);
    fig.poly(['A', 'B', 'C', 'D']).seg('A', 'B', `$${b}$`).seg('A', 'D', `$${a}$`);
    if (mode === 'parallelogram') {
      fig.pt('E', [off, 0]).hide('E').seg('D', 'E', `$${hgt}$`, true).right('D', 'E', 'B');
      const area = b * hgt;
      const opts: [number, string | undefined][] = [
        [area, undefined],
        [a * b, 'geom-quad-slanted-height'],
        [area - rng.int(1, 4), undefined],
        [area - rng.int(1, 4), undefined],
        [area + rng.int(1, 3), undefined],
        [Math.round((area + a * b) / 2), 'geom-quad-slanted-height'],
      ];
      const [k, trapId] = rng.pick(opts);
      const answer = qcCompare(area, k);
      const trapAns = qcCompare(a * b, k);
      return {
        params: { ...base, mode, a, b, h: hgt, off, k },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: `$ABCD$ is a parallelogram.`,
          quantityA: `The area of $ABCD$`,
          quantityB: `$${num(k)}$`,
          answer,
          traps: trapId && trapAns !== answer ? { [trapAns]: trapId } : undefined,
          explanation: `The area of a parallelogram is base × height, and the height is the perpendicular (dashed) segment: $${b} \\cdot ${hgt} = ${area}$.

Compare with ${plain(k)}: ${relText(answer)}. (${answer})

Multiplying the two sides, $${b} \\cdot ${a} = ${a * b}$, uses the slanted side as if it were the height; the slanted side is always longer than the height.`,
        },
      };
    }
    // no-angle: only the two sides are known
    const ab = a * b;
    const kind = rng.pick(['eq', 'eq', 'less', 'more'] as const);
    const k = kind === 'eq' ? ab : kind === 'less' ? ab - rng.int(1, Math.min(10, ab - 1)) : ab + rng.int(1, 8);
    const answer: QCChoice = kind === 'more' ? 'B' : 'D';
    const traps: QCQuestion['traps'] = kind === 'eq' ? { C: 'geom-quad-assumed-rectangle' } : kind === 'less' ? { A: 'geom-quad-assumed-rectangle' } : undefined;
    return {
      params: { ...base, mode, a, b, k },
      q: {
        format: 'qc',
        figure: fig.build(false),
        info: `$ABCD$ is a parallelogram.`,
        quantityA: `The area of $ABCD$`,
        quantityB: `$${num(k)}$`,
        answer,
        traps,
        explanation: `Only the sides are given. With base $AB = ${b}$, the height is at most the slanted side $AD = ${a}$, and it equals ${a} only when the angles are right angles. So the area can be any value greater than 0 and at most $${b} \\cdot ${a} = ${ab}$.

${
  kind === 'more'
    ? `Since ${k} is greater than ${ab}, Quantity B is greater in every case. (B)`
    : `If $ABCD$ is a rectangle the area is ${ab}${kind === 'eq' ? ', equal to Quantity B' : `, greater than ${k}`}; if the angle at $A$ is small, the area is close to 0, less than ${k}. (D)`
}

Do not read the angles off the figure: geometric figures are not necessarily drawn to scale, and nothing says the angles are right angles.`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    let expected: QCChoice;
    if (p.mode === 'coord-square') {
      // Build all four vertices by rotating the given vertex 90° around the center; shoelace area.
      const v: P2 = [p.a, p.a];
      const c: P2 = [p.b, p.b];
      const rot = (k: number): P2 => {
        const t = (k * Math.PI) / 2;
        const dx = v[0] - c[0];
        const dy = v[1] - c[1];
        return [c[0] + dx * Math.cos(t) - dy * Math.sin(t), c[1] + dx * Math.sin(t) + dy * Math.cos(t)];
      };
      expected = qcCompareNum(shoelace([0, 1, 2, 3].map(rot)), p.k);
    } else if (p.mode === 'regular-sides') {
      const side = (n: number, P: [number, number]) => dist(...(regularPolygon(n, 1).slice(0, 2) as [P2, P2])) * (P[0] / P[1] / pathLength(regularPolygon(n, 1), true));
      expected = qcCompareNum(side(p.n1, p.P1), side(p.n2, p.P2));
    } else if (p.mode === 'no-angle') {
      const samples: [number, number][] = [];
      for (let i = 0; i < 40; i++) {
        const t = i === 0 ? Math.PI / 2 : 0.02 + rng.next() * (Math.PI - 0.04);
        const D: P2 = [p.a * Math.cos(t), p.a * Math.sin(t)];
        samples.push([shoelace([[0, 0], [p.b, 0], [p.b + D[0], D[1]], D]), p.k]);
      }
      expected = qcFromSamples(samples);
    } else if (p.mode === 'parallelogram') {
      const D: P2 = [p.off, Math.sqrt(p.a * p.a - p.off * p.off)];
      expected = qcCompareNum(shoelace([[0, 0], [p.b, 0], [p.b + D[0], D[1]], D]), p.k);
    } else {
      const b2 = p.n1;
      const yTop = Math.sqrt(p.a * p.a - p.off * p.off);
      expected = qcCompareNum(shoelace([[0, 0], [p.b, 0], [p.b - p.off, yTop], [p.off, yTop]]), p.kFrac[0] / p.kFrac[1]);
      if (Math.abs(p.b - 2 * p.off - b2) > 1e-9) return 'trapezoid top base inconsistent';
    }
    return q.answer === expected ? null : `expected ${expected} (${QC_TEXT[expected]})`;
  },
};

/* ================================================================== 5. One perimeter as a fraction of another (NE) */

interface FractionParams {
  mode: 'perimeter' | 'area' | 'same-perimeter' | 'same-area';
  L: number;
  W: number;
  s: number;
  inverse: boolean;
}

const perimeterFraction: Template<FractionParams> = {
  id: 'geo.polygons.perimeter-fraction',
  skill: 'geo.polygons',
  format: 'ne',
  style: 'perimeter or area of one figure as a fraction of another',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1 ? (['perimeter'] as const) : d === 2 ? (['perimeter', 'area', 'area'] as const) : (['same-perimeter', 'same-area', 'area'] as const),
    );
    let L = 0;
    let W = 0;
    let s = 0;
    let answer: Frac;
    const traps: { value: Frac; trap: string }[] = [];
    let stem = '';
    let explanation = '';
    let inverse = false;
    const fig = new Fig();
    for (;;) {
      if (mode === 'same-area') {
        [W, L, s] = rng.pick([
          [4, 9, 6],
          [2, 8, 4],
          [3, 12, 6],
          [4, 16, 8],
          [2, 18, 6],
          [9, 16, 12],
          [5, 20, 10],
          [3, 27, 9],
          [8, 18, 12],
        ] as [number, number, number][]);
      } else {
        L = rng.int(d === 1 ? 4 : 5, d === 1 ? 15 : 24);
        W = rng.int(2, L - 1);
        s = mode === 'same-perimeter' ? (L + W) / 2 : rng.int(2, Math.max(3, L - 1));
        if (mode === 'same-perimeter' && !Number.isInteger(s)) continue;
      }
      const PR = 2 * (L + W);
      const PS = 4 * s;
      const AR = L * W;
      const AS = s * s;
      if (mode === 'perimeter') {
        if (PS >= PR) continue;
        answer = new Frac(PS, PR);
        traps.push({ value: new Frac(AS, AR), trap: 'geom-rect-area-for-perimeter' }, { value: new Frac(PR, PS), trap: 'geom-meas-fraction-inverted' }, { value: new Frac(PS, 2 * L + W), trap: 'geom-rect-three-sides' });
      } else if (mode === 'area') {
        inverse = AS > AR;
        if (AS === AR) continue;
        answer = inverse ? new Frac(AR, AS) : new Frac(AS, AR);
        traps.push({ value: inverse ? new Frac(PR, PS) : new Frac(PS, PR), trap: 'geom-rect-area-for-perimeter' }, { value: answer.inv(), trap: 'geom-meas-fraction-inverted' });
      } else if (mode === 'same-perimeter') {
        if (L === W) continue;
        answer = new Frac(AR, AS);
        traps.push({ value: new Frac(1), trap: 'geom-rect-same-perimeter' }, { value: answer.inv(), trap: 'geom-meas-fraction-inverted' });
      } else {
        answer = new Frac(PS, PR);
        traps.push({ value: new Frac(1), trap: 'geom-rect-same-perimeter' }, { value: answer.inv(), trap: 'geom-meas-fraction-inverted' });
      }
      if (answer.isInt()) continue;
      break;
    }
    const PR = 2 * (L + W);
    const PS = 4 * s;
    const AR = L * W;
    const AS = s * s;
    const t = (f: Frac) => f.toTex();
    const fracEq = (n: number, dd: number) => (new Frac(n, dd).n === n ? `\\frac{${n}}{${dd}}` : `\\frac{${n}}{${dd}} = ${t(new Frac(n, dd))}`);
    // figure: R and S side by side
    fig.pt('R1', [0, 0]).pt('R2', [L, 0]).pt('R3', [L, W]).pt('R4', [0, W]);
    const gap = Math.max(2, L * 0.25);
    fig.pt('S1', [L + gap, 0]).pt('S2', [L + gap + s, 0]).pt('S3', [L + gap + s, s]).pt('S4', [L + gap, s]);
    fig.hide('R1', 'R2', 'R3', 'R4', 'S1', 'S2', 'S3', 'S4');
    fig.poly(['R1', 'R2', 'R3', 'R4']).poly(['S1', 'S2', 'S3', 'S4']);
    fig.seg('R1', 'R2', `$${L}$`).seg('R2', 'R3', `$${W}$`);
    if (mode !== 'same-perimeter' && mode !== 'same-area') fig.seg('S1', 'S2', `$${s}$`);
    fig.label([L / 2, W / 2], '$R$').label([L + gap + s / 2, s / 2], '$S$');
    if (mode === 'perimeter') {
      stem = `Rectangle $R$ has length ${L} and width ${W}, and square $S$ has sides of length ${s}. The perimeter of $S$ is what fraction of the perimeter of $R$?`;
      explanation = `Perimeter of $S$: $4 \\cdot ${s} = ${PS}$. Perimeter of $R$: $2(${L} + ${W}) = ${PR}$.

The fraction is $${fracEq(PS, PR)}$ (any equivalent fraction is accepted).

"$S$ is what fraction of $R$" puts $S$ on top. Using $2 \\cdot ${L} + ${W}$ counts only three sides, and the ratio of the AREAS is a different question.`;
    } else if (mode === 'area') {
      const [top, bottom] = inverse ? ['R', 'S'] : ['S', 'R'];
      stem = `Rectangle $R$ has length ${L} and width ${W}, and square $S$ has sides of length ${s}. The area of $${top}$ is what fraction of the area of $${bottom}$?`;
      explanation = `Area of $R$: $${L} \\cdot ${W} = ${AR}$. Area of $S$: $${s}^2 = ${AS}$.

The fraction is $${fracEq(inverse ? AR : AS, inverse ? AS : AR)}$.

The quantity after "of" goes in the denominator; the perimeters give a different fraction.`;
    } else if (mode === 'same-perimeter') {
      stem = `Rectangle $R$ has length ${L} and width ${W}. Square $S$ has the same perimeter as $R$. The area of $R$ is what fraction of the area of $S$?`;
      explanation = `The perimeter of $R$ is $2(${L} + ${W}) = ${PR}$, so each side of $S$ is $\\frac{${PR}}{4} = ${s}$ and the area of $S$ is $${AS}$.

The area of $R$ is $${L} \\cdot ${W} = ${AR}$, so the fraction is $${fracEq(AR, AS)}$.

Equal perimeters do not mean equal areas: among rectangles with a given perimeter, the square has the largest area.`;
    } else {
      stem = `Rectangle $R$ has length ${L} and width ${W}. Square $S$ has the same area as $R$. The perimeter of $S$ is what fraction of the perimeter of $R$?`;
      explanation = `The area of $R$ is $${L} \\cdot ${W} = ${AR}$, so each side of $S$ is $\\sqrt{${AR}} = ${s}$ and the perimeter of $S$ is $${PS}$.

The perimeter of $R$ is $2(${L} + ${W}) = ${PR}$, so the fraction is $${fracEq(PS, PR)}$.

Equal areas do not mean equal perimeters: for a given area, the square has the smallest perimeter.`;
    }
    return {
      params: { mode, L, W, s, inverse },
      q: {
        format: 'ne',
        stem,
        figure: fig.build(false),
        fractionBoxes: true,
        answer: answer!,
        traps: traps.filter((x) => !x.value.eq(answer!)),
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const R: P2[] = [
      [0, 0],
      [p.L, 0],
      [p.L, p.W],
      [0, p.W],
    ];
    const perR = pathLength(R, true);
    const areaR = shoelace(R);
    let side = p.s;
    if (p.mode === 'same-perimeter') side = perR / 4;
    if (p.mode === 'same-area') side = Math.sqrt(areaR);
    const S: P2[] = [
      [0, 0],
      [side, 0],
      [side, side],
      [0, side],
    ];
    const perS = pathLength(S, true);
    const areaS = shoelace(S);
    const v =
      p.mode === 'perimeter' || p.mode === 'same-area' ? perS / perR : p.mode === 'same-perimeter' ? areaR / areaS : p.inverse ? areaR / areaS : areaS / areaR;
    return Math.abs(q.answer.toNumber() - v) < 1e-9 ? null : `expected ${v}`;
  },
};

export const polygonTemplates = [angleSum, rectangles, fence, compareQC, perimeterFraction];

