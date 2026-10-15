import type { Template, Trap } from '../../../engine/types';
import { consecutiveTemplates } from './consecutive';
import { countMultiplesTemplates, countMultiplesTraps } from './countMultiples';
import { divisibilityTemplates } from './divisibility';
import { divisorKindsTemplates, divisorKindsTraps } from './divisorKinds';
import { evaluateTemplates } from './evaluate';
import { exponentTemplates } from './exponents';
import { factorsTemplates } from './factors';
import { factorsSelectTemplates, factorsSelectTraps } from './factorsSelect';
import { gcdLcmPairTemplates, gcdLcmPairTraps } from './gcdLcmPair';
import { lcmGcdTemplates } from './lcm-gcd';
import { missingDigitTemplates, missingDigitTraps } from './missingDigit';
import { populationTemplates, populationTraps } from './populationTotals';
import { primeExpressionTemplates, primeExpressionTraps } from './primeExpressions';
import { primesTemplates } from './primes';
import { remainderLcmTemplates, remainderLcmTraps } from './remainderLcm';
import { remainderCycleTemplates, remainderCycleTraps } from './remainderCycle';
import { integerTraps } from './traps';

export const integersTemplates: Template<any>[] = [
  ...divisibilityTemplates,
  ...primesTemplates,
  ...factorsTemplates,
  ...factorsSelectTemplates,
  ...lcmGcdTemplates,
  ...gcdLcmPairTemplates,
  ...populationTemplates,
  ...remainderCycleTemplates,
  ...consecutiveTemplates,
  ...exponentTemplates,
  ...evaluateTemplates,
  ...missingDigitTemplates,
  ...countMultiplesTemplates,
  ...primeExpressionTemplates,
  ...divisorKindsTemplates,
  ...remainderLcmTemplates,
];
export const integersTraps: Record<string, Trap> = { ...integerTraps, ...populationTraps, ...remainderCycleTraps, ...factorsSelectTraps, ...gcdLcmPairTraps, ...missingDigitTraps, ...countMultiplesTraps, ...primeExpressionTraps, ...divisorKindsTraps, ...remainderLcmTraps };
