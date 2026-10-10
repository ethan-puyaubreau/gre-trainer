import type { Template, Trap } from '../../../engine/types';
import { divisibilityTemplates } from './divisibility';
import { factorsTemplates } from './factors';
import { primesTemplates } from './primes';
import { integerTraps } from './traps';

export const integersTemplates: Template<any>[] = [...divisibilityTemplates, ...primesTemplates, ...factorsTemplates];
export const integersTraps: Record<string, Trap> = { ...integerTraps };
