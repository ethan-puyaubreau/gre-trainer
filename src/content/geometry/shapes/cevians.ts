import type { Template, Trap } from '../../../engine/types';
import { num } from '../../../engine/tex';
import { trapNotes } from '../notes';
import { Redraw, retryAll } from '../redraw';
import { mixed } from './apex-parallel';
import { FigBuilder, add, angleAt, dist, foot, mul, sub, triFromAngles, type Pt } from './fig';
import { checkMcs, intChoices } from './util';

/* Angle bisectors and altitudes of a triangle: the angle at the incenter, the angle between altitude and bisector (MCS). */

export const cevianTraps: Record<string, Trap> = {
  'geo-cev-half-a': {
    label: 'Took the angle at the meeting point as half of the vertex angle',
    fix: 'The angle at the meeting point of the two bisectors is $90^\\circ + \\tfrac12 A$, not $\\tfrac12 A$. Build it from the triangle: $180^\\circ$ minus the two half-angles at the base.',
  },
  'geo-cev-supplement': {
    label: 'Gave $180^\\circ$ minus the vertex angle',
    fix: '$180^\\circ - A$ is the sum of the two base angles of the big triangle. The bisectors halve them: the small triangle has base angles $\\tfrac12 B$ and $\\tfrac12 C$.',
  },
  'geo-cev-minus-half': {
    label: 'Subtracted half of the vertex angle from $90^\\circ$ instead of adding',
    fix: 'Work it out: the base angles of the small triangle add up to $90^\\circ - \\tfrac12 A$, so the angle at the meeting point is $180^\\circ$ minus that, which is $90^\\circ + \\tfrac12 A$.',
  },
  'geo-cev-same-as-a': {
    label: 'Assumed the angle at the meeting point equals the vertex angle',
    fix: 'The bisectors start at the base vertices, so the angle they make at their meeting point is a different angle: $90^\\circ + \\tfrac12 A$.',
  },
  'geo-cev-half-sum': {
    label: 'Gave the sum of the two half base angles',
    fix: 'The two half-angles are two angles of the small triangle; the angle at the meeting point is the third one, $180^\\circ$ minus their sum.',
  },
  'geo-cev-base-sum': {
    label: 'Gave the sum of the two base angles',
    fix: 'The sum of the base angles is $180^\\circ - A$. The bisectors cut each of them in half before they meet.',
  },
  'geo-cev-no-half': {
    label: 'Forgot to halve the difference of the base angles',
    fix: 'The bisector splits the vertex angle in half, so the angle between bisector and altitude is half of $B - C$, not all of it.',
  },
  'geo-cev-half-vertex': {
    label: 'Gave half of the vertex angle',
    fix: 'Half of $A$ is the angle between the bisector and a side. The altitude is not that side: the angle asked is the gap between bisector and altitude.',
  },
  'geo-cev-whole-gap': {
    label: 'Gave the angle between the altitude and a side',
    fix: 'The altitude makes $90^\\circ - B$ with side $AB$ and $90^\\circ - C$ with side $AC$. The bisector lies between these two sides, so the angle asked is a smaller piece.',
  },
  'geo-cev-reverse-half': {
    label: 'Forgot to double when working back to the vertex angle',
    fix: 'From $\\angle BIC = 90^\\circ + \\tfrac12 A$ we get $\\tfrac12 A = \\angle BIC - 90^\\circ$, so $A$ is TWICE that.',
  },
  'geo-cev-reverse-supp': {
    label: 'Took the vertex angle as $180^\\circ$ minus the angle at the meeting point',
    fix: 'Use $\\angle BIC = 90^\\circ + \\tfrac12 A$ and solve: $A = 2(\\angle BIC - 90^\\circ)$.',
  },
};

type Names = [string, string, string];
const NAMES: Names[] = [
  ['A', 'B', 'C'],
  ['P', 'Q', 'R'],
  ['X', 'Y', 'Z'],
  ['J', 'K', 'L'],
];

interface P {
  kind: 'fwd-apex' | 'fwd-base' | 'reverse' | 'altitude';
  a?: number;
  b?: number;
  c?: number;
  k?: number;
  values: number[];
}

const deg = (v: { n: number }) => `$${num(v.n)}^\\circ$`;

