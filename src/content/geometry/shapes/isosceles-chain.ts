import { Frac } from '../../../engine/frac';
import type { Template, Trap } from '../../../engine/types';
import { Redraw, retryAll } from '../redraw';
import { FigBuilder, angleAt, dist, intersect, mid, sub, triFromAngles, type Pt } from './fig';

/* A chain of two isosceles triangles AB = AD = DC with D on BC: exterior angle, then base angles (NE). */

export const isoChainTraps: Record<string, Trap> = {
  'geo-ic-assumed-equal': {
    label: 'Assumed the two base angles $\\angle B$ and $\\angle C$ are equal',
    fix: 'Only $AB = AD$ and $AD = DC$ are given, not $AB = AC$. The base angles are $2c$ and $c$: $\\angle B$ is twice $\\angle C$.',
  },
  'geo-ic-forgot-c': {
    label: 'Left out one angle of the big triangle',
    fix: 'The angle sum of triangle $ABC$ has three terms: $\\angle B + \\angle C + \\angle BAC = 180^\\circ$. Use the small angle $c$ too.',
  },
  'geo-ic-wrong-angle': {
    label: 'Gave a different angle of the figure',
    fix: 'Several angles in the figure are $c$, $2c$ or built from them. Name the angle asked and keep track of which triangle it belongs to.',
  },
  'geo-ic-no-exterior': {
    label: 'Took the angle at $D$ in triangle $ABD$ as equal to $\\angle C$',
    fix: '$\\angle ADB$ is an exterior angle of triangle $ADC$, so it equals the sum of the two remote angles $c + c = 2c$, not $c$.',
  },
};

interface P {
  ask: 'B' | 'BAC' | 'ADC' | 'BAD';
  given: 'C' | 'B' | 'BAC';
  value: number;
  mirror: boolean;
}

const SETS: [string, string, string, string][] = [
  ['A', 'B', 'C', 'D'],
  ['P', 'Q', 'R', 'S'],
  ['X', 'Y', 'Z', 'W'],
  ['J', 'K', 'L', 'M'],
];

/** D on BC with DA = DC: intersection of BC with the perpendicular bisector of AC. */
function pointD(A: Pt, B: Pt, C: Pt): Pt {
  const AC = sub(C, A);
  return intersect(mid(A, C), [-AC[1], AC[0]], B, sub(C, B));
}
const build = (b: number, c: number) => {
  const [B, C, A] = triFromAngles(b, c, 6);
  return { A, B, C, D: pointD(A, B, C) };
};

