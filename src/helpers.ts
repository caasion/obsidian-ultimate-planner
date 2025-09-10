import type { ISODate, ActionItemID, PlannerState } from './types';
import { plannerStore } from './state/plannerStore';
/* Helper Functions */
import { addDays, format, parseISO } from 'date-fns';

export function generateID() {
    return "ai-" + crypto.randomUUID();
}

export function getISODate(date: Date): ISODate {
    return format(date, "yyyy-MM-dd")
}

export function addDaysISO(iso: ISODate, n: number): ISODate {
    return getISODate(addDays(parseISO(iso), n));
}