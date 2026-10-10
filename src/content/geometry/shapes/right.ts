import { qcFromSamples } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal, num } from '../../../engine/tex';
import type { QCChoice, Template } from '../../../engine/types';
import { FigBuilder, add, bisect, dir, dist, mul, shoelace, sub, unit, type Pt } from './fig';
import { checkMcs, intChoices, qcTraps, QC_SAY, surd, surdChoices, surdDiv, surdMul, surdTex, surdVal, type Surd } from './util';

const SKILL = 'geo.right-triangles';

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];
const dec = (f: Frac) => (f.isInt() ? num(f.n) : decimal(f));

/** Right triangle figure: right angle at C (bottom-left or bottom-right), legs a (vertical) and b (horizontal), drawn to scale. */
function rightTriFig(names: [string, string, string], a: number, b: number, labels: { a?: string; b?: string; c?: string }, mirror: boolean) {
  const [nA, nB, nC] = names;
  const s = 4 / Math.max(a, b);
  const C: Pt = [0, 0];
  const A: Pt = [0, a * s];
  const B: Pt = [mirror ? -b * s : b * s, 0];
  const fb = new FigBuilder().pt(nA, A).pt(nB, B).pt(nC, C).poly(nA, nB, nC).right(nA, nC, nB);
  if (labels.a) fb.side(nA, nC, nB, labels.a);
  if (labels.b) fb.side(nC, nB, nA, labels.b);
  if (labels.c) fb.side(nA, nB, nC, labels.c);
  return fb.build();
}

/* ================================================================== 1. Pythagorean theorem, exact or rounded (NE) */

interface PythParams {
  kind: 'hyp' | 'leg';
  legs?: [number, number];
  hyp?: number;
  leg?: number;
  round: 0 | 1 | 2;
}

/** Exact check that r (a Frac rounded to `places`) is the rounding of sqrt(N). */
function isRoundedSqrt(r: Frac, N: number, places: number): boolean {
  const half = new Frac(1, 2 * 10 ** places);
  const lo = r.sub(half);
  const hi = r.add(half);
  return lo.mul(lo).lt(N) && hi.mul(hi).gt(N);
}

