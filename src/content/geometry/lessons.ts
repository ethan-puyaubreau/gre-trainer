import type { Lesson } from '../lessons';

export const geometryLessons: Record<string, Lesson> = {
  'geo.lines-angles': {
    idea: `Every angle problem turns into one equation. Pick the fact that links the angles (a straight line is $180^\\circ$, a full turn is $360^\\circ$, vertical angles are equal), solve for $x$, then answer what was asked.`,
    recognize: `Think angles when you see a transversal across parallel lines, angles written as expressions in $x$, or an angle ratio. Parallel lines make only two measures: matching positions are equal, mixed positions add up to $180^\\circ$. A path that bends between two parallel lines makes a bend angle equal to the SUM of the two outer angles.`,
    example: {
      problem: `Two parallel lines are cut by a transversal. At the first line an acute angle measures $3x^\\circ$; at the second line an obtuse angle measures $(x + 100)^\\circ$. Find the obtuse angle.`,
      steps: [
        `Write $3x + (x + 100) = 180$, because an acute angle and an obtuse angle made by parallel lines are supplementary.`,
        `Solve: $4x + 100 = 180$ gives $4x = 80$, so $x = 20$.`,
        `The obtuse angle is $x + 100 = 120$, because the question asks for the angle, not for $x$.`,
      ],
      answer: `$120^\\circ$ (check: $60 + 120 = 180$)`,
    },
    traps: ['geo-par-equal-not-supp', 'geo-par-bend', 'geo-ang-wrong-unknown'],
  },
  'geo.triangles': {
    idea: `The three angles of a triangle add up to $180^\\circ$, and an exterior angle equals the sum of the two remote interior angles. In an isosceles triangle the equal angles sit opposite the equal sides.`,
    recognize: `If you see a caption that gives equal sides, think: equal angles opposite them. If you see a missing angle, think: the three angles add up to $180^\\circ$. If you see an area, think: a height perpendicular to the base, never a slanted side. A missing third side lies strictly between the difference and the sum of the other two.`,
    example: {
      problem: `In triangle $ABC$, $AB = BC$ and the angle at $B$ measures $40^\\circ$. Find angle $A$.`,
      steps: [
        `Angles $A$ and $C$ are equal, because they are opposite the equal sides $BC$ and $AB$.`,
        `$A + C = 180^\\circ - 40^\\circ = 140^\\circ$, because the three angles of a triangle add up to $180^\\circ$.`,
        `$A = 140^\\circ \\div 2 = 70^\\circ$, because the two equal angles share the $140^\\circ$ evenly.`,
      ],
      answer: `$70^\\circ$`,
    },
    traps: ['geo-tri-iso-pair', 'geo-tri-ineq-endpoint', 'geo-tri-slant-height'],
  },
  'geo.right-triangles': {
    idea: `In a right triangle $a^2 + b^2 = c^2$, where $c$ is the hypotenuse, opposite the right angle. Learn the triples (3-4-5, 5-12-13, 8-15-17) and their multiples, plus the special triangles 45-45-90 and 30-60-90.`,
    recognize: `If you see a right-angle mark, a rectangle, a square or a diagonal and two known lengths, think Pythagoras. If you see angles of $45^\\circ$, or $30^\\circ$ and $60^\\circ$, think special triangles: sides $s : s : s\\sqrt{2}$, or $s : s\\sqrt{3} : 2s$ with the shortest side facing the $30^\\circ$ angle.`,
    example: {
      problem: `A rectangle is $15$ wide and $20$ long. What is the length of its diagonal?`,
      steps: [
        `The diagonal is the hypotenuse of a right triangle with legs $15$ and $20$, because every corner of a rectangle is a right angle.`,
        `$15 = 5 \\cdot 3$ and $20 = 5 \\cdot 4$, so this is the 3-4-5 triangle scaled by $5$, because both legs share the factor $5$.`,
        `The hypotenuse is $5 \\cdot 5 = 25$, because the 3-4-5 triangle has hypotenuse $5$. Check: $15^2 + 20^2 = 225 + 400 = 625 = 25^2$.`,
      ],
      answer: `$25$`,
    },
    traps: ['geo-rt-add-legs', 'geo-rt-leg-as-hyp', 'geo-rt-306090-swap'],
  },
  'geo.similarity': {
    idea: `Similar figures have equal angles and proportional sides. Lengths scale by $k$, areas by $k^2$ and volumes by $k^3$. Match corresponding vertices before writing any ratio.`,
    recognize: `Think similar triangles when a segment is parallel to a side, when two right triangles share an angle (shadows, ladders), or when a question asks how an area changes after the sides do.`,
    example: {
      problem: `In triangle $ABC$, point $D$ is on $AB$ and point $E$ is on $AC$, with $DE$ parallel to $BC$. If $AD = 4$, $AB = 10$ and $BC = 20$, find $DE$.`,
      steps: [
        `Triangle $ADE$ is similar to triangle $ABC$ (with $A \\to A$, $D \\to B$, $E \\to C$), because a segment parallel to $BC$ makes equal corresponding angles.`,
        `$\\frac{DE}{BC} = \\frac{AD}{AB} = \\frac{4}{10}$, because corresponding sides are proportional and the part $AD$ is compared with the whole side $AB$, not with $DB$.`,
        `$DE = 20 \\cdot \\frac{4}{10} = 8$, because $DE$ is $\\frac{4}{10}$ of $BC$.`,
      ],
      answer: `$8$`,
    },
    traps: ['geo-sim-part-whole', 'geo-sim-linear-area', 'geo-sim-inverted'],
  },
  'geo.figure-reasoning': {
    idea: `GRE figures are not necessarily drawn to scale. You may assume only that straight-looking lines are straight and that points lie in the order shown. Redraw the figure with a free angle or length changed: if the comparison changes, the answer is D; if every redraw keeps it, it is forced.`,
    recognize: `If you see angles or lengths that only look special (a right angle without a right-angle mark, equal-looking sides, parallel-looking lines), think: not given, so redraw.`,
    example: {
      problem: `In triangle $PQR$, $PQ = 6$ and $PR = 8$. The angle at $P$ looks like a right angle but has no right-angle mark. Quantity A is $QR$; Quantity B is $10$.`,
      steps: [
        `Only the two side lengths are given, because an angle that merely looks right is not a given.`,
        `Redraw with $P$ exactly $90^\\circ$: $QR = \\sqrt{36 + 64} = 10$, so the quantities are equal, because $6^2 + 8^2 = 10^2$.`,
        `Close the angle a little and $QR < 10$; open it wider and $QR > 10$, because with the two sides fixed, the opposite side grows with the angle.`,
        `So the answer is D, because the comparison changes between allowed drawings.`,
      ],
      answer: `D: the relationship cannot be determined.`,
    },
    traps: ['geo-fig-looks-right', 'geo-fig-looks-equal', 'geo-fig-gave-up'],
  },
  'geo.polygons': {
    idea: `A polygon with $n$ sides has interior angles adding up to $(n - 2) \\cdot 180^\\circ$. Areas use a height perpendicular to the base: parallelogram $bh$, trapezoid $\\frac{1}{2}(b_1 + b_2)h$.`,
    recognize: `If you see a dashed perpendicular height or two parallel sides, think: area. If you see a regular polygon, think: the angle sum divided by $n$. If a question compares area and perimeter, think: for a fixed perimeter the square has the largest area.`,
    example: {
      problem: `A trapezoid has parallel sides of $6$ and $10$, a height of $4$ (the dashed perpendicular) and a slanted leg of $5$. Find its area.`,
      steps: [
        `Use $\\frac{1}{2}(b_1 + b_2)h$, because a trapezoid has the area of a rectangle whose width is the average of the parallel sides.`,
        `The height is the dashed $4$, not the slanted leg $5$, because the height must be perpendicular to the bases.`,
        `Area $= \\frac{1}{2}(6 + 10)(4) = 8 \\cdot 4 = 32$, because the average of the bases is $8$.`,
      ],
      answer: `$32$`,
    },
    traps: ['geom-poly-sum-n180', 'geom-quad-slanted-height', 'geom-quad-trapezoid-no-half'],
  },
  'geo.circles': {
    idea: `Find the radius first: $C = 2\\pi r$ and $A = \\pi r^2$. An arc or a sector is the fraction $\\frac{\\theta}{360}$ of the whole circle, where $\\theta$ is the central angle.`,
    recognize: `Think circles when a diameter, an arc, a sector, a tangent or a chord appears. A tangent, or the perpendicular from the center to a chord, makes a right triangle; an inscribed angle is half its central angle.`,
    example: {
      problem: `A circle has diameter $12$. A sector of this circle has a central angle of $60^\\circ$. What is the area of the sector?`,
      steps: [
        `$r = 12 \\div 2 = 6$, because the radius is half the diameter.`,
        `The whole circle has area $\\pi r^2 = 36\\pi$, because $A = \\pi r^2$.`,
        `The sector is $\\frac{60}{360} = \\frac{1}{6}$ of the circle, so its area is $\\frac{1}{6} \\cdot 36\\pi = 6\\pi$, because the central angle sets the fraction of the full $360^\\circ$.`,
      ],
      answer: `$6\\pi$`,
    },
    traps: ['geom-circle-radius-diameter', 'geom-circle-inscribed-as-central', 'geom-circle-no-right-triangle'],
  },
  'geo.composite': {
    idea: `Shaded area = whole figure minus the unshaded parts. Write each piece as a formula before computing, and read how the shapes touch: an inscribed circle's diameter equals the side of its square.`,
    recognize: `Think subtraction when a shaded region is what is left inside a square, a rectangle or a circle, or when a circle touches the sides. A perimeter counts only the outer boundary.`,
    example: {
      problem: `A circle is inscribed in a square of side $8$ (it touches all four sides). Find the area of the shaded region inside the square but outside the circle.`,
      steps: [
        `The square has area $8^2 = 64$, because it is the whole figure.`,
        `The circle's diameter is $8$, so $r = 4$ and its area is $16\\pi$, because an inscribed circle's diameter equals the side of the square.`,
        `Shaded $= 64 - 16\\pi \\approx 13.73$, because shaded = whole $-$ unshaded; rounding $\\pi$ to $3$ would give $16$, too far off in a close comparison.`,
      ],
      answer: `$64 - 16\\pi$, about $13.73$`,
    },
    traps: ['geom-shaded-wrong-region', 'geom-circle-radius-diameter', 'geom-shaded-pi-as-3'],
  },
  'geo.solids': {
    idea: `Use the volume formulas (box $\\ell w h$, cylinder $\\pi r^2 h$) and remember scaling: lengths $\\times k$ means areas $\\times k^2$ and volumes $\\times k^3$. In a cylinder the radius counts twice.`,
    recognize: `If you see a container poured into another, think: the volume of liquid stays the same. If you see surface area, think: the total area of the faces, $2(\\ell w + \\ell h + wh)$ for a box, in square units and never the volume. If you see packing with smaller cubes, think: count how many fit along each edge (round down), then multiply; dividing the volumes counts leftover slivers.`,
    example: {
      problem: `A cylinder has radius $3$ and height $10$. Its radius is doubled and its height stays the same. What is the new volume?`,
      steps: [
        `The original volume is $\\pi \\cdot 3^2 \\cdot 10 = 90\\pi$, because $V = \\pi r^2 h$.`,
        `The new radius is $6$, so $V = \\pi \\cdot 6^2 \\cdot 10 = 360\\pi$, because the height is unchanged.`,
        `That is $4$ times the original, because the radius is squared, so doubling it multiplies the volume by $2^2 = 4$, not by $2$.`,
      ],
      answer: `$360\\pi$, which is $4$ times the original volume`,
    },
    traps: ['geom-solid-scale-linear', 'geom-solid-volume-for-surface', 'geom-solid-pack-by-volume'],
  },
};
