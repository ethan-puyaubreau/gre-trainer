import type { Skill, Template, Trap } from '../../../engine/types';
import { comparisonTemplates } from './comparisons';
import { exponentTemplates } from './exponents';
import { expressionTemplates } from './expressions';
import { functionTemplates } from './functions';
import { inequalityTemplates } from './inequalities';
import { linearTemplates } from './linear';
import { quadraticTemplates } from './quadratics';
import { systemTemplates } from './systems';
import { coreAlgebraSkills } from './skills';
import { coreAlgebraTraps } from './traps';
import { hiddenTemplates, hiddenTraps } from './hidden';
import { chainTemplates, chainTraps } from './chains';
import { sameTemplates, sameTraps } from './same';

export const coreSkills: Skill[] = coreAlgebraSkills;
export const coreTemplates: Template<any>[] = [...expressionTemplates, ...exponentTemplates, ...linearTemplates, ...systemTemplates, ...quadraticTemplates, ...inequalityTemplates, ...functionTemplates, ...comparisonTemplates, ...hiddenTemplates, ...chainTemplates, ...sameTemplates];
export const coreTraps: Record<string, Trap> = { ...coreAlgebraTraps, ...hiddenTraps, ...chainTraps, ...sameTraps };
