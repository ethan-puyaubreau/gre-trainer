import type { Skill, Template, Trap } from '../../../engine/types';
import { coordinateTemplates } from './coordinate';
import { graphTemplates } from './graphs';
import { sequenceTemplates } from './sequences';
import { wordProblemTemplates } from './wordProblems';
import { rateWorkTemplates } from './rateWork';
import { appliedSkillList } from './skills';
import { appliedTrapMap } from './traps';

export const appliedSkills: Skill[] = appliedSkillList;
export const appliedTemplates: Template<any>[] = [...coordinateTemplates, ...graphTemplates, ...sequenceTemplates, ...wordProblemTemplates, ...rateWorkTemplates];
export const appliedTraps: Record<string, Trap> = appliedTrapMap;
