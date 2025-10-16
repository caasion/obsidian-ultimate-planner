import type { ISODate, ActionItemMeta, CalendarMeta, RowID } from '../types';
import { setTemplate, templates } from '../state/plannerStore';
import { get } from 'svelte/store';
import { fetchAllandFreeze } from './calendarPipelines';
import { addDays, parseISO, startOfDay } from 'date-fns';

/* === New Item === */
/** Registers a new action item in actionItems and adds it to a date's template. */
export function newActionItem(date: ISODate, meta: ActionItemMeta) {
    updateActionItem(meta.id, meta)

    const newTemplate: RowID[] = templateForDate(date);
    newTemplate.push(meta.id);
    setTemplate(date, newTemplate)
}


/** Registers a new calendar in calendars, adds it to a date's template, and fetches all + freezes. */
export function newCalendar(date: ISODate, meta: CalendarMeta) {
    updateCalendar(meta.id, meta)

    const newTemplate: RowID[] = templateForDate(date);
    newTemplate.push(meta.id);
    setTemplate(date, newTemplate)

    fetchAllandFreeze(get(calendars)[meta.id], parseISO(date), addDays(startOfDay(Date.now()), 60))
}

/** [PURE HELPER] Takes in an array, swaps two items, and returns a new array. Returns the same array if swapping causes an item to go beyond the array. */
export function swapArrayItems<T>(array: T[], a: number, b: number): T[] {
    if (a < 0 || b < 0) return array;
    if (a >= array.length || b >= array.length) return array;

    const newArray = array.slice();
    [newArray[a], newArray[b]] = [newArray[b], newArray[a]];
    return newArray;
}

