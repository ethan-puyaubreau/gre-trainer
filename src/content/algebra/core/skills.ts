import type { Skill } from '../../../engine/types';

const area = 'algebra' as const;
const EQ = 'Expressions & equations';
const IF = 'Inequalities & functions';

export const coreAlgebraSkills: Skill[] = [
  // ---------------------------------------------------------------- Expressions & equations
  {
    id: 'alg.expressions',
    area,
    unit: EQ,
    name: 'Algebraic expressions',
    summary: 'Simplifying, factoring, special products, evaluating expressions.',
    strategy: `Look for the expression the question asks about before solving anything: factor, expand, or square what you are given.

- $(a + b)^2 = a^2 + 2ab + b^2$, $(a - b)^2 = a^2 - 2ab + b^2$, $(a + b)(a - b) = a^2 - b^2$.
- Pull out common factors: $(6x - 3y)(4x + 2y) = 3(2x - y) \\cdot 2(2x + y) = 6(4x^2 - y^2)$.
- Factor out the smallest power: $3^{x + 2} - 3^{x} = 3^{x}(9 - 1) = 8 \\cdot 3^{x}$.
- A minus sign in front of parentheses changes every sign inside.
- To test whether two expressions are equivalent, plug in $x = 0$, $1$ and $2$.`,
  },
  {
    id: 'alg.exponent-equations',
    area,
    unit: EQ,
    name: 'Exponents with variables',
    summary: 'Exponent rules with variables, common bases, comparing powers.',
    strategy: `Rewrite every power with the same base, then work with the exponents.

- $a^m a^n = a^{m + n}$, $\\frac{a^m}{a^n} = a^{m - n}$, $(a^m)^n = a^{mn}$, $a^{-n} = \\frac{1}{a^n}$.
- $4 = 2^2$, $8 = 2^3$, $16 = 2^4$, $9 = 3^2$, $27 = 3^3$: so $8^{m} = 16^{t}$ means $3m = 4t$.
- With one base on each side, equal powers have equal exponents: $2^{3x + 2} = 2^{11}$ gives $3x + 2 = 11$.
- $2^k + 2^k = 2^{k + 1}$, but $a^m + a^n$ does not simplify to one power.
- If $x$ may be between 0 and 1, powers behave the other way: $x^3 < x^2$ there.`,
  },
  {
    id: 'alg.linear-equations',
    area,
    unit: EQ,
    name: 'Linear equations',
    summary: 'One-variable equations, literal equations, shortcuts to a target expression.',
    strategy: `Do the same thing to both sides; collect the variable on one side.

- Moving a term across the equals sign changes its sign: $5x + 3 = 2x - 9$ gives $3x = -12$.
- Clear fractions by multiplying EVERY term by the common denominator.
- Shortcut: if $3x + 2 = 11$, then $6x + 4 = 22$, so $6x - 1 = 17$ without finding $x$.
- Literal equations: isolate the letter you want exactly as you would a number; check with simple values.
- Check a solution by substituting it back into the original equation.`,
  },
  {
    id: 'alg.systems',
    area,
    unit: EQ,
    name: 'Systems of equations',
    summary: 'Two equations in two unknowns, combining equations, no or infinitely many solutions.',
    strategy: `Before solving, see whether adding or subtracting the equations gives what is asked.

- $3x + 2y = 17$ and $2x + 3y = 13$: adding gives $5x + 5y = 30$, so $x + y = 6$; subtracting gives $x - y = 4$.
- Elimination: multiply one equation so a variable cancels, then add.
- Products: from $xy^2 = a$ and $xy = b$, divide to get $y = \\frac{a}{b}$.
- Proportional left sides: same ratio on the right means infinitely many solutions; a different ratio means no solution.
- A nonlinear system (such as $xy = 8$, $x = y - 2$) can have two solutions: check both before answering a comparison.`,
  },
  {
    id: 'alg.quadratics',
    area,
    unit: EQ,
    name: 'Quadratic equations',
    summary: 'Factoring, roots, sum and product of roots, zero-product rule.',
    strategy: `Get 0 on one side, factor, and set each factor equal to 0.

- $(x - a)(x - b) = 0$ means $x = a$ or $x = b$: the roots have the opposite signs of the numbers in the factors.
- Never divide both sides by $x$: $x^2 = 5x$ has the two solutions 0 and 5.
- $x^2 = k$ (with $k > 0$) has two solutions, $\\sqrt{k}$ and $-\\sqrt{k}$.
- For $x^2 - sx + p = 0$ the roots add to $s$ and multiply to $p$.
- A fraction is 0 only where its numerator is 0 and its denominator is not.`,
  },
  // ---------------------------------------------------------------- Inequalities & functions
  {
    id: 'alg.inequalities',
    area,
    unit: IF,
    name: 'Inequalities',
    summary: 'Linear, compound and absolute value inequalities, integer solutions.',
    strategy: `Solve like an equation, but flip the inequality when you multiply or divide by a negative number.

- $-2x > 6$ gives $x < -3$.
- Compound: do the same step to all three parts of $-5 < 3 - 2x \\le 9$.
- $|x - a| < b$ means $a - b < x < a + b$; $|x - a| > b$ means $x < a - b$ or $x > a + b$.
- $x^2 < k$ means $-\\sqrt{k} < x < \\sqrt{k}$: count the negative integers and 0 as well.
- Greatest value of $x - y$: largest $x$ minus smallest $y$. For products, check every pair of endpoints.`,
  },
  {
    id: 'alg.functions',
    area,
    unit: IF,
    name: 'Functions & defined operations',
    summary: 'Evaluating functions, composition, tables, operations defined in the question.',
    strategy: `A function or a defined symbol is just a rule: substitute exactly what is in the parentheses.

- Substitute with parentheses: if $f(x) = x^2 - 3x$, then $f(-2) = (-2)^2 - 3(-2) = 10$.
- $f(g(3))$: work from the inside out, first $g(3)$, then $f$ of that.
- For $f\\left(\\frac{x + 1}{2}\\right) = \\ldots$, find the $x$ that makes the input equal to the number you need.
- "$a \\diamond b = a^2 - ab$" need not be symmetric: $a \\diamond b$ and $b \\diamond a$ can differ.
- $f(-x) = -f(x)$ (odd) for odd powers like $x^3$, $\\frac{x}{x^2 + 1}$; $f(-x) = f(x)$ (even) for $x^2$, $|x|$.`,
  },
  {
    id: 'alg.qc-algebra',
    area,
    unit: IF,
    name: 'Algebraic comparisons',
    summary: 'Quantitative comparisons with variables under a condition.',
    strategy: `Simplify the comparison: write "Quantity A ? Quantity B" and apply the same step to both sides.

- Adding or subtracting the same thing, or multiplying by a positive number, keeps the relationship; multiplying by a negative flips it. Squaring is not safe.
- Reduce to "$y$ ? $t$" and read the answer off the condition: if the condition puts $y$ on one side of $t$, the answer is determined; if not, it is D.
- $(x - h)^2 \\ge 0$: complete the square to compare $x^2 + p$ with $2hx + q$.
- Otherwise plug in special values allowed by the condition: 0, 1, a negative, a fraction, a large number. Two different results mean D.
- If the variables cancel completely, the answer is A, B or C, never D.`,
  },
];