const pythagorean: Template<PythParams> = {
  id: 'geo.right-triangles.pythagorean-ne',
  skill: SKILL,
  format: 'ne',
  style: 'missing side of a right triangle, exact or rounded',
  generate(rng, d) {
    const kind: 'hyp' | 'leg' = d === 1 ? rng.pick(['hyp', 'leg'] as const) : rng.pick(['hyp', 'leg', 'leg'] as const);
    const rounded = d === 1 ? false : d === 2 ? rng.chance(0.5) : rng.chance(0.7);
    const places: 1 | 2 = rng.chance(0.6) ? 2 : 1;
    const context = d >= 2 && kind === 'leg' && rng.chance(0.4);
    let a: number;
    let b: number;
    let c: number;
    let N: number;
    if (!rounded) {
      const t = rng.pick(d === 1 ? TRIPLES.slice(0, 2) : TRIPLES);
      let k = rng.int(1, d === 1 ? 2 : 3);
      if (t[2] * k > 75) k = 1;
      [a, b, c] = rng.chance(0.5) ? [t[0] * k, t[1] * k, t[2] * k] : [t[1] * k, t[0] * k, t[2] * k];
      N = kind === 'hyp' ? c * c : b * b;
    } else {
      for (;;) {
        a = rng.int(4, 60);
        b = rng.int(4, 60);
        if (a === b) continue;
        if (kind === 'hyp') {
          N = a * a + b * b;
          c = Math.sqrt(N);
        } else {
          c = rng.int(Math.max(a, 8) + 2, Math.max(a, 8) + 40);
          N = c * c - a * a;
          b = Math.sqrt(N);
        }
        if (Number.isInteger(Math.sqrt(N))) continue;
        break;
      }
    }
    const exact = Math.sqrt(N);
    const answer = rounded ? new Frac(Math.round(exact * 10 ** places), 10 ** places) : Frac.of(Math.round(exact));
    const rnd = (v: number) => (rounded ? new Frac(Math.round(v * 10 ** places), 10 ** places) : Number.isInteger(v) ? Frac.of(v) : null);
    const trapVals: { v: number; trap: string }[] =
      kind === 'hyp'
        ? [
            { v: a + b, trap: 'geo-rt-add-legs' },
            { v: Math.sqrt(a) + Math.sqrt(b), trap: 'geo-rt-root-split' },
          ]
        : [
            { v: c - a, trap: 'geo-rt-add-legs' },
            { v: Math.sqrt(c * c + a * a), trap: 'geo-rt-leg-as-hyp' },
          ];
    const traps = trapVals.flatMap((t) => {
      const f = rnd(t.v);
      return f && !f.eq(answer) ? [{ value: f, trap: t.trap }] : [];
    });
    const unknownLen = kind === 'hyp' ? exact : b;
    const nm: [string, string, string] = ['A', 'B', 'C'];
    const mirror = rng.chance(0.4);
    const roundTxt = rounded ? ` Give your answer to the nearest ${places === 2 ? '0.01' : '0.1'}.` : '';
    const showA = `$${num(a)}$`;
    let stem: string;
    let figure;
    let suffix: string | undefined;
    if (context) {
      // ladder against a wall: the ladder is the hypotenuse c, the foot is a from the wall, height b
      const s = 4 / Math.max(a, unknownLen);
      const fb = new FigBuilder();
      const W0 = fb.helper([0, 0]);
      const Wtop = fb.helper([0, unknownLen * s * 1.15]);
      const G1 = fb.helper([-0.6, 0]);
      const G2 = fb.helper([a * s + 0.8, 0]);
      fb.pt('P', [0, unknownLen * s], [-1, 0.2]).pt('Q', [a * s, 0], [0.3, -1]).pt('R', [0, 0], [-1, -1]);
      fb.seg(W0, Wtop).seg(G1, G2).seg('P', 'Q').right('P', 'R', 'Q');
      fb.side('P', 'Q', 'R', `$${num(c)}$`).side('R', 'Q', 'P', showA);
      figure = fb.build();
      stem = `A ladder $${num(c)}$ feet long leans against a vertical wall, as shown above. The foot of the ladder, $Q$, is $${num(a)}$ feet from the base of the wall, $R$, on level ground. How many feet above the ground is the top of the ladder, $P$?${roundTxt}`;
      suffix = 'feet';
    } else if (kind === 'hyp') {
      figure = rightTriFig(nm, a, b, { a: showA, b: `$${num(b)}$` }, mirror);
      stem = `In right triangle $ABC$ above, what is the length of side $AB$?${roundTxt}`;
    } else {
      figure = rightTriFig(nm, a, unknownLen, { a: showA, c: `$${num(c)}$` }, mirror);
      stem = `In right triangle $ABC$ above, what is the length of side $BC$?${roundTxt}`;
    }
    const val = rounded ? dec(answer) : num(answer.n);
    const explanation =
      kind === 'hyp'
        ? `The side opposite the right angle is the hypotenuse: $AB^2 = ${num(a)}^2 + ${num(b)}^2 = ${num(a * a)} + ${num(b * b)} = ${num(N)}$.

$AB = \\sqrt{${num(N)}}${rounded ? ` \\approx ${dec(answer)}` : ` = ${val}`}$.${rounded ? ` (On the calculator, add the squares first and take the square root of the total.)` : ''}

Adding the legs ($${num(a)} + ${num(b)} = ${num(a + b)}$) is wrong: the hypotenuse is always shorter than the sum of the legs.`
        : `The ${context ? 'ladder' : 'side of length ' + num(c)} is the hypotenuse, opposite the right angle. So the unknown leg satisfies $${context ? 'h' : 'BC'}^2 + ${num(a)}^2 = ${num(c)}^2$:

$${context ? 'h' : 'BC'}^2 = ${num(c * c)} - ${num(a * a)} = ${num(N)}$, so $${context ? 'h' : 'BC'} = \\sqrt{${num(N)}}${rounded ? ` \\approx ${dec(answer)}` : ` = ${val}`}$.

Subtract the squares, do not add them: $\\sqrt{${num(c)}^2 + ${num(a)}^2}$ would be longer than the hypotenuse itself.`;
    return {
      params: kind === 'hyp' ? { kind, legs: [a, b], round: rounded ? places : 0 } : { kind, hyp: c, leg: a, round: rounded ? places : 0 },
      q: { format: 'ne', stem, figure, answer, traps, explanation, ...(suffix ? { suffix } : {}) },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    // Measure on coordinates, then confirm exactly by squaring.
    let N: number;
    let measured: number;
    if (p.kind === 'hyp') {
      const [a, b] = p.legs!;
      measured = dist([0, a], [b, 0]);
      N = a * a + b * b;
    } else {
      const c = p.hyp!;
      const a = p.leg!;
      const y = bisect((t) => dist([a, 0], [0, t]) - c, 0, c);
      measured = y;
      N = c * c - a * a;
    }
    if (p.round === 0) return q.answer.mul(q.answer).eq(N) && Math.abs(q.answer.toNumber() - measured) < 1e-6 ? null : `expected ${measured}`;
    if (!isRoundedSqrt(q.answer, N, p.round)) return `expected ${measured.toFixed(p.round)}`;
    return Math.abs(q.answer.toNumber() - measured) <= 0.5 * 10 ** -p.round + 1e-9 ? null : 'measured value disagrees';
  },
};

/* ================================================================== 2. Special right triangles (MCS) */

type SpecialKind = '306090' | 'square' | 'equilateral';
type Side3 = 'short' | 'long' | 'hyp';
interface SpecialParams {
  kind: SpecialKind;
  given: string;
  givenVal: Surd;
  ask: string;
  values: number[];
}

const R1 = surd(1, 1);
const R2 = surd(1, 2);
const R3 = surd(1, 3);
const TWO = surd(2, 1);

const special: Template<SpecialParams> = {
  id: 'geo.right-triangles.special-mcs',
  skill: SKILL,
  format: 'mcs',
  style: '30-60-90, 45-45-90 and equilateral-triangle lengths with radicals',
  generate(rng, d) {
    const kind: SpecialKind = rng.pick(d === 1 ? (['306090', 'square'] as const) : (['306090', '306090', 'square', 'equilateral'] as const));
    if (kind === '306090') {
      const ratio: Record<Side3, Surd> = { short: R1, long: R3, hyp: TWO };
      const swapR: Record<Side3, Surd> = { short: R1, long: TWO, hyp: R3 };
      const wrongR: Record<Side3, Surd> = { short: R1, long: R1, hyp: R2 };
      const given = rng.pick(['short', 'long', 'hyp'] as Side3[]);
      const askArea = d >= 2 && rng.chance(d === 2 ? 0.35 : 0.5);
      const ask: Side3 | 'area' = askArea ? 'area' : rng.pick((['short', 'long', 'hyp'] as Side3[]).filter((x) => x !== given));
      const n = rng.int(2, 12);
      let gv: Surd;
      if (given === 'long') gv = rng.chance(0.5) ? surd(3 * rng.int(1, 4), 1) : surd(n, 3);
      else gv = surd(given === 'hyp' && d === 1 ? 2 * rng.int(1, 6) : n, 1);
      const via = (r: Record<Side3, Surd>, side: Side3) => surdMul(surdDiv(gv, r[given]), r[side]);
      const value = (r: Record<Side3, Surd>): Surd =>
        ask === 'area' ? surdMul(surdMul(via(r, 'short'), via(r, 'long')), surd(new Frac(1, 2), 1)) : via(r, ask);
      const correct = value(ratio);
      const traps: { v: Surd; trap: string }[] = [
        { v: value(swapR), trap: 'geo-rt-306090-swap' },
        { v: value(wrongR), trap: 'geo-rt-wrong-special' },
        ...(ask === 'area' ? [{ v: surdMul(via(ratio, 'short'), via(ratio, 'long')), trap: 'geo-tri-no-half' }] : []),
      ];
      const fillers = [surdMul(correct, TWO), surdMul(correct, surd(new Frac(1, 2))), surd(correct.c, 1), surdMul(correct, R3)];
      const { choices, answer, values } = surdChoices(rng, correct, traps, fillers);
      // figure: angle 30 at A, right angle at C, 60 at B. short = BC, long = AC, hyp = AB
      const mirror = rng.chance(0.5);
      const L = 4;
      const A: Pt = [mirror ? L : 0, 0];
      const C: Pt = [mirror ? 0 : L, 0];
      const B: Pt = [C[0], L / Math.sqrt(3)];
      const fb = new FigBuilder().pt('A', A).pt('B', B).pt('C', C).poly('A', 'B', 'C').right('A', 'C', 'B');
      const label30 = rng.chance(0.65);
      if (label30) fb.angle('A', 'B', 'C', '$30^\\circ$');
      else fb.angle('B', 'A', 'C', '$60^\\circ$');
      const segOf: Record<Side3, [string, string, string]> = { short: ['B', 'C', 'A'], long: ['A', 'C', 'B'], hyp: ['A', 'B', 'C'] };
      const [g1, g2, gAway] = segOf[given];
      fb.side(g1, g2, gAway, `$${surdTex(gv)}$`);
      const nameOf: Record<Side3, string> = { short: 'BC', long: 'AC', hyp: 'AB' };
      const short = via(ratio, 'short');
      const long = via(ratio, 'long');
      const hyp = via(ratio, 'hyp');
      return {
        params: { kind, given, givenVal: gv, ask, values: values.map(surdVal) },
        q: {
          format: 'mcs',
          stem: ask === 'area' ? 'What is the area of triangle $ABC$ above?' : `In triangle $ABC$ above, what is the length of $${nameOf[ask]}$?`,
          figure: fb.build(),
          choices,
          answer,
          explanation: `Triangle $ABC$ is a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle${label30 ? '' : ' (the third angle is $30^\\circ$)'}. Its sides are in the ratio $1 : \\sqrt{3} : 2$: the shortest side $BC$ faces the $30^\\circ$ angle, $AC$ faces the $60^\\circ$ angle, and the hypotenuse $AB$ is twice $BC$.

From $${nameOf[given]} = ${surdTex(gv)}$: $BC = ${surdTex(short)}$, $AC = ${surdTex(long)}$, $AB = ${surdTex(hyp)}$.${
            ask === 'area' ? `\n\nArea $= \\frac{1}{2}(BC)(AC) = \\frac{1}{2}(${surdTex(short)})(${surdTex(long)}) = ${surdTex(correct)}$.` : ''
          }

Mixing up which side gets the $\\sqrt{3}$ and which gets the $2$ (or using the $45^\\circ$ ratio $1 : 1 : \\sqrt{2}$) leads to the wrong choices.`,
        },
      };
    }
    if (kind === 'square') {
      // square ABCD with diagonal AC
      const mode = rng.pick(d === 1 ? (['side-to-diag', 'diag-to-side'] as const) : (['side-to-diag', 'diag-to-side', 'diag-to-area'] as const));
      const n = rng.int(2, 12);
      let given: Surd;
      let correct: Surd;
      let traps: { v: Surd; trap: string }[];
      if (mode === 'side-to-diag') {
        given = surd(n, 1);
        correct = surd(n, 2);
        traps = [
          { v: surd(2 * n, 1), trap: 'geo-rt-add-legs' },
          { v: surd(new Frac(n, 2), 2), trap: 'geo-rt-ratio-inverse' },
          { v: surd(n, 3), trap: 'geo-rt-wrong-special' },
        ];
      } else if (mode === 'diag-to-side') {
        given = rng.chance(0.5) ? surd(n, 2) : surd(n, 1);
        correct = surdDiv(given, R2);
        traps = [
          { v: surdMul(given, R2), trap: 'geo-rt-ratio-inverse' },
          { v: surdMul(given, surd(new Frac(1, 2))), trap: 'geo-rt-add-legs' },
          { v: surdDiv(given, R3), trap: 'geo-rt-wrong-special' },
        ];
      } else {
        given = rng.chance(0.5) ? surd(n, 1) : surd(n, 2);
        const g2 = surdMul(given, given);
        correct = surdMul(g2, surd(new Frac(1, 2)));
        traps = [
          { v: g2, trap: 'geo-rt-diag-area' },
          { v: surdMul(g2, surd(new Frac(1, 4))), trap: 'geo-rt-add-legs' },
        ];
      }
      const { choices, answer, values } = surdChoices(rng, correct, traps, [surdMul(correct, TWO), surdMul(correct, R2), surd(correct.c.add(1), correct.r)]);
      const fb = new FigBuilder().pt('A', [0, 3]).pt('B', [3, 3]).pt('C', [3, 0]).pt('D', [0, 0]).poly('A', 'B', 'C', 'D').seg('A', 'C');
      fb.right('A', 'D', 'C');
      if (mode === 'side-to-diag') fb.side('D', 'C', 'A', `$${surdTex(given)}$`);
      else fb.side('A', 'C', 'D', `$${surdTex(given)}$`, 12);
      const stem =
        mode === 'side-to-diag'
          ? 'In square $ABCD$ above, what is the length of diagonal $AC$?'
          : mode === 'diag-to-side'
            ? `In square $ABCD$ above, diagonal $AC$ has length $${surdTex(given)}$. What is the length of side $AB$?`
            : `In square $ABCD$ above, diagonal $AC$ has length $${surdTex(given)}$. What is the area of the square?`;
      const expl =
        mode === 'side-to-diag'
          ? `The diagonal cuts the square into two $45^\\circ$-$45^\\circ$-$90^\\circ$ triangles, whose sides are in the ratio $1 : 1 : \\sqrt{2}$. So $AC = ${surdTex(given)} \\cdot \\sqrt{2} = ${surdTex(correct)}$.

The diagonal is shorter than two sides ($${surdTex(surd(2 * n, 1))}$): it is a shortcut across the square.`
          : mode === 'diag-to-side'
            ? `The diagonal is the hypotenuse of a $45^\\circ$-$45^\\circ$-$90^\\circ$ triangle, so it equals side $\\times \\sqrt{2}$. Divide: $AB = \\dfrac{${surdTex(given)}}{\\sqrt{2}} = ${surdTex(correct)}$.

Multiplying by $\\sqrt{2}$ instead of dividing gives a side longer than the diagonal, which is impossible.`
            : `With side $s$, the diagonal is $s\\sqrt{2}$, so $2s^2 = (${surdTex(given)})^2 = ${surdTex(surdMul(given, given))}$ and the area is $s^2 = \\dfrac{${surdTex(surdMul(given, given))}}{2}${correct.c.isInt() ? ` = ${surdTex(correct)}` : ''}$.

Squaring the diagonal gives twice the area, not the area.`;
      return {
        params: { kind, given: mode, givenVal: given, ask: mode, values: values.map(surdVal) },
        q: { format: 'mcs', stem, figure: fb.build(), choices, answer, explanation: expl },
      };
    }
    // equilateral triangle with altitude
    const mode = rng.pick(d === 3 ? (['side-to-alt', 'alt-to-side', 'side-to-area'] as const) : (['side-to-alt', 'alt-to-side'] as const));
    const n = rng.int(2, 12);
    let given: Surd;
    let correct: Surd;
    let traps: { v: Surd; trap: string }[];
    const half = surd(new Frac(1, 2));
    if (mode === 'side-to-alt') {
      given = surd(n, 1);
      correct = surdMul(surdMul(given, R3), half);
      traps = [
        { v: surdMul(given, R3), trap: 'geo-rt-equi-half' },
        { v: surdMul(given, half), trap: 'geo-rt-306090-swap' },
        { v: surdMul(surdMul(given, R2), half), trap: 'geo-rt-wrong-special' },
      ];
    } else if (mode === 'alt-to-side') {
      given = rng.chance(0.5) ? surd(n, 3) : surd(3 * rng.int(1, 4), 1);
      correct = surdDiv(surdMul(given, TWO), R3);
      traps = [
        { v: surdDiv(given, R3), trap: 'geo-rt-equi-half' },
        { v: surdMul(given, TWO), trap: 'geo-rt-306090-swap' },
        { v: surdMul(given, R3), trap: 'geo-rt-ratio-inverse' },
      ];
    } else {
      given = surd(2 * rng.int(1, 6), 1);
      const s2 = surdMul(given, given);
      correct = surdMul(surdMul(s2, R3), surd(new Frac(1, 4)));
      traps = [
        { v: surdMul(surdMul(s2, R3), half), trap: 'geo-tri-no-half' },
        { v: surdMul(s2, half), trap: 'geo-tri-slant-height' },
      ];
    }
    const { choices, answer, values } = surdChoices(rng, correct, traps, [surdMul(correct, TWO), surd(correct.c, 1), surdMul(correct, half)]);
    const fb = new FigBuilder().pt('P', [2, 2 * Math.sqrt(3)]).pt('Q', [0, 0]).pt('R', [4, 0]).pt('S', [2, 0], [0, -1]).poly('P', 'Q', 'R');
    fb.seg('P', 'S', undefined, true).right('P', 'S', 'R');
    if (mode === 'alt-to-side') fb.text([2.42 + 0.12 * surdTex(given).length / 4, 1.25], `$${surdTex(given)}$`);
    else fb.side('P', 'Q', 'R', `$${surdTex(given)}$`);
    const stem =
      mode === 'side-to-alt'
        ? 'In the figure above, triangle $PQR$ is equilateral and $PS$ is perpendicular to $QR$. What is the length of $PS$?'
        : mode === 'alt-to-side'
          ? 'In the figure above, triangle $PQR$ is equilateral and $PS$ is perpendicular to $QR$. What is the length of $QR$?'
          : 'In the figure above, triangle $PQR$ is equilateral. What is the area of triangle $PQR$?';
    const sideS = mode === 'alt-to-side' ? correct : given;
    const alt = surdMul(surdMul(sideS, R3), half);
    const expl = `The altitude $PS$ splits the equilateral triangle into two $30^\\circ$-$60^\\circ$-$90^\\circ$ triangles. In triangle $PQS$, the hypotenuse is the side $s$, $QS = \\frac{s}{2}$ faces the $30^\\circ$ angle, and $PS = \\frac{s\\sqrt{3}}{2}$ faces the $60^\\circ$ angle.

${
      mode === 'side-to-alt'
        ? `With $s = ${surdTex(given)}$: $PS = ${surdTex(correct)}$.`
        : mode === 'alt-to-side'
          ? `With $PS = ${surdTex(given)} = \\frac{s\\sqrt{3}}{2}$: $s = \\dfrac{2(${surdTex(given)})}{\\sqrt{3}} = ${surdTex(correct)}$.`
          : `With $s = ${surdTex(given)}$: the height is $${surdTex(alt)}$ and the area is $\\frac{1}{2}(${surdTex(given)})(${surdTex(alt)}) = ${surdTex(correct)}$.`
    }

The altitude is $\\frac{s}{2}\\sqrt{3}$, not $s\\sqrt{3}$: the short leg $QS$ is only half of the side.`;
    return {
      params: { kind, given: mode, givenVal: given, ask: mode, values: values.map(surdVal) },
      q: { format: 'mcs', stem, figure: fb.build(), choices, answer, explanation: expl },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const g = surdVal(p.givenVal);
    let target: number;
    if (p.kind === '306090') {
      // unit drawing from the angles, scaled to the given side
      const A: Pt = [0, 0];
      const B: Pt = mul(dir(30), 1);
      const C: Pt = [B[0], 0];
      const len: Record<string, number> = { short: dist(B, C), long: dist(A, C), hyp: dist(A, B) };
      const k = g / len[p.given];
      target = p.ask === 'area' ? shoelace([A, B, C]) * k * k : len[p.ask] * k;
    } else if (p.kind === 'square') {
      const sq: Pt[] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
      const diag = dist(sq[0], sq[2]);
      if (p.ask === 'side-to-diag') target = g * diag;
      else {
        const k = g / diag;
        target = p.ask === 'diag-to-side' ? k : shoelace(sq) * k * k;
      }
    } else {
      const Q: Pt = [0, 0];
      const R: Pt = [1, 0];
      const P: Pt = dir(60);
      const S: Pt = [(Q[0] + R[0]) / 2, 0];
      const alt = dist(P, S);
      if (p.ask === 'side-to-alt') target = g * alt;
      else if (p.ask === 'alt-to-side') target = g / alt;
      else target = shoelace([P, Q, R]) * g * g;
    }
    return checkMcs(q.answer, p.values, target);
  },
};

/* ================================================================== 3. Comparisons: isosceles right triangle vs square, rectangle diagonals (QC) */

type CmpKind = 'iso-square' | 'rect-sides' | 'rect-diag-side' | 'rect-perimeter' | 'square-diag';
type IsoQ = 'leg' | 'hyp';
type SqQ = 'side' | 'diag';
interface CmpParams {
  kind: CmpKind;
  R?: number;
  tq?: IsoQ;
  sq?: SqQ;
  swap?: boolean;
  l?: number;
  w?: number;
  d?: number;
  s?: number;
  ask?: 'other' | 'area';
  N?: number;
}

const compareQC: Template<CmpParams> = {
  id: 'geo.right-triangles.compare-qc',
  skill: SKILL,
  format: 'qc',
  style: 'compare diagonals, legs and sides of right triangles, squares and rectangles',
  generate(rng, d) {
    const kind: CmpKind = rng.pick(
      d === 1
        ? (['rect-sides', 'square-diag', 'iso-square'] as const)
        : d === 2
          ? (['iso-square', 'rect-sides', 'rect-diag-side', 'square-diag'] as const)
          : (['iso-square', 'rect-diag-side', 'rect-perimeter', 'rect-sides'] as const),
    );
    const near = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? Math.round(x) : null);
    if (kind === 'iso-square') {
      // GE-22
      const k = rng.int(2, 9);
      const R = rng.chance(0.5) ? 2 * k * k : k * k * rng.pick([1, 3, 5]);
      const tq: IsoQ = rng.pick(['leg', 'leg', 'hyp']);
      const sq: SqQ = rng.pick(['side', 'side', 'diag']);
      const swap = rng.chance(0.3);
      const leg = Math.sqrt(2 * R);
      const tri = tq === 'leg' ? leg : leg * Math.SQRT2;
      const side = Math.sqrt(R);
      const sqv = sq === 'side' ? side : side * Math.SQRT2;
      const rel: QCChoice = Math.abs(tri - sqv) < 1e-9 ? 'C' : tri > sqv ? 'A' : 'B';
      const answer: QCChoice = swap && rel !== 'C' ? (rel === 'A' ? 'B' : 'A') : rel;
      const triTxt = `The length of a ${tq === 'leg' ? 'leg' : 'hypotenuse'} of an isosceles right triangle with area $${R}$`;
      const sqTxt = `The length of a ${sq === 'side' ? 'side' : 'diagonal'} of a square with area $${R}$`;
      const legT = surdTex(surd(1, 2 * R));
      return {
        params: { kind, R, tq, sq, swap },
        q: {
          format: 'qc',
          quantityA: swap ? sqTxt : triTxt,
          quantityB: swap ? triTxt : sqTxt,
          answer,
          traps: qcTraps(answer, { C: 'geo-rt-equal-area-sides' }),
          explanation: `Triangle: with legs $a$, the area is $\\frac{1}{2}a^2 = ${R}$, so $a^2 = ${2 * R}$ and $a = ${legT}$${tq === 'hyp' ? `; the hypotenuse is $a\\sqrt{2} = ${surdTex(surd(1, 4 * R))}$` : ''}.

Square: $s^2 = ${R}$, so $s = ${surdTex(surd(1, R))}$${sq === 'diag' ? `; the diagonal is $s\\sqrt{2} = ${surdTex(surd(1, 2 * R))}$` : ''}.

Compare the squares of the two lengths: $${tq === 'leg' ? 2 * R : 4 * R}$ (triangle) and $${sq === 'side' ? R : 2 * R}$ (square). ${
            rel === 'C' ? 'They are equal' : 'The triangle\'s length is greater'
          }, so ${QC_SAY[answer]}. (${answer})

Equal areas do not mean equal sides: the triangle's $\\frac{1}{2}$ makes its legs longer.`,
        },
      };
    }
    if (kind === 'square-diag') {
      const n = rng.int(2, 12);
      const dd = n; // diagonal length
      const area = (dd * dd) / 2;
      const N = rng.pick([area, area, dd * dd, area + rng.pick([-2, 2, 4])]);
      const answer: QCChoice = area > N ? 'A' : area < N ? 'B' : 'C';
      const fb = new FigBuilder().pt('A', [0, 3]).pt('B', [3, 3]).pt('C', [3, 0]).pt('D', [0, 0]).poly('A', 'B', 'C', 'D').seg('B', 'D').right('B', 'C', 'D');
      fb.side('D', 'B', 'A', `$${dd}$`, 12);
      return {
        params: { kind, d: dd, N },
        q: {
          format: 'qc',
          info: `$ABCD$ is a square with diagonal $BD = ${dd}$.`,
          figure: fb.build(),
          quantityA: 'The area of $ABCD$',
          quantityB: `$${dec(new Frac(N * 2, 2))}$`,
          answer,
          traps: qcTraps(answer, { [area * 2 > N ? 'A' : area * 2 < N ? 'B' : 'C']: 'geo-rt-diag-area' }),
          explanation: `The diagonal of a square of side $s$ is $s\\sqrt{2}$, so $2s^2 = ${dd}^2 = ${dd * dd}$ and the area is $s^2 = \\frac{${dd * dd}}{2} = ${dec(new Frac(dd * dd, 2))}$.

Compared with $${dec(new Frac(N * 2, 2))}$: ${QC_SAY[answer]}. (${answer})

Squaring the diagonal gives $${dd * dd}$, twice the area.`,
        },
      };
    }
    const fb = (l: number, w: number, lab: { AB?: string; BC?: string; AC?: string }) => {
      const s = 4.4 / Math.max(l, w);
      const L = Math.max(1.6, l * s);
      const W = Math.max(1.4, w * s);
      const f = new FigBuilder().pt('A', [0, W]).pt('B', [L, W]).pt('C', [L, 0]).pt('D', [0, 0]).poly('A', 'B', 'C', 'D').seg('A', 'C').right('B', 'C', 'D');
      if (lab.AB) f.side('A', 'B', 'D', lab.AB);
      if (lab.BC) f.side('B', 'C', 'A', lab.BC);
      if (lab.AC) f.text([L * 0.42, W * 0.5 + 0.35], lab.AC);
      return f.build();
    };
    if (kind === 'rect-sides') {
      let l: number;
      let w: number;
      if (rng.chance(0.45)) {
        const t = rng.pick(TRIPLES.slice(0, 3));
        const k = rng.int(1, 2);
        [l, w] = rng.chance(0.5) ? [t[1] * k, t[0] * k] : [t[0] * k, t[1] * k];
      } else {
        l = rng.int(4, 15);
        w = rng.int(2, l - 1);
      }
      const diag = Math.hypot(l, w);
      const exact = near(diag);
      const N = exact !== null ? rng.pick([exact, exact, exact + 1, exact - 1]) : rng.pick([Math.floor(diag), Math.ceil(diag), Math.floor(diag) - 1]);
      const answer: QCChoice = exact === N ? 'C' : diag > N ? 'A' : 'B';
      const naive: QCChoice = l + w > N ? 'A' : l + w < N ? 'B' : 'C';
      return {
        params: { kind, l, w, N },
        q: {
          format: 'qc',
          info: `$ABCD$ is a rectangle with $AB = ${l}$ and $BC = ${w}$.`,
          figure: fb(l, w, { AB: `$${l}$`, BC: `$${w}$` }),
          quantityA: '$AC$',
          quantityB: `$${N}$`,
          answer,
          traps: qcTraps(answer, { [naive]: 'geo-rt-add-legs' }),
          explanation: `Diagonal $AC$ is the hypotenuse of right triangle $ABC$: $AC^2 = ${l}^2 + ${w}^2 = ${l * l + w * w}$.

${exact !== null ? `$AC = \\sqrt{${l * l + w * w}} = ${exact}$` : `Compare squares instead of roots: $AC^2 = ${l * l + w * w}$ and $${N}^2 = ${N * N}$`}, so ${QC_SAY[answer]}. (${answer})`,
        },
      };
    }
    if (kind === 'rect-diag-side') {
      const t = rng.pick(TRIPLES.slice(0, 4));
      const k = rng.int(1, 2);
      const [l, w] = rng.chance(0.5) ? [t[0] * k, t[1] * k] : [t[1] * k, t[0] * k];
      const dd = t[2] * k;
      const ask: 'other' | 'area' = rng.chance(0.5) ? 'other' : 'area';
      const val = ask === 'other' ? w : l * w;
      const N = val + rng.pick([0, 0, -1, 1, 2]);
      const answer: QCChoice = val > N ? 'A' : val < N ? 'B' : 'C';
      const slant = ask === 'area' ? l * dd : dd - l;
      const trapAns: QCChoice = slant > N ? 'A' : slant < N ? 'B' : 'C';
      return {
        params: { kind, l, d: dd, ask, N },
        q: {
          format: 'qc',
          info: `$ABCD$ is a rectangle with $AB = ${l}$ and $AC = ${dd}$.`,
          figure: fb(l, w, { AB: `$${l}$`, AC: `$${dd}$` }),
          quantityA: ask === 'other' ? '$BC$' : 'The area of $ABCD$',
          quantityB: `$${N}$`,
          answer,
          traps: qcTraps(answer, { [trapAns]: ask === 'area' ? 'geo-rt-diag-as-side' : 'geo-rt-add-legs' }),
          explanation: `In right triangle $ABC$, $BC^2 = AC^2 - AB^2 = ${dd * dd} - ${l * l} = ${w * w}$, so $BC = ${w}$.${ask === 'area' ? ` The area is $AB \\times BC = ${l} \\times ${w} = ${l * w}$.` : ''}

Compared with $${N}$: ${QC_SAY[answer]}. (${answer})${ask === 'area' ? `\n\nThe diagonal is not a side: $${l} \\times ${dd}$ is not the area.` : ''}`,
        },
      };
    }
    // rect-perimeter: only the perimeter is known
    const half = rng.int(5, 14);
    const lo = half / Math.SQRT2;
    const which = rng.pick(['A', 'A', 'B', 'D'] as const);
    const N = which === 'A' ? Math.floor(lo) - rng.int(0, 1) : which === 'B' ? half + rng.int(0, 2) : Math.ceil(lo) + rng.int(0, Math.max(0, half - Math.ceil(lo) - 1));
    const answer: QCChoice = N < lo ? 'A' : N >= half ? 'B' : 'D';
    const sideL = Math.round(half * 0.62);
    return {
      params: { kind, s: half, N },
      q: {
        format: 'qc',
        info: `The perimeter of rectangle $ABCD$ is $${2 * half}$.`,
        figure: fb(sideL, half - sideL, {}),
        quantityA: '$AC$',
        quantityB: `$${N}$`,
        answer,
        traps: qcTraps(answer, answer === 'D' ? { C: 'geo-rt-assumed-dims', A: 'geo-rt-assumed-dims' } : { D: 'geo-rt-range-missed' }),
        explanation: `Only $AB + BC = ${half}$ is fixed. The diagonal $AC = \\sqrt{AB^2 + BC^2}$ is always less than $AB + BC = ${half}$ (a shortcut across the corner), and it is smallest for a square: $\\sqrt{(${dec(new Frac(half, 2))})^2 \\cdot 2} = \\frac{${half}}{\\sqrt{2}} \\approx ${(half / Math.SQRT2).toFixed(2)}$.

So $${(half / Math.SQRT2).toFixed(2)} \\le AC < ${half}$. ${
          answer === 'A' ? `Every possible $AC$ is greater than $${N}$. (A)` : answer === 'B' ? `Every possible $AC$ is less than $${N}$. (B)` : `$${N}$ is inside that range: a square gives $AC < ${N}$, a long thin rectangle gives $AC > ${N}$. (D)`
        }`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'qc') return 'format';
    const samples: [number, number][] = [];
    const rectDiag = (l: number, w: number) => dist([0, 0], [l, w]);
    switch (p.kind) {
      case 'iso-square': {
        const leg = bisect((t) => shoelace([[0, 0], [t, 0], [0, t]]) - p.R!, 0, 1e3);
        const tri = p.tq === 'leg' ? leg : dist([leg, 0], [0, leg]);
        const side = bisect((t) => shoelace([[0, 0], [t, 0], [t, t], [0, t]]) - p.R!, 0, 1e3);
        const sqv = p.sq === 'side' ? side : dist([0, 0], [side, side]);
        samples.push(p.swap ? [sqv, tri] : [tri, sqv]);
        break;
      }
      case 'square-diag': {
        const side = bisect((t) => dist([0, 0], [t, t]) - p.d!, 0, 1e3);
        samples.push([shoelace([[0, 0], [side, 0], [side, side], [0, side]]), p.N!]);
        break;
      }
      case 'rect-sides':
        samples.push([rectDiag(p.l!, p.w!), p.N!]);
        break;
      case 'rect-diag-side': {
        const w = bisect((t) => rectDiag(p.l!, t) - p.d!, 0, p.d!);
        samples.push([p.ask === 'other' ? w : p.l! * w, p.N!]);
        break;
      }
      case 'rect-perimeter':
        for (let i = 1; i < 400; i++) {
          const l = (p.s! * i) / 400;
          samples.push([rectDiag(l, p.s! - l), p.N!]);
        }
        break;
    }
    const exp = qcFromSamples(samples);
    return q.answer === exp ? null : `expected ${exp}`;
  },
};

/* ================================================================== 4. Two-step right-triangle problems (MCS) */

type TwoKind = 'ratio-area' | 'strips' | 'altitude' | 'stacked';
interface TwoParams {
  kind: TwoKind;
  a: number;
  b: number;
  c?: number;
  K?: number;
  L?: number;
  values: number[];
}

const STACKED: [number, number, number, number][] = [
  [2, 3, 6, 7],
  [1, 4, 8, 9],
  [2, 6, 9, 11],
  [3, 4, 12, 13],
  [2, 10, 11, 15],
  [6, 10, 15, 19],
  [4, 4, 7, 9],
  [6, 6, 7, 11],
];

const twoStep: Template<TwoParams> = {
  id: 'geo.right-triangles.two-step-mcs',
  skill: SKILL,
  format: 'mcs',
  style: 'two-step right-triangle problems: leg ratio and area, strips, shared or stacked triangles',
  generate(rng, d) {
    const kind: TwoKind = rng.pick(d === 1 ? (['strips', 'altitude'] as const) : d === 2 ? (['ratio-area', 'strips', 'altitude', 'stacked'] as const) : (['ratio-area', 'altitude', 'stacked'] as const));
    if (kind === 'strips') {
      // GE-10: parts made of strip material along all three sides
      const t = rng.pick(TRIPLES.slice(0, d === 1 ? 2 : 4));
      const k = rng.int(1, 2);
      const [a, b, c] = t.map((x) => x * k);
      const P = a + b + c;
      const n = rng.int(6, 40);
      const L = n * P;
      const unit = rng.pick(['inches', 'centimeters']);
      const { choices, answer, values } = intChoices(
        rng,
        n,
        [
          { value: Math.floor(L / (a + b)), trap: 'geo-rt-forgot-hyp' },
          { value: Math.floor(L / ((a * b) / 2)), trap: 'geo-rt-used-area' },
        ],
        [Math.floor(L / (a + b + c + 1)), Math.floor(L / (2 * (a + b))), n + 2, n - 2, n + 4, n - 4],
      );
      const fb = new FigBuilder();
      const s = 4 / Math.max(a, b);
      const p0 = fb.helper([0, 0]);
      const p1 = fb.helper([0, a * s]);
      const p2 = fb.helper([b * s, 0]);
      fb.poly(p0, p1, p2).right(p1, p0, p2).side(p0, p1, p2, `$${a}$`).side(p0, p2, p1, `$${b}$`);
      return {
        params: { kind, a, b, L, values },
        q: {
          format: 'mcs',
          stem: `Each piece of a craft project is a right triangle with legs of lengths $${a}$ ${unit} and $${b}$ ${unit}, as shown above, outlined along all three sides with a thin metal strip. If a strip $${num(L)}$ ${unit} long is cut into pieces with no waste, what is the greatest number of triangles that can be outlined?`,
          figure: fb.build(),
          choices,
          answer,
          explanation: `Each triangle needs its full perimeter. The hypotenuse is $\\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a * a + b * b}} = ${c}$, so one triangle uses $${a} + ${b} + ${c} = ${P}$ ${unit}.

$\\frac{${num(L)}}{${P}} = ${n}$ triangles.

Leaving out the hypotenuse ($${a} + ${b} = ${a + b}$ per triangle) or dividing by the area gives the wrong counts.`,
        },
      };
    }
    if (kind === 'ratio-area') {
      // GE-19: legs in ratio a : b, area K
      const [a, b] = rng.pick([
        [1, 2],
        [2, 3],
        [2, 5],
        [1, 3],
        [3, 5],
        [1, 4],
      ] as [number, number][]);
      const k = rng.int(2, 6);
      if ((a * b * k * k) % 2 !== 0) return twoStep.generate(rng, d);
      const K = (a * b * k * k) / 2;
      const sq = a * a + b * b;
      const correct = surd(k, sq);
      const traps = [
        { v: surd(1, sq), trap: 'geo-rt-ratio-no-k' },
        { v: surd((a + b) * k, 1), trap: 'geo-rt-add-legs' },
      ];
      const { choices, answer, values } = surdChoices(rng, correct, traps, [surd(2 * k, sq), surd(a * b * k, 1), surd(k * k, sq)]);
      return {
        params: { kind, a, b, K, values: values.map(surdVal) },
        q: {
          format: 'mcs',
          stem: `The lengths of the legs of a right triangle are in the ratio $${a} : ${b}$, and the area of the triangle is $${num(K)}$. What is the length of the hypotenuse?`,
          choices,
          answer,
          explanation: `Call the legs $${a === 1 ? '' : a}k$ and $${b}k$. The area is $\\frac{1}{2}(${a === 1 ? '' : a}k)(${b}k) = ${a * b === 2 ? '' : dec(new Frac(a * b, 2))}k^2 = ${num(K)}$, so $k^2 = ${k * k}$ and $k = ${k}$.

The legs are $${a * k}$ and $${b * k}$, and the hypotenuse is $\\sqrt{${a * k}^2 + ${b * k}^2} = \\sqrt{${(a * a + b * b) * k * k}} = ${surdTex(correct)}$.

$${surdTex(surd(1, sq))}$ is the hypotenuse for legs of exactly $${a}$ and $${b}$: the ratio alone does not give the lengths.`,
        },
      };
    }
    if (kind === 'altitude') {
      // AD perpendicular to BC, D between B and C; AB, BD, DC given; find AC
      const t = rng.pick(TRIPLES.slice(0, 3));
      const k = rng.int(1, d === 1 ? 1 : 2);
      const [p, h, AB] = rng.chance(0.5) ? [t[0] * k, t[1] * k, t[2] * k] : [t[1] * k, t[0] * k, t[2] * k];
      // DC: sometimes completing a triple with h
      let DC: number;
      const partners = [3, 4, 5, 8, 12, 15, 16, 20, 24].filter((q) => Number.isInteger(Math.hypot(h, q)) && q !== p);
      DC = partners.length && rng.chance(0.6) ? rng.pick(partners) : rng.int(2, 16);
      if (DC === p) DC++;
      const N = h * h + DC * DC;
      const correct = surd(1, N);
      const traps = [
        { v: surd(1, AB * AB + p * p + DC * DC), trap: 'geo-rt-leg-as-hyp' },
        { v: surd(h + DC, 1), trap: 'geo-rt-add-legs' },
        { v: surd(1, AB * AB + DC * DC), trap: 'geo-rt-wrong-triangle' },
      ];
      const { choices, answer, values } = surdChoices(rng, correct, traps, [N - 7, N + 9, N - 3, N + 5, N - 12, N + 16].filter((x) => x > 1).map((x) => surd(1, x)));
      const s = 4.6 / (p + DC);
      const fb = new FigBuilder().pt('A', [p * s, h * s]).pt('B', [0, 0]).pt('C', [(p + DC) * s, 0]).pt('D', [p * s, 0], [-0.6, -1]).poly('A', 'B', 'C');
      fb.seg('A', 'D', undefined, true).right('A', 'D', 'C');
      fb.side('A', 'B', 'C', `$${AB}$`).side('B', 'D', 'A', `$${p}$`, 14).side('D', 'C', 'A', `$${DC}$`, 14);
      return {
        params: { kind, a: AB, b: p, c: DC, values: values.map(surdVal) },
        q: {
          format: 'mcs',
          stem: 'In the figure above, $AD$ is perpendicular to $BC$. What is the length of $AC$?',
          figure: fb.build(),
          choices,
          answer,
          explanation: `Work through the shared leg $AD$. In right triangle $ABD$: $AD^2 = ${AB}^2 - ${p}^2 = ${AB * AB - p * p}$, so $AD = ${h}$.

In right triangle $ADC$: $AC^2 = ${h}^2 + ${DC}^2 = ${N}$, so $AC = ${surdTex(correct)}$.

$AB$ is the hypotenuse of the first triangle, so subtract its square; $AC$ is the hypotenuse of the second, so add the squares of its legs.`,
        },
      };
    }
    // stacked: right angle at B in ABC, right angle at C in ACD
    const [x, y, z, w] = rng.pick(STACKED);
    const nonInt = d === 3 && rng.chance(0.4);
    const zz = nonInt ? z + rng.pick([1, 2]) : z;
    const N = x * x + y * y + zz * zz;
    const correct = surd(1, N);
    const traps = [
      { v: surd(x + y + zz, 1), trap: 'geo-rt-add-legs' },
      { v: surd(1, Math.abs(zz * zz - x * x - y * y)), trap: 'geo-rt-leg-as-hyp' },
      { v: surd(1, x * x + zz * zz), trap: 'geo-rt-wrong-triangle' },
    ];
    const { choices, answer, values } = surdChoices(rng, correct, traps, [surd(w + 1, 1), surd(1, N + 4), surd(w - 1, 1), surd(1, N - 5), surd(1, N + 12), surd(1, N - 10)]);
    const s = 0.55;
    const B: Pt = [0, 0];
    const A: Pt = [0, x * s * 1.2 + 0.6];
    const C: Pt = [y * s * 1.2 + 0.6, 0];
    const u = unit(sub(C, A));
    const perp: Pt = [u[1], -u[0]];
    const Dp = add(C, mul(perp[1] > 0 || perp[0] > 0 ? perp : mul(perp, -1), Math.min(4.2, zz * s * 0.7 + 1)));
    const fb = new FigBuilder().pt('A', A).pt('B', B).pt('C', C).pt('D', Dp).poly('A', 'B', 'C').poly('A', 'C', 'D');
    fb.right('A', 'B', 'C').right('A', 'C', 'D');
    fb.side('A', 'B', 'C', `$${x}$`).side('B', 'C', 'A', `$${y}$`).side('C', 'D', 'A', `$${zz}$`);
    return {
      params: { kind, a: x, b: y, c: zz, values: values.map(surdVal) },
      q: {
        format: 'mcs',
        stem: 'In the figure above, angle $ABC$ and angle $ACD$ are right angles. What is the length of $AD$?',
        figure: fb.build(),
        choices,
        answer,
        explanation: `First find the shared side: $AC^2 = ${x}^2 + ${y}^2 = ${x * x + y * y}$. There is no need to take the root.

Then in right triangle $ACD$: $AD^2 = AC^2 + CD^2 = ${x * x + y * y} + ${zz * zz} = ${N}$, so $AD = ${surdTex(correct)}$.

Adding the lengths $${x} + ${y} + ${zz}$ instead of their squares gives the wrong answer.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    let target: number;
    if (p.kind === 'strips') {
      const per = p.a + p.b + dist([0, p.a], [p.b, 0]);
      target = Math.floor(p.L! / per + 1e-9);
    } else if (p.kind === 'ratio-area') {
      const t = bisect((k) => shoelace([[0, 0], [p.a * k, 0], [0, p.b * k]]) - p.K!, 0, 1e3);
      target = dist([p.a * t, 0], [0, p.b * t]);
    } else if (p.kind === 'altitude') {
      // A on the perpendicular at D with |AB| = a; then measure AC
      const BD = p.b;
      const yA = bisect((t) => dist([0, 0], [BD, t]) - p.a, 0, p.a);
      target = dist([BD, yA], [BD + p.c!, 0]);
    } else {
      const A: Pt = [0, p.a];
      const C: Pt = [p.b, 0];
      const u = unit(sub(C, A));
      const D = add(C, mul([u[1], -u[0]], p.c!));
      target = dist(A, D);
    }
    return checkMcs(q.answer, p.values, target);
  },
};

export const rightTemplates = [pythagorean, special, compareQC, twoStep];
