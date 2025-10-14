import type { ISODate, ActionItemMeta, CalendarMeta, RowID } from '../types';
import { calendars, setTemplate, templates, updateActionItem, updateCalendar } from '../state/plannerStore';
import { get } from 'svelte/store';
import { fetchAllandFreeze } from './calendarPipelines';
import { addDays, parseISO, startOfDay } from 'date-fns';

/* Template */
/** [HELPER] Returns a deep copy of the template that should apply on `date`
 *  Loops through all the keys (which are dates) in templates and compares them with the date provided.
 *  If no template exists at or before `date`, it return an empty array
 */
export function templateForDate(date: ISODate): RowID[] {
    let best: ISODate | null = null;
    for (const key in get(templates)) {
        if (key <= date && (best === null || key > best)) best = key;
    }
    // return best ? templates[best] : [];
    return best ? JSON.parse(JSON.stringify(get(templates)[best])) : [];
}

/* Action Items */
/** Registers a new action item in actionItems and adds it to a date's template. */
export function newActionItem(date: ISODate, meta: ActionItemMeta) {
    updateActionItem(meta.id, meta)

    const newTemplate: RowID[] = templateForDate(date);
    newTemplate.push(meta.id);
    setTemplate(date, newTemplate)
}

/* Calendars */
/** Registers a new calendar in calendars, adds it to a date's template, and fetches all + freezes. */
export function newCalendar(date: ISODate, meta: CalendarMeta) {
    updateCalendar(meta.id, meta)

    const newTemplate: RowID[] = templateForDate(date);
    newTemplate.push(meta.id);
    setTemplate(date, newTemplate)

    fetchAllandFreeze(get(calendars)[meta.id], parseISO(date), addDays(startOfDay(Date.now()), 60))
}

/** [HELPER] Returns a sorted list of dates that have a template, and are after the date provided */
export function getTemplateDatesAfter(date: ISODate): ISODate[] {
    return Object.keys(get(templates)).filter(d => d > date).sort();
}

/** [HELPER] Returns the date of the next template given a date. */
export function getNextTemplateDate(date: ISODate): ISODate | null {
    const templateDates = getTemplateDatesAfter(date);
    return templateDates.length > 0 ? templateDates[0] : null;
}

/** [HELPER] Returns the date of the previous template given a date. */
export function getPreviousTemplateDate(date: ISODate): ISODate | null {
    const templateDates = Object.keys(get(templates)).filter(d => d < date).sort();
    return templateDates.length > 0 ? templateDates[templateDates.length - 1] : null;
}

/** [PURE HELPER] Takes in an array, swaps two items, and returns a new array. Returns the same array if swapping causes an item to go beyond the array. */
export function swapArrayItems<T>(array: T[], a: number, b: number): T[] {
    if (a < 0 || b < 0) return array;
    if (a >= array.length || b >= array.length) return array;

    const newArray = array.slice();
    [newArray[a], newArray[b]] = [newArray[b], newArray[a]];
    return newArray;
}

