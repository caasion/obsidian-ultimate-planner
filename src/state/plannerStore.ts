import { get, writable } from "svelte/store";
import type { ISODate, ItemID, ItemMeta } from "src/types";

export const dayData = writable<Record<ISODate, Record<ItemID, string>>>({});
export const templates = writable<Record<ISODate, Record<ItemID, ItemMeta>>>({});
export const sortedTemplateDates = writable<ISODate[]>([]);

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
export function addToTemplate(tDate: ISODate, id: ItemID, meta: ItemMeta): boolean {
    if (!get(templates)[tDate]) return false;

    templates.update(templates => ({
        ...templates,
        [tDate]: {
            ...templates[tDate],
            [id]: meta
        }
    }))

    return true;
}

export function getTemplate(tDate: ISODate): Record<ItemID, ItemMeta> {
    return get(templates)[tDate];
}


/** Removes an item from a template of a given date. Returns false if the given date doesn't have a template. */
export function removeFromTemplate(tDate: ISODate, id: ItemID): boolean {
    if (!get(templates)[tDate]) return false;

    templates.update(templates => {
        const current = {...templates};
        delete current[tDate];
        return current;
    })
    return true;
}


/** Removes an item from all cells of a template of a given date. Returns false if the given date doesn't have a template. A costly operation. */
export function removeFromCellsInTemplate(tDate: ISODate, id: ItemID): boolean {
    if (!get(templates)[tDate]) return false;

    // Sort all templates
    // Get next template
    // Get date interval to next template
    // Remove all entries of a cell in a date


    return true;
    // Function not implemented.
}

export function removeTemplate(tDate: ISODate): boolean {
    // Sort all templates
    // Get next template
    // Get date interval to next template
    // Remove all entries in that date range

    return false;
    // Function not implemented.
}

/** Gets the metadata of an item given a date with a template */
export function getItemMeta(tDate: ISODate, id: ItemID): ItemMeta {
    return get(templates)[tDate][id];
}

/** Updates the metadata of an item given a date with a template, the item's id, and a partial object containing the updates. Returns false if given date doesn't have a template. */
export function updateItemMeta(tDate: ISODate, id: ItemID, updates: Partial<ItemMeta>): boolean {
    if (!get(templates)[tDate]) return false;

    templates.update(templates => ({
        ...templates,
        [tDate]: {
            ...templates[tDate],
            [id]: { ...templates[tDate][id], ...updates } as ItemMeta
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