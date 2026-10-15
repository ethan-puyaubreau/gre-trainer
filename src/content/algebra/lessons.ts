import type { Lesson } from '../lessons';

export const algebraLessons: Record<string, Lesson> = {
  'alg.expressions': {
    idea: 'Before you solve anything, rewrite what you are given in the form the question asks about: factor it, expand it, or square it. A common factor or a special product often turns a messy expression into a short one.',
    recognize:
      'If you see a difference of squares, a squared sum, or a factor shared by every term, think: factor or expand. If the question asks for one expression in two unknowns, think: that expression may be fixed even when each variable is not.',
    example: {
      problem: 'If $x^2 - y^2 = 40$ and $x + y = 8$, what is the value of $x - y$?',
      steps: [
        '$x^2 - y^2 = (x + y)(x - y)$, because a difference of squares always factors this way.',
        'Substitute $x + y = 8$ to get $8(x - y) = 40$, because the given sum now appears as a factor.',
        'Divide both sides by 8: $x - y = 5$, because only this combination was asked for, not each variable.',
      ],
      answer: '$5$ (check: $x = 6.5$ and $y = 1.5$ satisfy both equations).',
    },
    traps: ['alg-qc-unsolvable-d', 'alg-middle-term-half', 'alg-distribute-minus'],
  },
  'alg.exponent-equations': {
    idea: 'Write every power with the same base, then compare the exponents. Numbers such as 4, 8 and 16 are hidden powers of 2, and 9 and 27 are hidden powers of 3.',
    recognize:
      'If you see an equation with different bases like 4 and 8, think: rewrite both as powers of 2. If you see a sum of equal powers such as $2^k + 2^k$, think: that is a doubling, so $2^{k + 1}$.',
    example: {
      problem: 'If $4^{x} = 8^{x - 2}$, what is the value of $x$?',
      steps: [
        'Write $4 = 2^2$ and $8 = 2^3$, because exponents can be compared only when the bases are the same.',
        'Then $2^{2x} = 2^{3(x - 2)}$, because a power of a power multiplies the exponents, and the 3 multiplies the whole $x - 2$.',
        'Set the exponents equal: $2x = 3x - 6$, because equal powers of 2 have equal exponents.',
        'Subtract $2x$ from both sides: $0 = x - 6$, so $x = 6$, because that leaves the variable alone.',
      ],
      answer: '$x = 6$ (check: $4^6 = 4096 = 8^4$).',
    },
    traps: ['alg-ignore-base', 'alg-exponent-distribute', 'alg-power-sum'],
  },
  'alg.linear-equations': {
    idea: 'Do the same thing to both sides until the variable stands alone. With fractions, multiply EVERY term by the common denominator so that none is left behind. Then check the answer by substituting it back into the original equation.',
    recognize:
      'If you see fractions in an equation, think: multiply through by the common denominator. If the question asks for an expression like $6x - 1$ instead of $x$, think: scale the given equation to match it, with no solving needed.',
    example: {
      problem: 'If $\\frac{x}{4} + \\frac{x}{6} = 5$, what is the value of $x$?',
      steps: [
        'Multiply every term by 12: $3x + 2x = 60$, because 12 is the common denominator and the 5 must be multiplied too.',
        'Combine like terms: $5x = 60$, because $3x + 2x = 5x$.',
        'Divide both sides by 5: $x = 12$, because dividing by the coefficient isolates $x$.',
      ],
      answer: '$x = 12$ (check: $\\frac{12}{4} + \\frac{12}{6} = 3 + 2 = 5$).',
    },
    traps: ['alg-lcd-partial', 'alg-fraction-add-denominators', 'alg-move-term-sign'],
  },
  'alg.systems': {
    idea: 'Look at what the question asks before you solve. Adding or subtracting the two equations often gives the requested sum or difference directly, with no need to find each variable.',
    recognize:
      'If you see two equations with the coefficients of $x$ and $y$ swapped, think: add them, then subtract them. If one left side is a multiple of the other, think: no solution or infinitely many, depending on the right sides.',
    example: {
      problem: 'If $4x + 3y = 29$ and $3x + 4y = 27$, what is the value of $x + y$?',
      steps: [
        'Add the equations: $7x + 7y = 56$, because the coefficients of $x$ and $y$ become equal, which is the combination asked for.',
        'Divide by 7: $x + y = 8$, because $7x + 7y = 7(x + y)$.',
        'To check, subtract instead: $x - y = 2$, so $x = 5$ and $y = 3$, because these values must satisfy both original equations.',
      ],
      answer: '$8$',
    },
    traps: ['alg-forgot-divide', 'alg-answered-one-variable', 'alg-dependent-system'],
  },
  'alg.quadratics': {
    idea: 'Get 0 on one side, factor, and set each factor equal to 0. A product is zero only when one of its factors is zero, so the rule works only after the other side has been cleared to 0.',
    recognize:
      'If you see $x^2$ together with an $x$ term, think: move everything to one side and factor. If you see $x(x - 2) = 15$, think: the right side is not 0, so expand first.',
    example: {
      problem: 'What are all the solutions of $x^2 - 3x = 10$?',
      steps: [
        'Subtract 10 from both sides: $x^2 - 3x - 10 = 0$, because the zero-product rule needs 0 on one side.',
        'Factor: $(x - 5)(x + 2) = 0$, because $-5$ and $2$ multiply to $-10$ and add to $-3$.',
        'Set each factor to 0: $x = 5$ or $x = -2$, because a product is 0 only when a factor is 0, and each root has the opposite sign of the number in its factor.',
      ],
      answer: '$x = 5$ or $x = -2$ (check: $25 - 15 = 10$ and $4 + 6 = 10$).',
    },
    traps: ['alg-zero-product-nonzero', 'alg-root-sign', 'alg-divided-by-variable'],
  },
  'alg.inequalities': {
    idea: 'Solve like an equation, but reverse the inequality sign whenever you multiply or divide by a negative number. In a compound inequality, do every step to all three parts.',
    recognize:
      'If you see "how many integers", think: solve, then ask whether each endpoint is included. If you see $|x - a| < b$, think: $x$ lies between $a - b$ and $a + b$. If you see a product of two ranges, think: check every pair of endpoints.',
    example: {
      problem: 'How many integers $x$ satisfy $-7 < 5 - 2x \\le 3$?',
      steps: [
        'Subtract 5 from all three parts: $-12 < -2x \\le -2$, because every step must be applied to every part.',
        'Divide all parts by $-2$ and reverse both signs: $6 > x \\ge 1$, because dividing by a negative flips the inequality.',
        'Read it as $1 \\le x < 6$: the integers are 1, 2, 3, 4 and 5, because 1 is included but 6 is not.',
      ],
      answer: '$5$ integers.',
    },
    traps: ['alg-no-flip', 'alg-strict-endpoint', 'alg-count-off-by-one'],
  },
  'alg.functions': {
    idea: 'A function is a rule: replace the input by exactly what stands in the parentheses, and keep parentheses around negative values. For $f(g(x))$, work from the inside out.',
    recognize:
      'If you see $f(g(3))$, think: compute $g(3)$ first. If you see a symbol such as $a \\diamond b$ defined by a formula, think: substitute in the order written, since $a \\diamond b$ and $b \\diamond a$ may differ. If you see $f(-x)$, think: even functions like $x^2$ give back $f(x)$, odd functions like $x^3$ give $-f(x)$.',
    example: {
      problem: 'If $f(x) = x^2 - 4x$ and $g(x) = 2x + 1$, what is the value of $f(g(-1))$?',
      steps: [
        'Compute the inner function first: $g(-1) = 2(-1) + 1 = -1$, because $f$ needs the output of $g$ as its input.',
        'Substitute into $f$ with parentheses: $f(-1) = (-1)^2 - 4(-1) = 1 + 4 = 5$, because the whole negative number is squared.',
      ],
      answer: '$5$. The other order gives $g(f(-1)) = g(5) = 11$, so the order matters.',
    },
    traps: ['alg-composition-order', 'alg-substitute-negative', 'alg-assumed-commutative'],
  },
  'alg.qc-algebra': {
    idea: 'Simplify the comparison by applying the same step to both quantities, then use the condition to decide. The answer is D only when the condition leaves the result open.',
    recognize:
      'If you see two expressions with a variable and a condition, think: cancel what they share, then compare what remains with the values the condition allows. If the variable cancels completely, think: A, B or C, never D.',
    example: {
      problem: 'Given that $x > 2$, compare Quantity A, $2x + 9$, with Quantity B, $x + 11$.',
      steps: [
        'Subtract $x$ from both quantities: A becomes $x + 9$ and B becomes 11, because subtracting the same amount keeps the relationship.',
        'Subtract 9 from both: compare $x$ with 2, because now only the variable is left.',
        'The condition says $x > 2$, so A is greater, because the condition settles which side of 2 the variable is on.',
      ],
      answer: 'A. With the condition $x > 0$ instead, $x$ could be on either side of 2 and the answer would be D.',
    },
    traps: ['alg-qc-variable-d', 'alg-strict-vs-equal', 'alg-square-bigger'],
  },
  'alg.coordinate': {
    idea: 'Slope is rise over run, and a line is $y = mx + b$. To find the intercept $b$, substitute a point that lies on the line; to compare lines, compare their slopes.',
    recognize:
      'If you see "parallel", think: same slope. If you see "perpendicular", think: slopes $m$ and $-\\frac{1}{m}$. If you see "passes through a point", think: substitute that point into $y = mx + b$.',
    example: {
      problem: 'A line is perpendicular to $y = 2x + 3$ and passes through $(4, 1)$. What is its $y$-intercept?',
      steps: [
        'The given slope is 2, so the perpendicular slope is $-\\frac{1}{2}$, because perpendicular slopes multiply to $-1$.',
        'Write $y = -\\frac{1}{2}x + b$ and substitute $(4, 1)$: $1 = -2 + b$, because a point on the line must satisfy its equation.',
        'Add 2 to both sides: $b = 3$, because that leaves $b$ alone.',
      ],
      answer: '$3$ (check: at $x = 4$ the line gives $-2 + 3 = 1$).',
    },
    traps: ['algw-perp-no-sign', 'algw-intercept-sign', 'algw-swap-coordinates'],
  },
  'alg.graphs': {
    idea: 'A graph is the set of points $(x, f(x))$, so $f(a)$ is the height of the graph above $x = a$. A parabola is symmetric about its axis, and its vertex is its highest or lowest point.',
    recognize:
      'If you see the greatest or least value of a quadratic, think: vertex. If you see two graphs meeting, think: set the two expressions equal. If you see a region, think: test the point in EVERY inequality.',
    example: {
      problem: 'What is the greatest value of $y = -x^2 + 6x + 1$?',
      steps: [
        'Since $a = -1 < 0$, the parabola opens downward, because then the vertex is the highest point.',
        'Find the axis: $x = -\\frac{b}{2a} = -\\frac{6}{2(-1)} = 3$, because the vertex lies on the axis of symmetry.',
        'Substitute $x = 3$: $y = -9 + 18 + 1 = 10$, because the height at the vertex is the value of the function there.',
      ],
      answer: '$10$ (reached at $x = 3$, not at the $y$-intercept, where $y = 1$).',
    },
    traps: ['algw-vertex-sign', 'algw-min-at-intercept', 'algw-parabola-monotone'],
  },
  'alg.sequences': {
    idea: 'Count steps, not terms: from term 1 to term $n$ there are $n - 1$ steps. An arithmetic sequence adds the same $d$ at every step, a geometric sequence multiplies by the same $r$.',
    recognize:
      'If you see two known terms, think: the steps between them give $d$. If you see a sum of consecutive terms, think: there are $n - m + 1$ terms, and the sum is that number times (first + last) $\\div 2$.',
    example: {
      problem: 'In an arithmetic sequence, $a_3 = 11$ and $a_8 = 31$. What is $a_{20}$?',
      steps: [
        'From $a_3$ to $a_8$ there are $8 - 3 = 5$ steps, because the number of steps is the difference of the positions, not the count of terms.',
        'So $d = \\frac{31 - 11}{5} = 4$, because the 5 equal steps add up to the total change of 20.',
        'From $a_8$ to $a_{20}$ there are 12 steps: $a_{20} = 31 + 12 \\cdot 4 = 79$, because each step adds $d$.',
      ],
      answer: '$79$ (check: $a_1 = 3$, and $3 + 19 \\cdot 4 = 79$).',
    },
    traps: ['algw-seq-steps', 'algw-seq-off-by-one', 'algw-seq-count-terms'],
  },
  'alg.word-problems': {
    idea: 'Name the unknown, translate one sentence at a time into an equation, then reread the question to see which quantity is asked. Test the direction of every comparison with small numbers.',
    recognize:
      'If you see "$k$ more than twice $y$", think: $2y + k$. If you see two kinds of items with a total count and a total value, think: one count equation and one value equation.',
    example: {
      problem:
        'A school sells 40 tickets: student tickets cost 5 dollars and adult tickets cost 8 dollars. The sales total 260 dollars. How many adult tickets were sold?',
      steps: [
        'Let $a$ be the number of adult tickets, so $40 - a$ are student tickets, because the two counts add up to 40.',
        'Write the value equation: $5(40 - a) + 8a = 260$, because the money from both kinds adds up to 260.',
        'Simplify: $200 + 3a = 260$, so $a = 20$, because $-5a + 8a = 3a$ and $260 - 200 = 60$.',
      ],
      answer: '$20$ adult tickets (check: $20 \\cdot 5 + 20 \\cdot 8 = 260$).',
    },
    traps: ['algw-answered-other-unknown', 'algw-more-than-order', 'algw-more-than-direction'],
  },
  'alg.rate-work': {
    idea: 'Work with rates, the part of the job done in one hour: rates add when workers cooperate, times do not. Working together is always faster than the faster worker alone.',
    recognize:
      'If you see "together", "fill" or "drain", think: add or subtract rates. If you see a trip out and back, think: average speed is total distance divided by total time, not the average of the speeds.',
    example: {
      problem: 'Pump A fills a tank in 10 hours and pump B fills it in 15 hours. How long do they take together?',
      steps: [
        'Pump A fills $\\frac{1}{10}$ of the tank per hour and B fills $\\frac{1}{15}$, because rate is the job divided by the time.',
        'Add the rates: $\\frac{1}{10} + \\frac{1}{15} = \\frac{3}{30} + \\frac{2}{30} = \\frac{1}{6}$, because the two pumps work at the same time.',
        'Invert: $T = 6$ hours, because a rate of $\\frac{1}{6}$ of the tank per hour fills the whole tank in 6 hours.',
      ],
      answer: '$6$ hours, less than both 10 and 15, as it must be.',
    },
    traps: ['algw-add-times', 'algw-average-times', 'algw-average-speeds'],
  },
  'alg.mixtures-interest': {
    idea: 'Track the amount of the pure substance, because adding water does not change it: concentration is substance divided by total. For compound interest, each period multiplies the amount by $1 + r$.',
    recognize:
      'If you see two solutions mixed, think: add the amounts of substance, never average the percents. If you see interest earning interest, think: $P(1 + r)^n$, which beats simple interest $P(1 + rn)$ once $n \\ge 2$.',
    example: {
      problem: 'How many liters of water must be added to 20 liters of a 30 percent salt solution to make a 20 percent solution?',
      steps: [
        'The original solution holds $0.30 \\cdot 20 = 6$ liters of salt, because concentration times volume gives the amount of salt.',
        'Water adds no salt, so 6 is 20 percent of the new total: $0.20T = 6$ and $T = 30$, because the amount of salt stays the same.',
        'Water added: $30 - 20 = 10$ liters, because the new total includes the original 20 liters.',
      ],
      answer: '$10$ liters (check: $\\frac{6}{30}$ is 20 percent).',
    },
    traps: ['algw-total-vs-added', 'algw-average-percents', 'algw-simple-for-compound'],
  },
};
