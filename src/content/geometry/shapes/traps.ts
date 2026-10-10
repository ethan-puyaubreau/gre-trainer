import type { Trap } from '../../../engine/types';

export const shapesTraps: Record<string, Trap> = {
  /* ---------------------------------------------------------------- lines & angles */
  'geo-par-equal-not-supp': {
    label: 'Set two angles equal when they are supplementary',
    fix: 'Parallel lines make only two angle measures. Angles in matching positions (corresponding, alternate, vertical) are equal; an angle of one kind plus an angle of the other kind is $180^\\circ$.',
  },
  'geo-par-supp-not-equal': {
    label: 'Made two angles add to $180^\\circ$ when they are equal',
    fix: 'Corresponding, alternate interior and alternate exterior angles are equal, not supplementary. Only an angle of each kind (e.g. same-side interior angles) adds up to $180^\\circ$.',
  },
  'geo-par-bend': {
    label: 'Took the angle at the bend as $180^\\circ$ minus the other two',
    fix: 'Draw a line through the bend parallel to the two lines: the bend angle splits into two alternate interior angles, so it equals the SUM of the two outer angles.',
  },
  'geo-ang-wrong-unknown': {
    label: 'Answered a different quantity than the one asked',
    fix: 'After solving for $x$, reread the question: if it asks for an angle (or a length), substitute $x$ back into the expression.',
  },
  'geo-ang-line-360': {
    label: 'Used $360^\\circ$ for angles along a straight line',
    fix: 'Angles that together form a straight line add up to $180^\\circ$. $360^\\circ$ is a full turn around a point.',
  },
  'geo-ang-point-180': {
    label: 'Used $180^\\circ$ for angles all the way around a point',
    fix: 'Angles that fill the whole turn around a point add up to $360^\\circ$; $180^\\circ$ is only for angles along a straight line.',
  },
  'geo-ang-ratio-whole': {
    label: 'Read a part-to-whole ratio as a part-to-part ratio (or the reverse)',
    fix: '$\\frac{r}{r + s} = \\frac{3}{8}$ means $r$ is $\\frac{3}{8}$ of the whole; $r : s = 3 : 8$ means the whole is $3 + 8 = 11$ parts.',
  },
  'geo-ang-vertical-adjacent': {
    label: 'Treated adjacent angles as vertical angles',
    fix: 'Vertical angles are opposite each other at an intersection and are equal. Adjacent angles along a line are supplementary.',
  },

  /* ---------------------------------------------------------------- triangles */
  'geo-tri-sum-360': {
    label: 'Used $360^\\circ$ for the angles of a triangle',
    fix: 'The three angles of a triangle add up to $180^\\circ$ ($360^\\circ$ is the sum for a quadrilateral).',
  },
  'geo-tri-ext-adjacent': {
    label: 'Treated the exterior angle as an angle of the triangle',
    fix: 'An exterior angle is outside the triangle. It equals the sum of the two remote interior angles; it does not join them to make $180^\\circ$.',
  },
  'geo-tri-ext-interior': {
    label: 'Gave the interior angle instead of the exterior angle',
    fix: 'The exterior angle and the interior angle next to it form a straight line: exterior $= 180^\\circ -$ interior.',
  },
  'geo-tri-iso-pair': {
    label: 'Made the wrong pair of angles equal in an isosceles triangle',
    fix: 'The equal angles are the ones OPPOSITE the equal sides. If $AB = BC$, the angles at $A$ and $C$ are equal, not the angle at $B$.',
  },
  'geo-tri-iso-split': {
    label: 'Forgot that the two equal angles share what is left',
    fix: 'After subtracting the known angle from $180^\\circ$, split the rest between the two equal angles (or subtract both equal angles).',
  },
  'geo-tri-iso-invalid': {
    label: 'Kept an isosceles triangle that cannot exist',
    fix: 'Check the triangle inequality for each case: sides $4, 4, 9$ fail because $4 + 4$ is not greater than $9$.',
  },
  'geo-tri-ineq-endpoint': {
    label: 'Allowed the third side to equal the sum or the difference',
    fix: 'The third side must be STRICTLY between the difference and the sum of the other two sides; equal to either one gives a flat figure, not a triangle.',
  },
  'geo-tri-ineq-low': {
    label: 'Forgot the lower bound for the third side',
    fix: 'The third side must also be longer than the difference of the other two, or the two shorter sides cannot meet.',
  },
  'geo-tri-ineq-high': {
    label: 'Forgot the upper bound for the third side',
    fix: 'The third side must be shorter than the sum of the other two sides.',
  },
  'geo-tri-ineq-forgot': {
    label: 'Answered D because no lengths are given',
    fix: 'The triangle inequality holds for every triangle: each side is shorter than the sum of the other two. That alone can decide the comparison.',
  },
  'geo-tri-ineq-assumed-longest': {
    label: 'Assumed $z$ is the longest side',
    fix: 'Nothing says which side is longest. Try a case where $z$ is the longest side and a case where it is the shortest.',
  },
  'geo-tri-side-adjacent': {
    label: 'Matched a side with an angle at its end instead of the opposite angle',
    fix: 'The longest side is OPPOSITE the largest angle: side $QR$ faces the angle at $P$.',
  },
  'geo-tri-coord-abs': {
    label: 'Compared distances instead of signed coordinates',
    fix: 'Find which coordinate is larger in absolute value, then apply the signs: for two negative numbers, the one farther from 0 is the smaller.',
  },
  'geo-tri-slant-height': {
    label: 'Used a slanted side as the height',
    fix: 'The height must be perpendicular to the base. For an obtuse triangle it can fall outside the triangle, on the extension of the base.',
  },
  'geo-tri-extended-base': {
    label: 'Included the extension in the base',
    fix: 'The base is only the side of the triangle. The extension is drawn just to show where the height lands.',
  },
  'geo-tri-no-half': {
    label: 'Forgot the $\\frac{1}{2}$ in the triangle area',
    fix: 'Area of a triangle $= \\frac{1}{2} \\times \\text{base} \\times \\text{height}$; base times height is a rectangle.',
  },
  'geo-tri-hyp-midpoint': {
    label: 'Took the altitude to the hypotenuse as half the hypotenuse',
    fix: 'Write the area two ways: $\\frac{1}{2}(\\text{leg})(\\text{leg}) = \\frac{1}{2}(\\text{hypotenuse})(\\text{altitude})$.',
  },
  'geo-tri-same-area': {
    label: 'Assumed triangles with the same height have the same area',
    fix: 'With equal heights, the areas are in the ratio of the bases.',
  },
  'geo-tri-ratio-flip': {
    label: 'Flipped the ratio of the bases',
    fix: 'The triangle with the longer base has the larger area: area $\\propto$ base when the heights are equal.',
  },
  'geo-tri-wrong-side': {
    label: 'Ignored which side of the axis the point must be on',
    fix: 'A point "above the $x$-axis" has a positive $y$-coordinate; the same height below the axis is not allowed.',
  },
  'geo-tri-height-double': {
    label: 'Used half of the base',
    fix: 'The base is the whole segment between the two given vertices. From $\\frac{1}{2} b h = K$, the height is $h = \\frac{2K}{b}$.',
  },
  'geo-fig-looks-equal': {
    label: 'Assumed lengths or angles that look equal are equal',
    fix: 'GRE figures are not necessarily drawn to scale. Use only the given facts; if they do not force equality, test other shapes.',
  },

  /* ---------------------------------------------------------------- right triangles */
  'geo-rt-add-legs': {
    label: 'Added or subtracted the side lengths instead of their squares',
    fix: 'The Pythagorean theorem works with squares: $c = \\sqrt{a^2 + b^2}$, which is less than $a + b$. A square\'s diagonal is $s\\sqrt{2}$, not $2s$.',
  },
  'geo-rt-root-split': {
    label: '$\\sqrt{a^2 + b^2} = a + b$ or $\\sqrt{a} + \\sqrt{b}$',
    fix: 'Add the squares first, then take one square root of the total.',
  },
  'geo-rt-leg-as-hyp': {
    label: 'Treated a leg as the hypotenuse (added squares instead of subtracting)',
    fix: 'The hypotenuse is opposite the right angle and is the longest side. For a missing leg: $b^2 = c^2 - a^2$.',
  },
  'geo-rt-306090-swap': {
    label: 'Mixed up the $\\sqrt{3}$ and the $2$ in a 30-60-90 triangle',
    fix: 'Sides $x : x\\sqrt{3} : 2x$. The side opposite $30^\\circ$ is the shortest, the hypotenuse is twice it, and the side opposite $60^\\circ$ is $\\sqrt{3}$ times it.',
  },
  'geo-rt-wrong-special': {
    label: 'Used the wrong special-triangle ratio',
    fix: '$45^\\circ$-$45^\\circ$-$90^\\circ$: $1 : 1 : \\sqrt{2}$. $30^\\circ$-$60^\\circ$-$90^\\circ$: $1 : \\sqrt{3} : 2$. Check the angles before choosing the ratio.',
  },
  'geo-rt-ratio-inverse': {
    label: 'Multiplied by the ratio when you should divide (or the reverse)',
    fix: 'Going from a shorter side to a longer one, multiply ($s \\to s\\sqrt{2}$); going from the longer side back, divide ($d \\to \\frac{d}{\\sqrt{2}}$). Sanity check: the hypotenuse is the longest side.',
  },
  'geo-rt-diag-area': {
    label: 'Took the square of the diagonal as the area',
    fix: 'A square with diagonal $d$ has side $\\frac{d}{\\sqrt{2}}$, so its area is $\\frac{d^2}{2}$.',
  },
  'geo-rt-equi-half': {
    label: 'Forgot to halve the side in an equilateral triangle',
    fix: 'The altitude cuts the base in half: the right triangle has legs $\\frac{s}{2}$ and $\\frac{s\\sqrt{3}}{2}$ and hypotenuse $s$.',
  },
  'geo-rt-equal-area-sides': {
    label: 'Thought equal areas mean equal side lengths',
    fix: 'Write each length from its area formula: an isosceles right triangle with area $R$ has legs $\\sqrt{2R}$, a square with area $R$ has sides $\\sqrt{R}$.',
  },
  'geo-rt-diag-as-side': {
    label: 'Used the diagonal as a side',
    fix: 'Find the missing side with the Pythagorean theorem first; area is side times side.',
  },
  'geo-rt-assumed-dims': {
    label: 'Assumed particular dimensions for the rectangle',
    fix: 'Only the perimeter is fixed. Test a square and a long thin rectangle: the diagonal ranges from $\\frac{l + w}{\\sqrt{2}}$ up to (but not reaching) $l + w$.',
  },
  'geo-rt-range-missed': {
    label: 'Answered D without checking the whole range',
    fix: 'Find the smallest and largest possible values. If the number in the other column is outside that range, the comparison is determined.',
  },
  'geo-rt-forgot-hyp': {
    label: 'Left out the hypotenuse',
    fix: 'The perimeter of a right triangle includes the hypotenuse; get it from the Pythagorean theorem.',
  },
  'geo-rt-used-area': {
    label: 'Used the area instead of the perimeter',
    fix: 'Material along the sides is a length: use the perimeter.',
  },
  'geo-rt-ratio-no-k': {
    label: 'Used the ratio numbers as the actual lengths',
    fix: 'A ratio $a : b$ means legs $ak$ and $bk$. Use the area to find $k$ before computing the hypotenuse.',
  },
  'geo-rt-wrong-triangle': {
    label: 'Used a side from the wrong triangle',
    fix: 'Each Pythagorean step must use the three sides of ONE right triangle. Find the shared side first.',
  },

  /* ---------------------------------------------------------------- similarity */
  'geo-sim-part-whole': {
    label: 'Compared a part of a side with the other part instead of the whole side',
    fix: 'In triangle $ADE$ vs triangle $ABC$, the matching sides are $AD$ and $AB$ (the whole side): $\\frac{AD}{AB} = \\frac{DE}{BC}$, not $\\frac{AD}{DB}$.',
  },
  'geo-sim-whole-not-part': {
    label: 'Found the whole instead of the part asked for',
    fix: 'The proportion gives the whole side (or the whole area); subtract the known part if the question asks for the rest.',
  },
  'geo-sim-additive': {
    label: 'Added a constant instead of multiplying by the scale factor',
    fix: 'Similar figures scale by a common FACTOR: every length is multiplied by the same number, not increased by the same amount.',
  },
  'geo-sim-midpoint': {
    label: 'Assumed the parallel segment is half the base',
    fix: '$DE = \\frac{1}{2}BC$ only when $D$ is the midpoint of $AB$. Use the actual ratio $\\frac{AD}{AB}$.',
  },
  'geo-sim-inverted': {
    label: 'Set up the proportion upside down',
    fix: 'Write both ratios in the same order, e.g. $\\frac{\\text{height}}{\\text{shadow}} = \\frac{\\text{height}}{\\text{shadow}}$, and check that the bigger object gets the bigger answer.',
  },
  'geo-sim-linear-area': {
    label: 'Scaled the area by the side ratio instead of its square',
    fix: 'If lengths are multiplied by $k$, areas are multiplied by $k^2$: doubling the sides makes the area 4 times as large.',
  },
  'geo-sim-perimeter-squared': {
    label: 'Squared the scale factor for a length',
    fix: 'Perimeters, heights and sides are lengths: they scale by $k$. Only areas scale by $k^2$.',
  },
  'geo-sim-cubed': {
    label: 'Cubed the ratio for an area',
    fix: 'Cubing is for volumes of similar solids. For areas, square the ratio.',
  },
  'geo-sim-double-percent': {
    label: 'Doubled the percent instead of squaring the factor',
    fix: 'Sides up 20% means a factor of 1.2; the area factor is $1.2^2 = 1.44$, a 44% increase, not 40%.',
  },
  'geo-sim-ratio-not-change': {
    label: 'Gave the new area as a percent of the old one',
    fix: '"How many percent greater" asks for the change: subtract 100% from the ratio (144% of the old area is 44% greater).',
  },
  'geo-sim-square-percent': {
    label: 'Squared the percent itself',
    fix: 'Square the scale factor $(1 + p)$, not the percent $p$.',
  },
  'geo-sim-ss-not-similar': {
    label: 'Assumed two pairs of proportional sides make the triangles similar',
    fix: 'Similarity needs the included angles to be equal too (SAS), or all three pairs of sides proportional (SSS). Otherwise the angle between the sides can change the area.',
  },
  'geo-sim-missed-similar': {
    label: 'Did not recognize that the triangles are similar',
    fix: 'Two sides in the same ratio with equal included angles (SAS), or three sides in the same ratio (SSS), make triangles similar.',
  },
  'geo-sim-correspondence': {
    label: 'Matched the wrong corresponding angles',
    fix: 'Match the vertices in order: $D$ on $AB$ corresponds to $B$, and $E$ on $AC$ corresponds to $C$.',
  },

  /* ---------------------------------------------------------------- reading figures */
  'geo-fig-looks-right': {
    label: 'Assumed an angle that looks like $90^\\circ$ is a right angle',
    fix: 'A right angle is certain only from a square mark, a stated fact, or $a^2 + b^2 = c^2$ for the three sides. Otherwise redraw the angle a little larger or smaller.',
  },
  'geo-fig-looks-parallel': {
    label: 'Assumed lines that look parallel are parallel',
    fix: 'Use parallel-line angle facts only when the lines are stated (or proved) to be parallel. Tilt one line slightly and see whether the comparison changes.',
  },
  'geo-fig-gave-up': {
    label: 'Answered D although the given facts force the comparison',
    fix: 'Before choosing D, look for a relation that holds in every allowed drawing: equal sides force equal angles, an altitude of an isosceles triangle bisects the base, angles on a line add to $180^\\circ$.',
  },
  'geo-fig-triple-assumed': {
    label: 'Saw a Pythagorean triple and assumed a right angle',
    fix: 'The sides form the triple only for one value of the variable. Try another allowed value: if $a^2 + b^2 \\ne c^2$, the angle is not $90^\\circ$.',
  },
};
