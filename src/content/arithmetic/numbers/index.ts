import type { Template, Trap } from '../../../engine/types';
import { decimalTemplates } from './decimals';
import { decimalExtraTemplates } from './decimalsMore';
import { fractionTemplates } from './fractions';
import { numberLineTemplates } from './numberLine';
import { percentTemplates } from './percent';
import { ratioTemplates } from './ratios';
import { ratioMixtureTemplates, ratioMixtureTraps } from './ratiosMixture';
import { ratioTotalTemplates, ratioTotalTraps } from './ratioTotals';
import { rateTemplates } from './rates';
import { realNumberTemplates } from './realNumbers';
import { successiveTemplates } from './successive';
import { numbersTraps as traps } from './traps';

export const numbersTemplates: Template<any>[] = [...fractionTemplates, ...decimalTemplates, ...decimalExtraTemplates, ...numberLineTemplates, ...realNumberTemplates, ...percentTemplates, ...successiveTemplates, ...ratioTemplates, ...ratioTotalTemplates, ...ratioMixtureTemplates, ...rateTemplates];
export const numbersTraps: Record<string, Trap> = { ...traps, ...ratioTotalTraps, ...ratioMixtureTraps };
