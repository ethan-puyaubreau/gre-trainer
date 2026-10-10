import type { Skill } from '../../../engine/types';

const area = 'geometry' as const;

export const measureSkills: Skill[] = [
  {
    id: 'geo.polygons',
    area,
    unit: 'Polygons & circles',
    name: 'Polygons & quadrilaterals',
    summary: 'Interior angle sums, regular polygons, parallelogram and trapezoid areas, perimeter vs area.',
    strategy: `Interior angle sum of an $n$-sided polygon: $(n - 2) \\cdot 180^\\circ$ (quadrilateral $360^\\circ$, pentagon $540^\\circ$, hexagon $720^\\circ$).

- Regular $n$-gon: each exterior angle is $\\frac{360^\\circ}{n}$, each interior angle is $180^\\circ - \\frac{360^\\circ}{n}$.
- Parallelogram area = base × height, the height perpendicular to the base. The slanted side is longer than the height, so sides $a$ and $b$ give an area of at most $ab$ (only a rectangle reaches it).
- Trapezoid area = $\\frac{1}{2}(b_1 + b_2)h$. A slanted leg is not the height.
- Fixed perimeter: the square has the largest area. Fixed area: the square has the smallest perimeter.
- "X is what fraction of Y" means $\\frac{X}{Y}$.`,
  },
  {
    id: 'geo.circles',
    area,
    unit: 'Polygons & circles',
    name: 'Circles',
    summary: 'Circumference and area, arcs and sectors, central and inscribed angles, tangents and chords.',
    strategy: `$C = 2\\pi r = \\pi d$ and $A = \\pi r^2$: find the radius first, then compute what is asked.

- An arc or a sector is the fraction $\\frac{\\theta}{360}$ of the whole circumference or area, where $\\theta$ is the CENTRAL angle.
- An inscribed angle is half the central angle on the same arc. An angle inscribed in a semicircle is $90^\\circ$.
- A tangent is perpendicular to the radius at the point of tangency: look for the right triangle.
- The perpendicular from the center bisects a chord: $r^2 = d^2 + \\left(\\frac{c}{2}\\right)^2$. The longest chord is a diameter.
- A wheel rolls one circumference ($\\pi d$) per revolution.`,
  },
  {
    id: 'geo.composite',
    area,
    unit: 'Polygons & circles',
    name: 'Composite figures & shaded regions',
    summary: 'Shaded areas, figures inscribed in or circumscribed about circles, combined areas and perimeters.',
    strategy: `Shaded area = (whole figure) − (unshaded parts). Write each piece as a formula before computing.

- Square inscribed in a circle: its diagonal is the diameter, so side $= r\\sqrt{2}$ and area $= 2r^2$.
- Circle inscribed in a square: the diameter equals the side.
- Circular segment = sector − triangle. A $90^\\circ$ sector of radius $r$ minus its right triangle: $\\frac{\\pi r^2}{4} - \\frac{r^2}{2}$.
- Perimeter counts only the outer boundary: a semicircle on a side replaces that side by an arc of length $\\frac{\\pi d}{2}$.
- In close comparisons use $\\pi \\approx 3.14$, not 3.`,
  },
  {
    id: 'geo.solids',
    area,
    unit: 'Solids',
    name: '3-D figures',
    summary: 'Rectangular solids, cubes and cylinders: volume, surface area, diagonals, scaling, pouring.',
    strategy: `Box: $V = \\ell w h$, surface area $2(\\ell w + \\ell h + wh)$, space diagonal $\\sqrt{\\ell^2 + w^2 + h^2}$. Cube: $V = e^3$, surface area $6e^2$, diagonal $e\\sqrt{3}$.

- Cylinder: $V = \\pi r^2 h$, total surface area $2\\pi r^2 + 2\\pi r h$.
- Scaling: lengths × $k$ means areas × $k^2$ and volumes × $k^3$. In a cylinder the radius counts twice.
- Pouring: the volume of liquid does not change, so set the two volume formulas equal ($\\pi$ cancels).
- Packing: count how many fit along each edge (round down), then multiply. Do not just divide the volumes.
- For a fixed volume the cube has the smallest surface area.`,
  },
];
