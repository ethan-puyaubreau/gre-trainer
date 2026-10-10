import { flaggedChoices, qcFromSamples, QC_TEXT } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { num, plain } from '../../../engine/tex';
import type { QCChoice, QCQuestion, Template } from '../../../engine/types';
import { checkChoiceValue, Ex, exChoices, unitCircle, type ExData } from './ex';
import { drawBox, drawCylinder, Fig } from './fig';

type V3 = [number, number, number];
const relText = (a: QCChoice) => (a === 'A' ? 'Quantity A is greater' : a === 'B' ? 'Quantity B is greater' : 'the two quantities are equal');
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
function cmpTol(a: number, b: number, tol = 1e-6): QCChoice {
  if (Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))) return 'C';
  return a > b ? 'A' : 'B';
}

/** The 8 corners of an axis-parallel box [0,l] x [0,w] x [0,h]. */
const corners = (l: number, w: number, h: number): V3[] => [0, 1].flatMap((i) => [0, 1].flatMap((j) => [0, 1].map((k) => [i * l, j * w, k * h] as V3)));
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
/** Box measured from its corners: longest corner-to-corner distance, total face area, volume (triple product). */
function measureBox(l: number, w: number, h: number): { diag: number; surface: number; volume: number } {
  const c = corners(l, w, h);
  let diag = 0;
  for (const p of c) for (const q of c) diag = Math.max(diag, norm(sub3(p, q)));
  const o = c[0];
  const ex = sub3(c[4], o);
  const ey = sub3(c[2], o);
  const ez = sub3(c[1], o);
  const faces = [cross(ex, ey), cross(ex, ez), cross(ey, ez)].map(norm);
  const volume = Math.abs(ex[0] * (ey[1] * ez[2] - ey[2] * ez[1]) - ex[1] * (ey[0] * ez[2] - ey[2] * ez[0]) + ex[2] * (ey[0] * ez[1] - ey[1] * ez[0]));
  return { diag, surface: 2 * faces.reduce((s, x) => s + x, 0), volume };
}

/* ================================================================== 1. Measures of boxes, cubes and cylinders (MCS) */

interface MeasuresParams {
  mode: 'cube-diagonal' | 'box-diagonal' | 'surface' | 'cube-v2s' | 'cube-s2v' | 'faces' | 'cylinder' | 'tank';
  dims: number[];
  values: ExData[];
}

const DIAG_BOXES: [number, number, number][] = [
  [1, 2, 2],
  [2, 3, 6],
  [1, 4, 8],
  [4, 4, 7],
  [2, 6, 9],
  [6, 6, 7],
  [3, 4, 12],
  [2, 10, 11],
  [8, 9, 12],
  [4, 5, 20],
  [6, 10, 15],
  [12, 15, 16],
];

