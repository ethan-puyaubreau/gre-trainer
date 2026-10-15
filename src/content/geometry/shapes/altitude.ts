import { numericChoices } from '../../../engine/build';
import { Frac } from '../../../engine/frac';
import { decimal } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { Fig, type P2 } from '../measure/fig';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';

/* Altitude to the hypotenuse of a right triangle: three similar triangles give lengths (MCS). */

export const altitudeTraps: Record<string, Trap> = {
  'geo-sim-alt-no-root': {
    label: 'Multiplied the two hypotenuse pieces and forgot the square root',
    fix: 'The similar triangles give $\\frac{AD}{CD} = \\frac{CD}{DB}$, so $CD^2 = AD \\cdot DB$ and $CD$ is the square root of the product.',
  },
  'geo-sim-alt-arith-mean': {
    label: 'Took the average of the two pieces as the altitude',
    fix: 'The altitude is the GEOMETRIC mean $\\sqrt{AD \\cdot DB}$ of the pieces. The average $\\frac{AD + DB}{2}$ is always larger unless the pieces are equal.',
  },
  'geo-sim-alt-hyp-for-piece': {
    label: 'Used the whole hypotenuse where one piece belongs in the ratio',
    fix: 'A leg is the mean of the WHOLE hypotenuse and the piece next to it, but the altitude is the mean of the two PIECES. Check which segment each proportion uses.',
  },
  'geo-sim-alt-other-piece': {
    label: 'Gave the other piece of the hypotenuse',
    fix: 'The two pieces add up to the hypotenuse, but they are different lengths. The piece next to a leg $L$ is $\\frac{L^2}{\\text{hypotenuse}}$.',
  },
  'geo-sim-alt-altitude': {
    label: 'Gave the altitude when a piece of the hypotenuse was asked (or the reverse)',
    fix: 'Read what the question names: $AD$ and $DB$ lie on the hypotenuse, $CD$ is the perpendicular. Label the three lengths before computing.',
  },
  'geo-sim-alt-half-hyp': {
    label: 'Took half of the hypotenuse',
    fix: 'The hypotenuse is a diameter of the circle through the vertices, so the MEDIAN to it is half of it. The altitude and the pieces made by the altitude are not.',
  },
  'geo-sim-alt-wrong-leg': {
    label: 'Gave the other leg',
    fix: 'Each leg is the mean of the whole hypotenuse and the piece touching that leg. Check which piece touches the leg you want.',
  },
  'geo-sim-alt-drop-hyp': {
    label: 'Left the hypotenuse out of the perimeter',
    fix: 'The perimeter of $ABC$ is leg + leg + hypotenuse. The altitude is inside the triangle and is not part of it.',
  },
};

type Ask = 'h' | 'm' | 'n' | 'leg' | 'perim';
interface Params {
  m: number | string; // AD as "n/d" string
  mode: 'mean' | 'hyp' | 'legs' | 'pieces';
  ask: Ask;
  p: number; // CA
  q: number; // CB
  c: number; // AB
  names: string[];
  flip: boolean;
}

const SETS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['P', 'Q', 'R', 'S'],
  ['X', 'Y', 'Z', 'W'],
  ['K', 'L', 'M', 'N'],
  ['E', 'F', 'G', 'H'],
];
const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [7, 24, 25],
];
const dec = (f: Frac) => decimal(f);
const tx = (f: Frac) => `$${dec(f)}$`;
const F = (n: number, d = 1) => new Frac(n, d);

