import type { Lesson } from '../lessons';

export const arithmeticLessons: Record<string, Lesson> = {
  'arith.divisibility': {
    idea: 'Saying "$n$ leaves remainder $r$ when divided by $d$" is the equation $n = dk + r$ with $0 \\le r < d$. Every conclusion about $n$ comes from that equation.',
    recognize: 'If you see "leaves a remainder", "is a multiple of" or "must divide $n$", write $n = dk + r$ first, then ask what $d$ and $r$ have in common.',
    example: {
      problem: 'A positive integer $n$ leaves remainder 4 when divided by 10. Which of 2, 4 and 5 must divide $n$ for every such $n$?',
      steps: [
        'Translate: $n = 10k + 4$ for some integer $k \\ge 0$, because that is what remainder 4 on division by 10 means.',
        'Factor: $10k + 4 = 2(5k + 2)$. The number 2 divides both 10 and 4, so it divides the whole sum.',
        'Test $k = 0$ and $k = 1$: $n = 4$ and $n = 14$. Since 4 is not divisible by 5 and 14 is not divisible by 4, those two are out, because one counterexample is enough to defeat a "must" claim.',
      ],
      answer: 'Only 2 must divide $n$.',
    },
    traps: ['int-divides-divisor-only', 'int-divides-remainder-only', 'int-remainder-not-reduced'],
  },

  'arith.primes': {
    idea: 'The number 2 is the only even prime, and 1 is not prime. Odd/even rules then tell you which primes a sum can use.',
    recognize: 'If you see "sum of two primes", "is prime" or odd and even integers, ask: is the total odd, which would force one prime to be 2? Is the number really prime, or just odd?',
    example: {
      problem: 'Which of 21 and 23 can be written as the sum of two primes?',
      steps: [
        'Both totals are odd, so one prime must be even, because odd + odd and even + even are both even.',
        'The only even prime is 2, so the other prime must be $n - 2$.',
        'Test $21 - 2 = 19$: the primes up to $\\sqrt{19}$ are 2 and 3, and neither divides 19, so 19 is prime. Test $23 - 2 = 21 = 3 \\cdot 7$, which is not prime.',
      ],
      answer: '$21 = 2 + 19$ works; 23 does not.',
    },
    traps: ['forgot-two-is-prime', 'int-odd-composite-as-prime', 'one-is-prime'],
  },

  'arith.factors': {
    idea: 'Break a number into primes, $N = p^a q^b \\cdots$. A divisor picks an exponent from $0$ to $a$ for $p$, from $0$ to $b$ for $q$, and so on, so $N$ has $(a + 1)(b + 1)\\cdots$ divisors.',
    recognize: 'If you see "how many divisors", "factors of $N$" or a product of unknown integers, think prime factorization. Isolate the product and apply every condition before you count.',
    example: {
      problem: 'How many positive divisors does 72 have?',
      steps: [
        'Factor: $72 = 8 \\cdot 9 = 2^3 \\cdot 3^2$, because primes are the building blocks of every divisor.',
        'A divisor uses 2 to the power 0, 1, 2 or 3 (4 choices) and 3 to the power 0, 1 or 2 (3 choices). Any other prime or larger power would not divide 72.',
        'Multiply the independent choices: $4 \\cdot 3 = 12$. This count already includes 1 and 72 themselves.',
      ],
      answer: '72 has 12 positive divisors.',
    },
    traps: ['int-divisors-exponents', 'int-divisors-missed-ends', 'int-forgot-greater-than-one'],
  },

  'arith.lcm-gcd': {
    idea: 'Prime factors build both. The LCM takes every prime at its highest power, the GCD only the shared primes at their lowest power. Check with $\\text{GCD} \\times \\text{LCM} = ab$.',
    recognize: '"Together again", "every 12 minutes" and "smallest number divisible by" mean LCM. "Largest equal groups" and "greatest length that fits all" mean GCD.',
    example: {
      problem: 'Two buses leave a station together at 8:00. One leaves every 12 minutes, the other every 18 minutes. When do they next leave together?',
      steps: [
        'This is an LCM question, because the buses coincide exactly at common multiples of 12 and 18.',
        'Factor: $12 = 2^2 \\cdot 3$ and $18 = 2 \\cdot 3^2$. Take each prime at its highest power: $2^2 \\cdot 3^2 = 36$.',
        'Check: $36 = 3 \\cdot 12 = 2 \\cdot 18$, and nothing smaller is a multiple of both. Thirty-six minutes after 8:00 is 8:36.',
      ],
      answer: 'They next leave together at 8:36.',
    },
    traps: ['int-lcm-is-product', 'int-gcd-lcm-swapped', 'int-lcm-two-only'],
  },

  'arith.cycles': {
    idea: 'A repeating pattern has a cycle length $L$. Only the remainder of the position divided by $L$ matters, and a remainder of 0 means the LAST element of the cycle.',
    recognize: 'If you see a repeating decimal, "the 50th term" of a periodic list or the units digit of a power such as $7^n$, find the cycle first, then reduce the position.',
    example: {
      problem: 'The decimal $\\frac{3}{7} = 0.\\overline{428571}$ repeats forever. What is the 48th digit after the decimal point?',
      steps: [
        'The cycle 428571 has length 6, because those six digits repeat in the same order.',
        'Divide the position by the length: $48 = 6 \\cdot 8 + 0$. The remainder tells how far into the current cycle the 48th digit sits.',
        'A remainder of 0 means a cycle has just finished, so take the LAST digit of the cycle, not the first.',
      ],
      answer: 'The 48th digit is 1.',
    },
    traps: ['cycle-off-by-one', 'cycle-wrong-start', 'power-as-product'],
  },

  'arith.consecutive': {
    idea: 'An evenly spaced list adds up to (number of terms) $\\times$ (average), and the average is halfway between the first and last terms. The count of integers from $a$ to $b$ inclusive is $b - a + 1$.',
    recognize: 'If you see "the sum of the integers from $a$ to $b$", consecutive even or odd integers, or multiples of $k$ in a range, count the terms first, then average the ends.',
    example: {
      problem: 'What is $31 + 32 + \\cdots + 50$?',
      steps: [
        'Count the terms: $50 - 31 + 1 = 20$, because both endpoints are included.',
        'Average the ends: $\\frac{31 + 50}{2} = 40.5$. In an evenly spaced list the average is the midpoint of first and last.',
        'Multiply: $20 \\times 40.5 = 810$, because the sum is the number of terms times the average.',
        'Check by pairing: $31 + 50 = 81$, $32 + 49 = 81$, and so on for 10 pairs, so $10 \\times 81 = 810$.',
      ],
      answer: 'The sum is 810.',
    },
    traps: ['cycle-count-terms', 'int-sum-difference-shift', 'int-step-size'],
  },

  'arith.fractions': {
    idea: 'A fraction keeps its value only when you multiply or divide the numerator and denominator by the same nonzero number. To compare two fractions, cross-multiply.',
    recognize: 'If you see "which is greater", "what happens if we add 1 to the top and bottom" or a division by a fraction, think cross-multiply, scale by a common factor, or flip and multiply.',
    example: {
      problem: 'Which is greater, $\\frac{7}{11}$ or $\\frac{5}{8}$?',
      steps: [
        'Both denominators are positive, so $\\frac{7}{11} > \\frac{5}{8}$ exactly when $7 \\cdot 8 > 5 \\cdot 11$. Multiplying both sides by $8 \\cdot 11$ keeps the direction.',
        'Compute the two cross products: $7 \\cdot 8 = 56$ and $5 \\cdot 11 = 55$.',
        'Since $56 > 55$, the first fraction is larger. As a check, $0.636\\ldots > 0.625$.',
        'Adding 1 to both parts of $\\frac{7}{11}$ gives $\\frac{8}{12} = \\frac{2}{3}$, a different value, so only multiplying or dividing both parts by the same number is safe.',
      ],
      answer: '$\\frac{7}{11}$ is greater.',
    },
    traps: ['num-compare-parts', 'num-same-operation-both', 'num-add-same-to-fraction'],
  },

  'arith.decimals': {
    idea: 'Place value is powers of 10. Multiplying the top and bottom of a quotient by the same power of 10 clears the decimals without changing the value. Rounding looks only at the digit right after the place you round to.',
    recognize: 'If you see decimals in a division, a rounding instruction or a number like $3 \\times 10^{-4}$, scale everything to integers, or track the powers of 10 apart from the digits.',
    example: {
      problem: 'Compute $4.5 \\div 0.15$.',
      steps: [
        'Multiply the top and bottom by 100: $\\frac{4.5}{0.15} = \\frac{450}{15}$. Both decimal points move two places, so the value is unchanged.',
        'Divide: $450 \\div 15 = 30$, because $15 \\cdot 30 = 450$.',
        'Cross-check with a fraction: $0.15 = \\frac{3}{20}$, so $4.5 \\div \\frac{3}{20} = 4.5 \\cdot \\frac{20}{3} = 30$, because dividing by a fraction means multiplying by its reciprocal.',
      ],
      answer: '$4.5 \\div 0.15 = 30$.',
    },
    traps: ['num-decimal-shift', 'num-double-rounding', 'num-exponent-sign'],
  },

  'arith.number-line': {
    idea: 'Every segment on a number line is a length. Express all of them in one unit $u$, add them up, and compare with the coordinates.',
    recognize: 'If you see points in order, relations like $AB = CD$, a midpoint or "the distance between", draw the line and label each segment with $u$.',
    example: {
      problem: 'Points A, B, C, D lie in that order on a number line, with $AB = CD$ and $BC = 3 \\cdot AB$. If A is at $-3$ and D is at 17, where is C?',
      steps: [
        'Let $AB = CD = u$. Then $BC = 3u$ and $AD = u + 3u + u = 5u$, because all lengths must share one unit.',
        'The distance is $AD = 17 - (-3) = 20$, so $5u = 20$ and $u = 4$.',
        'C is $CD = 4$ to the left of D: $17 - 4 = 13$. It lies between B at 1 and D at 17, as it should.',
      ],
      answer: 'C is at 13.',
    },
    traps: ['num-equal-segments', 'num-segment-count', 'num-wrong-point'],
  },

  'arith.real-numbers': {
    idea: 'Powers and reciprocals move differently in each zone: above 1, between 0 and 1, between $-1$ and 0, and below $-1$. Find the zone first. Squares are never negative, and $\\frac{1}{x}$ keeps the sign of $x$.',
    recognize: 'If you see "which must be true", "greatest of" or a bound such as $-1 < x < 0$ or $|z| \\le 1$, test sample values from each zone, including a negative fraction.',
    example: {
      problem: 'If $-1 < x < 0$, which of $x$, $x^2$, $x^3$ and $\\frac{1}{x}$ is greatest, and which is least?',
      steps: [
        'Pick a test value in the range, $x = -\\frac{1}{2}$, because a negative fraction shows the pattern.',
        'Compute: $x^2 = \\frac{1}{4}$, $x^3 = -\\frac{1}{8}$, $\\frac{1}{x} = -2$. Order them: $-2 < -\\frac{1}{2} < -\\frac{1}{8} < \\frac{1}{4}$.',
        'Confirm with $x = -\\frac{1}{4}$, which gives $-4 < -\\frac{1}{4} < -\\frac{1}{64} < \\frac{1}{16}$, because one value alone is not proof.',
      ],
      answer: '$x^2$ is greatest and $\\frac{1}{x}$ is least.',
    },
    traps: ['negative-fraction-sign', 'reciprocal-direction', 'tested-one-value'],
  },

  'arith.exponents': {
    idea: 'Exponent rules only work on a common base. Rewrite every power with the same base first, then add, subtract or multiply the exponents. Even exponents erase a minus sign: $(-2)^4 = 16$, but $(-2)^3 = -8$.',
    recognize: 'If you see mixed bases such as 2, 4 and 8, negative or zero exponents, or a negative base like $(-x)^n$, move to a common base and check the parity of $n$.',
    example: {
      problem: 'Compute $\\frac{8^2 \\cdot 4^3}{2^5}$.',
      steps: [
        'Rewrite in base 2: $8^2 = (2^3)^2 = 2^6$ and $4^3 = (2^2)^3 = 2^6$, because a power of a power multiplies the exponents.',
        'Multiply the numerator: $2^6 \\cdot 2^6 = 2^{12}$, because exponents add when you multiply the same base.',
        'Divide: $\\frac{2^{12}}{2^5} = 2^7 = 128$, because exponents subtract when you divide.',
        'Check with plain numbers: $8^2 \\cdot 4^3 = 64 \\cdot 64 = 4096$ and $4096 \\div 32 = 128$.',
      ],
      answer: 'The value is 128.',
    },
    traps: ['int-power-of-power', 'int-base-change-exponent', 'int-negative-exponent'],
  },

  'arith.roots': {
    idea: 'Simplify each radical by pulling out perfect squares (or cubes). Only radicals with the same number under the root can then be combined, like $5x + 3x$. Cube roots work the same way: $\\sqrt[3]{54} = 3\\sqrt[3]{2}$.',
    recognize: 'If you see a sum or difference of roots, or a comparison like $3\\sqrt{5}$ against $\\sqrt{40}$, simplify first and put a coefficient inside the root only after squaring it.',
    example: {
      problem: 'Simplify $\\sqrt{50} + \\sqrt{18}$.',
      steps: [
        'Pull out perfect squares: $\\sqrt{50} = \\sqrt{25 \\cdot 2} = 5\\sqrt{2}$ and $\\sqrt{18} = \\sqrt{9 \\cdot 2} = 3\\sqrt{2}$.',
        'Both are multiples of $\\sqrt{2}$, so add the coefficients: $5\\sqrt{2} + 3\\sqrt{2} = 8\\sqrt{2}$.',
        'Check: $7.07 + 4.24 \\approx 11.31 \\approx 8 \\cdot 1.414$, while $\\sqrt{50 + 18} = \\sqrt{68} \\approx 8.25$ is far off, because radicals never add under the root.',
      ],
      answer: '$\\sqrt{50} + \\sqrt{18} = 8\\sqrt{2}$.',
    },
    traps: ['radical-add', 'radical-coefficient', 'radical-subtract'],
  },

  'arith.order-of-operations': {
    idea: 'Substitute every value inside parentheses, then follow the order: parentheses, exponents, multiplication and division left to right, then addition and subtraction left to right. Remember $-3^2 = -9$ but $(-3)^2 = 9$.',
    recognize: 'If you see an expression with given values, a defined operation like $a \\star b$ or negative inputs, write each substitution in full and work one operation at a time. On QC questions with given values, compute both sides completely.',
    example: {
      problem: 'If $r = 2$ and $s = -3$, what is $r - s^2 + rs$?',
      steps: [
        'Substitute with parentheses: $2 - (-3)^2 + (2)(-3)$, because a bare minus sign is easy to lose.',
        'Exponent first: $(-3)^2 = 9$, since the parentheses put the minus sign inside the square. The product is $(2)(-3) = -6$.',
        'Now add and subtract left to right: $2 - 9 + (-6) = -13$.',
      ],
      answer: 'The value is $-13$.',
    },
    traps: ['int-no-parentheses', 'int-negative-square', 'int-left-to-right'],
  },

  'arith.percent': {
    idea: 'A percent is a multiplier on a base: $+8\\%$ is $\\times 1.08$ and $-20\\%$ is $\\times 0.80$. Percent change divides by the ORIGINAL value. Also, $x\\%$ of $y$ equals $y\\%$ of $x$, so 8% of 25 is 25% of 8, which is 2.',
    recognize: 'If you see "increased by", "reduced to" or "what percent more", name the original amount and write an equation with a multiplier. Percents without base amounts cannot become dollars.',
    example: {
      problem: 'After a 20% discount, a jacket costs 60 dollars. What was the original price?',
      steps: [
        'Let the original price be $P$. A 20% discount leaves 80% of it, so $0.8P = 60$, because the discount is taken on the original.',
        'Divide: $P = \\frac{60}{0.8} = 75$.',
        'Check: 20% of 75 is 15, and $75 - 15 = 60$. Adding 20% to 60 would give 72, the wrong base.',
      ],
      answer: 'The original price was 75 dollars.',
    },
    traps: ['num-reverse-percent', 'num-percent-wrong-base', 'num-change-only'],
  },

  'arith.successive-percent': {
    idea: 'Successive percent changes multiply, they never add. Turn each change into a multiplier and chain them.',
    recognize: 'If you see "discount then tax", "increase then decrease" or several years of growth, multiply the multipliers. Each percent applies to the NEW amount, so undoing a $+25\\%$ change takes $-20\\%$, not $-25\\%$.',
    example: {
      problem: 'A 400-dollar bike is discounted 30%, then a 10% tax is added to the sale price. What is the final price?',
      steps: [
        'Write multipliers: a 30% discount is $\\times 0.70$ and a 10% tax is $\\times 1.10$, because each percent is a fraction of the current price.',
        'Discount first: $400 \\times 0.70 = 280$. The tax applies to 280, not to the original 400.',
        'Then tax: $280 \\times 1.10 = 308$. Adding the percents ($-30\\% + 10\\% = -20\\%$) would give 320, which is wrong because the changes multiply.',
      ],
      answer: 'The final price is 308 dollars.',
    },
    traps: ['num-add-percents', 'num-second-on-original', 'num-percent-cancel'],
  },

  'arith.ratios': {
    idea: 'A ratio $a : b$ splits a total into $a + b$ equal parts. Find the size of one part, then multiply by the number of parts you need.',
    recognize: 'If you see "in the ratio", "twice as many" or "divided in proportion", count the total parts. If a known fraction is taken out first, split only what remains.',
    example: {
      problem: 'A bag holds 240 marbles. One quarter are blue, and the rest are red and green in the ratio $2 : 3$. How many are green?',
      steps: [
        'Take out the known fraction first: blue is $\\frac{1}{4} \\cdot 240 = 60$, so $240 - 60 = 180$ are red or green, because the ratio covers only those two colors.',
        'The ratio $2 : 3$ makes $2 + 3 = 5$ equal parts, so one part is $180 \\div 5 = 36$.',
        'Green has 3 parts: $3 \\cdot 36 = 108$. Check: red is $2 \\cdot 36 = 72$, and $72 + 108 = 180$.',
      ],
      answer: '108 marbles are green.',
    },
    traps: ['num-ratio-whole', 'num-ratio-parts', 'num-ratio-part-whole'],
  },

  'arith.rates': {
    idea: 'Treat units like fractions and cancel them. Each conversion factor equals 1, and total = rate $\\times$ time, so time = total $\\div$ rate.',
    recognize: 'If you see "per hour", "miles per gallon", "at this rate" or a change of units, write the units out and multiply by conversion fractions until only the wanted unit is left. Know 3,600 seconds per hour and 1,440 minutes per day.',
    example: {
      problem: 'Convert 90 kilometers per hour to meters per second.',
      steps: [
        'Write $\\frac{90\\text{ km}}{1\\text{ h}} \\times \\frac{1000\\text{ m}}{1\\text{ km}} \\times \\frac{1\\text{ h}}{3600\\text{ s}}$, placing each factor so the old unit cancels.',
        'Kilometers cancel with kilometers and hours with hours, leaving meters over seconds, because each factor equals 1.',
        'Compute: $\\frac{90 \\cdot 1000}{3600} = \\frac{90{,}000}{3600} = 25$.',
        'Sanity check: 1 m/s is 3.6 km/h, and $25 \\times 3.6 = 90$.',
      ],
      answer: '90 km/h is 25 meters per second.',
    },
    traps: ['num-inverted-conversion', 'num-time-conversion', 'num-inverted-rate'],
  },
};
