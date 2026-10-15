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
  'geo-par-complementary': {
    label: 'Made two angles of parallel lines add up to $90^\\circ$',
    fix: 'Nothing here makes a right angle. Angles in matching positions are equal; an angle of each kind adds up to $180^\\circ$.',
  },
  'geo-par-sums-assumed': {
    label: 'Assumed two sums of angles are equal',
    fix: 'Replace every angle by its measure, $\\theta$ or $180^\\circ - \\theta$, and compare the two sums. They are equal only when both sides hold the same kinds of angles.',
  },
  'geo-ang-supplement': {
    label: 'Gave the supplement of the angle instead of the angle itself',
    fix: 'After solving for $x$, substitute it into the expression for the angle that was asked about. The angle next to it on a line is a different angle.',
  },
  'geo-ang-sign-slip': {
    label: 'Made a sign error when solving the equation',
    fix: 'Subtract the same number from both sides: $c_1x + k_1 = c_2x + k_2$ gives $(c_1 - c_2)x = k_2 - k_1$. Substitute back to check.',
  },
  'geo-ang-wrong-coefficient': {
    label: 'Divided by the wrong coefficient of $x$',
    fix: 'Collect the $x$ terms first: $c_1x + c_2x = (c_1 + c_2)x$, or $c_2x - c_1x = (c_2 - c_1)x$. Then divide by that total, not by one coefficient.',
  },
  'geo-ang-dropped-constant': {
    label: 'Left one of the constants out of the equation',
    fix: 'Both labels have their constants: move every number to the right side, subtract each one, then divide.',
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
  'geo-tri-drop-constant': {
    label: 'Left the constants out when adding the angle expressions',
    fix: 'Each angle is the whole expression, constant included. Add the $x$ terms and the plain numbers separately, then solve.',
  },
  'geo-tri-const-sign': {
    label: 'Added a constant to the $180^\\circ$ instead of subtracting it',
    fix: 'From $Cx + K = 180$, subtract $K$ from both sides: $Cx = 180 - K$.',
  },
  'geo-tri-sum-90': {
    label: 'Used $90^\\circ$ for the angles of a triangle',
    fix: 'The three angles of a triangle add up to $180^\\circ$; $90^\\circ$ is the sum of the two acute angles of a RIGHT triangle.',
  },
  'geo-tri-mis-added': {
    label: 'Added the $x$ terms wrongly (one too many or too few)',
    fix: 'Count the coefficients of $x$ in all three expressions and add them: the equation is $Cx + K = 180$ with $C$ the sum of the three coefficients.',
  },
  'geo-tri-wrong-angle': {
    label: 'Gave a different angle of the triangle than the one asked',
    fix: 'Find all three angles first, then read off the one the question asks for (largest, smallest, at a given vertex).',
  },
  'geo-tri-diff-pair': {
    label: 'Subtracted the wrong pair of angles',
    fix: 'The difference asked for is between the LARGEST and the SMALLEST angle. List the three angles, then pick those two.',
  },
  'geo-tri-iso-three': {
    label: 'Shared the rest between three angles instead of two',
    fix: 'An isosceles triangle has TWO equal angles. After subtracting the given angle from $180^\\circ$, split what is left in two.',
  },
  'geo-tri-iso-half': {
    label: 'Halved the given angle instead of sharing what is left',
    fix: 'The equal angles share $180^\\circ$ minus the other angle. Half of the given angle has no role in an isosceles triangle.',
  },
  'geo-tri-ext-add': {
    label: 'Added the known remote angle to the exterior angle',
    fix: 'The exterior angle EQUALS the sum of the two remote interior angles, so the unknown one is the exterior angle MINUS the known one.',
  },
  'geo-tri-ext-forgot': {
    label: 'Used only one of the two remote angles',
    fix: 'The exterior angle equals the SUM of both remote interior angles: exterior $=$ known angle $+$ unknown angle.',
  },
  'geo-tri-ext-twice': {
    label: 'Subtracted the known angle twice',
    fix: 'Subtract the known remote angle once from the exterior angle to get the other remote angle.',
  },
  'geo-tri-ext-half': {
    label: 'Halved the exterior angle as if the remote angles were equal',
    fix: 'Nothing says the two remote angles are equal. Subtract the known one from the exterior angle.',
  },
  'geo-tri-ext-supp': {
    label: 'Used the interior angle next to the exterior angle',
    fix: 'The angle next to the exterior angle is a different angle of the triangle. The exterior angle equals the two REMOTE angles, not the one beside it.',
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
  'geo-tri-equilateral-assumed': {
    label: 'Assumed all three sides are equal',
    fix: 'Isosceles means only two equal sides. The third side is either of the two given lengths, so the perimeter is $2a + b$ or $a + 2b$, not three equal sides.',
  },
  'geo-tri-forgot-third': {
    label: 'Left the third side out of the perimeter',
    fix: 'The perimeter adds all three sides. Here the third side repeats one of the two given lengths.',
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
  'geo-tri-swapped-coords': {
    label: 'Swapped the $x$- and $y$-coordinates',
    fix: 'The height of the triangle is the $y$-coordinate of $C$ (its distance from the $x$-axis). The $x$-coordinate only slides $C$ along a line parallel to the base.',
  },
  'geo-tri-height-is-area': {
    label: 'Used the area as the height',
    fix: 'From $\\frac{1}{2}(\\text{base})(\\text{height}) = K$ the height is $\\frac{2K}{\\text{base}}$, not $K$.',
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
  'geo-rt-left-out-leg': {
    label: 'Left a leg out of the perimeter of the triangle',
    fix: 'The strip goes along ALL three sides: both legs and the hypotenuse.',
  },
  'geo-rt-sides-twice': {
    label: 'Counted the sides twice',
    fix: 'Each side of the triangle is outlined once: the perimeter is leg + leg + hypotenuse.',
  },
  'geo-rt-no-sqrt': {
    label: 'Gave the square of the hypotenuse',
    fix: 'The Pythagorean sum gives the SQUARE of the hypotenuse. Take the square root to get its length.',
  },
  'geo-rt-half-twice': {
    label: 'Took a quarter of the product of the legs as the area',
    fix: 'The area of a right triangle is ONE half of the product of the legs: $\\frac{1}{2}(ak)(bk) = K$.',
  },
  'geo-rt-counted-twice': {
    label: 'Counted one of the lengths twice',
    fix: 'Each Pythagorean step uses each square once. List the squares you add and check that each length appears only once.',
  },
  'geo-rt-hyp-only': {
    label: 'Used only the hypotenuse as the length of strip per triangle',
    fix: 'The strip goes along ALL three sides, so each triangle uses its perimeter: leg + leg + hypotenuse.',
  },
  'geo-rt-rectangle-perimeter': {
    label: 'Used the perimeter formula of a rectangle for the triangle',
    fix: 'A triangle has three sides, not four. Its perimeter is the two legs plus the hypotenuse, not $2(\\ell + w)$.',
  },
  'geo-rt-gave-area': {
    label: 'Gave the area instead of the hypotenuse',
    fix: 'The area is only a clue that fixes the scale $k$. The question asks for the hypotenuse, which comes from the Pythagorean theorem.',
  },
  'geo-rt-stopped-early': {
    label: 'Stopped after the first step',
    fix: 'The first triangle only gives the shared side. Use it as a leg of the second triangle and apply the Pythagorean theorem again.',
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
  'geo-sim-squared-twice': {
    label: 'Squared the ratio twice',
    fix: 'Areas go with the square of the ratio of lengths once: $\\left(\\frac{a}{b}\\right)^2$, not the fourth power.',
  },
  'geo-sim-one-side-squared': {
    label: 'Squared only one term of the ratio',
    fix: 'To square a ratio, square BOTH terms: $\\left(\\frac{a}{b}\\right)^2 = \\frac{a^2}{b^2}$.',
  },
  'geo-sim-averaged-percent': {
    label: 'Averaged the change of the sides and the change of the area',
    fix: 'The changes are not averaged: the new area (or volume) is the old one times the scale factor squared (or cubed).',
  },
  'geo-sim-triple-percent': {
    label: 'Tripled the percent for a volume',
    fix: 'Three dimensions multiply: the factor is $(1 + \\frac{p}{100})^3$, not $1 + \\frac{3p}{100}$.',
  },
  'geo-sim-squared-for-volume': {
    label: 'Used the square of the scale factor for a volume',
    fix: 'A volume scales with the CUBE of the scale factor. The square is for areas.',
  },
  'geo-sim-wrong-length': {
    label: 'Gave a length from the figure instead of the one asked',
    fix: 'The proportion gives the unknown length. Do not stop at a number that is already in the figure; solve the proportion and answer what is asked.',
  },
  'geo-sim-no-divide': {
    label: 'Multiplied the lengths without dividing by the matching length',
    fix: 'Similar triangles give a proportion: $\\frac{h}{s_2} = \\frac{h_1}{s_1}$. Multiply across the proportion and then divide by the remaining length.',
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
