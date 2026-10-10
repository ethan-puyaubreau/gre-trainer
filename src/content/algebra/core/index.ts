import type { Skill, Template, Trap } from '../../../engine/types';
import { exponentTemplates } from './exponents';
import { expressionTemplates } from './expressions';
import { coreAlgebraSkills } from './skills';
import { coreAlgebraTraps } from './traps';

export const coreSkills: Skill[] = coreAlgebraSkills;
export const coreTemplates: Template<any>[] = [...expressionTemplates, ...exponentTemplates];
export const coreTraps: Record<string, Trap> = coreAlgebraTraps;
