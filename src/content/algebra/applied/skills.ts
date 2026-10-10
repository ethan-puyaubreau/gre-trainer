import type { Skill } from '../../../engine/types';

const area = 'algebra' as const;

export const appliedSkillList: Skill[] = [
  // ---------------------------------------------------------------- Coordinate geometry
  {
    id: 'alg.coordinate',
    area,
    unit: 'Coordinate geometry',
    name: 'Lines in the xy-plane',
    summary: 'Slope, intercepts, parallel and perpendicular lines, distance and midpoint, points on a line.',
    strategy: `Slope is rise over run: $m = \\frac{y_2 - y_1}{x_2 - x_1}$. A line $y = mx + b$ has slope $m$ and $y$-intercept $b$; its $x$-intercept is $-\\frac{b}{m}$.

- Parallel lines: equal slopes. Perpendicular lines: slopes $m$ and $-\\frac{1}{m}$ (product $-1$).
- To find $b$, substitute a known point into $y = mx + b$. For $ax + by = c$, the slope is $-\\frac{a}{b}$.
- A point is on a line exactly when its coordinates satisfy the equation; above $y = x$ means $y > x$.
- Distance $= \\sqrt{(\\Delta x)^2 + (\\Delta y)^2}$ (look for 3-4-5, 5-12-13, 8-15-17). Midpoint = average of the coordinates; the other endpoint is $2M - P$.
- Sign questions need no numbers: sketch the line through the given intercept or point. Coordinate figures ARE drawn to scale.`,
  },
  {
    id: 'alg.graphs',
    area,
    unit: 'Coordinate geometry',
    name: 'Graphs of functions',
    summary: 'Parabolas, intersections of graphs, reading a graph, regions defined by inequalities.',
    strategy: `A graph is the set of points $(x, f(x))$: read $f(a)$ as the height of the graph above $x = a$.

- Parabola $y = a(x - h)^2 + k$: vertex $(h, k)$, axis $x = h$; for $y = ax^2 + bx + c$ the axis is $x = -\\frac{b}{2a}$. Points with the same $y$ are symmetric: $r + t = 2h$.
- $(x - h)^2 \\ge 0$ with equality at $x = h$: "at least" comparisons are often D.
- Intersections: set the two expressions equal and solve; $x$-intercepts of one graph are a different thing.
- $y = f(x - c) + d$ moves the graph $c$ right and $d$ up: $g(5) = f(5 - c) + d$.
- A point is in a region when it satisfies EVERY inequality; substitute, do not eyeball points near the boundary.
- $y = a|x - h| + k$ is a V with vertex $(h, k)$: a line passing below the vertex meets it only if it is steeper than $a$.`,
  },
  // ---------------------------------------------------------------- Sequences & word problems
  {
    id: 'alg.sequences',
    area,
    unit: 'Sequences & word problems',
    name: 'Sequences',
    summary: 'Arithmetic and geometric sequences, recursive rules, n-th term, sums of terms.',
    strategy: `Count steps, not terms: $a_n = a_1 + (n - 1)d$ and $a_n = a_1 r^{n-1}$.

- From $a_m$ to $a_n$: $n - m$ steps, so $d = \\frac{a_n - a_m}{n - m}$ and $\\frac{a_n}{a_m} = r^{n - m}$.
- Differences of terms do not depend on $a_1$; terms symmetric about $a_k$ average to $a_k$: $a_{k-j} + a_{k+j} = 2a_k$.
- Sum of an arithmetic run = (number of terms) × (first + last) ÷ 2, with $n - m + 1$ terms from $a_m$ to $a_n$.
- Recursive rule: apply it one term at a time; to go backward, undo the operations in reverse order.
- A number is a term of $a_1, a_1 + d, \\dots$ when it is at least $a_1$ (for $d > 0$) and $(N - a_1)$ is a multiple of $d$.`,
  },
  {
    id: 'alg.word-problems',
    area,
    unit: 'Sequences & word problems',
    name: 'Translating word problems',
    summary: 'Ages, tickets and coins, parts of a total, "k more than twice y", setting up equations.',
    strategy: `Name the unknown, translate one sentence at a time, then reread what is asked.

- "$k$ more than twice $y$" is $2y + k$; "$k$ less than three times $y$" is $3y - k$.
- "There are $k$ more $X$ than $Y$": $X = Y + k$. Check the direction with small numbers.
- Ages: $n$ years ago (or from now), EVERY age changes by $n$.
- Two item types: count equation $x + y = T$ and value equation $ax + by = V$; solve for the one asked.
- Fixed fee plus a rate: subtract the fee before dividing by the rate. Watch the units (cents vs dollars, half-hours vs hours).
- In QC, write both quantities in the same unknown and cancel the common part; if what is left depends on the unknown, the answer is D.`,
  },
  {
    id: 'alg.rate-work',
    area,
    unit: 'Sequences & word problems',
    name: 'Rate, work & distance',
    summary: 'Combined work, distance = rate × time, average speed, relative speed.',
    strategy: `Work with RATES (jobs per hour), never with times: rates add, times do not.

- Together: $\\frac{1}{T} = \\frac{1}{a} + \\frac{1}{b}$, so $T = \\frac{ab}{a + b}$ (6 and 12 hours give 4 hours). Together is faster than either alone.
- Missing worker: $\\frac{1}{b} = \\frac{1}{T} - \\frac{1}{a}$. A drain subtracts its rate.
- $d = rt$. Average speed = total distance ÷ total time; for equal distances at $u$ and $v$ it is $\\frac{2uv}{u + v}$, below $\\frac{u + v}{2}$.
- Same distance, speed × $k$ means time ÷ $k$: 25% faster means 80% of the time.
- Toward each other the gap closes at $u + v$; same direction at $u - v$. Account for any head start first.`,
  },
  {
    id: 'alg.mixtures-interest',
    area,
    unit: 'Sequences & word problems',
    name: 'Mixtures & interest',
    summary: 'Concentration of mixtures, simple and compound interest, exponential growth.',
    strategy: `Track the amount of the pure substance: concentration = amount of substance ÷ total amount.

- Mixing: $x \\cdot p\\% + y \\cdot q\\% = (x + y) \\cdot c\\%$. The result is between $p$ and $q$, closer to the larger amount; never average the percents.
- Adding water keeps the substance and increases the total; adding pure substance increases both.
- Simple interest: $I = Prt$. Compound interest: $P(1 + r)^n$; compounded $k$ times a year: $P\\left(1 + \\frac{r}{k}\\right)^{kn}$.
- Compound beats simple after the first period; more frequent compounding beats less frequent.
- Doubling every $k$ years for $t$ years multiplies by $2^{t/k}$.`,
  },
];
