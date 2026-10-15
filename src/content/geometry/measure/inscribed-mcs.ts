import { num } from '../../../engine/tex';
import type { Template, Trap } from '../../../engine/types';
import { checkChoiceValue, circlePolygon, Ex, exChoices, type ExData, shoelace } from './ex';
import { drawBox, drawCylinder, Fig, onCircle } from './fig';
import { trapNotes } from '../notes';
import { retryAll } from '../redraw';

/* Cylinders and boxes fitted inside each other: the volume of the inner solid or of the space left over (MCS). */

export const inscribedTraps: Record<string, Trap> = {
  'geom-incyl-wrong-region': {
    label: 'Gave the other region (the inner solid instead of the space around it, or the reverse)',
    fix: 'Reread which region is asked. The leftover space is the outer solid minus the inner solid.',
  },
  'geom-incyl-whole-solid': {
    label: 'Gave the volume of the outer solid',
    fix: 'The outer solid is not the region asked for. Subtract the inner solid, or compute the inner one directly.',
  },
  'geom-incyl-r-cubed': {
    label: 'Used pi r cubed for the volume of the cylinder',
    fix: 'The volume of a cylinder is the base area $\\pi r^2$ times the height $h$. With $h = 2r$ that is $2\\pi r^3$, not $\\pi r^3$.',
  },
  'geom-incyl-no-height': {
    label: 'Found an AREA of the base and left the height out',
    fix: 'The base gives an area, not a volume. A volume needs the height too: base area times $h$.',
  },
  'geom-incyl-base-only': {
    label: 'Subtracted the area of the circle from the volume of the solid',
    fix: 'An area and a volume cannot be subtracted. Use the volume of the cylinder, $\\pi r^2 h$.',
  },
  'geom-incyl-diameter-radius': {
    label: 'Used the diameter as the radius',
    fix: 'The cylinder touches opposite faces, so the DIAMETER equals the distance between them. The radius is half of it.',
  },
  'geom-incyl-no-pi': {
    label: 'Forgot the factor pi in the area of the circular base',
    fix: 'The base is a circle, with area $\\pi r^2$. The volume of a cylinder keeps the $\\pi$.',
  },
  'geom-incyl-half-radius': {
    label: 'Halved the radius a second time',
    fix: 'The diameter is the edge (or the width of a can) and the radius is half of that. Do not halve again.',
  },
  'geom-incyl-one-piece': {
    label: 'Gave only one of the equal leftover pieces',
    fix: 'The leftover space is made of several equal pieces (the four corners of the cube, or the four curved slabs). Add them all.',
  },
  'geom-incyl-side-is-radius': {
    label: 'Took the side of the inscribed square to be the radius',
    fix: 'The diagonal of the inscribed square is the diameter of the circle, $2r$. The side is $r\\sqrt{2}$ and the area of the square is $2r^2$.',
  },
  'geom-incyl-side-is-diameter': {
    label: 'Took the side of the inscribed square to be the diameter',
    fix: 'A square inside a circle cannot be as wide as the diameter on its side: the diameter is its DIAGONAL, and the area of the square is $2r^2$.',
  },
  'geom-incyl-diagonal-radius': {
    label: 'Took the radius for the diagonal of the inscribed square',
    fix: 'The diagonal of the inscribed square is the whole diameter, $2r$, not the radius $r$.',
  },
  'geom-incyl-one-can': {
    label: 'Used the volume of one can only',
    fix: 'There are several cans. Multiply the volume of one can by their number.',
  },
  'geom-incyl-count': {
    label: 'Counted $k$ cans instead of $k^2$',
    fix: 'The cans stand in $k$ rows of $k$, so there are $k \\cdot k$ of them.',
  },
};

type Kind = 'cube' | 'prism' | 'cans';
type Ask = 'outside' | 'inside';
interface Params {
  kind: Kind;
  ask: Ask;
  e: number;
  r: number;
  h: number;
  k: number;
  values: ExData[];
}

const NOUN = ['cans', 'jars', 'candles'] as const;

