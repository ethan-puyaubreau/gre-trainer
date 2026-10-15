import type { Template, Trap } from '../../../engine/types';
import { wpAverageChange, wpAverageChangeTraps } from './wpAverageChange';
import { wpIntegerPurchaseQc, wpIntegerPurchaseTraps } from './wpIntegerPurchaseQc';

// New question styles added by lot B5, with their traps.
export const lotB5Templates: Template<any>[] = [wpAverageChange, wpIntegerPurchaseQc];
export const lotB5Traps: Record<string, Trap> = { ...wpAverageChangeTraps, ...wpIntegerPurchaseTraps };
