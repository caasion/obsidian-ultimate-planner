import { get, writable } from "svelte/store";
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

export function setTemplate(date: ISODate, newTemplate: RowID[]) {
    templates.update(templates => ({
        ...templates,
        [date]: newTemplate
    }))
}

/** Adds an item to a template if the template doesn't already 
 * have it. Returns true if added to template and false if 
 * template already contains the item. */
export function addToTemplate(date: ISODate, id: RowID): boolean {
    if (get(templates)[date].contains(id)) return false;

    templates.update(templates => ({
        ...templates,
        [date]: [...templates.date, id]
    }))
    return true;
 
}

/** Removes an item from a template if the template has it. Returns false if template doesn't contain the item. */
export function removeFromTemplate(date: ISODate, id: ActionItemID): boolean {
    if (!get(templates)[date].contains(id)) return false;

    const template = get(templates)[date].slice()
    const index = template.indexOf(id);
    template.splice(index, 1);

    templates.update(templates => ({
        ...templates,
        [date]: template
    }))
    return true;
}

export function removeItemFromPlanner(id: ActionItemID) {

    actionItems.update(items => {
        delete items[id];
        return items;
    })

    cells.update(cells => {
        const updatedCells: Record<ISODate, Record<ActionItemID, string>> = {};
        for (const date in cells) {
            const cellMap = { ...cells[date] }; // Copy the cell map for this date
            if (id in cellMap) delete cellMap[id]; // Remove the ActionItemID if present
            updatedCells[date] = cellMap;
        }
        return updatedCells;
    });
}

export function updateActionItem(id: ActionItemID, updates: Partial<ActionItemMeta>) {
    actionItems.update(items => ({
        ...items,
        [id]: { ...items[id], ...updates }
    }));
}

export function setCell(date: ISODate, actionItemId: ActionItemID, value: string) {
    cells.update(cells => ({
        ...cells,
        [date]: {
            ...cells[date],
            [actionItemId]: value
        }
    }));
}

export function getCell(date: ISODate, actionItemId: ActionItemID) {
    if (!get(cells)[date] || !get(cells)[date][actionItemId]) return "";

    return get(cells)[date][actionItemId];
}

export function updateCalendar(id: CalendarID, updates: Partial<CalendarMeta>) {
    calendars.update(calendars => ({
        ...calendars,
        [id]: { ...calendars[id], ...updates}
    }))
} 

export function setCalendarCell(date: ISODate, calendarId: CalendarID, values: string[]) {
    calendarCells.update(cells => ({
        ...cells,
        [date]: { 
            ...cells[date], 
            [calendarId]: values 
        }
    }))
}