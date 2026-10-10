import type { Template, Trap } from '../../../engine/types';
import { decimalTemplates } from './decimals';
import { fractionTemplates } from './fractions';
import { numberLineTemplates } from './numberLine';
import { numbersTraps as traps } from './traps';

export const numbersTemplates: Template<any>[] = [...fractionTemplates, ...decimalTemplates, ...numberLineTemplates];
export const numbersTraps: Record<string, Trap> = traps;
