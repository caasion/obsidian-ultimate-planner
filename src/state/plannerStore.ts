import { get, writable } from "svelte/store";
import type { ActionItemID, ISODate, ItemID, ItemMeta } from "src/types";

export const dayData = writable<Record<ISODate, Record<ItemID, string>>>({});
export const templates = writable<Record<ISODate, Record<ItemID, ItemMeta>>>({});

/** Sets the template for a date.
 * Primarily used for initializing templates.
 */
export function setTemplate(date: ISODate, newTemplate: Record<ItemID, ItemMeta>) {
    templates.update(templates => ({
        ...templates,
        [date]: newTemplate
    }))
}


/** Adds an item to a template of a given date. Returns false if the given date doesn't have a template.  */
export function addToTemplate(date: ISODate, id: ItemID, meta: ItemMeta): boolean {
    if (!get(templates)[date]) return false;

    templates.update(templates => ({
        ...templates,
        [date]: {
            ...templates[date],
            [id]: meta
        }
    }))

    return true;
}


/** Removes an item from a template of a given date. Returns false if the given date doesn't have a template. */
export function removeFromTemplate(date: ISODate, id: ItemID): boolean {
    if (!get(templates)[date]) return false;

    templates.update(templates => {
        const current = {...templates};
        delete current[date];
        return current;
    })
    return true;
}


/** Removes an item from all cells of a template of a given date. Returns false if the given date doesn't have a template. */
export function removeFromCellsInTemplate(date: ISODate, id: ItemID): boolean {
    if (!get(templates)[date]) return false;

    return true;
    // Function not implemented.
}


/** Updates the metadata of an item given a date with a template, the item's id, and a partial object containing the updates. Returns false if given date doesn't have a template. */
export function updateItem(date: ISODate, id: ItemID, updates: Partial<ItemMeta>): boolean {
    if (!get(templates)[date]) return false;

    templates.update(templates => ({
        ...templates,
        [date]: {
            ...templates[date],
            [id]: { ...templates[date][id], ...updates }
        }
    }))

    return true;
}


/** Sets the contents of a cell in a given date for given action item ID.
 * Doesn't matter if the cell was previously empty.
 */
export function setCell(date: ISODate, id: ItemID, value: string) {
    dayData.update(data => ({
        ...data,
        [date]: {
            ...data[date],
            [id]: value
        }
    }))
}


/** Gets the contents of a cell in a given date for given row ID. 
 * Returns an empty string if there is no date entry in dayData or if the date entry exists but there is no entry for a given row ID. */
export function getCell(date: ISODate, id: ItemID) {
    const data = get(dayData);

    if (!data[date] || !data[date][id]) return "";

    return data[date][id];
}