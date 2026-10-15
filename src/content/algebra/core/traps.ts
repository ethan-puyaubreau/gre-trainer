import type { Trap } from '../../../engine/types';

// Named mistakes for the core algebra skills. Ids start with "alg-". Shared arithmetic mistakes
// (square-of-sum, tested-one-value, fraction-power-grows, counted-endpoint) are reused from
// ../../arithmetic/traps.ts.
export const coreAlgebraTraps: Record<string, Trap> = {
  // ---------------------------------------------------------------- expressions
  'alg-qc-unsolvable-d': {
    label: 'One equation, two unknowns, so "cannot be determined"',
    fix: 'The question asks for an expression, not for each variable. Factor or rearrange the given equation to see whether it already fixes that expression.',
  },
  'alg-qc-variable-d': {
    label: 'Chose D because the quantities contain a variable',
    fix: 'Simplify the comparison first (subtract the same terms from both sides). If the variable cancels, or its sign is fixed by the condition, the answer is determined.',
  },
  'alg-dropped-factor': {
    label: 'Dropped a common factor',
    fix: 'When you factor $6x - 3y = 3(2x - y)$, keep the 3: every factor you pull out multiplies the result.',
  },
  'alg-middle-term-half': {
    label: '$(a + b)^2 = a^2 + ab + b^2$',
    fix: 'The middle term is $2ab$: $(a + b)^2 = a^2 + 2ab + b^2$ and $(a - b)^2 = a^2 - 2ab + b^2$.',
  },
  'alg-square-middle-sign': {
    label: 'Gave the middle term of a square the wrong sign',
    fix: '$(a - b)^2 = a^2 - 2ab + b^2$ and $(a + b)^2 = a^2 + 2ab + b^2$: the middle term has the sign of the sum or difference inside.',
  },
  'alg-conjugate-as-square': {
    label: 'Expanded $(a + b)(a - b)$ like a square',
    fix: 'The two factors differ in sign, so the middle terms cancel: $(a + b)(a - b) = a^2 - b^2$.',
  },
  'alg-foil-cross-terms': {
    label: 'Multiplied only the first terms and the last terms',
    fix: 'Every term of the first factor multiplies every term of the second: first, outer, inner, last.',
  },
  'alg-distribute-minus': {
    label: 'Changed the sign of only the first term after a minus',
    fix: 'A minus sign in front of parentheses changes the sign of EVERY term inside: $-(x^2 - 6x + 9) = -x^2 + 6x - 9$.',
  },
  'alg-power-difference': {
    label: '$b^{m} - b^{n} = b^{m - n}$',
    fix: 'Exponents subtract only when powers are divided. For a difference, factor out the smaller power: $b^{x + 2} - b^{x} = b^{x}(b^2 - 1)$.',
  },
  'alg-factor-dropped-one': {
    label: 'Lost the 1 when factoring out a power',
    fix: '$b^{n} = b^{n} \\cdot 1$, so $b^{n + 2} - b^{n} = b^{n}(b^{2} - 1)$, not $b^{n} \\cdot b^{2}$.',
  },
  'alg-power-base-mult': {
    label: '$4^{k} = 2 \\cdot 2^{k}$',
    fix: 'Rewrite the base as a power: $4 = 2^2$, so $4^{k} = (2^2)^{k} = 2^{2k} = (2^{k})^2$.',
  },
  'alg-factor-sign': {
    label: 'Wrong signs inside the factors',
    fix: 'Expand your factored form to check it: $(x - 3)(x + 5) = x^2 + 2x - 15$, while $(x + 3)(x - 5) = x^2 - 2x - 15$.',
  },
  'alg-reversed-factor': {
    label: '$(a - x) = (x - a)$',
    fix: '$a - x = -(x - a)$. Reversing one factor changes the sign of the product; reversing two factors does not.',
  },
  'alg-distribute-partial': {
    label: 'Multiplied only the first term',
    fix: 'A factor multiplies every term in the parentheses: $3(x - 4) = 3x - 12$, not $3x - 4$.',
  },
  'alg-factor-pair': {
    label: 'Right product, wrong sum',
    fix: 'To factor $x^2 + bx + c$ you need two numbers whose product is $c$ AND whose sum is $b$. Check the middle term.',
  },
  'alg-cancel-wrong-factor': {
    label: 'Cancelled the wrong factor',
    fix: 'Factor the numerator completely, then cancel only the factor that also appears in the denominator.',
  },
  // ---------------------------------------------------------------- exponents
  'alg-ignore-base': {
    label: 'Set exponents equal across different bases',
    fix: 'Exponents can be equated only when the bases are the same. First write every power with one base: $8^{x} = 2^{3x}$, $9^{x} = 3^{2x}$.',
  },
  'alg-exponent-order': {
    label: 'Subtracted the exponents in the wrong order',
    fix: '$\\frac{a^{m}}{a^{n}} = a^{m - n}$: the numerator exponent minus the denominator exponent.',
  },
  'alg-exponent-cancel': {
    label: 'Cancelled the wrong variable',
    fix: 'Subtract the whole exponents in parentheses: $(x - y) - (x + y) = -2y$. The $x$ terms cancel, not the $y$ terms.',
  },
  'alg-exponent-product': {
    label: 'Multiplied exponents when dividing',
    fix: 'Dividing powers of the same base subtracts the exponents; only a power of a power multiplies them.',
  },
  'alg-exponent-ratio-inverted': {
    label: 'Inverted the ratio of the exponents',
    fix: 'From $2^{3m} = 2^{4t}$ you get $3m = 4t$, so $m = \\frac{4t}{3}$. Check with a value: $t = 3$ gives $m = 4$.',
  },
  'alg-exponent-difference-added': {
    label: 'Matched the exponents by adding instead of multiplying',
    fix: 'Rewriting $16^{t}$ as $2^{4t}$ multiplies the exponent by 4; it does not add anything to it.',
  },
  'alg-exponent-distribute': {
    label: 'Multiplied only part of the exponent',
    fix: '$(2^{2})^{n + 1} = 2^{2(n + 1)} = 2^{2n + 2}$: the outer exponent multiplies the whole inner exponent.',
  },
  'alg-exponent-add-as-sum': {
    label: '$a^{m + n} = a^{m} + a^{n}$',
    fix: 'A sum in the exponent means a PRODUCT of powers: $a^{m + n} = a^{m} \\cdot a^{n}$.',
  },
  'alg-exponent-add-as-mult': {
    label: '$a^{m + n} = (a^{m})^{n}$',
    fix: '$(a^{m})^{n} = a^{mn}$; a sum in the exponent comes from a product $a^{m} \\cdot a^{n}$.',
  },
  'alg-power-sum': {
    label: '$2^{k} + 2^{k} = 4^{k}$',
    fix: 'Adding equal powers just doubles: $2^{k} + 2^{k} = 2 \\cdot 2^{k} = 2^{k + 1}$, while $4^{k} = 2^{2k}$.',
  },
  'alg-assumed-x-gt-1': {
    label: 'Assumed $x$ is greater than 1',
    fix: 'If the condition allows $0 < x < 1$, test a fraction such as $x = \\frac{1}{2}$ too: higher powers of a fraction are smaller.',
  },
  // ---------------------------------------------------------------- linear equations
  'alg-move-term-sign': {
    label: 'Moved a term across the equals sign without changing its sign',
    fix: 'Moving a term to the other side means subtracting it from (or adding it to) both sides: $5x + 3 = 2x - 9$ becomes $5x - 2x = -9 - 3$.',
  },
  'alg-dropped-term': {
    label: 'Dropped a term while collecting',
    fix: 'Every term of the equation must appear after each step. When you finish, substitute your answer in the ORIGINAL equation.',
  },
  'alg-lcd-partial': {
    label: 'Multiplied only some terms by the common denominator',
    fix: 'Clearing fractions multiplies EVERY term of both sides, including the whole numbers on the right.',
  },
  'alg-fraction-add-denominators': {
    label: '$\\frac{x}{a} + \\frac{x}{b} = \\frac{x}{a + b}$',
    fix: 'Add fractions over a common denominator: $\\frac{x}{3} + \\frac{x}{6} = \\frac{2x}{6} + \\frac{x}{6} = \\frac{x}{2}$.',
  },
  'alg-cross-multiply-wrong': {
    label: 'Multiplied each numerator by its own denominator',
    fix: 'Cross-multiplying $\\frac{A}{a} = \\frac{B}{b}$ gives $bA = aB$: each numerator times the OTHER denominator.',
  },
  'alg-shortcut-constant': {
    label: 'Mishandled the constant when scaling the equation',
    fix: 'Scale the whole equation first: $3x + 2 = 11$ gives $6x + 4 = 22$. Then adjust: $6x - 1 = 22 - 5 = 17$.',
  },
  'alg-sign-slip': {
    label: 'Lost a minus sign',
    fix: 'Collect the terms carefully, then test your relation with numbers that satisfy the original equation.',
  },
  'alg-swapped-coefficients': {
    label: 'Swapped the coefficients',
    fix: 'Keep each coefficient with its own letter, and check the result by plugging in simple numbers.',
  },
  'alg-undo-order': {
    label: 'Undid the operations in the wrong order',
    fix: 'To solve $y = \\frac{px + q}{r}$ for $x$, undo the LAST operation first: multiply by $r$, then subtract $q$, then divide by $p$.',
  },
  'alg-inverse-operation': {
    label: 'Used the wrong inverse operation',
    fix: 'To undo a division by $r$, MULTIPLY by $r$; to undo a multiplication, divide. Test the result with a number.',
  },
  'alg-divide-partial': {
    label: 'Divided only one term',
    fix: 'Dividing both sides by $p$ divides EVERY term: $\\frac{ry - q}{p} = \\frac{ry}{p} - \\frac{q}{p}$.',
  },
  'alg-factor-skipped': {
    label: 'Stopped before dividing by the factor taken out of $x$',
    fix: 'From $x(y - 1) = qy + p$, divide both sides by $y - 1$: $x = \\frac{qy + p}{y - 1}$.',
  },
  'alg-reciprocal-sum': {
    label: '$\\frac{1}{a} + \\frac{1}{b} = \\frac{1}{a + b}$',
    fix: '$\\frac{1}{a} + \\frac{1}{b} = \\frac{a + b}{ab}$. Taking reciprocals of a sum term by term is not allowed.',
  },
  'alg-forgot-reciprocal': {
    label: 'Found $\\frac{1}{c}$ instead of $c$',
    fix: 'After combining the fractions you have $\\frac{1}{c}$; flip both sides to get $c$.',
  },
  // ---------------------------------------------------------------- systems
  'alg-answered-one-variable': {
    label: 'Gave the value of one variable',
    fix: 'Reread what is asked: the question wants a combination such as $x + y$, which you can often get directly by adding or subtracting the equations.',
  },
  'alg-forgot-divide': {
    label: 'Forgot to divide after combining the equations',
    fix: 'Adding $3x + 2y = 17$ and $2x + 3y = 13$ gives $5x + 5y = 30$; divide by 5 to get $x + y = 6$.',
  },
  'alg-answered-other-variable': {
    label: 'Found the other variable',
    fix: 'After dividing the equations you usually get the second variable first; substitute it back to find the one that is asked.',
  },
  'alg-divided-wrong-way': {
    label: 'Divided the equations in the wrong order',
    fix: 'Write the division out: $\\frac{xy^2}{xy} = y$, so $y = \\frac{\\text{first value}}{\\text{second value}}$, not the reciprocal.',
  },
  'alg-forgot-root': {
    label: 'Forgot to take the root',
    fix: 'Undo a power with the matching root: $(xy)^3 = 216$ gives $xy = 6$, and $(x - 2)^2 = 9$ gives $x - 2 = 3$ or $x - 2 = -3$.',
  },
  'alg-found-one-solution': {
    label: 'Used only one solution of the system',
    fix: 'A system with a product such as $xy = 8$ can have two solutions. Find both and check the comparison for each.',
  },
  'alg-dependent-system': {
    label: 'Treated two equivalent equations as two different ones',
    fix: 'If one equation is a multiple of the other, they describe the same line: infinitely many solutions, so $x$ and $y$ are not determined (but the left side is).',
  },
  'alg-proportional-sign': {
    label: 'Sign error in the proportional coefficients',
    fix: 'Find the factor from a pair of matching coefficients, sign included: if $-4y$ corresponds to $2y$, the factor is $-2$.',
  },
  'alg-ratio-inverted': {
    label: 'Used the scale factor upside down',
    fix: 'If the second equation is $m$ times the first, each of its coefficients is $m$ times the matching coefficient, not divided by $m$.',
  },
  'alg-ignored-scaling': {
    label: 'Ignored the factor between the equations',
    fix: 'For infinitely many solutions the whole second equation, constant included, must be the same multiple of the first.',
  },
  // ---------------------------------------------------------------- quadratics
  'alg-vieta-sign': {
    label: 'Wrong sign for the sum of the roots',
    fix: 'For $x^2 - sx + p = 0$ the roots add to $s$ (the opposite of the $x$ coefficient) and multiply to $p$. Check with the factored form.',
  },
  'alg-root-sign': {
    label: 'Read the roots off the factors with the wrong sign',
    fix: '$(x - 5)(x + 3) = 0$ gives $x = 5$ or $x = -3$: each root has the opposite sign of the number in its factor.',
  },
  'alg-zero-product-nonzero': {
    label: 'Used the zero-product rule with a nonzero right side',
    fix: '$x(x - 2) = 15$ does NOT mean $x = 15$ or $x - 2 = 15$. Expand, move everything to one side ($x^2 - 2x - 15 = 0$), then factor.',
  },
  'alg-divided-by-variable': {
    label: 'Divided both sides by $x$ and lost the solution $x = 0$',
    fix: 'Never divide by an expression that can be 0. Write $x^2 - 5x = 0$ as $x(x - 5) = 0$: both $x = 0$ and $x = 5$ work.',
  },
  'alg-square-root-one-sign': {
    label: 'Took only the positive square root',
    fix: '$x^2 = 25$ has two solutions, $x = 5$ and $x = -5$.',
  },
  'alg-denominator-root': {
    label: 'Kept a value that makes the denominator 0',
    fix: 'A fraction is 0 only where the numerator is 0 AND the denominator is not. Cross out any root of the numerator that is also a root of the denominator.',
  },
  'alg-qc-two-values-d': {
    label: 'Chose D because $x$ has two possible values',
    fix: 'Two values do not automatically mean D: if both are greater (or both are less) than Quantity B, the answer is determined.',
  },
  // ---------------------------------------------------------------- inequalities
  'alg-no-flip': {
    label: 'Did not flip the inequality after dividing by a negative',
    fix: 'Multiplying or dividing both sides by a negative number reverses the inequality: $-3x > 12$ gives $x < -4$.',
  },
  'alg-strict-endpoint': {
    label: 'Mixed up strict and non-strict inequalities',
    fix: '$<$ and $>$ exclude the endpoint; $\\le$ and $\\ge$ include it. For integers, $x < 5$ means $x \\le 4$.',
  },
  'alg-count-positive-only': {
    label: 'Counted only the positive integers',
    fix: '$x^2 < 10$ also holds for negative $x$ and for 0: the solutions are $-3, -2, -1, 0, 1, 2, 3$.',
  },
  'alg-count-forgot-zero': {
    label: 'Forgot to count 0',
    fix: 'Zero is an integer. Between $-3$ and $3$ inclusive there are 7 integers, not 6.',
  },
  'alg-count-to-k': {
    label: 'Counted up to $k$ instead of $\\sqrt{k}$',
    fix: '$x^2 < k$ bounds $x$ by $\\sqrt{k}$, not by $k$: $x^2 < 20$ allows $|x| \\le 4$.',
  },
  'alg-count-off-by-one': {
    label: 'Off by one when counting integers',
    fix: 'From $a$ to $b$ inclusive there are $b - a + 1$ integers; strictly between them there are $b - a - 1$.',
  },
  'alg-abs-drop-bars': {
    label: 'Treated $|m + k|$ as $m + k$',
    fix: 'The absolute value changes the sign of a negative inside: $|m + k| = -(m + k)$ when $m + k < 0$. Test a value that makes the inside negative.',
  },
  'alg-range-subtract': {
    label: 'Combined the endpoints without thinking about signs',
    fix: 'For the greatest $x - y$, take the LARGEST $x$ and the SMALLEST $y$: subtracting a small number leaves more.',
  },
  'alg-range-product': {
    label: 'Multiplied the largest (or smallest) endpoints only',
    fix: 'With negative numbers in a range, check all four endpoint products: for $-7 \\le x \\le 4$ and $-2 \\le y \\le 3$, the greatest $xy$ is $(-7)(-2) = 14$, not $(4)(3) = 12$.',
  },
  'alg-range-square': {
    label: 'Squared the wrong endpoint',
    fix: '$x^2$ grows with the distance from 0: on $-7 \\le x \\le 3$ the greatest $x^2$ is 49, and the least is 0 (at $x = 0$).',
  },
  'alg-magnitude-vs-value': {
    label: 'Ordered by size and ignored the signs',
    fix: 'A negative number is less than any positive one, and among negatives the one with the larger size is smaller: $-\\frac{1}{2} < -\\frac{1}{8}$.',
  },
  'alg-order-reversed': {
    label: 'Listed the order backwards',
    fix: 'The question asks from least to greatest: start with the most negative value.',
  },
  // ---------------------------------------------------------------- functions
  'alg-composition-order': {
    label: 'Composed the functions in the wrong order',
    fix: '$f(g(3))$ means: compute $g(3)$ first, then apply $f$ to that result. $g(f(3))$ is usually different.',
  },
  'alg-composition-product': {
    label: 'Multiplied the functions instead of composing them',
    fix: '$f(g(x))$ feeds the output of $g$ into $f$; it is not $f(x) \\cdot g(x)$.',
  },
  'alg-composition-inner-only': {
    label: 'Applied only one of the two functions',
    fix: 'A composition uses both rules: find the inner value, then apply the outer function to it.',
  },
  'alg-substitute-negative': {
    label: 'Squared a negative number without parentheses',
    fix: 'Substitute with parentheses: if $a = -3$, then $a^2 = (-3)^2 = 9$, not $-9$.',
  },
  'alg-assumed-commutative': {
    label: 'Assumed the order of the inputs does not matter',
    fix: 'A defined operation such as $a \\diamond b = a^2 - ab$ need not be symmetric. Compute $a \\diamond b$ and $b \\diamond a$ separately.',
  },
  'alg-linear-as-proportional': {
    label: 'Treated a linear function as proportional',
    fix: 'A linear function $f(x) = mx + b$ is proportional only when $b = 0$. Find the slope from two rows, then the intercept.',
  },
  'alg-forgot-intercept': {
    label: 'Used the slope but forgot the intercept',
    fix: 'After finding the slope $m$, find $b$ from one row of the table: $f(x) = mx + b$.',
  },
  'alg-matched-one-row': {
    label: 'Checked the rule on only one row of the table',
    fix: 'A rule must fit EVERY pair in the table. Many rules fit one point; test each candidate on all the rows.',
  },
  'alg-step-count': {
    label: 'Counted the steps wrongly',
    fix: 'If the rule moves $x$ by $p$ each time, going from $a$ to $b$ takes $\\frac{b - a}{p}$ steps, not $b - a$.',
  },
  'alg-growth-linear': {
    label: 'Added instead of multiplying at each step',
    fix: 'If each step multiplies the value by $r$, after $n$ steps the value is multiplied by $r^n$, not by $rn$.',
  },
  'alg-substitute-directly': {
    label: 'Substituted the number into the rule directly',
    fix: 'For $f\\left(\\frac{x + 3}{2}\\right) = x^2$, the rule is in terms of $x$. Find the $x$ that makes the input equal to the number you want, then evaluate.',
  },
  'alg-even-vs-odd': {
    label: 'Confused $f(-x) = f(x)$ with $f(-x) = -f(x)$',
    fix: 'Even functions (like $x^2$, $|x|$) satisfy $f(-x) = f(x)$; odd functions (like $x^3$, $\\frac{x}{x^2 + 1}$) satisfy $f(-x) = -f(x)$.',
  },
  'alg-parity-mixed': {
    label: 'Missed that the formula mixes odd and even parts',
    fix: 'A sum such as $x^3 + 2$ or $x^2 + x$ has a part that changes sign and a part that does not, so it is neither odd nor even.',
  },
  // ---------------------------------------------------------------- algebraic comparisons
  'alg-strict-vs-equal': {
    label: 'Missed the case where the quantities are equal',
    fix: '$(x - h)^2 \\ge 0$, not $> 0$: at $x = h$ the difference is 0. Equal for one value and greater for others means D.',
  },
  'alg-square-bigger': {
    label: 'Assumed the expression with $x^2$ is the larger one',
    fix: 'A square term does not make an expression bigger for every $x$. Rewrite the difference (complete the square) or test $x = 0$, $x = 1$ and a negative value.',
  },
  'alg-cross-multiply-sign': {
    label: 'Cross-multiplied without checking the signs of the denominators',
    fix: 'Multiplying a comparison by a negative number reverses it. Subtract the fractions instead, or check the sign of each denominator first.',
  },
  'alg-same-numbers-equal': {
    label: 'Assumed equal because both use the same numbers',
    fix: 'Expand and cancel what is common: $(x + 4)(y + 3) - (x + 3)(y + 4) = y - x$, which depends on $x$ and $y$.',
  },
  'alg-translation-slip': {
    label: 'Applied "twice" to only part of the quantity',
    fix: 'Translate exactly: "twice the age in 5 years" is $2(p + 5) = 2p + 10$, not $2p + 5$.',
  },
  'alg-percent-as-number': {
    label: 'Read "$x$ percent" as $x$',
    fix: '$x$ percent means $\\frac{x}{100}$: $x$ percent of $200x$ is $\\frac{x}{100} \\cdot 200x = 2x^2$.',
  },
  'alg-translation-direction': {
    label: 'Reversed "more than" when translating',
    fix: '"12 more teachers than students" means teachers $=$ students $+ 12$, so students $=$ teachers $- 12$. Check with numbers.',
  },
};
