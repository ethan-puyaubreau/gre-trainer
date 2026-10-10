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
};
