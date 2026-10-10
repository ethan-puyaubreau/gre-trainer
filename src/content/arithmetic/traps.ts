import type { Trap } from '../../engine/types';

export const arithmeticTraps: Record<string, Trap> = {
  'cycle-off-by-one': {
    label: 'Off by one inside the cycle',
    fix: 'Position $n$ in a cycle of length $L$ is element number ($n \\bmod L$) of the cycle, and a remainder of 0 means the LAST element, not the first.',
  },
  'cycle-count-terms': {
    label: 'Wrong number of terms',
    fix: 'From term $a$ to term $b$ inclusive there are $b - a + 1$ terms, not $b - a$.',
  },
  'cycle-wrong-start': {
    label: 'Started the cycle at the wrong element',
    fix: 'Find which element of the cycle the first term of the range is (use its position mod the cycle length) instead of assuming the range starts at the beginning of the cycle.',
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
