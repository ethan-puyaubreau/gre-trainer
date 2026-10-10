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
};
