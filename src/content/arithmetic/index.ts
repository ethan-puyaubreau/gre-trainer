import type { AreaContent } from '../../engine/types';
import { cycleTemplates } from './cycles';
import { integersTemplates, integersTraps } from './integers';
import { numbersTemplates, numbersTraps } from './numbers';
import { rootTemplates } from './roots';
import { arithmeticSkills } from './skills';
import { arithmeticTraps } from './traps';

export const arithmetic: AreaContent = {
  area: 'arithmetic',
  skills: arithmeticSkills,
  traps: { ...arithmeticTraps, ...integersTraps, ...numbersTraps },
  templates: [...cycleTemplates, ...rootTemplates, ...integersTemplates, ...numbersTemplates],
};
