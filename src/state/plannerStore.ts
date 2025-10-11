import { writable } from "svelte/store";
import type { ActionItemID, ActionItemMeta, CalendarID, CalendarMeta, ISODate, PlannerState, RowID } from "src/types";

export const actionItems = writable<Record<ActionItemID, ActionItemMeta>>({});
export const calendars = writable<Record<CalendarID, CalendarMeta>>({
        "cal-abcdefji-fsdkj-fjdskl": {
            id: "cal-abcdefji-fsdkj-fjdskl",
            label: "Test Calendar",
            color: "#cccccc",
            url: ""
        }
    });
export const templates = writable<Record<ISODate, RowID[]>>({});
export const cells = writable<Record<ISODate, Record<ActionItemID, string>>>({});
export const calendarCells = writable<Record<ISODate, Record<CalendarID, string[]>>>({});

export function updateActionItem(id: ActionItemID, updates: Partial<ActionItemMeta>) {
    actionItems.update(items => ({
        ...items,
        [id]: { ...items[id], ...updates }
    }));
}

export function updateCell(date: ISODate, actionItemId: ActionItemID, value: string) {
    cells.update(cells => ({
        ...cells,
        [date]: {
            ...cells[date],
            [actionItemId]: value
        }
    }));
}

export function updateCalendar(id: CalendarID, updates: Partial<CalendarMeta>) {
    calendars.update(calendars => ({
        ...calendars,
        [id]: { ...calendars[id], ...updates}
    }))
} 

export function updateCalendarCell(date: ISODate, calendarId: CalendarID, values: string[]) {
    calendarCells.update(cells => ({
        ...cells,
        [date]: { 
            ...cells[date], 
            [calendarId]: values 
        }
    }))
}