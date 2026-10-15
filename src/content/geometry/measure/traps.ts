import type { Trap } from '../../../engine/types';

export const measureTraps: Record<string, Trap> = {
  /* ------------------------------------------------------------ polygons */
  'geom-poly-sum-n180': {
    label: 'Interior angle sum $= n \\cdot 180^\\circ$',
    fix: 'A polygon with $n$ sides splits into $n - 2$ triangles from one vertex, so its angles add up to $(n - 2) \\cdot 180^\\circ$: $360^\\circ$, $540^\\circ$, $720^\\circ$ for 4, 5, 6 sides.',
  },
  'geom-poly-sum-360': {
    label: 'Used $360^\\circ$ for every polygon',
    fix: 'Only a quadrilateral has an angle sum of $360^\\circ$. Use $(n - 2) \\cdot 180^\\circ$: a pentagon has $540^\\circ$, a hexagon $720^\\circ$. (It is the EXTERIOR angles that always add up to $360^\\circ$.)',
  },
  'geom-poly-answered-other': {
    label: 'Answered a different quantity than the one asked',
    fix: 'After solving, reread the question: substitute $x$ into the angle it asks for, and give one angle (not the sum, not the number of sides) when one angle is asked.',
  },
  'geom-poly-exterior-angle': {
    label: 'Gave the exterior angle $\\frac{360}{n}$',
    fix: '$\\frac{360^\\circ}{n}$ is each EXTERIOR angle of a regular $n$-gon. The interior angle is $180^\\circ - \\frac{360^\\circ}{n}$.',
  },
  'geom-poly-diagonal-bisects': {
    label: 'Assumed the diagonal bisects the angle',
    fix: 'A diagonal from vertex $A$ to the next-but-one vertex cuts off an isosceles triangle: its base angles are $\\frac{180^\\circ - \\text{interior angle}}{2}$, not half the interior angle.',
  },
  'geom-poly-compared-perimeters': {
    label: 'Compared the perimeters instead of the sides',
    fix: 'The side of a regular polygon is its perimeter divided by its number of sides. Divide first, then compare.',
  },
  'geom-rect-percent-of-perimeter': {
    label: 'Took the percent of the perimeter',
    fix: '"The width is $p$ percent of the length" means $w = \\frac{p}{100}\\ell$. Substitute it into $2(\\ell + w) = P$.',
  },
  'geom-rect-semiperimeter': {
    label: 'Set length + width equal to the whole perimeter',
    fix: 'The perimeter is $2(\\ell + w)$, so $\\ell + w$ is HALF the perimeter.',
  },
  'geom-rect-assumed-square': {
    label: 'Treated the rectangle as a square',
    fix: 'Nothing says the sides are equal. Use the given conditions (perimeter, area, ratio) to find each side.',
  },
  'geom-rect-half-perimeter': {
    label: 'Added only one length and one width',
    fix: 'A rectangle has two lengths and two widths: perimeter $= 2(\\ell + w)$.',
  },
  'geom-rect-coordinate-sign': {
    label: 'Subtracted coordinates of opposite signs incorrectly',
    fix: 'The distance from $x = -3$ to $x = 5$ is $5 - (-3) = 8$, not $5 - 3$. Subtracting a negative coordinate adds its size.',
  },
  'geom-rect-area-for-perimeter': {
    label: 'Mixed up area and perimeter',
    fix: 'Perimeter is the distance around ($2\\ell + 2w$); area is the space inside ($\\ell w$). Check which one the question asks for.',
  },
  'geom-rect-added-sides': {
    label: 'Added the sides to get the diagonal',
    fix: 'The diagonal is the hypotenuse of a right triangle with the sides as legs: $\\sqrt{\\ell^2 + w^2}$, always less than $\\ell + w$.',
  },
  'geom-rect-square-of-sum': {
    label: 'Added $2\\ell w$ instead of subtracting it',
    fix: '$\\ell^2 + w^2 = (\\ell + w)^2 - 2\\ell w$.',
  },
  'geom-rect-factor-only': {
    label: 'Picked a factor of the area without checking the fence',
    fix: 'A side length must satisfy BOTH conditions: the area and the total length of fencing. Test each candidate pair in the fence equation.',
  },
  'geom-rect-ignored-wall': {
    label: 'Ignored the condition about the side along the wall',
    fix: 'Both pairs of lengths satisfy the fencing and the area, but the stem adds a condition (the side along the wall is longer). Keep only the pair that respects it.',
  },
  'geom-poly-triangle-count': {
    label: 'Counted the wrong number of triangles',
    fix: 'From one vertex, the diagonals split an $n$-gon into $n - 2$ triangles, each with an angle sum of $180^\\circ$.',
  },
  'geom-poly-side-count': {
    label: 'Miscounted the sides of the polygon',
    fix: 'Count the vertices of the figure one by one. A polygon with $n$ sides has $n$ vertices, and the angle formulas depend on that exact $n$.',
  },
  'geom-rect-subtracted-sides': {
    label: 'Subtracted the width from the length instead of adding it',
    fix: 'Half the perimeter is length PLUS width: $\\ell + w = \\frac{P}{2}$.',
  },
  'geom-rect-three-sides': {
    label: 'Perimeter of a rectangle $= 2\\ell + w$',
    fix: 'All four sides count: $2\\ell + 2w$.',
  },
  'geom-rect-same-perimeter': {
    label: 'Assumed equal perimeters (or areas) give equal areas (or perimeters)',
    fix: 'Shapes with the same perimeter can have different areas: for a given perimeter the square has the largest area, and for a given area the square has the smallest perimeter.',
  },
  'geom-meas-fraction-inverted': {
    label: 'Inverted the fraction',
    fix: '"X is what fraction of Y" means $\\frac{X}{Y}$: the quantity after "of" goes in the denominator.',
  },
  'geom-quad-center-as-side': {
    label: 'Used the vertex-to-center distance as a side',
    fix: 'The diagonals of a square bisect each other: the distance from a vertex to the center is HALF a diagonal. Find the opposite vertex (or the full diagonal $d$) first; area $= \\frac{d^2}{2}$.',
  },
  'geom-quad-diagonal-as-side': {
    label: 'Used the diagonal as a side',
    fix: 'A square with diagonal $d$ has side $\\frac{d}{\\sqrt{2}}$ and area $\\frac{d^2}{2}$, not $d^2$.',
  },
  'geom-quad-slanted-height': {
    label: 'Used the slanted side as the height',
    fix: 'The height is perpendicular to the base (the dashed segment). The slanted side is longer, so base × slanted side overstates the area.',
  },
  'geom-quad-trapezoid-no-half': {
    label: 'Forgot the $\\frac{1}{2}$ in the trapezoid formula',
    fix: 'Trapezoid area $= \\frac{1}{2}(b_1 + b_2)h$: the average of the bases times the height.',
  },
  'geom-quad-assumed-rectangle': {
    label: 'Assumed the parallelogram is a rectangle',
    fix: 'With only two sides $a$ and $b$ known, the height can be anything up to $a$: the area can be any value up to $ab$, reached only when the angles are right angles.',
  },
  /* ------------------------------------------------------------ circles */
  'geom-circle-ratio-inverted': {
    label: 'Reversed the order of the ratio',
    fix: '"The ratio of A to B" puts the measure of A first. Write $\\frac{A}{B}$ before simplifying.',
  },
  'geom-circle-ratio-linear': {
    label: 'Used the ratio of the radii for the areas',
    fix: 'Areas grow with the SQUARE of the radius: radii in the ratio $p : q$ give areas in the ratio $p^2 : q^2$.',
  },
  'geom-circle-ratio-cubed': {
    label: 'Cubed the ratio for an area',
    fix: 'Cubing is for volumes. Areas of circles go with the square of the radii.',
  },
  'geom-circle-ratio-squared': {
    label: 'Squared the ratio for a length',
    fix: 'Circumferences, radii and diameters are lengths: they are in the same ratio as the radii. Only areas use the squared ratio.',
  },
  'geom-circle-radius-diameter': {
    label: 'Used the diameter as the radius (or the reverse)',
    fix: '$r = \\frac{d}{2}$. Circumference is $2\\pi r = \\pi d$; area is $\\pi r^2$, never $\\pi d^2$.',
  },
  'geom-circle-arc-sector-mixed': {
    label: 'Mixed up arc length and sector area',
    fix: 'Arc length $= \\frac{\\theta}{360} \\cdot 2\\pi r$ (part of the circumference); sector area $= \\frac{\\theta}{360} \\cdot \\pi r^2$ (part of the area).',
  },
  'geom-circle-forgot-fraction': {
    label: 'Used the whole circle',
    fix: 'An arc or a sector is only the fraction $\\frac{\\theta}{360}$ of the full circumference or area.',
  },
  'geom-circle-inscribed-as-central': {
    label: 'Treated an inscribed angle as the central angle',
    fix: 'An inscribed angle (vertex on the circle) is HALF the central angle (vertex at the center) that cuts off the same arc.',
  },
  'geom-circle-minor-major': {
    label: 'Used the wrong part of the circle',
    fix: 'If the shaded sector or the named arc goes the long way around, its central angle is $360^\\circ - \\theta$.',
  },
  'geom-circle-chord-diameter': {
    label: 'Misjudged whether the chord is a diameter',
    fix: 'A chord is a diameter exactly when the inscribed angle opposite it is $90^\\circ$. If that angle is obtuse, the chord is shorter than the diameter, and nothing more is fixed.',
  },
  'geom-circle-pi-rounded': {
    label: 'Rounded $\\pi$ too much for a close comparison',
    fix: '$\\pi \\approx 3.1416$: $2\\pi \\approx 6.283$, which is more than 6 and more than 6.28 but less than 6.3. Keep enough digits when the two sides are close.',
  },
  'geom-circle-diff-depends': {
    label: 'Thought the difference depends on the unknown radii',
    fix: 'The difference of circumferences is $2\\pi(r_A - r_B)$: only the difference of the radii matters. (A difference of AREAS, $\\pi(r_A^2 - r_B^2)$, does depend on the radii.)',
  },
  'geom-circle-semicircle-right': {
    label: 'Missed the right angle inscribed in a semicircle',
    fix: 'An angle inscribed in a semicircle (its sides end at the ends of a diameter) is always $90^\\circ$. Use it in the triangle angle sum.',
  },
  'geom-circle-tangent-right': {
    label: 'Missed the right angle at the point of tangency',
    fix: 'A tangent line is perpendicular to the radius drawn to the point of tangency: the triangle has a $90^\\circ$ angle there.',
  },
  'geom-circle-no-right-triangle': {
    label: 'Added or subtracted lengths instead of using the right triangle',
    fix: 'The radius to a point of tangency, or the perpendicular from the center to a chord, makes a right angle. Use $a^2 + b^2 = c^2$.',
  },
  'geom-circle-pb-whole': {
    label: 'Gave the distance to the center instead of to the circle',
    fix: 'The distance from an outside point $P$ to the circle along $OP$ is $OP - r$.',
  },
  'geom-circle-half-chord': {
    label: 'Forgot to double the half-chord',
    fix: 'The perpendicular from the center cuts the chord into two equal halves; the right triangle gives only one half.',
  },
  'geom-circle-whole-chord-leg': {
    label: 'Used the whole chord as a leg',
    fix: 'The right triangle is made of the radius, the distance from the center, and HALF the chord.',
  },
  'geom-circle-wheel-round-up': {
    label: 'Counted an unfinished revolution',
    fix: '"Complete revolutions" means round DOWN: a partial turn does not count.',
  },
  'geom-circle-wheel-no-pi': {
    label: 'Divided by the diameter instead of the circumference',
    fix: 'One revolution covers one circumference, $\\pi d$, not $d$.',
  },
  /* ------------------------------------------------------------ composite figures */
  'geom-shaded-one-piece': {
    label: 'Counted the wrong number of pieces',
    fix: 'Check how many of the equal pieces are shaded: compute (whole − unshaded) and divide by the number of pieces only if just one of them is shaded.',
  },
  'geom-shaded-radius-wrong': {
    label: 'Took the wrong radius for the circle',
    fix: 'A square inscribed in a circle has its DIAGONAL as the diameter, so $r = \\frac{s\\sqrt{2}}{2}$ and $r^2 = \\frac{s^2}{2}$. An arc centered at a vertex of a square with radius equal to the side has radius $s$.',
  },
  'geom-shaded-circumference': {
    label: 'Used the circumference instead of the area',
    fix: 'To subtract a circle from a region, subtract its area $\\pi r^2$, not its circumference $2\\pi r$.',
  },
  'geom-shaded-wrong-region': {
    label: 'Found the area of the unshaded part (or of the whole figure)',
    fix: 'Shaded area = whole figure − unshaded parts. Identify which region is shaded before computing.',
  },
  'geom-shaded-ring-difference': {
    label: 'Ring area $= \\pi(R - r)^2$',
    fix: 'The ring is the big disk minus the small one: $\\pi R^2 - \\pi r^2$. Subtract the areas, not the radii.',
  },
  'geom-shaded-pi-as-3': {
    label: 'Used $\\pi = 3$ in a close comparison',
    fix: 'Rounding $\\pi$ down to 3 shifts a value like $9\\pi - 18$ from 10.27 to 9. When the comparison is close, use $\\pi \\approx 3.14$ (and $\\sqrt{3} \\approx 1.73$).',
  },
  'geom-shaded-assumed-length': {
    label: 'Assumed a particular length for the side that is not given',
    fix: 'A length that is not given can take many values. Test the smallest allowed value and a large one: if the comparison flips, the answer is D.',
  },
  'geom-shaded-radius-as-side': {
    label: 'Took the radius for the side of the inscribed square',
    fix: 'The diagonal of an inscribed square is a diameter, $2r$. The side is $\\frac{2r}{\\sqrt{2}} = r\\sqrt{2}$, not $r$.',
  },
  'geom-shaded-apothem-as-side': {
    label: 'Took the distance to a side for the side of the hexagon',
    fix: 'The side of a regular hexagon equals the radius of its circle. $r\\sqrt{3}$ is the distance across two sides (a short diagonal).',
  },
  'geom-shaded-wrong-diagonal': {
    label: 'Took the longest diagonal for the diagonal asked',
    fix: 'A regular hexagon has long diagonals ($2r$, through the center) and short diagonals ($r\\sqrt{3}$, across two sides). Check which vertices the diagonal joins.',
  },
  'geom-shaded-fraction-wrong': {
    label: 'Subtracted the wrong fraction of the circle',
    fix: 'Count the quarter circles that are really cut out of the square: one quarter circle is $\\frac{1}{4}\\pi r^2$, four of them make a whole circle.',
  },
  'geom-shaded-forgot-pi': {
    label: 'Dropped the factor $\\pi$',
    fix: 'Every circle has area $\\pi r^2$. The ring is $\\pi R^2 - \\pi r^2 = \\pi(R^2 - r^2)$, with the $\\pi$.',
  },
  'geom-shaded-added-areas': {
    label: 'Added the two areas instead of subtracting',
    fix: 'The ring is what is left of the large disk after the small disk is removed, so the areas are subtracted.',
  },
  'geom-shaded-apex-position': {
    label: 'Thought the area depends on where the point is',
    fix: 'A triangle with a side of the rectangle as its base and its third vertex on the opposite side always has height equal to the rectangle\'s width: its area is half the rectangle.',
  },
  'geom-shaded-inner-edge': {
    label: 'Counted an inside edge in the perimeter',
    fix: 'The perimeter is the outer boundary only. When a semicircle sits on a side, that side (the diameter) is inside the figure: replace it by the arc $\\frac{\\pi d}{2}$.',
  },
  'geom-shaded-side-diameter': {
    label: 'Took the side of the inscribed square as the diameter',
    fix: 'For a square inscribed in a circle, the DIAGONAL is the diameter: side $= \\frac{d}{\\sqrt{2}} = r\\sqrt{2}$ and area $= 2r^2$.',
  },
  'geom-shaded-diagonal-diameter': {
    label: 'Took the diagonal of the square as the diameter of the inscribed circle',
    fix: 'A circle inscribed in a square touches the sides: its diameter equals the SIDE of the square.',
  },
  'geom-shaded-missing-sides': {
    label: 'Used only the labeled sides',
    fix: 'Find every side of the figure first. In a figure with right angles, the horizontal pieces on top add up to the full bottom, and the vertical pieces add up to the full height.',
  },
  'geom-shaded-forgot-cutout': {
    label: 'Forgot to subtract the cut-out part',
    fix: 'Area of the figure = area of the full rectangle − area of the missing piece (or add the pieces it splits into).',
  },
  'geom-shaded-perimeter-bounding': {
    label: 'Assumed the perimeter equals that of the surrounding rectangle',
    fix: 'That shortcut works for a corner cut. A notch in the middle of a side adds its two walls to the perimeter.',
  },
  'geom-shaded-border-once': {
    label: 'Added the border width only once to each dimension',
    fix: 'A border of width $w$ on all sides adds $w$ at each end: the outer dimensions are $\\ell + 2w$ and $h + 2w$.',
  },
  'geom-shaded-semicircle-full': {
    label: 'Used a whole circle instead of a semicircle',
    fix: 'A semicircle has half the area of the circle: $\\frac{1}{2}\\pi r^2$.',
  },
  /* ------------------------------------------------------------ solids */
  'geom-solid-face-diagonal': {
    label: 'Used a face diagonal instead of the space diagonal',
    fix: 'The segment between opposite corners of a box goes through the inside: $\\sqrt{\\ell^2 + w^2 + h^2}$. $\\sqrt{\\ell^2 + w^2}$ is only the diagonal of one face.',
  },
  'geom-solid-added-edges': {
    label: 'Added the edges instead of using the Pythagorean theorem',
    fix: 'A diagonal is a straight-line distance: $\\sqrt{\\ell^2 + w^2 + h^2}$ (for a cube, $e\\sqrt{3}$), always less than $\\ell + w + h$.',
  },
  'geom-solid-diag-sum-legs': {
    label: 'Added the legs of the right triangle instead of squaring them',
    fix: 'The space diagonal is the hypotenuse of a right triangle whose legs are the face diagonal and an edge: $\\sqrt{d^2 + c^2}$, which is less than $d + c$.',
  },
  'geom-solid-no-sqrt': {
    label: 'Stopped before taking the square root',
    fix: 'A sum of squares (or a product of three face areas) is the SQUARE of the length (or of the volume). The square root is the last step.',
  },
  'geom-solid-missing-pair': {
    label: 'Left out one pair of faces',
    fix: 'A box has three pairs of faces, $\\ell w$, $\\ell h$ and $wh$, each counted twice: $2(\\ell w + \\ell h + wh)$.',
  },
  'geom-solid-edges-for-surface': {
    label: 'Used the total edge length for an area',
    fix: 'The 12 edges of a box add up to a length ($4(\\ell + w + h)$). Surface area adds the AREAS of the faces, in square units.',
  },
  'geom-solid-square-of-sum': {
    label: 'Squared the sum of the dimensions',
    fix: '$(\\ell + w + h)^2$ also contains $\\ell^2 + w^2 + h^2$, which are not faces. Add the three face areas $\\ell w$, $\\ell h$, $wh$ and double.',
  },
  'geom-solid-edge-not-squared': {
    label: 'Multiplied the edge by 6 instead of squaring it',
    fix: 'A face is a square of side $e$, with area $e^2$. The six faces give $6e^2$, not $6e$.',
  },
  'geom-solid-times-six': {
    label: 'Multiplied the volume by 6',
    fix: 'Find the edge first ($e = \\sqrt[3]{V}$), then the area of one face $e^2$, then the six faces.',
  },
  'geom-solid-edge-as-volume': {
    label: 'Stopped at the edge',
    fix: 'After finding the edge $e$, finish the question: the volume of the cube is $e^3$.',
  },
  'geom-solid-face-cubed': {
    label: 'Cubed the area of a face instead of its edge',
    fix: 'The area of a face is $e^2$. The volume is $e^3$, so take the square root of the face area first to get $e$.',
  },
  'geom-solid-surface-as-base': {
    label: 'Used the whole surface area as the base area',
    fix: 'Volume is (area of ONE face) times the edge. The surface area counts all six faces.',
  },
  'geom-solid-face-sum': {
    label: 'Added the three face areas',
    fix: 'The faces are $\\ell w$, $\\ell h$ and $wh$; the volume is $\\ell w h$. Their product is $(\\ell w h)^2$, so the volume is the square root of that product.',
  },
  'geom-solid-pair-product': {
    label: 'Multiplied only two of the face areas',
    fix: '$(\\ell w)(\\ell h) = \\ell^2 w h$ has an extra $\\ell$. Multiply all three faces, then take the square root.',
  },
  'geom-solid-pair-root': {
    label: 'Took the square root of the product of only two faces',
    fix: 'The square root of $(\\ell w)(\\ell h)$ is $\\ell\\sqrt{wh}$, not the volume. Use all three faces: $\\sqrt{(\\ell w)(\\ell h)(wh)} = \\ell w h$.',
  },
  'geom-solid-circ-area-mix': {
    label: 'Mixed the circumference formula with the area formula',
    fix: 'The circumference is $2\\pi r$ (one factor of $r$); the area is $\\pi r^2$.',
  },
  'geom-solid-lateral-area': {
    label: 'Gave the lateral area instead of the circumference of the base',
    fix: 'The curved surface of a cylinder has area $2\\pi r h$. The circumference of the BASE is only $2\\pi r$, with no $h$.',
  },
  'geom-solid-round-up': {
    label: 'Rounded the depth up when it must not overflow',
    fix: 'When the liquid may not rise above the top, the depth is the greatest multiple of 5 that does NOT exceed the bound. Rounding up overshoots it.',
  },
  'geom-solid-ignore-expansion': {
    label: 'Ignored the expansion and filled the tank to the top',
    fix: 'Once frozen, the liquid is taller than it was. Fill to $\\frac{H}{1 + p/100}$, not to $H$.',
  },
  'geom-solid-percent-of-height': {
    label: 'Took the expansion percent of the height as the depth',
    fix: 'The depth is the height divided by $1 + \\frac{p}{100}$, which is close to $H$ for a small $p$. $p$ percent of $H$ is only the extra height.',
  },
  'geom-solid-percent-as-cm': {
    label: 'Subtracted the percent as if it were centimeters',
    fix: 'A percent is a fraction of the depth, not a length. Divide the height by $1 + \\frac{p}{100}$.',
  },
  'geom-solid-strict': {
    label: 'Treated "does not rise above" as "stays strictly below"',
    fix: 'Reaching exactly the top does not rise above it. If the bound is itself a multiple of 5, it is allowed.',
  },
  'geom-solid-ignore-shrink': {
    label: 'Ignored the dimension that gets smaller',
    fix: 'Every factor counts, including the ones below 1: doubling the radius (volume $\\times 4$) and halving the height (volume $\\times \\frac{1}{2}$) gives $4 \\times \\frac{1}{2} = 2$, not 4.',
  },
  'geom-solid-surface-half': {
    label: 'Counted each pair of faces once',
    fix: 'A box has 6 faces in 3 equal pairs: surface area $= 2(\\ell w + \\ell h + wh)$.',
  },
  'geom-solid-volume-for-surface': {
    label: 'Mixed up volume and surface area',
    fix: 'Volume is $\\ell w h$ (cubic units); surface area is the total area of the faces, $2(\\ell w + \\ell h + wh)$ (square units).',
  },
  'geom-solid-cube-four-faces': {
    label: 'Counted only 4 faces of the cube',
    fix: 'A cube has 6 faces: surface area $= 6e^2$.',
  },
  'geom-solid-one-face': {
    label: 'Gave the area of one face',
    fix: 'One face of a cube is $e^2$; the surface area is $6e^2$ and the volume is $e^3$.',
  },
  'geom-solid-face-product': {
    label: 'Multiplied the face areas without taking the square root',
    fix: '$(\\ell w)(\\ell h)(wh) = (\\ell w h)^2$: the product of the three face areas is the SQUARE of the volume.',
  },
  'geom-solid-base-area': {
    label: 'Gave the area of the base instead of its circumference',
    fix: 'The base is a circle: its circumference is $2\\pi r$, its area is $\\pi r^2$.',
  },
  'geom-solid-radius-not-circ': {
    label: 'Stopped at the radius',
    fix: 'After finding $r$, finish the question: the circumference is $2\\pi r$.',
  },
  'geom-solid-percent-subtract': {
    label: 'Subtracted the percent instead of dividing by $1 + p$',
    fix: 'If the volume grows by $p$ percent, the final volume is $(1 + \\frac{p}{100})$ times the initial one. To find the initial amount, divide by $1 + \\frac{p}{100}$; taking $p$ percent off the final amount is not the same.',
  },
  'geom-solid-scale-linear': {
    label: 'Scaled the volume like a length',
    fix: 'Lengths × $k$ means volume × $k^3$; in a cylinder, the radius × $k$ multiplies the volume by $k^2$ (the radius is squared).',
  },
  'geom-solid-same-depth': {
    label: 'Kept the same depth after pouring',
    fix: 'What stays the same is the VOLUME. Divide it by the new base area to get the new depth.',
  },
  'geom-solid-forgot-pi': {
    label: 'Dropped the factor $\\pi$',
    fix: 'The volume of a cylinder is $\\pi r^2 h$; when the liquid goes into a box, $\\pi$ does not cancel.',
  },
  'geom-solid-pack-by-volume': {
    label: 'Divided the volumes',
    fix: 'Count how many cubes fit along each edge (round down), then multiply. Dividing the volumes counts leftover slivers as if they could hold cubes.',
  },
  'geom-solid-ignored-initial': {
    label: 'Ignored the water already in the tank',
    fix: 'Only the empty part of the tank must be filled: its volume is (base area) × (height − current depth).',
  },
  'geom-solid-volume-symmetric': {
    label: 'Assumed swapping radius and height keeps the volume',
    fix: 'In $\\pi r^2 h$ the radius is squared and the height is not: the cylinder with the larger radius has the larger volume.',
  },
  'geom-solid-assumed-cube': {
    label: 'Assumed the box is a cube',
    fix: 'A box with a given volume can have many shapes. The cube has the smallest surface area; any other box has more.',
  },
  'geom-solid-min-surface': {
    label: 'Thought the comparison cannot be decided',
    fix: 'Even with the shape unknown, the surface area has a minimum (the cube) for a fixed volume. If that minimum already beats the other quantity, the answer is determined.',
  },
  'geom-solid-percent-linear': {
    label: 'Added the percent increases',
    fix: 'Each edge × 1.1 means volume × $1.1^3 = 1.331$: a 33.1 percent increase, not 30 percent.',
  },
  'geom-solid-changes-cancel': {
    label: 'Assumed equal percent changes cancel',
    fix: 'Multiply the factors: radius × 1.2 and height × 0.8 give volume × $1.2^2 \\times 0.8 = 1.152$, not 1.',
  },
};