const altitude: Template<Params> = {
  id: 'geo.similarity.altitude-hypotenuse-mcs',
  skill: 'geo.similarity',
  format: 'mcs',
  style: 'altitude to the hypotenuse of a right triangle: pieces, altitude and legs by similar triangles',
  generate(rng, d) {
    const [nA, nB, nC, nD] = rng.pick(SETS);
    const flip = rng.chance(0.5);
    let p: number;
    let q: number;
    let c: number;
    let mode: Params['mode'];
    let ask: Ask;
    if (d === 1 || (d === 2 && rng.chance(0.4))) {
      // pieces u*s^2 and u*t^2: altitude u*s*t
      mode = d === 1 ? 'mean' : 'hyp';
      ask = 'h';
      const s = rng.int(1, 6);
      const t = rng.int(1, 6);
      const u = rng.pick([1, 1, 2, 3, 4, 5]);
      if (s === t || (d === 1 && u * s * s > 60) || u * (s * s + t * t) > 90) throw new Redraw('pieces');
      const mm = u * s * s;
      const nn = u * t * t;
      c = mm + nn;
      p = 0;
      q = mm;
      // p is unused here; q stores AD, c the hypotenuse
    } else {
      const k = rng.int(1, 10);
      const [a, b, hh] = rng.pick(TRIPLES);
      const kk = hh === 25 ? rng.int(1, 4) : k;
      [p, q, c] = rng.chance(0.5) ? [a * kk, b * kk, hh * kk] : [b * kk, a * kk, hh * kk];
      if (d === 2) {
        mode = 'legs';
        ask = rng.pick(['m', 'n', 'h']);
      } else {
        mode = 'pieces';
        ask = rng.pick(['leg', 'perim', 'leg']);
      }
    }
    // exact values
    let m: Frac;
    let n: Frac;
    let h: Frac;
    let CA: Frac;
    let CB: Frac;
    if (mode === 'mean' || mode === 'hyp') {
      m = F(q);
      n = F(c - q);
      h = F(0);
      const s = Math.round(Math.sqrt(m.toNumber() * n.toNumber()));
      h = F(s);
      CA = F(0);
      CB = F(0);
    } else {
      m = new Frac(p * p, c);
      n = new Frac(q * q, c);
      h = new Frac(p * q, c);
      CA = F(p);
      CB = F(q);
    }
    const hyp = F(c);
    let answer: Frac;
    let askName: string;
    const traps: { value: Frac; trap: string }[] = [];
    let steps: string;
    let given: string;
    const fig = new Fig();
    const mm = m.toNumber();
    const nn = n.toNumber();
    const hh = h.toNumber();
    const x = flip ? (v: number) => c - v : (v: number) => v;
    const Ap: P2 = [x(0), 0];
    const Bp: P2 = [x(c), 0];
    const Dp: P2 = [x(mm), 0];
    const Cp: P2 = [x(mm), mode === 'mean' || mode === 'hyp' ? hh : hh];
    fig.pt(nA, Ap, [flip ? 1 : -1, -0.6]).pt(nB, Bp, [flip ? -1 : 1, -0.6]).pt(nC, Cp, [0, 1]).pt(nD, Dp, [0, -1]);
    fig.seg(nC, nA, mode === 'legs' ? `$${p}$` : undefined).seg(nC, nB).seg(nC, nD, undefined, true).right(nA, nC, nB).right(nC, nD, nA);
    if (mode === 'mean') {
      fig.seg(nA, nD, `$${mm}$`).seg(nD, nB, `$${nn}$`);
      given = `$${nA}${nD} = ${mm}$ and $${nD}${nB} = ${nn}$`;
      answer = h;
      askName = `${nC}${nD}`;
      traps.push({ value: m.mul(n), trap: 'geo-sim-alt-no-root' }, { value: m.add(n).div(2), trap: 'geo-sim-alt-arith-mean' }, { value: hyp, trap: 'geo-sim-alt-hyp-for-piece' }, { value: m, trap: 'geo-sim-alt-altitude' }, { value: n, trap: 'geo-sim-alt-altitude' });
      steps = `The altitude splits ${nA}${nB}${nC} into triangles similar to each other, so $\\frac{${nA}${nD}}{${nC}${nD}} = \\frac{${nC}${nD}}{${nD}${nB}}$. Then $${nC}${nD}^2 = ${mm} \\cdot ${nn} = ${mm * nn}$ and $${nC}${nD} = ${dec(h)}$.`;
    } else if (mode === 'hyp') {
      fig.seg(nA, nB, `$${c}$`).seg(nA, nD, `$${mm}$`);
      given = `$${nA}${nB} = ${c}$ and $${nA}${nD} = ${mm}$`;
      answer = h;
      askName = `${nC}${nD}`;
      traps.push({ value: m.mul(hyp), trap: 'geo-sim-alt-hyp-for-piece' }, { value: m.mul(n), trap: 'geo-sim-alt-no-root' }, { value: hyp.div(2), trap: 'geo-sim-alt-half-hyp' }, { value: m, trap: 'geo-sim-alt-altitude' }, { value: n, trap: 'geo-sim-alt-altitude' });
      steps = `The other piece is $${nD}${nB} = ${c} - ${mm} = ${nn}$. The altitude is the mean of the two pieces: $${nC}${nD}^2 = ${mm} \\cdot ${nn} = ${mm * nn}$, so $${nC}${nD} = ${dec(h)}$.`;
    } else if (mode === 'legs') {
      fig.seg(nA, nB, `$${c}$`);
      given = `$${nC}${nA} = ${p}$ and $${nA}${nB} = ${c}$`;
      if (ask === 'm') {
        answer = m;
        askName = `${nA}${nD}`;
        traps.push({ value: n, trap: 'geo-sim-alt-other-piece' }, { value: h, trap: 'geo-sim-alt-altitude' }, { value: hyp.div(2), trap: 'geo-sim-alt-half-hyp' });
        steps = `Triangles ${nA}${nD}${nC} and ${nA}${nC}${nB} share angle ${nA} and each has a right angle, so they are similar: $\\frac{${nA}${nD}}{${nA}${nC}} = \\frac{${nA}${nC}}{${nA}${nB}}$. Thus $${nA}${nD} = \\frac{${p}^2}{${c}} = ${dec(m)}$.`;
      } else if (ask === 'n') {
        answer = n;
        askName = `${nD}${nB}`;
        traps.push({ value: m, trap: 'geo-sim-alt-other-piece' }, { value: h, trap: 'geo-sim-alt-altitude' }, { value: hyp.div(2), trap: 'geo-sim-alt-half-hyp' });
        steps = `The pieces satisfy $${nA}${nD} = \\frac{${p}^2}{${c}} = ${dec(m)}$ by similar triangles (they share angle ${nA}), so $${nD}${nB} = ${c} - ${dec(m)} = ${dec(n)}$.`;
      } else {
        answer = h;
        askName = `${nC}${nD}`;
        traps.push({ value: m, trap: 'geo-sim-alt-altitude' }, { value: n, trap: 'geo-sim-alt-altitude' }, { value: hyp.div(2), trap: 'geo-sim-alt-half-hyp' });
        steps = `The other leg is $${nC}${nB} = ${q}$ (Pythagoras). Writing the area of ${nA}${nB}${nC} in two ways, $\\frac12 \\cdot ${p} \\cdot ${q} = \\frac12 \\cdot ${c} \\cdot ${nC}${nD}$, so $${nC}${nD} = \\frac{${p * q}}{${c}} = ${dec(h)}$.`;
      }
    } else {
      fig.seg(nA, nD, `$${dec(m)}$`).seg(nD, nB, `$${dec(n)}$`);
      given = `$${nA}${nD} = ${dec(m)}$ and $${nD}${nB} = ${dec(n)}$`;
      if (ask === 'leg') {
        answer = CB;
        askName = `${nC}${nB}`;
        traps.push({ value: CA, trap: 'geo-sim-alt-wrong-leg' }, { value: h, trap: 'geo-sim-alt-altitude' }, { value: n, trap: 'geo-sim-alt-other-piece' });
        steps = `The hypotenuse is $${dec(m)} + ${dec(n)} = ${c}$. Triangles ${nB}${nD}${nC} and ${nB}${nC}${nA} share angle ${nB}, so $${nC}${nB}^2 = ${nD}${nB} \\cdot ${nA}${nB} = ${dec(n)} \\cdot ${c} = ${dec(n.mul(hyp))}$ and $${nC}${nB} = ${q}$.`;
      } else {
        answer = F(p + q + c);
        askName = `the perimeter of triangle ${nA}${nB}${nC}`;
        traps.push({ value: F(p + q), trap: 'geo-sim-alt-drop-hyp' }, { value: F(p + q).add(h), trap: 'geo-sim-alt-altitude' }, { value: m.add(n).add(h), trap: 'geo-sim-alt-altitude' });
        steps = `The hypotenuse is $${dec(m)} + ${dec(n)} = ${c}$. Each leg is the mean of the hypotenuse and the piece touching it: $${nC}${nA}^2 = ${dec(m)} \\cdot ${c} = ${dec(m.mul(hyp))}$, so $${nC}${nA} = ${p}$, and $${nC}${nB}^2 = ${dec(n)} \\cdot ${c} = ${dec(n.mul(hyp))}$, so $${nC}${nB} = ${q}$. The perimeter is $${p} + ${q} + ${c}$.`;
      }
    }
    const { choices, answer: ans } = numericChoices(rng, {
      correct: answer,
      traps,
      fillers: [answer.add(F(1)), answer.sub(F(2)), answer.mul(2), answer.div(2), answer.add(F(3))],
      format: tx,
      order: 'asc',
    });
    if (choices.filter((c) => c.trap).length < 2) throw new Redraw('too few traps shown');
    const notes = trapNotes(
      choices,
      {
        'geo-sim-alt-no-root': (vs) => `${vs} multiplies the two pieces but skips the square root`,
        'geo-sim-alt-arith-mean': (vs) => `${vs} averages the pieces, but the altitude is their geometric mean`,
        'geo-sim-alt-hyp-for-piece': (vs) => `${vs} uses the whole hypotenuse where a piece belongs`,
        'geo-sim-alt-other-piece': (vs) => `${vs} is the other piece of the hypotenuse`,
        'geo-sim-alt-altitude': (vs) => `${vs} is a different segment of the figure from the one asked`,
        'geo-sim-alt-half-hyp': (vs) => `${vs} is half the hypotenuse, which is the median, not the length asked`,
        'geo-sim-alt-wrong-leg': (vs) => `${vs} is the other leg`,
        'geo-sim-alt-drop-hyp': (vs) => `${vs} leaves the hypotenuse out`,
      },
      2,
    );
    const stem = `In the figure, angle $${nA}${nC}${nB}$ is a right angle and $${nC}${nD}$ is perpendicular to $${nA}${nB}$, with $${nD}$ on $${nA}${nB}$. Given ${given}, what is ${ask === 'perim' ? askName : `the length of $${askName}$`}?`;
    return {
      params: { m: `${m.n}/${m.d}`, mode, ask, p, q, c, names: [nA, nB, nC, nD], flip },
      q: {
        format: 'mcs',
        stem,
        figure: fig.build(false),
        choices,
        answer: ans,
        explanation: `Recognize: the altitude to the hypotenuse of a right triangle makes two smaller right triangles, each similar to the whole.

${steps}

Check: ${mode === 'mean' || mode === 'hyp' ? `in triangle ${nA}${nD}${nC}, $${mm}^2 + ${hh}^2 = ${mm * mm + hh * hh}$, which equals $${nA}${nD} \\cdot ${nA}${nB} = ${mm} \\cdot ${c}$, as it must since $${nA}${nC}^2 = ${nA}${nD} \\cdot ${nA}${nB}$.` : `$${p}^2 + ${q}^2 = ${p * p + q * q} = ${c}^2$, so the sides fit the right angle at ${nC}.`}

${notes}

Rule: match triangles that share an acute angle, then write each ratio as a part over the whole side it belongs to.`,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const [m0, m1] = String(p.m).split('/').map(Number);
    const m = m0 / m1;
    const A: P2 = [0, 0];
    const B: P2 = [p.c, 0];
    let C: P2;
    if (p.mode === 'mean' || p.mode === 'hyp') {
      // Thales: C lies on the circle with diameter AB, above D
      const r = p.c / 2;
      C = [m, Math.sqrt(r * r - (m - r) * (m - r))];
    } else {
      C = [(p.p * p.p + p.c * p.c - p.q * p.q) / (2 * p.c), 0];
      C[1] = Math.sqrt(p.p * p.p - C[0] * C[0]);
    }
    const dist = (u: P2, v: P2) => Math.hypot(u[0] - v[0], u[1] - v[1]);
    if (Math.abs((C[0] - A[0]) * (C[0] - B[0]) + C[1] * C[1]) > 1e-6) return 'angle at C is not right';
    const D: P2 = [C[0], 0];
    let exp: number;
    if (p.ask === 'h') exp = dist(C, D);
    else if (p.ask === 'm') exp = dist(A, D);
    else if (p.ask === 'n') exp = dist(D, B);
    else if (p.ask === 'leg') exp = dist(C, B);
    else exp = dist(A, C) + dist(C, B) + dist(A, B);
    const got = q.choices[q.answer].text.replace(/[$,{}]/g, '');
    if (Math.abs(Number(got) - exp) > 1e-6) return `expected ${exp}`;
    return null;
  },
};

export const altitudeTemplates = retryAll([altitude]);
