import type { AreaContent } from '../../engine/types';
import { probSkills, probTemplates, probTraps } from './prob';
import { statsSkills, statsTemplates, statsTraps } from './stats';

export const dataAnalysis: AreaContent = {
  area: 'data',
  skills: [...statsSkills, ...probSkills],
  traps: { ...statsTraps, ...probTraps },
  templates: [...statsTemplates, ...probTemplates],
};
