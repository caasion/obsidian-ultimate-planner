import { type Day, parseISO, startOfWeek, eachDayOfInterval, addDays } from "date-fns";
import type { ISODate } from "src/types";
import { getISODate } from "./helpers";
import { templates } from "src/state/plannerStore";
import { get } from "svelte/store";

export function getDatesOfWeek(anchor: ISODate, weekStartsOn: Day): ISODate[] {
    const date = parseISO(anchor);

    const start = startOfWeek(date, { weekStartsOn });
    const end = startOfWeek(date, { weekStartsOn });

    const dates = eachDayOfInterval({ start, end });

    return dates.map(d => getISODate(d));
}

export function getDatesOfBlock(anchor: ISODate, days: number): ISODate[] {
    const date = parseISO(anchor);

    const dates = eachDayOfInterval({ start: date, end: addDays(date, days)})

    return dates.map(d => getISODate(d));
}

export function getTemplateDate(date: ISODate): ISODate {
    const sortedTemplateDates: ISODate[] = Object.keys(get(templates)).sort();

    // Implement binary search to find the template date that is the greatest date less than or equal to the date provided
    let left = 0;
    let right = sortedTemplateDates.length - 1;
    let mid = 0;

    while (left <= right) {
        mid = Math.floor((left + right) / 2);
        if (sortedTemplateDates[mid] === date) {
            return sortedTemplateDates[mid];
        }
        if (sortedTemplateDates[mid] <= date) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return "";
}