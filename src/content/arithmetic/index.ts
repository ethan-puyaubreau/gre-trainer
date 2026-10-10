import type { AreaContent } from '../../engine/types';
import { cycleTemplates } from './cycles';
import { rootTemplates } from './roots';
import { arithmeticSkills } from './skills';
import { arithmeticTraps } from './traps';

export const arithmetic: AreaContent = {
  area: 'arithmetic',
  skills: arithmeticSkills,
  traps: arithmeticTraps,
  templates: [...cycleTemplates, ...rootTemplates],
};
