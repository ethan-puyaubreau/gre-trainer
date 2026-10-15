import type { Template, Trap } from '../../../engine/types';
import { barEntryTemplates, barEntryTraps } from './barEntry';
import { consecutiveTemplates } from './consecutive';
import { divisibilityTemplates } from './divisibility';
import { evaluateTemplates } from './evaluate';
import { exponentTemplates } from './exponents';
import { factorsTemplates } from './factors';
import { factorsSelectTemplates, factorsSelectTraps } from './factorsSelect';
import { groupingCompareTemplates, groupingCompareTraps } from './groupingCompare';
import { gcdLcmPairTemplates, gcdLcmPairTraps } from './gcdLcmPair';
import { lcmGcdTemplates } from './lcm-gcd';
import { populationTemplates, populationTraps } from './populationTotals';
import { primesTemplates } from './primes';
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
  ...groupingCompareTemplates,
  ...barEntryTemplates,
];
export const integersTraps: Record<string, Trap> = { ...integerTraps, ...populationTraps, ...remainderCycleTraps, ...factorsSelectTraps, ...gcdLcmPairTraps, ...groupingCompareTraps, ...barEntryTraps };