const inscribed: Template<Params> = {
  id: 'geo.solids.inscribed',
  skill: 'geo.solids',
  format: 'mcs',
  style: 'cylinder in a cube, square prism in a cylinder, or cans in a box: the inner volume or the leftover volume',
  generate(rng, dif) {
    const kind: Kind = dif === 1 ? 'cube' : dif === 2 ? 'prism' : 'cans';
    const ask: Ask = rng.pick(['outside', 'inside']);
    const fig = new Fig();
    const cm = rng.chance(0.5) ? 'centimeters' : 'inches';
    const cu = cm === 'inches' ? 'cubic inches' : 'cubic centimeters';
    let stem: string;
    let geometry: string;
    let inner: Ex;
    let outer: Ex;
    let traps: { v: Ex; trap: string }[];
    let notesMap: Record<string, (v: string) => string>;
    let extra = '';
    let e = 0;
    let r = 0;
    let h = 0;
    let k = 0;
    if (kind === 'cube' || kind === 'cans') {
      k = kind === 'cube' ? 1 : rng.pick([2, 3]);
      e = kind === 'cube' ? 2 * rng.int(1, 20) : 2 * k * rng.int(1, k === 2 ? 8 : 6);
      const e3 = e ** 3;
      inner = Ex.pi(e3 / 4);
      outer = Ex.of(e3);
      const left = outer.sub(inner);
      const wrongRegion = ask === 'outside' ? inner : left;
      traps = [
        { v: wrongRegion, trap: 'geom-incyl-wrong-region' },
        { v: outer, trap: 'geom-incyl-whole-solid' },
      ];
      if (ask === 'outside') {
        traps.push(
          { v: Ex.of(e3).add(Ex.pi(-e3 / 8)), trap: 'geom-incyl-r-cubed' },
          { v: Ex.of(e * e).add(Ex.pi(-(e * e) / 4)), trap: 'geom-incyl-no-height' },
          { v: left.scale(0.25), trap: 'geom-incyl-one-piece' },
        );
        if (kind === 'cube') traps.push({ v: Ex.of(e3).add(Ex.pi(-(e * e) / 4)), trap: 'geom-incyl-base-only' });
      } else {
        traps.push({ v: Ex.pi(e3), trap: 'geom-incyl-diameter-radius' }, { v: Ex.pi(e3 / 16), trap: 'geom-incyl-half-radius' }, { v: Ex.pi(e3 / 8), trap: 'geom-incyl-r-cubed' }, { v: Ex.of(e3 / 4), trap: 'geom-incyl-no-pi' });
      }
      if (kind === 'cans') {
        const oneCan = Ex.pi(e3 / (4 * k * k));
        const kCans = Ex.pi(e3 / (4 * k));
        traps.push({ v: ask === 'outside' ? outer.sub(oneCan) : oneCan, trap: 'geom-incyl-one-can' }, { v: ask === 'outside' ? outer.sub(kCans) : kCans, trap: 'geom-incyl-count' });
      }
      const question = ask === 'outside' ? `the space inside the ${kind === 'cube' ? 'cube that is outside the cylinder' : 'box that is not occupied by the cans'}` : kind === 'cube' ? 'the cylinder' : 'all of the cans together';
      if (kind === 'cube') {
        stem = rng.chance(0.5)
          ? `A solid cylinder fits snugly inside a cube with edge ${e} ${cm}: its height equals the edge, and its curved surface touches all four side faces. What is the volume, in ${cu}, of ${question}?`
          : `A round column is turned from a cube of stone with edge ${e} ${cm}. The column is as tall as the cube, and its curved surface touches all four side faces. What is the volume, in ${cu}, of ${ask === 'outside' ? 'the stone that is removed' : 'the column'}?`;
        drawBox(fig, 3, 3, 3, { L: `$${e}$`, W: `$${e}$`, H: `$${e}$` });
        geometry = `The cylinder touches opposite side faces, so its diameter is the edge, $${e}$, and its radius is $${e / 2}$. Its height is also $${e}$.\n\nCylinder: $\\pi \\cdot ${e / 2}^2 \\cdot ${e} = ${num(e3 / 4)}\\pi$. Cube: $${e}^3 = ${num(e3)}$.`;
      } else {
        const noun = rng.pick(NOUN);
        const word = k === 2 ? 'four' : 'nine';
        stem = `A cubical box with inside edge ${e} ${cm} is filled with ${word} identical upright cylindrical ${noun}, standing in ${k === 2 ? 'two rows of two' : 'three rows of three'}. Each one is as tall as the box, and they touch their neighbors and the walls of the box. What is the volume, in ${cu}, of ${ask === 'outside' ? 'the space inside the box that is not occupied' : `the ${noun} together`}?`;
        fig.polyXY([[-3, -3], [3, -3], [3, 3], [-3, 3]]);
        for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) fig.circle(fig.h([-3 + (6 / k) * (i + 0.5), -3 + (6 / k) * (j + 0.5)]), 3 / k);
        fig.segXY([-3, -3.6], [3, -3.6], `$${e}$`);
        const d = e / k;
        geometry = `Along one row, ${k} of them touch edge to edge and fill the width, so each has diameter $\\frac{${e}}{${k}} = ${d}$ and radius $${d / 2}$.\n\nOne: $\\pi \\cdot ${d / 2}^2 \\cdot ${e} = ${num(e3 / (4 * k * k))}\\pi$. There are $${k} \\cdot ${k} = ${k * k}$ of them: $${num(e3 / 4)}\\pi$. The box: $${e}^3 = ${num(e3)}$.`;
        extra = `\n\nThe ${k * k} small circles cover the same share, $\\frac{\\pi}{4}$, of the base as one big circle of diameter ${e} would, so the total does not depend on how many there are.`;
      }
      notesMap = {
        'geom-incyl-wrong-region': (v) => `${v} is the other region`,
        'geom-incyl-whole-solid': (v) => `${v} is the whole ${kind === 'cube' ? 'cube' : 'box'}`,
        'geom-incyl-r-cubed': (v) => `${v} uses $\\pi r^3$ for a cylinder`,
        'geom-incyl-no-height': (v) => `${v} is an area of the base, with the height left out`,
        'geom-incyl-base-only': (v) => `${v} subtracts an area from a volume`,
        'geom-incyl-diameter-radius': (v) => `${v} uses the diameter as the radius`,
        'geom-incyl-no-pi': (v) => `${v} leaves out the factor $\\pi$`,
        'geom-incyl-half-radius': (v) => `${v} halves the radius twice`,
        'geom-incyl-one-piece': (v) => `${v} is only one of the four equal leftover parts`,
        'geom-incyl-one-can': (v) => `${v} uses a single can`,
        'geom-incyl-count': (v) => `${v} counts ${k} cans instead of ${k * k}`,
      };
    } else {
      r = rng.int(2, 9);
      h = rng.int(2, 15);
      const v = r * r * h;
      outer = Ex.pi(v);
      inner = Ex.of(2 * v);
      const left = outer.sub(inner);
      traps =
        ask === 'outside'
          ? [
              { v: outer, trap: 'geom-incyl-whole-solid' },
              { v: inner, trap: 'geom-incyl-wrong-region' },
              { v: outer.sub(Ex.of(v)), trap: 'geom-incyl-side-is-radius' },
              { v: outer.sub(Ex.of(v / 2)), trap: 'geom-incyl-diagonal-radius' },
              { v: left.scale(0.25), trap: 'geom-incyl-one-piece' },
            ]
          : [
              { v: outer, trap: 'geom-incyl-whole-solid' },
              { v: left, trap: 'geom-incyl-wrong-region' },
              { v: Ex.of(v), trap: 'geom-incyl-side-is-radius' },
              { v: Ex.of(v / 2), trap: 'geom-incyl-diagonal-radius' },
              { v: Ex.of(4 * v), trap: 'geom-incyl-side-is-diameter' },
            ];
      stem = `A solid cylinder of radius ${r} ${cm} and height ${h} ${cm} is cut into a rectangular prism with a square base, as large as possible, by trimming its curved side: the base of the prism is a square inscribed in the circular base. What is the volume, in ${cu}, of ${ask === 'outside' ? 'the material that is cut away' : 'the prism'}?`;
      drawCylinder(fig, 3, 4, { r: `$${r}$`, h: `$${h}$` });
      geometry = `The square base is inscribed in the circle, so its diagonal is the diameter, $2 \\cdot ${r} = ${2 * r}$. A square with diagonal $D$ has area $\\frac{D^2}{2}$, so the base has area $\\frac{${2 * r}^2}{2} = ${2 * r * r}$.\n\nPrism: $${2 * r * r} \\cdot ${h} = ${num(2 * v)}$. Cylinder: $\\pi \\cdot ${r}^2 \\cdot ${h} = ${num(v)}\\pi$.`;
      notesMap = {
        'geom-incyl-whole-solid': (x) => `${x} is the whole cylinder`,
        'geom-incyl-wrong-region': (x) => `${x} is the other region`,
        'geom-incyl-side-is-radius': (x) => `${x} takes the side of the square as $r$`,
        'geom-incyl-side-is-diameter': (x) => `${x} takes the side of the square as the diameter`,
        'geom-incyl-diagonal-radius': (x) => `${x} takes the diagonal of the square as $r$`,
        'geom-incyl-one-piece': (x) => `${x} is only one of the four curved pieces`,
      };
    }
    const correct = ask === 'outside' ? outer.sub(inner) : inner;
    const built = exChoices(rng, correct, traps, [], { scales: false });
    const notes = trapNotes(built.choices, notesMap, 2);
    const final =
      ask === 'outside' ? `The space left is the difference: $${outer.tex()} - ${inner.tex()} = ${correct.tex()}$.` : `The volume asked for is $${correct.tex()}$.`;
    const explanation = `${geometry}${extra}

${final}

Check: $\\pi \\approx 3.14$, so the answer is about $${num(Math.round(correct.value()))}$.

${notes}

Rule: write the radius from the diameter (or the diagonal), then subtract volumes, never a volume and an area.`;
    return { params: { kind, ask, e, r, h, k, values: built.values }, q: { format: 'mcs', stem, figure: fig.build(), choices: built.choices, answer: built.answer, explanation } };
  },
  check(q, p) {
    if (q.format !== 'mcs') return 'format';
    const circle = (rad: number) => shoelace(circlePolygon([0, 0], rad));
    let inside: number;
    let area: number; // area of the base of the container
    let height: number;
    if (p.kind === 'prism') {
      area = circle(p.r);
      inside = shoelace([45, 135, 225, 315].map((a) => onCircle([0, 0], p.r, a))) * p.h;
      height = p.h;
      const target = p.ask === 'outside' ? area * height - inside : inside;
      return checkChoiceValue(p.values, q.answer, target, 1e-5);
    }
    area = p.e * p.e;
    height = p.e;
    inside = p.k * p.k * circle(p.e / (2 * p.k)) * height;
    const target = p.ask === 'outside' ? area * height - inside : inside;
    return checkChoiceValue(p.values, q.answer, target, 1e-5);
  },
};

export const inscribedTemplates = retryAll([inscribed]);