const isoChain: Template<P> = {
  id: 'geo.triangles.isosceles-chain-ne',
  skill: 'geo.triangles',
  format: 'ne',
  style: 'two isosceles triangles sharing a side: AB = AD = DC with D on BC',
  generate(rng, d) {
    const [nA, nB, nC, nD] = rng.pick(SETS);
    const mirror = rng.chance(0.5);
    const c = rng.int(10, 40);
    const ask: P['ask'] = d === 1 ? 'B' : d === 2 ? 'BAC' : rng.pick(['ADC', 'BAD'] as const);
    const given: P['given'] = d === 1 ? 'C' : d === 2 ? 'B' : 'BAC';
    const angles = { C: c, B: 2 * c, ADB: 2 * c, ADC: 180 - 2 * c, BAD: 180 - 4 * c, BAC: 180 - 3 * c, DAC: c };
    const value = angles[given];
    const answer = new Frac(angles[ask]);
    const traps: { value: Frac; trap: string }[] = [];
    const push = (v: number, trap: string) => {
      const f = new Frac(v);
      if (v > 0 && v < 180 && !f.eq(answer) && !traps.some((t) => t.value.eq(f))) traps.push({ value: f, trap });
    };
    if (d === 2) {
      push(180 - 2 * angles.B, 'geo-ic-assumed-equal');
      push(180 - angles.B, 'geo-ic-forgot-c');
      push(c, 'geo-ic-wrong-angle');
    } else if (d === 1) {
      push(c, 'geo-ic-no-exterior');
      push(180 - 4 * c, 'geo-ic-wrong-angle');
      push(4 * c, 'geo-ic-wrong-angle');
    } else {
      push(c, 'geo-ic-no-exterior');
      push(2 * c, 'geo-ic-wrong-angle');
      push(ask === 'ADC' ? 180 - 4 * c : 180 - 2 * c, 'geo-ic-wrong-angle');
      push(180 - 3 * c, 'geo-ic-wrong-angle');
    }
    if (traps.length < 2) throw new Redraw('not enough traps');
    const { A, B, C, D } = build(2 * c, c);
    const sx = mirror ? -1 : 1;
    const flip = (p: Pt): Pt => [sx * p[0], p[1]];
    const fb = new FigBuilder().pt(nA, flip(A)).pt(nB, flip(B)).pt(nC, flip(C)).pt(nD, flip(D));
    fb.poly(nA, nB, nC).seg(nA, nD);
    const lab = (deg: number) => `$${deg}^\\circ$`;
    if (given === 'C') fb.angle(nC, nB, nA, lab(value));
    else if (given === 'B') fb.angle(nB, nC, nA, lab(value));
    else fb.angle(nA, nB, nC, lab(value));
    const q1 = `AB = AD = DC`.replace('AB', `${nA}${nB}`).replace('AD', `${nA}${nD}`).replace('DC', `${nD}${nC}`);
    const AngC = `\\angle ${nC}`;
    const askTxt: Record<P['ask'], string> = { B: `\\angle ${nB}`, BAC: `\\angle ${nB}${nA}${nC}`, ADC: `\\angle ${nA}${nD}${nC}`, BAD: `\\angle ${nB}${nA}${nD}` };
    const givenTxt: Record<P['given'], string> = { C: AngC, B: `\\angle ${nB}`, BAC: `\\angle ${nB}${nA}${nC}` };
    const stem = `In the figure above, $${nD}$ lies on side $\\overline{${nB}${nC}}$ of triangle $${nA}${nB}${nC}$ and $${q1}$. If $${givenTxt[given]} = ${value}^\\circ$, what is the degree measure of $${askTxt[ask]}$?`;
    const chain = `Because $${nD}${nA} = ${nD}${nC}$, $\\angle ${nD}${nA}${nC} = ${AngC} = ${c}^\\circ$. Angle $${nA}${nD}${nB}$ is an exterior angle of triangle $${nA}${nD}${nC}$, so it equals $${c} + ${c} = ${2 * c}^\\circ$. Because $${nA}${nB} = ${nA}${nD}$, $\\angle ${nB} = \\angle ${nA}${nD}${nB} = ${2 * c}^\\circ$.`;
    const tail =
      ask === 'B'
        ? ''
        : ask === 'BAC'
          ? `Triangle $${nA}${nB}${nC}$ gives $\\angle ${nB}${nA}${nC} = 180 - ${2 * c} - ${c} = ${180 - 3 * c}^\\circ$.`
          : ask === 'ADC'
            ? `Then $\\angle ${nA}${nD}${nC} = 180 - ${2 * c} = ${180 - 2 * c}^\\circ$.`
            : `Triangle $${nA}${nB}${nD}$ gives $\\angle ${nB}${nA}${nD} = 180 - ${2 * c} - ${2 * c} = ${180 - 4 * c}^\\circ$.`;
    const start =
      given === 'C'
        ? `Recognize: two equal-side pairs chain together, so go triangle by triangle, starting from the given $\\angle ${nC} = ${c}^\\circ$.`
        : given === 'B'
          ? `Recognize: the chain gives $\\angle ${nB}$ as twice $\\angle ${nC}$, so work back to $\\angle ${nC}$ first: $${value} \\div 2 = ${c}^\\circ$.`
          : `Recognize: write $\\angle ${nC} = c$ and the chain gives $\\angle ${nB} = 2c$, then the angle sum finds $c$ from the given angle: $180 - 3c = ${value}$, so $c = ${c}^\\circ$.`;
    const explanation = `${start}

${chain} ${tail}

Check: in triangle $${nA}${nB}${nC}$, $${2 * c} + ${c} + ${180 - 3 * c} = 180$.

Trap: stopping at $\\angle ${nC}$ or taking $\\angle ${nB} = \\angle ${nC}$ treats the two equal-side pairs as one.`;
    return {
      params: { ask, given, value, mirror },
      q: { format: 'ne', stem, figure: fb.build(), answer, suffix: 'degrees', traps, explanation },
    };
  },
  check(q, p) {
    if (q.format !== 'ne') return 'format';
    // Search every triangle ABC with integer base angles for the one where AB = AD = DC, D on BC, and the given angle fits.
    const hits: number[] = [];
    for (let b = 2; b < 170; b++)
      for (let c = 2; c < 60 && b + c < 178; c++) {
        const [B, C, A] = triFromAngles(b, c, 6);
        const D = pointD(A, B, C);
        if (Math.abs(dist(A, B) - dist(A, D)) > 1e-6 * 6 || Math.abs(dist(A, D) - dist(D, C)) > 1e-6 * 6) continue;
        const dxs = (D[0] - B[0]) * (D[0] - C[0]);
        if (!(dxs < -1e-6)) continue; // D must lie strictly between B and C
        const angs = { C: angleAt(C, B, A), B: angleAt(B, C, A), BAC: angleAt(A, B, C), ADC: angleAt(D, A, C), BAD: angleAt(A, B, D) };
        if (Math.abs(angs[p.given] - p.value) > 1e-6) continue;
        hits.push(angs[p.ask]);
      }
    if (hits.length !== 1) return `${hits.length} configurations fit`;
    return Math.abs(hits[0] - q.answer.toNumber()) < 1e-6 ? null : `expected ${hits[0]}`;
  },
};

export const isoChainTemplates = retryAll([isoChain]);
