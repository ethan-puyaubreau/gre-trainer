import type { Template } from '../../../engine/types';
import { weightedSpeedTemplates, weightedSpeedTraps } from './weighted-speed';
import { centerFilteredTemplates, centerFilteredTraps } from './center-filtered';
import { centerOverlapTemplates, centerOverlapTraps } from './center-overlap';
import { centerTemplates } from './center';
import { centerQCTemplates } from './center-qc';
import { distributionTemplates } from './distributions';
import { statsSkills } from './skills';
import { statsTraps as baseStatsTraps } from './traps';
import { spreadSetTemplates, spreadSetTraps } from './spreadSets';
import { spreadTemplates } from './spread';
import { weightedTemplates } from './weighted';

export { statsSkills };
export const statsTraps = { ...baseStatsTraps, ...spreadSetTraps, ...weightedSpeedTraps, ...centerFilteredTraps, ...centerOverlapTraps };

export const statsTemplates: Template<any>[] = [
  ...centerTemplates.slice(0, 1),
  ...centerQCTemplates,
  ...centerTemplates.slice(1),
  ...weightedTemplates,
  ...spreadTemplates,
  ...spreadSetTemplates,
  ...centerOverlapTemplates,
  ...centerFilteredTemplates,
  ...weightedSpeedTemplates,
  ...distributionTemplates,
];