/** Incenter from the side lengths (weighted average of the vertices): independent of any bisector drawing. */
function incenter(A: Pt, B: Pt, C: Pt): Pt {
  const la = dist(B, C);
  const lb = dist(A, C);
  const lc = dist(A, B);
  const s = la + lb + lc;
  return [(la * A[0] + lb * B[0] + lc * C[0]) / s, (la * A[1] + lb * B[1] + lc * C[1]) / s];
}
/** Foot of the bisector from A on BC: divides BC in the ratio AB : AC. */
function bisectorFoot(A: Pt, B: Pt, C: Pt): Pt {
  const r = dist(A, B) / (dist(A, B) + dist(A, C));
  return add(B, mul(sub(C, B), r));
}
const tri = (b: number, c: number): { A: Pt; B: Pt; C: Pt } => {
  const [B, C, A] = triFromAngles(b, c, 6);
  return { A, B, C };
};

const cevians: Template<P> = {
  id: 'geo.triangles.cevian-angles-mcs',
  skill: 'geo.triangles',
  format: 'mcs',
  style: 'angle bisectors meeting at a point, or the angle between an altitude and a bisector',
  generate(rng, d) {
    const names = rng.pick(NAMES);
    const [nA, nB, nC] = names;
    const kind: P['kind'] = d === 1 ? 'fwd-apex' : d === 2 ? rng.pick(['fwd-base', 'reverse'] as const) : 'altitude';
    if (kind === 'fwd-apex') {
      const a = 2 * rng.int(20, 60); // 40..120
      const ans = 90 + a / 2;
      const { choices, answer, values } = mixed(
        rng,
        intChoices(
          rng,
          ans,
          [
            { value: a / 2, trap: 'geo-cev-half-a' },
            { value: 180 - a, trap: 'geo-cev-supplement' },
            { value: 90 - a / 2, trap: 'geo-cev-minus-half' },
            { value: a, trap: 'geo-cev-same-as-a' },
          ],
          [ans + 10, ans - 10, ans + 20],
          deg,
          1,
        ),
      );
      const bAng = (180 - a) / 2 + rng.pick([-8, 0, 8]);
      const cAng = 180 - a - bAng;
      const { A, B, C } = tri(bAng, cAng);
      const I = incenter(A, B, C);
      const fb = new FigBuilder().pt(nA, A).pt(nB, B).pt(nC, C).pt('I', I).poly(nA, nB, nC).seg(nB, 'I').seg(nC, 'I').angle(nA, nB, nC, `$${a}^\\circ$`);
      const explanation = `Recognize: $I$ is where the bisectors of $\\angle ${nB}$ and $\\angle ${nC}$ meet, so triangle $${nB}I${nC}$ has base angles $\\tfrac12 \\angle ${nB}$ and $\\tfrac12 \\angle ${nC}$.

Since $\\angle ${nB} + \\angle ${nC} = 180 - ${a} = ${180 - a}$, those two halves add up to $${(180 - a) / 2}^\\circ$. The third angle of triangle $${nB}I${nC}$ is $180 - ${(180 - a) / 2} = ${ans}^\\circ$.

Check: the answer is $90 + \\tfrac12(${a}) = ${ans}$, always between $90^\\circ$ and $180^\\circ$.

${trapNotes(choices, { 'geo-cev-half-a': (v) => `${v} is only half of $\\angle ${nA}$`, 'geo-cev-supplement': (v) => `${v} is $\\angle ${nB} + \\angle ${nC}$, before the bisectors halve them`, 'geo-cev-minus-half': (v) => `${v} subtracts the half from $90^\\circ$ instead of adding` }, 2)}

Rule: $\\angle BIC = 90^\\circ + \\tfrac12 A$.`;
      return {
        params: { kind, a, b: bAng, c: cAng, values },
        q: {
          format: 'mcs',
          stem: `In triangle $${nA}${nB}${nC}$ above, $\\angle ${nA} = ${a}^\\circ$. The bisectors of $\\angle ${nB}$ and $\\angle ${nC}$ meet at point $I$. What is the measure, in degrees, of $\\angle ${nB}I${nC}$?`,
          figure: fb.build(),
          choices,
          answer,
          explanation,
        },
      };
    }
    if (kind === 'fwd-base' || kind === 'reverse') {
      const b = rng.int(40, 80);
      const c = rng.int(40, 80);
      if ((b + c) % 2 || b === c || b + c > 150) throw new Redraw('shape');
      const a = 180 - b - c;
      const ans = 180 - (b + c) / 2;
      const { A, B, C } = tri(b, c);
      const I = incenter(A, B, C);
      if (kind === 'fwd-base') {
        const { choices, answer, values } = mixed(
          rng,
          intChoices(
            rng,
            ans,
            [
              { value: (b + c) / 2, trap: 'geo-cev-half-sum' },
              { value: b + c, trap: 'geo-cev-base-sum' },
              { value: a, trap: 'geo-cev-same-as-a' },
              { value: 180 - a, trap: 'geo-cev-supplement' },
            ],
            [ans + 10, ans - 10, ans + 20],
            deg,
            1,
          ),
        );
        const fb = new FigBuilder().pt(nA, A).pt(nB, B).pt(nC, C).pt('I', I).poly(nA, nB, nC).seg(nB, 'I').seg(nC, 'I').angle(nB, nC, nA, `$${b}^\\circ$`).angle(nC, nA, nB, `$${c}^\\circ$`);
        const explanation = `Recognize: the bisectors cut $\\angle ${nB}$ and $\\angle ${nC}$ in half, so triangle $${nB}I${nC}$ has base angles $${b} \\div 2 = ${b / 2}^\\circ$ and $${c} \\div 2 = ${c / 2}^\\circ$.

The angle at $I$ is the third angle of that triangle: $180 - ${b / 2} - ${c / 2} = ${ans}^\\circ$.

Check: $\\angle ${nA} = 180 - ${b} - ${c} = ${a}^\\circ$, and $90 + \\tfrac12(${a}) = ${ans}$.

${trapNotes(choices, { 'geo-cev-half-sum': (v) => `${v} stops at the sum of the two half-angles`, 'geo-cev-base-sum': (v) => `${v} adds the whole base angles, before the bisectors halve them`, 'geo-cev-same-as-a': (v) => `${v} is $\\angle ${nA}$, a different angle`, 'geo-cev-supplement': (v) => `${v} is $180^\\circ - \\angle ${nA}$` }, 2)}

Rule: halve the base angles, then use the angle sum of the small triangle.`;
        return {
          params: { kind, b, c, values },
          q: {
            format: 'mcs',
            stem: `In triangle $${nA}${nB}${nC}$ above, $\\angle ${nB} = ${b}^\\circ$ and $\\angle ${nC} = ${c}^\\circ$. The bisectors of $\\angle ${nB}$ and $\\angle ${nC}$ meet at point $I$. What is the measure, in degrees, of $\\angle ${nB}I${nC}$?`,
            figure: fb.build(),
            choices,
            answer,
            explanation,
          },
        };
      }
      // reverse: the angle at I is given, find the vertex angle
      const k = ans;
      const { choices, answer, values } = mixed(
        rng,
        intChoices(
          rng,
          a,
          [
            { value: k - 90, trap: 'geo-cev-reverse-half' },
            { value: 180 - k, trap: 'geo-cev-reverse-supp' },
            { value: k, trap: 'geo-cev-same-as-a' },
            { value: 2 * (180 - k), trap: 'geo-cev-base-sum' },
          ],
          [a + 10, a - 10, a + 20],
          deg,
          1,
        ),
      );
      const fb = new FigBuilder().pt(nA, A).pt(nB, B).pt(nC, C).pt('I', I).poly(nA, nB, nC).seg(nB, 'I').seg(nC, 'I').angle('I', nB, nC, `$${k}^\\circ$`, 14);
      const explanation = `Recognize: in triangle $${nB}I${nC}$ the base angles are $\\tfrac12 \\angle ${nB}$ and $\\tfrac12 \\angle ${nC}$, and the angle at $I$ is $${k}^\\circ$.

So $\\tfrac12 \\angle ${nB} + \\tfrac12 \\angle ${nC} = 180 - ${k} = ${180 - k}$, which means $\\angle ${nB} + \\angle ${nC} = ${2 * (180 - k)}$. Then $\\angle ${nA} = 180 - ${2 * (180 - k)} = ${a}^\\circ$.

Check: $90 + \\tfrac12(${a}) = ${k}$.

${trapNotes(choices, { 'geo-cev-reverse-half': (v) => `${v} is $${k} - 90$, which is only half of $\\angle ${nA}$`, 'geo-cev-reverse-supp': (v) => `${v} is the sum of the two half base angles`, 'geo-cev-base-sum': (v) => `${v} is $\\angle ${nB} + \\angle ${nC}$, not $\\angle ${nA}$` }, 2)}

Rule: $A = 2(\\angle BIC - 90^\\circ)$.`;
      return {
        params: { kind, k, values },
        q: {
          format: 'mcs',
          stem: `In triangle $${nA}${nB}${nC}$ above, the bisectors of $\\angle ${nB}$ and $\\angle ${nC}$ meet at point $I$, and $\\angle ${nB}I${nC} = ${k}^\\circ$. What is the measure, in degrees, of $\\angle ${nA}$?`,
          figure: fb.build(),
          choices,
          answer,
          explanation,
        },
      };
    }
    // d3: altitude and bisector from the same vertex
    const b = rng.int(40, 80);
    const c = rng.int(40, 80);
    if ((b - c) % 2 || b - c < 10 || b + c > 150) throw new Redraw('shape');
    const a = 180 - b - c;
    const ans = (b - c) / 2;
    const { choices, answer, values } = mixed(
      rng,
      intChoices(
        rng,
        ans,
        [
          { value: b - c, trap: 'geo-cev-no-half' },
          { value: a / 2, trap: 'geo-cev-half-vertex' },
          { value: 90 - c, trap: 'geo-cev-whole-gap' },
          { value: (b + c) / 2, trap: 'geo-cev-half-sum' },
        ],
        [ans + 3, ans + 6, ans - 3],
        deg,
        1,
      ),
    );
    const { A, B, C } = tri(b, c);
    const D = foot(A, B, C);
    const E = bisectorFoot(A, B, C);
    const fb = new FigBuilder().pt(nA, A).pt(nB, B).pt(nC, C).pt('D', D).pt('E', E).poly(nA, nB, nC).seg(nA, 'D').seg(nA, 'E').right(nA, 'D', nC).angle(nB, nC, nA, `$${b}^\\circ$`).angle(nC, nA, nB, `$${c}^\\circ$`);
    const explanation = `Recognize: the altitude makes a right triangle, so it leaves $90 - ${b} = ${90 - b}^\\circ$ next to side $${nA}${nB}$. The bisector splits $\\angle ${nA} = ${a}^\\circ$ into two $${a / 2}^\\circ$ angles.

Measured from side $${nA}${nB}$, the bisector is at $${a / 2}^\\circ$ and the altitude at $${90 - b}^\\circ$. The gap is $${a / 2} - ${90 - b} = ${ans}^\\circ$.

Check: $\\tfrac12(${b} - ${c}) = ${ans}$.

${trapNotes(choices, { 'geo-cev-no-half': (v) => `${v} is $B - C$ without the half`, 'geo-cev-half-vertex': (v) => `${v} is the bisected half-angle, measured from a side and not from the altitude`, 'geo-cev-whole-gap': (v) => `${v} is the angle between the altitude and side $${nA}${nC}$` }, 2)}

Rule: the angle between altitude and bisector is half the difference of the base angles.`;
    return {
      params: { kind: 'altitude', b, c, values },
      q: {
        format: 'mcs',
        stem: `In triangle $${nA}${nB}${nC}$ above, $\\angle ${nB} = ${b}^\\circ$ and $\\angle ${nC} = ${c}^\\circ$. Segment $${nA}D$ is the altitude to $\\overline{${nB}${nC}}$ and segment $${nA}E$ bisects $\\angle ${nA}$. What is the measure, in degrees, of $\\angle D${nA}E$?`,
        figure: fb.build(),
        choices,
        answer,
        explanation,
      },
    };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    let target: number;
    const angI = (b: number, c: number) => {
      const { A, B, C } = tri(b, c);
      return angleAt(incenter(A, B, C), B, C);
    };
    if (p.kind === 'fwd-apex') {
      // the angle at I must depend on A only: test two different shapes with the same apex angle
      const t1 = angI(p.b!, p.c!);
      const t2 = angI((180 - p.a!) / 2, (180 - p.a!) / 2);
      if (Math.abs(t1 - t2) > 1e-6) return 'angle at I depends on the base angles';
      target = t1;
    } else if (p.kind === 'fwd-base') target = angI(p.b!, p.c!);
    else if (p.kind === 'reverse') {
      const hits: number[] = [];
      for (let a = 1; a < 179; a++) if (Math.abs(angI((180 - a) / 2, (180 - a) / 2) - p.k!) < 1e-6) hits.push(a);
      if (hits.length !== 1) return `${hits.length} solutions`;
      target = hits[0];
    } else {
      const { A, B, C } = tri(p.b!, p.c!);
      target = angleAt(A, foot(A, B, C), bisectorFoot(A, B, C));
    }
    return checkMcs(q.answer, p.values, target);
  },
};

export const cevianTemplates = retryAll([cevians]);
