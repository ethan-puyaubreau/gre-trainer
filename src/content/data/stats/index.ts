import type { Template } from '../../../engine/types';
import { centerTemplates } from './center';
import { centerQCTemplates } from './center-qc';
import { distributionTemplates } from './distributions';
import { statsSkills } from './skills';
import { statsTraps } from './traps';
import { spreadTemplates } from './spread';
import { weightedTemplates } from './weighted';

export { statsSkills, statsTraps };

export const statsTemplates: Template<any>[] = [
  ...centerTemplates.slice(0, 1),
  ...centerQCTemplates,
  ...centerTemplates.slice(1),
  ...weightedTemplates,
  ...spreadTemplates,
  ...distributionTemplates,
];
