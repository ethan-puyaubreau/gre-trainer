import type { Template } from '../../../engine/types';
import { countingTemplates } from './counting';
import { probabilityTemplates } from './probability';
import { setsTemplates } from './sets';
import { changeTemplates } from './di-change';
import { homesTemplates } from './di-homes';
import { regionTemplates } from './di-region';
import { workTemplates } from './di-worktime';
import { seasonTemplates } from './di-seasons';
import { singleDITemplates } from './di-single';
import { probSkills } from './skills';
import { probTraps } from './traps';

export { probSkills, probTraps };
export const probTemplates: Template<any>[] = [...countingTemplates, ...probabilityTemplates, ...setsTemplates, ...changeTemplates, ...homesTemplates, ...regionTemplates, ...workTemplates, ...seasonTemplates, ...singleDITemplates];
