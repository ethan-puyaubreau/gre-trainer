import type { Skill, Template, Trap } from '../../../engine/types';
import { coordinateTemplates } from './coordinate';
import { graphTemplates } from './graphs';
import { sequenceTemplates } from './sequences';
import { wordProblemTemplates } from './wordProblems';
import { rateWorkTemplates } from './rateWork';
import { mixtureTemplates } from './mixtures';
import { appliedSkillList } from './skills';
import { appliedTrapMap } from './traps';
import { telescopeTemplates, telescopeTraps } from './telescope';
import { interceptTemplates, interceptTraps } from './intercepts';
import { interceptRangeTemplates, interceptRangeTraps } from './interceptRange';
import { triangleAreaTemplates, triangleAreaTraps } from './triangleArea';

export const appliedSkills: Skill[] = appliedSkillList;
export const appliedTemplates: Template<any>[] = [...coordinateTemplates, ...graphTemplates, ...sequenceTemplates, ...wordProblemTemplates, ...rateWorkTemplates, ...mixtureTemplates, ...telescopeTemplates, ...interceptTemplates, ...interceptRangeTemplates, ...triangleAreaTemplates];
export const appliedTraps: Record<string, Trap> = { ...appliedTrapMap, ...telescopeTraps, ...interceptTraps, ...interceptRangeTraps, ...triangleAreaTraps };