const measures: Template<MeasuresParams> = {
  id: 'geo.solids.measures',
  skill: 'geo.solids',
  format: 'mcs',
  style: 'volume, surface area or diagonal of a box, cube or cylinder',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1
        ? (['cube-diagonal', 'surface', 'cube-v2s', 'cube-s2v'] as const)
        : d === 2
          ? (['box-diagonal', 'surface', 'cylinder', 'cube-s2v'] as const)
          : (['box-diagonal', 'faces', 'cylinder', 'tank'] as const),
    );
    const fig = new Fig();
    let correct: Ex;
    const traps: { v: Ex; trap: string }[] = [];
    let fillers: Ex[] = [];
    let stem: string;
    let explanation: string;
    let dims: number[];
    let step: Ex | undefined;
    let withFigure = true;
    if (mode === 'cube-diagonal') {
      const e = rng.int(2, 9);
      dims = [e];
      correct = Ex.sqrt(3, e);
      traps.push({ v: Ex.sqrt(2, e), trap: 'geom-solid-face-diagonal' }, { v: Ex.of(3 * e), trap: 'geom-solid-added-edges' });
      fillers = [Ex.of(e), Ex.of(2 * e), Ex.sqrt(6, e), Ex.of(e * e)];
      step = Ex.sqrt(3, 1);
      drawBox(fig, e, e, e, { L: `$${e}$` }, { diagonal: true });
      stem = `The figure above shows a cube with edges of length ${e}. What is the length of the dashed segment, which joins two opposite vertices of the cube?`;
      explanation = `The diagonal of the bottom face is $${e}\\sqrt{2}$ (a 45-45-90 triangle). The dashed diagonal is the hypotenuse of a right triangle with that face diagonal and a vertical edge as legs:

$$\\sqrt{(${e}\\sqrt{2})^2 + ${e}^2} = \\sqrt{${2 * e * e} + ${e * e}} = \\sqrt{${3 * e * e}} = ${correct.tex()}$$

$${e}\\sqrt{2}$ is only a face diagonal, and adding the three edges does not give a straight-line distance.`;
    } else if (mode === 'box-diagonal') {
      const [a, b, c] = rng.shuffle(rng.pick(DIAG_BOXES));
      dims = [a, b, c];
      const dg = Math.round(Math.hypot(a, b, c));
      correct = Ex.of(dg);
      traps.push({ v: Ex.sqrt(a * a + b * b), trap: 'geom-solid-face-diagonal' }, { v: Ex.of(a + b + c), trap: 'geom-solid-added-edges' });
      fillers = [Ex.sqrt(b * b + c * c), Ex.of(dg + 1), Ex.of(dg - 1), Ex.sqrt(a * a + b * b + c * c + 2 * a * b)];
      step = Ex.of(1);
      drawBox(fig, a, b, c, { L: `$${a}$`, W: `$${b}$`, H: `$${c}$` }, { diagonal: true });
      stem = `The rectangular box shown above has dimensions ${a}, ${b} and ${c}. What is the length of the dashed segment, which joins two opposite vertices of the box?`;
      explanation = `The space diagonal of a box is $\\sqrt{\\ell^2 + w^2 + h^2}$ (the Pythagorean theorem used twice: first across the bottom face, then up):

$$\\sqrt{${a}^2 + ${b}^2 + ${c}^2} = \\sqrt{${a * a} + ${b * b} + ${c * c}} = \\sqrt{${a * a + b * b + c * c}} = ${dg}$$

$\\sqrt{${a}^2 + ${b}^2} = ${Ex.sqrt(a * a + b * b).tex()}$ is only the diagonal of the bottom face.`;
    } else if (mode === 'surface') {
      let a: number, b: number, c: number;
      do {
        [a, b, c] = [rng.int(2, 9), rng.int(2, 9), rng.int(2, 12)];
      } while (a === b || b === c || a === c);
      dims = [a, b, c];
      const half = a * b + a * c + b * c;
      correct = Ex.of(2 * half);
      traps.push({ v: Ex.of(half), trap: 'geom-solid-surface-half' }, { v: Ex.of(a * b * c), trap: 'geom-solid-volume-for-surface' });
      fillers = [Ex.of(2 * half - 2 * a * b), Ex.of(4 * half), Ex.of(2 * half + 2 * a * b), Ex.of(2 * half - 2 * b * c)];
      step = Ex.of(2 * Math.min(a, b, c));
      drawBox(fig, a, b, c, { L: `$${a}$`, W: `$${b}$`, H: `$${c}$` });
      stem = `What is the total surface area of the rectangular box shown above?`;
      explanation = `A box has 6 faces in 3 equal pairs: $${a} \\times ${b}$, $${a} \\times ${c}$ and $${b} \\times ${c}$.

$$2(${a * b} + ${a * c} + ${b * c}) = 2(${half}) = ${2 * half}$$

Counting each pair once gives ${half}, and $${a} \\cdot ${b} \\cdot ${c} = ${a * b * c}$ is the volume, not the surface area.`;
    } else if (mode === 'cube-v2s' || mode === 'cube-s2v') {
      const e = rng.int(2, d === 1 ? 6 : 9);
      dims = [e];
      const V = e ** 3;
      const S = 6 * e * e;
      withFigure = false;
      if (mode === 'cube-v2s') {
        correct = Ex.of(S);
        traps.push({ v: Ex.of(4 * e * e), trap: 'geom-solid-cube-four-faces' }, { v: Ex.of(e * e), trap: 'geom-solid-one-face' });
        fillers = [Ex.of(V), Ex.of(8 * e * e), Ex.of(6 * e), Ex.of(12 * e)];
        step = Ex.of(e * e);
        stem = `The volume of a cube is ${plain(V)} cubic centimeters. What is the total surface area of the cube, in square centimeters?`;
        explanation = `The edge is $\\sqrt[3]{${num(V)}} = ${e}$. Each face is a ${e}-by-${e} square of area ${e * e}, and a cube has 6 faces: $6 \\cdot ${e * e} = ${S}$.

A cube has 6 faces, not 4: $4 \\cdot ${e * e} = ${4 * e * e}$ leaves out the top and bottom.`;
      } else {
        correct = Ex.of(V);
        traps.push({ v: Ex.of(e * e), trap: 'geom-solid-one-face' }, { v: Ex.of(S), trap: 'geom-solid-volume-for-surface' });
        fillers = [Ex.of(e), Ex.of(2 * V), Ex.of((e + 1) ** 3), Ex.of((e - 1) ** 3)];
        step = Ex.of(e * e);
        stem = `The total surface area of a cube is ${plain(S)} square inches. What is the volume of the cube, in cubic inches?`;
        explanation = `Each of the 6 faces has area $\\frac{${num(S)}}{6} = ${e * e}$, so the edge is $\\sqrt{${e * e}} = ${e}$ and the volume is $${e}^3 = ${num(V)}$.

${e * e} is the area of one face, not the volume.`;
      }
    } else if (mode === 'faces') {
      let a: number, b: number, c: number;
      do {
        [a, b, c] = [rng.int(2, 6), rng.int(2, 7), rng.int(3, 9)];
      } while (a === b || b === c || a === c);
      dims = [a, b, c];
      const [f1, f2, f3] = rng.shuffle([a * b, a * c, b * c]);
      correct = Ex.of(a * b * c);
      traps.push({ v: Ex.of(f1 * f2 * f3), trap: 'geom-solid-face-product' }, { v: Ex.of(2 * (f1 + f2 + f3)), trap: 'geom-solid-volume-for-surface' });
      fillers = [Ex.of(f1 + f2 + f3), Ex.of(a * b * c * 2), Ex.of(a * b * c - a * b), Ex.of(a * b * c + b * c)];
      step = Ex.of(Math.min(f1, f2, f3));
      withFigure = false;
      stem = `Three faces of a rectangular box that share a vertex have areas ${f1}, ${f2} and ${f3} square inches. What is the volume of the box, in cubic inches?`;
      explanation = `If the edges are $\\ell$, $w$ and $h$, the faces are $\\ell w$, $\\ell h$ and $wh$, so their product is $(\\ell w)(\\ell h)(wh) = (\\ell w h)^2$:

$$(\\ell w h)^2 = ${f1} \\cdot ${f2} \\cdot ${f3} = ${num(f1 * f2 * f3)}, \\quad \\ell w h = \\sqrt{${num(f1 * f2 * f3)}} = ${a * b * c}$$

(The edges are ${[a, b, c].sort((x, y) => x - y).join(', ')}.) Do not forget the square root: ${plain(f1 * f2 * f3)} is the square of the volume.`;
    } else if (mode === 'cylinder') {
      const r = rng.int(2, 9);
      const h = rng.int(2, 12);
      dims = [r, h];
      const k = r * r * h;
      correct = Ex.pi(2 * r);
      traps.push({ v: Ex.pi(r), trap: 'geom-circle-radius-diameter' }, { v: Ex.pi(r * r), trap: 'geom-solid-base-area' }, { v: Ex.of(r), trap: 'geom-solid-radius-not-circ' });
      fillers = [Ex.of(r * r), Ex.pi(4 * r), Ex.of(2 * r), Ex.pi(h)];
      step = Ex.pi(2);
      drawCylinder(fig, 3, 3 * Math.max(0.8, Math.min(2.2, h / (2 * r))), { h: `$${h}$` });
      stem = `The volume $V$ of a right circular cylinder with radius $r$ and height $h$ is $V = \\pi r^2 h$. The cylinder shown above has volume $${num(k)}\\pi$ and height ${h}. What is the circumference of its base?`;
      explanation = `From $\\pi r^2 \\cdot ${h} = ${num(k)}\\pi$: $r^2 = \\frac{${num(k)}}{${h}} = ${r * r}$, so $r = ${r}$.

The circumference of the base is $2\\pi r = ${correct.tex()}$.

${r} is the radius and $${Ex.pi(r * r).tex()}$ is the area of the base, not its circumference.`;
    } else {
      // tank with a liquid that expands when it freezes [GE-24]
      let H = 0;
      let p = 0;
      let v = 0;
      let wrong = 0;
      for (;;) {
        H = 10 * rng.int(6, 30);
        p = rng.pick([10, 15, 20, 25, 30, 40, 50]);
        v = H / (1 + p / 100);
        wrong = H * (1 - p / 100);
        const near = Math.round(v / 5) * 5;
        if (Math.abs(v - near) < 1.2 && Math.round(wrong / 5) * 5 !== near) break;
      }
      const L = 10 * rng.int(5, 20);
      const W = 10 * rng.int(3, 12);
      dims = [L, W, H, p];
      const near = Math.round(v / 5) * 5;
      correct = Ex.of(near);
      traps.push({ v: Ex.of(Math.round(wrong / 5) * 5), trap: 'geom-solid-percent-subtract' });
      fillers = [Ex.of(near - 5), Ex.of(near + 5), Ex.of(near - 10), Ex.of(near + 10), Ex.of(near + 15), Ex.of(near - 15)];
      step = Ex.of(5);
      drawBox(fig, L, W, H, { L: `$${L}$`, W: `$${W}$`, H: `$${H}$` }, { waterLevel: v });
      stem = `A rectangular tank with interior dimensions ${L} centimeters by ${W} centimeters by ${H} centimeters (height) stands on level ground. It is to be filled with a liquid that expands by ${p} percent of its volume when it freezes. To the nearest 5 centimeters, what is the greatest depth to which the tank can be filled so that, once frozen, the liquid does not rise above the top of the tank?`;
      explanation = `The base area is the same before and after freezing, so heights scale like volumes: a depth $h$ becomes $${new Frac(100 + p, 100).toDecimalString()}h$ when frozen.

$$${new Frac(100 + p, 100).toDecimalString()}h \\le ${H} \\quad\\Rightarrow\\quad h \\le \\frac{${H}}{${new Frac(100 + p, 100).toDecimalString()}} \\approx ${v.toFixed(1)}$$

The closest choice is ${near}. Taking ${p} percent off the height ($${H} \\times ${new Frac(100 - p, 100).toDecimalString()} = ${Number(wrong.toFixed(2))}$) is wrong: the frozen volume is ${p} percent MORE than the liquid's volume, so divide by $${new Frac(100 + p, 100).toDecimalString()}$. The length and width are not needed.`;
    }
    const { choices, answer, values } = exChoices(rng, correct, traps, fillers, { minGap: 0.02, ...(step ? { step } : {}), scales: mode !== 'tank' });
    return {
      params: { mode, dims, values },
      q: { format: 'mcs', stem, ...(withFigure ? { figure: fig.build(false) } : {}), choices, answer, explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'wrong format';
    let target: number;
    switch (p.mode) {
      case 'cube-diagonal':
        target = measureBox(p.dims[0], p.dims[0], p.dims[0]).diag;
        break;
      case 'box-diagonal':
        target = measureBox(p.dims[0], p.dims[1], p.dims[2]).diag;
        break;
      case 'surface':
        target = measureBox(p.dims[0], p.dims[1], p.dims[2]).surface;
        break;
      case 'cube-v2s':
        target = measureBox(p.dims[0], p.dims[0], p.dims[0]).surface;
        break;
      case 'cube-s2v':
        target = measureBox(p.dims[0], p.dims[0], p.dims[0]).volume;
        break;
      case 'faces': {
        // brute force: integer edges whose pairwise products are the three face areas
        const [f1, f2, f3] = [p.dims[0] * p.dims[1], p.dims[0] * p.dims[2], p.dims[1] * p.dims[2]].sort((x, y) => x - y);
        const vols = new Set<number>();
        // with l <= w <= h the face areas come out sorted: lw <= lh <= wh
        for (let l = 1; l <= 30; l++) for (let w = l; w <= 30; w++) for (let h = w; h <= 30; h++) if (l * w === f1 && l * h === f2 && w * h === f3) vols.add(l * w * h);
        if (vols.size !== 1) return `found ${vols.size} volumes`;
        target = [...vols][0];
        break;
      }
      case 'cylinder': {
        // find r from the volume with the polygon disk, then the polygon circumference
        const [r0, h] = p.dims;
        const u = unitCircle();
        const vol = r0 * r0 * h * Math.PI;
        const r = Math.sqrt(vol / (h * u.area));
        target = r * u.perim;
        break;
      }
      default: {
        // tank: largest depth (bisection) whose frozen volume fits, then the closest multiple of 5 among the choices
        const [L, W, H, pct] = p.dims;
        let lo = 0;
        let hi = H;
        for (let i = 0; i < 60; i++) {
          const mid = (lo + hi) / 2;
          if (L * W * mid * (1 + pct / 100) <= L * W * H) lo = mid;
          else hi = mid;
        }
        const vals = p.values.map((v) => Ex.from(v).value());
        const best = vals.reduce((bi, v, i) => (Math.abs(v - lo) < Math.abs(vals[bi] - lo) ? i : bi), 0);
        return best === q.answer ? null : `expected choice ${best} (depth ${lo})`;
      }
    }
    return checkChoiceValue(p.values, q.answer, target, 1e-5);
  },
};

