import type { Skill } from '../../engine/types';

const area = 'arithmetic' as const;

export const arithmeticSkills: Skill[] = [
  // ---------------------------------------------------------------- Integers
  {
    id: 'arith.divisibility',
    area,
    unit: 'Integers',
    name: 'Divisibility & remainders',
    summary: 'n = dk + r, what must divide n, remainders of sums and products.',
    strategy: `Write the division as an equation: "n divided by d leaves remainder r" means $n = dk + r$ with $0 \\le r < d$.

- Factor out what $d$ and $r$ share: $45k + 18 = 9(5k + 2)$, so 9 always divides $n$.
- Test the smallest case $k = 0$ (so $n = r$) to eliminate choices instantly.
- Remainders add and multiply: the remainder of $x + y$ comes from the remainders of $x$ and $y$.
- "Depends on $n$" questions: plug in $n = 1, 2, 3$; different results mean D.`,
  },
  {
    id: 'arith.primes',
    area,
    unit: 'Integers',
    name: 'Primes & parity',
    summary: 'Prime facts, odd/even rules, sums of primes.',
    strategy: `2 is the only even prime, and 1 is not prime.

- An odd number is a sum of two primes only if one of them is 2: test whether $n - 2$ is prime.
- odd + odd = even, odd + even = odd, odd × odd = odd, anything × even = even.
- Know the primes below 50: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47.
- To test whether $n$ is prime, try primes up to $\\sqrt{n}$ only.`,
  },
  {
    id: 'arith.factors',
    area,
    unit: 'Integers',
    name: 'Factors & prime factorization',
    summary: 'Factor pairs, number of divisors, products of unknown integers.',
    strategy: `Isolate the product first: $(4x)(7y) = 756$ gives $xy = 27$.

- List factor pairs from 1 upward and stop at $\\sqrt{N}$.
- Apply the constraints (both greater than 1, distinct, even...) before computing.
- Number of positive divisors of $p^a q^b$ is $(a + 1)(b + 1)$.
- A perfect square has an odd number of divisors.`,
  },
  {
    id: 'arith.lcm-gcd',
    area,
    unit: 'Integers',
    name: 'LCM & GCD',
    summary: 'Schedules that coincide, equal groups, least common multiple.',
    strategy: `"When do they happen together again?" means LCM. "Largest equal groups" means GCD.

- LCM: take every prime at its highest power. $30 = 2 \\cdot 3 \\cdot 5$, $25 = 5^2$, $50 = 2 \\cdot 5^2$ gives $2 \\cdot 3 \\cdot 5^2 = 150$.
- Coinciding times are start + every multiple of the LCM. Convert minutes to hours carefully.
- GCD: take common primes at their lowest power.
- $\\text{GCD}(a, b) \\times \\text{LCM}(a, b) = ab$.`,
  },
  {
    id: 'arith.cycles',
    area,
    unit: 'Integers',
    name: 'Cycles & repeating patterns',
    summary: 'Repeating decimals, periodic sequences, units digits of powers.',
    strategy: `Find the cycle length $L$, then use the remainder of the position divided by $L$. A remainder of 0 means the LAST element of the cycle.

- $\\frac{4}{11} = 0.\\overline{36}$: odd positions are 3, even positions are 6.
- Fractions over 7 have a 6-digit cycle (142857 family).
- Any $L$ consecutive terms of an $L$-cycle add up to one full cycle, wherever you start.
- Units digits of powers repeat every 4 (or less): $7^1, 7^2, 7^3, 7^4 \\to 7, 9, 3, 1$.
- Count terms from position $a$ to $b$ inclusive as $b - a + 1$.`,
  },
  {
    id: 'arith.consecutive',
    area,
    unit: 'Integers',
    name: 'Sums of consecutive integers',
    summary: 'Evenly spaced lists, number of terms, sums from a to b.',
    strategy: `Evenly spaced list: sum = (number of terms) × (first + last) / 2.

- $1 + 2 + \\cdots + n = \\frac{n(n+1)}{2}$.
- Number of integers from $a$ to $b$ inclusive: $b - a + 1$. Multiples of $k$ from $a$ to $b$: $\\frac{\\text{last} - \\text{first}}{k} + 1$.
- Sum of the first $n$ odd numbers is $n^2$; of the first $n$ even numbers is $n(n+1)$.
- $T(60) - T(40)$ is the sum $41 + \\cdots + 60$, not $1 + \\cdots + 20$.`,
  },
  // ---------------------------------------------------------------- Fractions & real numbers
  {
    id: 'arith.fractions',
    area,
    unit: 'Fractions & decimals',
    name: 'Fractions',
    summary: 'Operations on fractions, comparing fractions, what changes a fraction.',
    strategy: `Multiplying or dividing numerator and denominator by the same nonzero number gives an equal fraction. Adding the same number does not.

- For $0 < \\frac{a}{b} < 1$, adding the same positive number to both parts moves the fraction toward 1 (it grows).
- Compare fractions by cross-multiplying: $\\frac{a}{b} > \\frac{c}{d} \\iff ad > bc$ (for positive denominators).
- Complex fraction: multiply top and bottom by the LCD of the inner fractions.
- Dividing by a fraction = multiplying by its reciprocal.`,
  },
  {
    id: 'arith.decimals',
    area,
    unit: 'Fractions & decimals',
    name: 'Decimals & place value',
    summary: 'Place value, rounding, scientific notation, decimal arithmetic.',
    strategy: `Remove decimals by scaling: $18 \\div 0.75 = 1800 \\div 75 = 24$.

- Know the common equivalents: $0.125 = \\frac{1}{8}$, $0.2 = \\frac{1}{5}$, $0.25 = \\frac{1}{4}$, $0.375 = \\frac{3}{8}$, $0.75 = \\frac{3}{4}$.
- Rounding: look only at the digit right after the place you round to.
- Scientific notation: $a \\times 10^n$ with $1 \\le a < 10$; multiplying adds exponents.
- Tenths, hundredths, thousandths are the 1st, 2nd, 3rd digits after the point.`,
  },
  {
    id: 'arith.number-line',
    area,
    unit: 'Fractions & decimals',
    name: 'Number line',
    summary: 'Points and segments on the number line, distances, ratios of segments.',
    strategy: `Express every segment in one unit. If $AB = CD = \\frac{1}{3} BC$, let $BC = 3u$, then $AD = 5u$.

- Distance between $a$ and $b$ is $|a - b|$.
- Midpoint of $a$ and $b$ is $\\frac{a + b}{2}$.
- Sanity check: the point you find must lie between its neighbors.`,
  },
  {
    id: 'arith.real-numbers',
    area,
    unit: 'Fractions & decimals',
    name: 'Signs, powers & absolute value',
    summary: 'How x², x³ and 1/x behave between −1 and 1, absolute value, inequalities.',
    strategy: `Memorize where powers and reciprocals land:

- $x > 1$: $x^3 > x^2 > x > \\frac{1}{x}$.
- $0 < x < 1$: $\\frac{1}{x} > x > x^2 > x^3$.
- $-1 < x < 0$: $x^2 > 0 > x^3 > x > \\frac{1}{x}$.
- $x < -1$: $x^2 > 0 > \\frac{1}{x} > x > x^3$.
- "Must be true" with $|z| \\le 1$: test $-1$, $0$, $1$ and a negative fraction like $-\\frac{1}{2}$.
- $|x| < a$ means $-a < x < a$; $|x| > a$ means $x > a$ or $x < -a$.`,
  },
  // ---------------------------------------------------------------- Exponents & roots
  {
    id: 'arith.exponents',
    area,
    unit: 'Exponents & roots',
    name: 'Exponents',
    summary: 'Exponent rules, negative and zero exponents, negative bases.',
    strategy: `Check the parity of the exponent first: $(-x)^{\\text{even}} = x^{\\text{even}}$ and $(-x)^{\\text{odd}} = -x^{\\text{odd}}$.

- $a^m a^n = a^{m+n}$, $\\frac{a^m}{a^n} = a^{m-n}$, $(a^m)^n = a^{mn}$, $a^0 = 1$.
- Negative exponents flip the base: $\\left(\\frac{1}{3}\\right)^{-n} = 3^n$.
- $(a + b)^n \\ne a^n + b^n$: just compute both sides.
- Rewrite with a common base: $8^x = 2^{3x}$, $27 = 3^3$.
- Even powers are never negative.`,
  },
  {
    id: 'arith.roots',
    area,
    unit: 'Exponents & roots',
    name: 'Roots & radicals',
    summary: 'Simplifying square and cube roots, adding and comparing radicals.',
    strategy: `Factor out perfect powers first: $\\sqrt{a^2 b} = a\\sqrt{b}$ and $\\sqrt[3]{a^3 b} = a\\sqrt[3]{b}$.

- $\\sqrt[3]{270} - \\sqrt[3]{10} = 3\\sqrt[3]{10} - \\sqrt[3]{10} = 2\\sqrt[3]{10} = \\sqrt[3]{80}$.
- $\\sqrt{a} - \\sqrt{b} \\ne \\sqrt{a - b}$ and $\\sqrt{a} + \\sqrt{b} \\ne \\sqrt{a + b}$. Only like radicals combine.
- To compare $k\\sqrt{b}$ with $\\sqrt{c}$, put the coefficient back inside: $k\\sqrt{b} = \\sqrt{k^2 b}$.
- $\\sqrt{a}\\sqrt{b} = \\sqrt{ab}$, and $(\\sqrt{a} + \\sqrt{b})^2 = a + b + 2\\sqrt{ab}$.`,
  },
  {
    id: 'arith.order-of-operations',
    area,
    unit: 'Exponents & roots',
    name: 'Evaluating expressions',
    summary: 'Substituting values, order of operations, signs with negatives.',
    strategy: `Substitute with parentheses: if $s = -7$, then $r - s = 2 - (-7) = 9$.

- Exponents before multiplication, multiplication before addition.
- $-3^2 = -9$ but $(-3)^2 = 9$.
- On QC questions with given values, compute both sides fully; the answer can never be D.`,
  },
  // ---------------------------------------------------------------- Percents, ratios & rates
  {
    id: 'arith.percent',
    area,
    unit: 'Percents, ratios & rates',
    name: 'Percents & percent change',
    summary: 'Percent of, percent change, unknown base amounts.',
    strategy: `Use multipliers: +8% is ×1.08, −20% is ×0.80.

- Percent change = (new − old) / old. The base is always the ORIGINAL value.
- A percent change with no base amount cannot be turned into a dollar amount: comparing reductions of two unknown prices is D.
- "Total paid" includes the original: $s + 0.08s = 1.08s$.
- $x\\%$ of $y$ = $y\\%$ of $x$.`,
  },
  {
    id: 'arith.successive-percent',
    area,
    unit: 'Percents, ratios & rates',
    name: 'Successive percents',
    summary: 'Discount then tax, increase then decrease, compound changes.',
    strategy: `Successive changes multiply; they never add.

- −15% then +8%: $0.85 \\times 1.08 = 0.918$, not $0.93$.
- +25% then −20%: $1.25 \\times 0.8 = 1$, back to the start.
- +x% then −x% always ends BELOW the start: $(1 + x)(1 - x) = 1 - x^2$.
- To undo a +25% change you need −20%, not −25%.`,
  },
  {
    id: 'arith.ratios',
    area,
    unit: 'Percents, ratios & rates',
    name: 'Ratios & parts of a whole',
    summary: 'Splitting a total by fractions and ratios.',
    strategy: `Ratio $a : b$ means $a + b$ equal parts. Find one part, then multiply.

- Take out a known fraction first, then split the rest by the ratio: $6000 \\times \\frac{3}{8} = 2250$, the remaining 3,750 split 2 : 1 gives 2,500 and 1,250.
- "Twice as many in M as in P" means $M : P = 2 : 1$.
- Combine ratios through the shared term: $a : b = 2 : 3$ and $b : c = 4 : 5$ give $a : b : c = 8 : 12 : 15$.`,
  },
  {
    id: 'arith.rates',
    area,
    unit: 'Percents, ratios & rates',
    name: 'Rates & unit conversions',
    summary: 'Constant rates, unit conversion by cancelling units.',
    strategy: `Write units as fractions and cancel them: $5\\text{ h} \\times \\frac{3600\\text{ s}}{1\\text{ h}} \\times \\frac{2\\text{ pages}}{3\\text{ s}} = 12{,}000$ pages.

- Total = rate × time; time = total ÷ rate.
- Know 3,600 seconds per hour and 1,440 minutes per day.
- Dividing by 0.75 is multiplying by $\\frac{4}{3}$.`,
  },
];
