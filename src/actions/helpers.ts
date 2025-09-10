import type { ISODate, ActionItemID, PlannerState } from '../types';
import { plannerStore } from '../state/plannerStore';
/* Helper Functions */
import { addDays, format, parseISO } from 'date-fns';
import { get } from 'svelte/store';

export function generateID() {
    return "ai-" + crypto.randomUUID();
}

// Date Helpers
export function getISODate(date: Date): ISODate {
    return format(date, "yyyy-MM-dd")
}

export function addDaysISO(iso: ISODate, n: number): ISODate {
    return getISODate(addDays(parseISO(iso), n));
}

// Table Helpers
export function getLabelFromID(rowID: string) {
    const actionItem = get(plannerStore).actionItems[rowID];
    return actionItem ? actionItem.label : "";
}

export function getColorFromID(rowID: string) {
    const actionItem = get(plannerStore).actionItems[rowID];
    return actionItem ? actionItem.color : "";
}