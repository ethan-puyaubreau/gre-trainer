import type { Trap } from '../../engine/types';

export const arithmeticTraps: Record<string, Trap> = {
  'cycle-off-by-one': {
    label: 'Off by one inside the cycle',
    fix: 'Position $n$ in a cycle of length $L$ is element number ($n \\bmod L$) of the cycle, and a remainder of 0 means the LAST element, not the first.',
  },
  'cycle-wrong-position': {
    label: 'Picked the wrong element of the cycle',
    fix: 'Divide the exponent by the cycle length and use the remainder as the position: remainder 1 is the first element, remainder 0 the last.',
  },
  'cycle-count-terms': {
    label: 'Wrong number of terms',
    fix: 'From term $a$ to term $b$ inclusive there are $b - a + 1$ terms, not $b - a$.',
  },
  'cycle-wrong-start': {
    label: 'Started the cycle at the wrong element',
    fix: 'Find which element of the cycle the first term of the range is (use its position mod the cycle length) instead of assuming the range starts at the beginning of the cycle.',
  },
  'cycle-quotient-for-remainder': {
    label: 'Used the number of whole cycles instead of the leftover',
    fix: 'Divide, then keep the REMAINDER: after $100 = 7 \\cdot 14 + 2$ only the 2 leftover days move the weekday, not the 14 weeks.',
  },
  'cycle-direction': {
    label: 'Moved the wrong way around the cycle',
    fix: 'Read whether the question goes forward ("from today") or backward ("ago"), and move the leftover days in that direction.',
  },
  'units-base-digit': {
    label: 'Kept the units digit of the base',
    fix: 'The exponent changes the units digit: $7^2 = 49$ ends in 9, not 7. Follow the cycle of units digits.',
  },
  'units-exponent-last-digit': {
    label: 'Used only the last digit of the exponent',
    fix: 'The cycle length divides the whole exponent, not its last digit: for a cycle of 4, $58 = 4 \\cdot 14 + 2$ gives position 2, but the last digit 8 would give position 4.',
  },
  'units-wrong-operation': {
    label: 'Added the units digits of a product (or multiplied those of a sum)',
    fix: 'Combine the units digits with the same operation as the numbers: add for a sum, multiply for a product, then keep the units digit.',
  },
  'power-as-product': {
    label: 'Multiplied instead of raising to a power',
    fix: '$a^n$ is $a$ multiplied by itself $n$ times, not $a \\times n$. Use the repeating cycle of units digits.',
  },
  'radical-subtract': {
    label: '$\\sqrt{a} - \\sqrt{b} = \\sqrt{a - b}$',
    fix: 'Radicals do not subtract (or add) under the root. Simplify each one first ($\\sqrt{75} = 5\\sqrt{3}$), then combine like radicals.',
  },
  'radical-add': {
    label: '$\\sqrt{a} + \\sqrt{b} = \\sqrt{a + b}$',
    fix: 'Only like radicals combine: $2\\sqrt{3} + 5\\sqrt{3} = 7\\sqrt{3}$, but $\\sqrt{9} + \\sqrt{16} = 7 \\ne \\sqrt{25}$.',
  },
  'radical-coefficient': {
    label: 'Moved the coefficient inside without squaring it',
    fix: '$k\\sqrt{b} = \\sqrt{k^2 b}$: the coefficient must be squared (or cubed for a cube root) when it moves under the radical.',
  },
  'radical-add-radicands': {
    label: '$2\\sqrt{3} + 3\\sqrt{3} = 5\\sqrt{6}$',
    fix: 'Like radicals add through their coefficients only. The radical stays the same: $2\\sqrt{3} + 3\\sqrt{3} = 5\\sqrt{3}$, as $2x + 3x = 5x$.',
  },
  'radical-sign-ignored': {
    label: 'Added the coefficients and ignored the minus signs',
    fix: 'Keep each sign when you combine the coefficients: $5\\sqrt{6} - 4\\sqrt{6} = \\sqrt{6}$, not $9\\sqrt{6}$.',
  },
  'radical-square-outside': {
    label: 'Pulled out the perfect square instead of its root',
    fix: '$\\sqrt{c^2 r} = c\\sqrt{r}$: take the square root of the perfect square. $\\sqrt{18} = \\sqrt{9 \\cdot 2} = 3\\sqrt{2}$, not $9\\sqrt{2}$.',
  },
  'radical-dropped': {
    label: 'Lost the radical sign after simplifying',
    fix: 'The radical stays on the factor that is not a perfect square: $\\sqrt{12} = 2\\sqrt{3}$, not $2 \\cdot 3 = 6$.',
  },
  'radical-product-dropped': {
    label: 'Forgot that $\\sqrt{r} \\cdot \\sqrt{r} = r$',
    fix: 'Multiply the coefficients AND the radicals: $\\sqrt{5} \\cdot 3\\sqrt{5} = 3 \\cdot 5 = 15$, not $3$.',
  },
  'square-of-sum': {
    label: '$(a + b)^2 = a^2 + b^2$',
    fix: '$(a + b)^2 = a^2 + 2ab + b^2$. The middle term $2ab$ is easy to forget.',
  },
  'forgot-two-is-prime': {
    label: 'Forgot that 2 is prime',
    fix: '2 is the only even prime. An odd number can be a sum of two primes only as $2 + (n - 2)$.',
  },
  'one-is-prime': {
    label: 'Treated 1 as a prime',
    fix: '1 is not prime: a prime has exactly two positive divisors.',
  },
  'not-two-primes': {
    label: 'Used more than two primes',
    fix: 'Read the constraint: "the sum of two primes" means exactly two primes, e.g. $9 = 2 + 7$ counts but $3 + 3 + 3$ does not matter.',
  },
  'counted-endpoint': {
    label: 'Included an endpoint the question excludes',
    fix: '"Between $a$ and $b$" excludes $a$ and $b$ themselves.',
  },
  'fraction-power-grows': {
    label: 'Assumed powers make numbers bigger',
    fix: 'For $0 < x < 1$, higher powers are SMALLER: $x^3 < x^2 < x$.',
  },
  'negative-fraction-sign': {
    label: 'Ignored the sign of a negative fraction',
    fix: 'For $-1 < x < 0$: $x^2$ is positive, and $x^3$ is negative but closer to 0 than $x$, so $x < x^3 < 0 < x^2$.',
  },
  'reciprocal-direction': {
    label: 'Reciprocal on the wrong side',
    fix: 'For $0 < |x| < 1$, $\\frac{1}{x}$ is farther from 0 than $x$ (same sign). For $|x| > 1$ it is closer to 0.',
  },
  'tested-one-value': {
    label: 'Checked only one value',
    fix: '"Must be true" has to hold for EVERY allowed value. Test the endpoints and a value from each region (negative fraction, positive fraction, 0).',
  },
};
