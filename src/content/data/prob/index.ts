import type { Template } from '../../../engine/types';
import { countingTemplates } from './counting';
import { probabilityTemplates } from './probability';
import { probSkills } from './skills';
import { probTraps } from './traps';

export { probSkills, probTraps };
export const probTemplates: Template<any>[] = [...countingTemplates, ...probabilityTemplates];
