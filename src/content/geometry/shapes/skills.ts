import type { Skill } from '../../../engine/types';

const area = 'geometry' as const;
const unit = 'Lines, angles & triangles';

export const shapesSkillList: Skill[] = [
  {
    id: 'geo.lines-angles',
    area,
    unit,
    name: 'Lines & angles',
    summary: 'Parallel lines and a transversal, vertical and supplementary angles, angles around a point.',
    strategy: `Write one equation from one angle fact, solve for $x$, then answer what is actually asked.

- Along a straight line the angles add up to $180^\\circ$; all the way around a point, $360^\\circ$. Vertical angles are equal.
- Parallel lines cut by a transversal make only two angle measures: angles in matching positions (corresponding, alternate) are equal, and one of each kind adds up to $180^\\circ$.
- A path bending between two parallel lines: the angle at the bend equals the sum of the two outer angles (draw a third parallel line through the bend).
- Ratio of angles on a line: $r : s = 2 : 7$ splits $180^\\circ$ into 9 parts, but $\\frac{r}{r + s} = \\frac{2}{7}$ means $r$ is $\\frac{2}{7}$ of $180^\\circ$.
- After finding $x$, substitute back if the question asks for an angle.`,
  },
  {
    id: 'geo.triangles',
    area,
    unit,
    name: 'Triangles',
    summary: 'Angle sum, exterior angles, isosceles triangles, the triangle inequality, area with base and height.',
    strategy: `The three angles add up to $180^\\circ$; an exterior angle equals the sum of the two remote interior angles.

- Isosceles: the angles opposite the equal sides are equal (the caption "$AB = BC$" makes angles $A$ and $C$ equal). Equilateral: all angles $60^\\circ$.
- The longest side is opposite the largest angle, and equal angles face equal sides.
- Third side: strictly between the difference and the sum of the other two sides. Equal to either one is a flat, impossible triangle.
- Area $= \\frac{1}{2} \\times \\text{base} \\times \\text{height}$, where the height is perpendicular to the base and may fall outside an obtuse triangle. Never use a slanted side as the height.
- Two triangles with the same height have areas in the ratio of their bases.`,
  },
  {
    id: 'geo.right-triangles',
    area,
    unit,
    name: 'Right triangles',
    summary: 'Pythagorean theorem and triples, 30-60-90 and 45-45-90 triangles, diagonals.',
    strategy: `$a^2 + b^2 = c^2$, with $c$ the side opposite the right angle (the longest side).

- Know the triples and their multiples: 3-4-5, 5-12-13, 8-15-17, 7-24-25 (6-8-10, 9-12-15...).
- 45-45-90: sides $s, s, s\\sqrt{2}$. A square's diagonal is $s\\sqrt{2}$ and its area is $\\frac{d^2}{2}$.
- 30-60-90: sides $s, s\\sqrt{3}, 2s$; the shortest side faces the $30^\\circ$ angle. An equilateral triangle of side $s$ has height $\\frac{s\\sqrt{3}}{2}$.
- A rectangle's diagonal is $\\sqrt{l^2 + w^2}$, always less than $l + w$.
- Legs in a ratio $a : b$: call them $ak$ and $bk$, use the area to find $k$, and the hypotenuse is $k\\sqrt{a^2 + b^2}$.`,
  },
  {
    id: 'geo.similarity',
    area,
    unit,
    name: 'Similar & congruent figures',
    summary: 'Similar triangles from a parallel segment, side ratios, area ratio = square of the side ratio.',
    strategy: `Similar figures have equal angles and proportional sides. Match corresponding vertices before writing a ratio.

- A segment $DE$ parallel to side $BC$ cuts off a triangle $ADE$ similar to $ABC$: $\\frac{AD}{AB} = \\frac{AE}{AC} = \\frac{DE}{BC}$. Compare a part with the WHOLE side, not with the other part.
- Lengths (sides, perimeters, heights) scale by $k$; areas scale by $k^2$ (and volumes by $k^3$).
- Sides up 20%: $k = 1.2$, area $\\times 1.44$, so the area grows by 44%, not 20% or 40%.
- Shadows and overlapping right triangles: set up height/shadow = height/shadow for the two triangles that share an angle.
- Two pairs of proportional sides are not enough for similarity: the angle between them must also match.`,
  },
  {
    id: 'geo.figure-reasoning',
    area,
    unit,
    name: 'Reading figures (not drawn to scale)',
    summary: 'What a GRE figure guarantees and what it does not: when a comparison is forced and when it is D.',
    strategy: `GRE geometry figures are not necessarily drawn to scale. Trust only what is given and what follows from it.

- You MAY assume: lines that look straight are straight, points on a line are in the order shown, and points and regions are on the side shown.
- You may NOT assume: lengths, angle sizes, right angles, parallel lines or midpoints that only look that way.
- Redraw the figure: move the free point or stretch the free angle while keeping every given fact. If the comparison changes, the answer is D.
- Before answering D, look for a forced relation: an exterior angle exceeds each remote interior angle, a side of a triangle is shorter than the sum of the other two, $\\frac{1}{2}ab$ is the largest area for sides $a$ and $b$.
- A right angle is only certain from a square mark, a stated fact, or $a^2 + b^2 = c^2$ for the three sides.`,
  },
];
