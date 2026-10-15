import type { Template, Trap } from '../../../engine/types';
import { consecutiveTemplates } from './consecutive';
import { divisibilityTemplates } from './divisibility';
import { evaluateTemplates } from './evaluate';
import { exponentTemplates } from './exponents';
import { factorsTemplates } from './factors';
import { lcmGcdTemplates } from './lcm-gcd';
import { populationTemplates, populationTraps } from './populationTotals';
import { primesTemplates } from './primes';
import { integerTraps } from './traps';

export const integersTemplates: Template<any>[] = [
  ...divisibilityTemplates,
  ...primesTemplates,
  ...factorsTemplates,
  ...lcmGcdTemplates,
  ...populationTemplates,
  ...consecutiveTemplates,
  ...exponentTemplates,
  ...evaluateTemplates,
];
export const integersTraps: Record<string, Trap> = { ...integerTraps, ...populationTraps };
