import type { Template, Trap } from '../../../engine/types';
import { wpAverageChange, wpAverageChangeTraps } from './wpAverageChange';

// New question styles added by lot B5, with their traps.
export const lotB5Templates: Template<any>[] = [wpAverageChange];
export const lotB5Traps: Record<string, Trap> = { ...wpAverageChangeTraps };
