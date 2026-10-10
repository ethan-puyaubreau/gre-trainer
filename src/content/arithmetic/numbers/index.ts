import type { Template, Trap } from '../../../engine/types';
import { decimalTemplates } from './decimals';
import { fractionTemplates } from './fractions';
import { numberLineTemplates } from './numberLine';
import { percentTemplates } from './percent';
import { realNumberTemplates } from './realNumbers';
import { numbersTraps as traps } from './traps';

export const numbersTemplates: Template<any>[] = [...fractionTemplates, ...decimalTemplates, ...numberLineTemplates, ...realNumberTemplates, ...percentTemplates];
export const numbersTraps: Record<string, Trap> = traps;
