import type { Template } from '../../../engine/types';
import { centerTemplates } from './center';
import { centerQCTemplates } from './center-qc';
import { distributionTemplates } from './distributions';
import { distTailTemplates, distTailTraps } from './distTail';
import { distCumulativeTemplates, distCumulativeTraps } from './distCumulative';
import { statsSkills } from './skills';
import { statsTraps as baseStatsTraps } from './traps';
import { spreadSetTemplates, spreadSetTraps } from './spreadSets';
import { spreadTemplates } from './spread';
import { weightedTemplates } from './weighted';

export { statsSkills };
export const statsTraps = { ...baseStatsTraps, ...spreadSetTraps, ...distTailTraps, ...distCumulativeTraps };

export const statsTemplates: Template<any>[] = [
  ...centerTemplates.slice(0, 1),
  ...centerQCTemplates,
  ...centerTemplates.slice(1),
  ...weightedTemplates,
  ...spreadTemplates,
  ...spreadSetTemplates,
  ...distributionTemplates,
  ...distTailTemplates,
  ...distCumulativeTemplates,
];