/* ================================================================== 2. Pouring, packing, filling (NE) */

interface PourParams {
  mode: 'cyl-cyl' | 'box-box' | 'cyl-box' | 'packing' | 'fill';
  a: number[];
  b: number[];
  extra: number;
}

const pour: Template<PourParams> = {
  id: 'geo.solids.pour',
  skill: 'geo.solids',
  format: 'ne',
  style: 'pour liquid between containers, pack cubes, fill a tank',
  generate(rng, d) {
    const mode = rng.pick(
      d === 1 ? (['box-box', 'cyl-cyl', 'packing'] as const) : d === 2 ? (['cyl-cyl', 'packing', 'fill'] as const) : (['cyl-box', 'packing', 'cyl-cyl'] as const),
    );
    const fig = new Fig();
    const traps: { value: Frac; trap: string }[] = [];
    let answer: Frac;
    let stem: string;
    let explanation: string;
    let suffix: string | undefined;
    let a: number[] = [];
    let b: number[] = [];
    let extra = 0;
    let withFigure = true;
    if (mode === 'cyl-cyl') {
      let rA: number, rB: number, hA: number, h2: Frac;
      do {
        rA = rng.int(2, 9);
        rB = rng.int(2, 10);
        hA = rng.int(3, 20);
        h2 = new Frac(rA * rA * hA, rB * rB);
      } while (rA === rB || !h2.isTerminating() || h2.d > 4 || h2.lt(1) || h2.gt(60));
      const useDiam = d >= 2 && rng.chance(0.6);
      const HB = Math.ceil(h2.toNumber()) + rng.int(2, 8);
      a = [rA, hA];
      b = [rB, HB];
      answer = h2;
      const lin = new Frac(rA * hA, rB);
      if (lin.isTerminating() && !lin.eq(h2)) traps.push({ value: lin, trap: 'geom-solid-scale-linear' });
      if (useDiam) {
        const wrong = new Frac(rA * rA * hA, 4 * rB * rB);
        if (wrong.isTerminating()) traps.push({ value: wrong, trap: 'geom-circle-radius-diameter' });
      }
      const s = 1 / Math.max(rA, rB, 1);
      const hs = (x: number) => (x / Math.max(hA, HB)) * 6;
      drawCylinder(fig, rA * s * 2, hs(Math.max(hA + 2, hA * 1.3)), { r: `$${rA}$` }, { origin: [0, 0], waterLevel: hs(hA) });
      drawCylinder(fig, rB * s * 2, hs(HB), useDiam ? { d: `$${2 * rB}$` } : { r: `$${rB}$` }, { origin: [rA * s * 2 + rB * s * 2 + 1.5, 0] });
      fig.label([0, -1], '$A$').label([rA * s * 2 + rB * s * 2 + 1.5, -1], '$B$');
      stem = `Right circular cylinder $A$ has radius ${rA} inches and contains water to a depth of ${hA} inches. All of the water is poured into the empty right circular cylinder $B$, which has ${useDiam ? `a diameter of ${2 * rB} inches` : `radius ${rB} inches`} and height ${HB} inches. What is the depth of the water in cylinder $B$, in inches?`;
      suffix = 'inches';
      explanation = `The volume of water does not change: $\\pi (${rA})^2 (${hA}) = \\pi (${rB})^2 h$.${useDiam ? ` (The radius of $B$ is half its diameter: ${rB}.)` : ''}

$$h = \\frac{${rA * rA} \\cdot ${hA}}{${rB * rB}} = ${h2.isInt() ? h2.n : h2.toDecimalString()}$$

The radii enter squared: scaling the depth by $\\frac{${rA}}{${rB}}$ alone is the trap.`;
    } else if (mode === 'box-box') {
      let l1: number, w1: number, h1: number, l2: number, w2: number, h2: Frac;
      do {
        l1 = rng.int(4, 12);
        w1 = rng.int(3, 10);
        h1 = rng.int(2, 10);
        l2 = rng.int(4, 15);
        w2 = rng.int(3, 12);
        h2 = new Frac(l1 * w1 * h1, l2 * w2);
      } while (l1 * w1 === l2 * w2 || !h2.isTerminating() || h2.d > 4 || h2.lt(1) || h2.gt(30));
      a = [l1, w1, h1];
      b = [l2, w2];
      answer = h2;
      const H2 = Math.ceil(h2.toNumber()) + rng.int(2, 6);
      extra = H2;
      const L1 = Math.ceil(h1 * 1.4) + 1;
      drawBox(fig, l1, w1, L1, { L: `$${l1}$`, W: `$${w1}$` }, { waterLevel: h1 });
      drawBox(fig, l2, w2, H2, { L: `$${l2}$`, W: `$${w2}$` }, { origin: [l1 + w1 * 0.5 + 3, 0] });
      const span = Math.max(l1 + w1 * 0.5 + 3 + l2 + w2 * 0.5, Math.max(L1, H2) + Math.max(w1, w2) * 0.35);
      fig.label([l1 / 2, -0.14 * span], 'Tank 1').label([l1 + w1 * 0.5 + 3 + l2 / 2, -0.14 * span], 'Tank 2');
      traps.push({ value: new Frac(h1), trap: 'geom-solid-same-depth' });
      stem = `Tank 1, a rectangular tank with a base ${l1} feet by ${w1} feet, contains water to a depth of ${h1} feet. All of the water is pumped into tank 2, an empty rectangular tank with a base ${l2} feet by ${w2} feet and a height of ${H2} feet. What is the depth of the water in tank 2, in feet?`;
      suffix = 'feet';
      explanation = `Volume of water: $${l1} \\cdot ${w1} \\cdot ${h1} = ${num(l1 * w1 * h1)}$ cubic feet. In tank 2 it covers a base of $${l2} \\cdot ${w2} = ${l2 * w2}$ square feet, so its depth is

$$\\frac{${num(l1 * w1 * h1)}}{${l2 * w2}} = ${h2.isInt() ? h2.n : h2.toDecimalString()}$$

The depth changes because the base area changes; only the volume stays the same.`;
    } else if (mode === 'cyl-box') {
      let r: number, h: number, L: number, W: number, v: number;
      for (;;) {
        r = rng.int(2, 6);
        h = rng.int(4, 15);
        L = rng.int(6, 20);
        W = rng.int(5, 15);
        v = (Math.PI * r * r * h) / (L * W);
        const t = v * 10 - Math.floor(v * 10);
        if (v > 1 && v < 40 && Math.abs(t - 0.5) > 0.15) break;
      }
      a = [r, h];
      b = [L, W];
      answer = new Frac(Math.round(v * 10), 10);
      const noPi = new Frac(Math.round(((r * r * h) / (L * W)) * 10), 10);
      if (!noPi.eq(answer)) traps.push({ value: noPi, trap: 'geom-solid-forgot-pi' });
      const dia = new Frac(Math.round(((Math.PI * 4 * r * r * h) / (L * W)) * 10), 10);
      if (!dia.eq(answer)) traps.push({ value: dia, trap: 'geom-circle-radius-diameter' });
      withFigure = false;
      stem = `A right circular cylinder with an inside diameter of ${2 * r} centimeters is filled with water to a height of ${h} centimeters. The water is poured into an empty rectangular container whose base measures ${L} centimeters by ${W} centimeters. To the nearest 0.1 centimeter, what is the depth of the water in the container?`;
      suffix = 'centimeters';
      explanation = `The radius is ${r}, so the water's volume is $\\pi (${r})^2 (${h}) = ${num(r * r * h)}\\pi \\approx ${(Math.PI * r * r * h).toFixed(2)}$ cubic centimeters.

Spread over a base of $${L} \\cdot ${W} = ${L * W}$ square centimeters, the depth is $\\frac{${num(r * r * h)}\\pi}{${L * W}} \\approx ${v.toFixed(3)}$, which rounds to ${answer.toDecimalString()}.

Use the radius (half the diameter), and keep the factor $\\pi$.`;
    } else if (mode === 'packing') {
      const e = rng.int(2, 4);
      let L: number, W: number, H: number;
      if (d === 3) {
        do {
          L = rng.int(2, 9) * e + rng.int(0, e - 1);
          W = rng.int(2, 7) * e + rng.int(0, e - 1);
          H = rng.int(2, 6) * e + rng.int(0, e - 1);
        } while (L % e === 0 && W % e === 0 && H % e === 0);
      } else {
        L = rng.int(2, 9) * e;
        W = rng.int(2, 7) * e;
        H = rng.int(2, 6) * e;
      }
      a = [L, W, H];
      b = [e];
      const count = Math.floor(L / e) * Math.floor(W / e) * Math.floor(H / e);
      answer = new Frac(count);
      const byVol = Math.floor((L * W * H) / e ** 3);
      if (byVol !== count) traps.push({ value: new Frac(byVol), trap: 'geom-solid-pack-by-volume' });
      drawBox(fig, L, W, H, { L: `$${L}$`, W: `$${W}$`, H: `$${H}$` });
      stem = `What is the greatest number of cubes with edges of length ${e} inches that can be placed, without overlapping, inside the rectangular box shown above (dimensions in inches)?`;
      suffix = 'cubes';
      const fl = (x: number) => (x % e === 0 ? `${x / e}` : `${Math.floor(x / e)}`);
      explanation = `Count along each edge: $\\frac{${L}}{${e}}$ gives ${fl(L)}, $\\frac{${W}}{${e}}$ gives ${fl(W)}, $\\frac{${H}}{${e}}$ gives ${fl(H)}${d === 3 ? ' (round DOWN: a partial cube does not fit)' : ''}.

Number of cubes: $${fl(L)} \\cdot ${fl(W)} \\cdot ${fl(H)} = ${count}$.${
        byVol !== count ? `\n\nDividing the volumes ($\\frac{${num(L * W * H)}}{${e ** 3}}$) gives about ${byVol}, too many: the leftover space is in thin slices that cannot hold a whole cube.` : ''
      }`;
    } else {
      // fill a partly filled tank at a constant rate
      let L: number, W: number, H: number, h0: number, R: number, vol: number;
      do {
        L = rng.int(4, 12);
        W = rng.int(3, 10);
        H = rng.int(4, 10);
        h0 = rng.int(1, H - 2);
        R = rng.pick([2, 3, 4, 5, 6, 8, 10, 12]);
        vol = L * W * (H - h0);
      } while (vol % R !== 0 || vol / R > 240);
      a = [L, W, H, h0];
      b = [R];
      answer = new Frac(vol, R);
      const fullT = new Frac(L * W * H, R);
      if (!fullT.eq(answer) && fullT.isTerminating()) traps.push({ value: fullT, trap: 'geom-solid-ignored-initial' });
      const initT = new Frac(L * W * h0, R);
      if (!initT.eq(answer) && initT.isTerminating()) traps.push({ value: initT, trap: 'geom-solid-ignored-initial' });
      drawBox(fig, L, W, H, { L: `$${L}$`, W: `$${W}$`, H: `$${H}$` }, { waterLevel: h0 });
      stem = `The rectangular tank shown above (dimensions in feet) contains water to a depth of ${h0} feet. Water is pumped into the tank at a constant rate of ${R} cubic feet per minute. How many minutes will it take to fill the tank to the top?`;
      suffix = 'minutes';
      explanation = `The empty part of the tank is $${L} \\cdot ${W} \\cdot (${H} - ${h0}) = ${num(vol)}$ cubic feet. At ${R} cubic feet per minute, it fills in $\\frac{${num(vol)}}{${R}} = ${answer.isInt() ? answer.n : answer.toDecimalString()}$ minutes.

Only the empty part needs water: using the full volume (${plain(L * W * H)}) ignores the ${h0} feet already there.`;
    }
    return {
      params: { mode, a, b, extra },
      q: {
        format: 'ne',
        stem,
        ...(withFigure ? { figure: fig.build(false) } : {}),
        answer: answer!,
        ...(suffix ? { suffix } : {}),
        traps: traps.filter((t) => !t.value.eq(answer!)),
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'wrong format';
    const u = unitCircle();
    // Height of liquid with a given volume in a container, by bisection on the container's volume function.
    const height = (vol: number, base: number) => {
      let lo = 0;
      let hi = 1e4;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (base * mid < vol) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    let v: number;
    if (p.mode === 'cyl-cyl') v = height(p.a[0] * p.a[0] * u.area * p.a[1], p.b[0] * p.b[0] * u.area);
    else if (p.mode === 'box-box') v = height(p.a[0] * p.a[1] * p.a[2], p.b[0] * p.b[1]);
    else if (p.mode === 'cyl-box') v = Math.round(height(p.a[0] * p.a[0] * u.area * p.a[1], p.b[0] * p.b[1]) * 10) / 10;
    else if (p.mode === 'packing') {
      // place cubes greedily in a grid and count them
      const [L, W, H] = p.a;
      const e = p.b[0];
      let n = 0;
      for (let x = 0; x + e <= L; x += e) for (let y = 0; y + e <= W; y += e) for (let z = 0; z + e <= H; z += e) n++;
      v = n;
    } else {
      // simulate minute by minute (fractional last minute)
      const [L, W, H, h0] = p.a;
      const R = p.b[0];
      let water = L * W * h0;
      let t = 0;
      while (water + R <= L * W * H + 1e-9) {
        water += R;
        t++;
      }
      v = t + (L * W * H - water) / R;
    }
    return Math.abs(q.answer.toNumber() - v) < 1e-6 * Math.max(1, v) ? null : `expected ${v}`;
  },
};

/* ================================================================== 3. Comparisons (QC) */

interface SolidQCParams {
  mode: 'swap-num' | 'swap-ordered' | 'swap-free' | 'roll' | 'min-surface' | 'percent-cube' | 'percent-cyl';
  a: number;
  b: number;
  k: number;
  variant: string;
}

const solidQC: Template<SolidQCParams> = {
  id: 'geo.solids.compare-qc',
  skill: 'geo.solids',
  format: 'qc',
  style: 'compare volumes or surface areas of solids',
  generate(rng, d) {
    const base: SolidQCParams = { mode: 'swap-num', a: 0, b: 0, k: 0, variant: '' };
    const x = rng.next();
    const mode: SolidQCParams['mode'] =
      d === 1
        ? rng.pick(['swap-num', 'swap-num', 'roll', 'percent-cube', 'percent-cyl', 'min-surface'] as const)
        : x < 0.15 ? 'swap-num' : x < 0.29 ? 'swap-ordered' : x < 0.37 ? 'swap-free' : x < 0.55 ? 'roll' : x < 0.72 ? 'min-surface' : x < 0.86 ? 'percent-cube' : 'percent-cyl';
    if (mode === 'swap-num') {
      let a: number, b: number;
      do {
        a = rng.int(2, 10);
        b = rng.int(2, 10);
      } while (a === b);
      const answer: QCChoice = a > b ? 'A' : 'B';
      const fig = new Fig();
      drawCylinder(fig, a / 2, b / 2, { r: `$${a}$`, h: `$${b}$` }, { origin: [0, 0] });
      drawCylinder(fig, b / 2, a / 2, { r: `$${b}$`, h: `$${a}$` }, { origin: [a / 2 + b / 2 + 1.5, 0] });
      const yl = -(0.16 * Math.max(a, b) + 1);
      fig.label([0, yl], '$P$').label([a / 2 + b / 2 + 1.5, yl], '$Q$');
      return {
        params: { ...base, mode, a, b },
        q: {
          format: 'qc',
          figure: fig.build(false),
          info: `Right circular cylinder $P$ has radius ${a} and height ${b}. Right circular cylinder $Q$ has radius ${b} and height ${a}.`,
          quantityA: `The volume of $P$`,
          quantityB: `The volume of $Q$`,
          answer,
          traps: { C: 'geom-solid-volume-symmetric' },
          explanation: `Volume $= \\pi r^2 h$. $P$: $\\pi (${a})^2 (${b}) = ${num(a * a * b)}\\pi$. $Q$: $\\pi (${b})^2 (${a}) = ${num(b * b * a)}\\pi$. ${cap(relText(answer))}. (${answer})

Swapping the radius and the height changes the volume: the radius is squared, so the cylinder with the larger radius has the larger volume.`,
        },
      };
    }
    if (mode === 'swap-ordered' || mode === 'swap-free') {
      const ordered = mode === 'swap-ordered';
      const flip = rng.chance(0.5);
      const answer: QCChoice = ordered ? (flip ? 'B' : 'A') : 'D';
      return {
        params: { ...base, mode, variant: flip ? 'flip' : '' },
        q: {
          format: 'qc',
          info: ordered
            ? `$${flip ? '0 < x < y' : 'x > y > 0'}$. Cylinder $P$ has radius $x$ and height $y$; cylinder $Q$ has radius $y$ and height $x$.`
            : `$x$ and $y$ are positive. Cylinder $P$ has radius $x$ and height $y$; cylinder $Q$ has radius $y$ and height $x$.`,
          quantityA: `The volume of $P$`,
          quantityB: `The volume of $Q$`,
          answer,
          traps: ordered ? { C: 'geom-solid-volume-symmetric', D: 'geom-solid-volume-symmetric' } : { C: 'geom-solid-volume-symmetric' },
          explanation: ordered
            ? `$P$: $\\pi x^2 y$. $Q$: $\\pi y^2 x$. Divide both by the positive number $\\pi xy$: compare $x$ with $y$. Since $${flip ? 'x < y' : 'x > y'}$, ${relText(answer)}. (${answer})

The radius is squared, so swapping radius and height does change the volume.`
            : `$P$: $\\pi x^2 y$. $Q$: $\\pi y^2 x$. Dividing both by $\\pi xy$ leaves $x$ versus $y$, and nothing says which is larger: $x = 2, y = 1$ makes $P$ larger; $x = 1, y = 2$ makes $Q$ larger. (D)

The volumes are equal only when $x = y$.`,
        },
      };
    }
    if (mode === 'roll') {
      let a: number, b: number;
      do {
        a = rng.int(5, 14);
        b = rng.int(4, 12);
      } while (a <= b);
      const longFirst = rng.chance(0.5);
      const answer: QCChoice = longFirst ? 'A' : 'B';
      const qa = longFirst ? a : b;
      const qb = longFirst ? b : a;
      return {
        params: { ...base, mode, a: qa, b: qb },
        q: {
          format: 'qc',
          info: `A rectangular sheet of paper ${a} inches by ${b} inches can be rolled into the curved surface of a right circular cylinder in two ways: the ${a}-inch sides or the ${b}-inch sides can form the circumference of the base (with no overlap).`,
          quantityA: `The volume of the cylinder whose base has circumference ${qa} inches`,
          quantityB: `The volume of the cylinder whose base has circumference ${qb} inches`,
          answer,
          traps: { C: 'geom-solid-volume-symmetric' },
          explanation: `A circumference $C$ gives radius $r = \\frac{C}{2\\pi}$, so the volume with height $h$ is $\\pi \\left(\\frac{C}{2\\pi}\\right)^2 h = \\frac{C^2 h}{4\\pi}$.

Quantity A: $\\frac{${qa}^2 \\cdot ${qb}}{4\\pi} = \\frac{${num(qa * qa * qb)}}{4\\pi}$. Quantity B: $\\frac{${qb}^2 \\cdot ${qa}}{4\\pi} = \\frac{${num(qb * qb * qa)}}{4\\pi}$. ${cap(relText(answer))}. (${answer})

The same sheet gives the same curved surface area both ways, but not the same volume: the circumference is squared, so the longer side should go around.`,
        },
      };
    }
    if (mode === 'min-surface') {
      const e = rng.int(2, 6);
      const V = e ** 3;
      const S = 6 * e * e;
      const variant = rng.pick(['free-eq', 'free-less', 'free-less', 'cube', 'square-base'] as const);
      let info: string;
      let k: number;
      let answer: QCChoice;
      let traps: QCQuestion['traps'];
      let explanation: string;
      if (variant === 'free-eq') {
        info = `A rectangular box has a volume of ${plain(V)} cubic centimeters.`;
        k = S;
        answer = 'D';
        traps = { C: 'geom-solid-assumed-cube' };
        explanation = `If the box is a cube, its edge is ${e} and its surface area is $6 \\cdot ${e}^2 = ${S}$ (equal). But a box with volume ${plain(V)} need not be a cube: a $1 \\times 1 \\times ${num(V)}$ box has surface area $2(1 + ${num(V)} + ${num(V)}) = ${num(2 * (1 + 2 * V))}$, greater than ${S}. (D)

For a given volume the cube has the smallest surface area; every other shape has more.`;
      } else if (variant === 'free-less') {
        info = `A rectangular box has a volume of ${plain(V)} cubic centimeters.`;
        k = S - rng.int(1, Math.max(2, e * 2));
        answer = 'A';
        traps = { D: 'geom-solid-min-surface' };
        explanation = `For a given volume, the cube has the smallest surface area. A cube with volume ${plain(V)} has edge ${e} and surface area $6 \\cdot ${e}^2 = ${S}$, so every box with volume ${plain(V)} has surface area at least ${S}, which is greater than ${k}. (A)

The shape is unknown, but the minimum is enough to decide the comparison.`;
      } else if (variant === 'cube') {
        info = `A cube has a volume of ${plain(V)} cubic centimeters.`;
        k = rng.chance(0.5) ? S : S + rng.pick([-2, 2]) * e;
        answer = cmpTol(S, k);
        traps = undefined;
        explanation = `The edge is $\\sqrt[3]{${num(V)}} = ${e}$, so the surface area is $6 \\cdot ${e}^2 = ${S}$. Compare with ${k}: ${relText(answer)}. (${answer})`;
      } else {
        const s = rng.pick([1, 2].filter((x) => x < e && V % (x * x) === 0) as number[]) || 1;
        const h = V / (s * s);
        const SA = 2 * s * s + 4 * s * h;
        info = `A rectangular box with a square base of side ${s} centimeters has a volume of ${plain(V)} cubic centimeters.`;
        k = rng.pick([S, SA, SA - 2 * s, SA + 4]);
        answer = cmpTol(SA, k);
        traps = answer !== 'C' && k === S ? { C: 'geom-solid-assumed-cube' } : undefined;
        explanation = `The height is $\\frac{${num(V)}}{${s}^2} = ${num(h)}$. Surface area: two square ends $2 \\cdot ${s * s}$ plus four sides $4 \\cdot ${s} \\cdot ${num(h)}$, total $${num(SA)}$. Compare with ${plain(k)}: ${relText(answer)}. (${answer})`;
        return {
          params: { ...base, mode, a: s, b: h, k, variant },
          q: { format: 'qc', info, quantityA: `The surface area of the box, in square centimeters`, quantityB: `$${num(k)}$`, answer, traps, explanation },
        };
      }
      return {
        params: { ...base, mode, a: e, b: V, k, variant },
        q: {
          format: 'qc',
          info,
          quantityA: `The surface area of the ${variant === 'cube' ? 'cube' : 'box'}, in square centimeters`,
          quantityB: `$${num(k)}$`,
          answer,
          traps,
          explanation,
        },
      };
    }
    if (mode === 'percent-cube') {
      const p = rng.pick([10, 20, 30, 50]);
      const inc = ((100 + p) ** 3 - 1e6) / 1e4; // percent increase in volume
      const variant = rng.pick(['3p', '3p', 'exact', 'between'] as const);
      const k = variant === '3p' ? 3 * p : variant === 'exact' ? inc : Math.round((3 * p + inc) / 2);
      const answer = cmpTol(inc, k);
      const kTex = Number.isInteger(k) ? `${k}` : `${k}`;
      return {
        params: { ...base, mode, a: p, k, variant },
        q: {
          format: 'qc',
          info: `Each edge of a cube is increased by ${p} percent.`,
          quantityA: `The percent increase in the volume of the cube`,
          quantityB: `$${kTex}\\%$`,
          answer,
          traps: answer !== 'C' && variant === '3p' ? { C: 'geom-solid-percent-linear' } : variant === 'between' ? { B: 'geom-solid-percent-linear' } : undefined,
          explanation: `Lengths are multiplied by ${new Frac(100 + p, 100).toDecimalString()}, so the volume is multiplied by $${new Frac(100 + p, 100).toDecimalString()}^3 = ${Number(((100 + p) ** 3 / 1e6).toFixed(4))}$: an increase of ${Number(inc.toFixed(3))} percent.

Compare with ${kTex} percent: ${relText(answer)}. (${answer})

Percent changes multiply; they do not add: three increases of ${p} percent are more than ${3 * p} percent.`,
        },
      };
    }
    // percent-cyl: radius up p%, height down p% (or the reverse)
    const p = rng.pick([10, 20, 25, 40, 50]);
    const radiusUp = rng.chance(0.55);
    const f = radiusUp ? ((100 + p) ** 2 * (100 - p)) / 1e6 : ((100 - p) ** 2 * (100 + p)) / 1e6;
    const answer: QCChoice = f > 1 ? 'A' : 'B';
    return {
      params: { ...base, mode: 'percent-cyl', a: p, variant: radiusUp ? 'up' : 'down' },
      q: {
        format: 'qc',
        info: `The radius of a right circular cylinder is ${radiusUp ? 'increased' : 'decreased'} by ${p} percent, and its height is ${radiusUp ? 'decreased' : 'increased'} by ${p} percent.`,
        quantityA: `The volume of the new cylinder`,
        quantityB: `The volume of the original cylinder`,
        answer,
        traps: { C: 'geom-solid-changes-cancel' },
        explanation: `$V = \\pi r^2 h$, and the radius is squared. The new volume is $${new Frac(radiusUp ? 100 + p : 100 - p, 100).toDecimalString()}^2 \\times ${new Frac(radiusUp ? 100 - p : 100 + p, 100).toDecimalString()} = ${Number(f.toFixed(4))}$ times the original. ${cap(relText(answer))}. (${answer})

Equal percent changes do not cancel, especially when one of them applies to a squared dimension.`,
      },
    };
  },
  check(q, p, rng) {
    if (q.format !== 'qc') return 'wrong format';
    const u = unitCircle();
    const cyl = (r: number, h: number) => r * r * u.area * h;
    let expected: QCChoice;
    if (p.mode === 'swap-num') expected = cmpTol(cyl(p.a, p.b), cyl(p.b, p.a));
    else if (p.mode === 'swap-ordered' || p.mode === 'swap-free') {
      const samples: [number, number][] = [];
      for (let i = 0; i < 40; i++) {
        let x = 0.1 + rng.next() * 10;
        let y = 0.1 + rng.next() * 10;
        if (p.mode === 'swap-ordered') {
          // respect the stated order
          if (p.variant === 'flip' ? x >= y : x <= y) [x, y] = [y, x];
          if (x === y) continue;
        }
        samples.push([cyl(x, y), cyl(y, x)]);
      }
      expected = qcFromSamples(samples);
    } else if (p.mode === 'roll') {
      // radius from the circumference via the polygon perimeter
      const vol = (c: number, h: number) => cyl(c / u.perim, h);
      expected = cmpTol(vol(p.a, p.b), vol(p.b, p.a));
    } else if (p.mode === 'min-surface') {
      if (p.variant === 'square-base') expected = cmpTol(measureBox(p.a, p.a, p.b).surface, p.k);
      else if (p.variant === 'cube') expected = cmpTol(measureBox(p.a, p.a, p.a).surface, p.k);
      else {
        const V = p.b;
        const samples: [number, number][] = [[measureBox(p.a, p.a, p.a).surface, p.k]];
        for (let i = 0; i < 60; i++) {
          const l = 0.2 + rng.next() * 3 * p.a;
          const w = 0.2 + rng.next() * 3 * p.a;
          samples.push([measureBox(l, w, V / (l * w)).surface, p.k]);
        }
        const rel = samples.map(([s, k]) => cmpTol(s, k, 1e-9));
        expected = rel.every((r) => r === rel[0]) ? rel[0] : 'D';
      }
    } else if (p.mode === 'percent-cube') {
      const e = 3.7;
      const before = measureBox(e, e, e).volume;
      const after = measureBox(e * (1 + p.a / 100), e * (1 + p.a / 100), e * (1 + p.a / 100)).volume;
      expected = cmpTol(((after - before) / before) * 100, p.k, 1e-9);
    } else {
      const f = p.variant === 'up' ? [1 + p.a / 100, 1 - p.a / 100] : [1 - p.a / 100, 1 + p.a / 100];
      expected = cmpTol(cyl(2 * f[0], 5 * f[1]), cyl(2, 5));
    }
    return q.answer === expected ? null : `expected ${expected} (${QC_TEXT[expected]})`;
  },
};

/* ================================================================== 4. Which changes multiply the volume (MCM) */

interface ScalingParams {
  shape: 'cylinder' | 'box';
  target: [number, number];
  /** per change: squared radius factor and height factor (cylinder), or the three edge factors (box) */
  changes: [number, number][][];
}

const H2 = (n: number, d = 1): [number, number] => [n, d];
interface Change {
  text: string;
  f: [number, number][];
}
const CYL_CHANGES: Change[] = [
  { text: 'Doubling the height', f: [H2(1), H2(2)] },
  { text: 'Doubling the radius', f: [H2(4), H2(1)] },
  { text: 'Tripling the height', f: [H2(1), H2(3)] },
  { text: 'Doubling the radius and halving the height', f: [H2(4), H2(1, 2)] },
  { text: 'Halving the radius and multiplying the height by 8', f: [H2(1, 4), H2(8)] },
  { text: 'Doubling both the radius and the height', f: [H2(4), H2(2)] },
  { text: 'Multiplying the radius by 4', f: [H2(16), H2(1)] },
  { text: 'Multiplying the radius by $\\sqrt{2}$', f: [H2(2), H2(1)] },
  { text: 'Multiplying the height by 4', f: [H2(1), H2(4)] },
  { text: 'Increasing the height by 100 percent', f: [H2(1), H2(2)] },
  { text: 'Increasing the radius by 100 percent', f: [H2(4), H2(1)] },
  { text: 'Multiplying the radius by 4 and halving the height', f: [H2(16), H2(1, 2)] },
  { text: 'Halving the radius and multiplying the height by 16', f: [H2(1, 4), H2(16)] },
  { text: 'Multiplying the radius by $\\sqrt{2}$ and doubling the height', f: [H2(2), H2(2)] },
  { text: 'Multiplying the height by 8', f: [H2(1), H2(8)] },
  { text: 'Doubling the radius and multiplying the height by 4', f: [H2(4), H2(4)] },
];
const BOX_CHANGES: Change[] = [
  { text: 'Doubling the length', f: [H2(2), H2(1), H2(1)] },
  { text: 'Doubling the length and the width', f: [H2(2), H2(2), H2(1)] },
  { text: 'Doubling the length, the width and the height', f: [H2(2), H2(2), H2(2)] },
  { text: 'Doubling the length and halving the width', f: [H2(2), H2(1, 2), H2(1)] },
  { text: 'Quadrupling the height and halving the width', f: [H2(1), H2(1, 2), H2(4)] },
  { text: 'Tripling the length and the width', f: [H2(3), H2(3), H2(1)] },
  { text: 'Increasing the height by 100 percent', f: [H2(1), H2(1), H2(2)] },
  { text: 'Multiplying the width by 8', f: [H2(1), H2(8), H2(1)] },
  { text: 'Doubling the width and the height', f: [H2(1), H2(2), H2(2)] },
  { text: 'Halving the length and multiplying the width by 8', f: [H2(1, 2), H2(8), H2(1)] },
  { text: 'Quadrupling the length', f: [H2(4), H2(1), H2(1)] },
  { text: 'Doubling the length and quadrupling the height', f: [H2(2), H2(1), H2(4)] },
];

const fr = ([n, d]: [number, number]) => new Frac(n, d);
const factorOf = (f: [number, number][]) => f.reduce((acc, x) => acc.mul(fr(x)), new Frac(1));
/** What a student who scales everything linearly (radius not squared) would compute. */
const linearFactor = (shape: ScalingParams['shape'], f: [number, number][]) => {
  if (shape === 'box') {
    // "doubling every edge doubles the volume"
    const [a, b, c] = f.map((x) => fr(x).toNumber());
    return a === b && b === c ? a : null;
  }
  const r2 = fr(f[0]).toNumber();
  return Math.sqrt(r2) * fr(f[1]).toNumber();
};

const scaling: Template<ScalingParams> = {
  id: 'geo.solids.scaling',
  skill: 'geo.solids',
  format: 'mcm',
  style: 'which changes of dimensions multiply a volume by a factor',
  generate(rng, d) {
    const shape: ScalingParams['shape'] = d === 1 ? rng.pick(['cylinder', 'box'] as const) : rng.chance(0.65) ? 'cylinder' : 'box';
    const pool = shape === 'cylinder' ? CYL_CHANGES : BOX_CHANGES;
    const targets = shape === 'cylinder' ? (d === 1 ? [2, 4] : [2, 4, 8]) : d === 1 ? [2, 4] : [2, 4, 8];
    let target = 0;
    let picked: Change[] = [];
    for (let tries = 0; tries < 200; tries++) {
      target = rng.pick(targets);
      const n = d === 1 ? 5 : 6;
      const yes = rng.shuffle(pool.filter((c) => factorOf(c.f).eq(target)));
      const no = rng.shuffle(pool.filter((c) => !factorOf(c.f).eq(target)));
      const nYes = rng.int(1, Math.min(4, yes.length));
      if (yes.length < 1 || no.length < n - nYes) continue;
      // prefer wrong changes that are traps (linear thinking gives the target)
      const trapNo = no.filter((c) => linearFactor(shape, c.f) === target);
      const otherNo = no.filter((c) => linearFactor(shape, c.f) !== target);
      const wrong = [...trapNo.slice(0, 2), ...otherNo].slice(0, n - nYes);
      picked = rng.shuffle([...yes.slice(0, nYes), ...wrong]);
      // texts must be distinct
      if (new Set(picked.map((c) => c.text)).size === picked.length) break;
    }
    const items = picked.map((c) => {
      const ok = factorOf(c.f).eq(target);
      const trap = !ok && linearFactor(shape, c.f) === target ? 'geom-solid-scale-linear' : undefined;
      return { text: c.text, correct: ok, ...(trap ? { trap } : {}) };
    });
    const { choices, answer } = flaggedChoices(items);
    const fig = new Fig();
    if (shape === 'cylinder') drawCylinder(fig, 2.5, 4.5, { r: '$r$', h: '$h$' });
    else drawBox(fig, 6, 4, 3.5, { L: '$\\ell$', W: '$w$', H: '$h$' });
    const lines = picked
      .map((c) => {
        const f = factorOf(c.f);
        const how =
          shape === 'cylinder'
            ? `$${fr(c.f[0]).toTex()} \\times ${fr(c.f[1]).toTex()} = ${f.toTex()}$`
            : `$${c.f.map((x) => fr(x).toTex()).join(' \\times ')} = ${f.toTex()}$`;
        return `- ${c.text}: ${how} ${f.eq(target) ? '✓' : '✗'}`;
      })
      .join('\n');
    const word = target === 2 ? 'twice' : `${target} times`;
    return {
      params: { shape, target: [target, 1], changes: picked.map((c) => c.f) },
      q: {
        format: 'mcm',
        stem:
          shape === 'cylinder'
            ? `The right circular cylinder shown above has radius $r$ and height $h$. Which of the following changes, each made to the original cylinder, would produce a cylinder whose volume is ${word} the volume of the original cylinder?`
            : `The rectangular box shown above has length $\\ell$, width $w$ and height $h$. Which of the following changes, each made to the original box, would produce a box whose volume is ${word} the volume of the original box?`,
        instruction: 'Indicate all such changes.',
        figure: fig.build(false),
        choices,
        answer,
        explanation: `${
          shape === 'cylinder'
            ? `$V = \\pi r^2 h$: multiplying $r$ by $k$ multiplies $V$ by $k^2$, and multiplying $h$ by $m$ multiplies $V$ by $m$. For each change, (factor from $r^2$) × (factor from $h$):`
            : `$V = \\ell w h$: the volume is multiplied by the product of the three factors. For each change:`
        }
${lines}

${shape === 'cylinder' ? 'Doubling the radius multiplies the volume by 4, not 2: the radius is squared.' : 'Doubling every edge multiplies the volume by $2^3 = 8$.'}`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcm') return 'wrong format';
    const u = unitCircle();
    const [r0, h0] = [3, 5];
    const [l0, w0, z0] = [3, 4, 5];
    const target = p.target[0] / p.target[1];
    const expected = p.changes.flatMap((f, i) => {
      let ratio: number;
      if (p.shape === 'cylinder') {
        const r = r0 * Math.sqrt(f[0][0] / f[0][1]);
        const h = h0 * (f[1][0] / f[1][1]);
        ratio = (r * r * u.area * h) / (r0 * r0 * u.area * h0);
      } else {
        const [l, w, z] = [l0 * (f[0][0] / f[0][1]), w0 * (f[1][0] / f[1][1]), z0 * (f[2][0] / f[2][1])];
        ratio = measureBox(l, w, z).volume / measureBox(l0, w0, z0).volume;
      }
      return Math.abs(ratio - target) < 1e-9 * target ? [i] : [];
    });
    return JSON.stringify(expected) === JSON.stringify(q.answer) ? null : `expected ${expected}`;
  },
};

export const solidTemplates = [measures, pour, solidQC, scaling];

