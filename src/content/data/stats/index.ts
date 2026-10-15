import type { Template } from '../../../engine/types';
import { spreadWhichListTemplates, spreadWhichListTraps } from './spread-which-list';
import { spreadSdByHandTemplates, spreadSdByHandTraps } from './spread-sd-by-hand';
import { spreadAddValueTemplates, spreadAddValueTraps } from './spread-add-value';
import { weightedRestTemplates, weightedRestTraps } from './weighted-rest';
import { weightedTransferTemplates, weightedTransferTraps } from './weighted-transfer';
import { weightedPercentTemplates, weightedPercentTraps } from './weighted-percent';
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
export const statsTraps = { ...baseStatsTraps, ...spreadSetTraps, ...spreadWhichListTraps, ...spreadSdByHandTraps, ...spreadAddValueTraps, ...weightedRestTraps, ...weightedTransferTraps, ...weightedPercentTraps, ...weightedSpeedTraps, ...centerFilteredTraps, ...centerOverlapTraps };

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
  ...weightedPercentTemplates,
  ...weightedTransferTemplates,
  ...weightedRestTemplates,
  ...spreadAddValueTemplates,
  ...spreadSdByHandTemplates,
  ...spreadWhichListTemplates,
  ...distributionTemplates,
];
