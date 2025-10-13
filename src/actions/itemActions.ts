import type { ISODate, ActionItemID, PlannerState } from '../types';
import { actionItems, addToTemplate, removeFromTemplate, removeItemFromPlanner, setTemplate, templates, updateActionItem } from '../state/plannerStore';
import { get } from 'svelte/store';
import { App, Menu, Notice } from 'obsidian';
import { addDaysISO, idUsedInTemplates } from './helpers';
import { RenameActionItemModal } from '../ui/ActionItemModals';

/* Template */
/** [HELPER] Returns a deep copy of the template that should apply on `date`
 *  Loops through all the keys (which are dates) in templates and compares them with the date provided.
 *  If no template exists at or before `date`, it return an empty array
 */
export function templateForDate(date: ISODate): ActionItemID[] {
    let best: ISODate | null = null;
    for (const key in get(templates)) {
        if (key <= date && (best === null || key > best)) best = key;
    }
    // return best ? templates[best] : [];
    return best ? JSON.parse(JSON.stringify(get(templates)[best])) : [];
}

/* Action Items */
/** Registers a new action item in actionItems and adds it to a date's template. */
export function newActionItem(date: ISODate, id: ActionItemID, label: string, color: string) {
    updateActionItem(id, { label, color })

    const newTemplate: ActionItemID[] = templateForDate(date);
    newTemplate.push(id);
    setTemplate(date, newTemplate)
}

/** [HELPER] Returns a list of dates that have a template, and are after the date provided */
export function getDatesWithTemplatesAfterDate(date: ISODate): ISODate[] {
    let dates: ISODate[] = [];
    for (const key in get(templates)) {
        if (key >= date) dates.push(key);
    }
    return dates;
}

/** [PURE HELPER] Takes in an array, swaps two items, and returns a new array. Returns the same array if swapping causes an item to go beyond the array. */
export function swapArrayItems<T>(array: T[], a: number, b: number): T[] {
    if (a < 0 || b < 0) return array;
    if (a >= array.length || b >= array.length) return array;

    const newArray = array.slice();
    [newArray[a], newArray[b]] = [newArray[b], newArray[a]];
    return newArray;
}

/* Context Menu */
export function openActionItemContextMenu(app: App, evt: MouseEvent, date: ISODate, id: ActionItemID) {
    evt.preventDefault();
    evt.stopPropagation();

    const menu = new Menu();

    menu
        .addItem((i) =>
            i.setTitle(`ID: ${id}`)
            .setIcon("info")
        )
        .addSeparator()
        .addItem((i) =>
            i.setTitle("Edit")
            .setIcon("pencil")
            .onClick(() => {
                new RenameActionItemModal(app, get(actionItems)[id], (label: string, color: string) => updateActionItem(id, {label, color})).open();
            })
        )
        .addItem((i) =>
            i.setTitle("Extend until next template")
            .setIcon("calendar-plus-2")
            .onClick(() => {
                addToTemplate(addDaysISO(date, 1), id);
            })
        )
        .addItem((i) =>
            i.setTitle("Extend until latest template")
            .setIcon("calendar-plus")
            .onClick(() => {
                const dates = getDatesWithTemplatesAfterDate(date);

                dates.forEach((date) => {        
                    addToTemplate(addDaysISO(date, 1), id);
                })
            })
        )
        .addItem((i) =>
            i.setTitle("Extend to previous template")
            .setIcon("calendar-minus")
            .onClick(() => {
                addToTemplate(addDaysISO(date, -1), id);
            })
        )
        .addItem((i) =>
            i.setTitle("Remove from this date (until next template)")
            .setIcon("calendar-x")
            .onClick(() => {
                removeFromTemplate(date, id)
                if (!idUsedInTemplates(get(templates), id)) {
                    removeItemFromPlanner(id);
                }
            })
        ).addItem((i) =>
            i.setTitle("Remove from this date (until latest templates)")
            .setIcon("calendar-off")
            .onClick(() => {
                const dates = getDatesWithTemplatesAfterDate(date);

                dates.forEach((date) => {        
                    removeFromTemplate(date, id)
                    if (!idUsedInTemplates(get(templates), id)) {
                        removeItemFromPlanner(id);
                    }
                })
            })
        ).addItem((i) =>
            i.setTitle("Move up")
            .setIcon("chevron-up")
            .onClick(() => {
                const template = templateForDate(date);
                const a = template.findIndex((value) => value == id);

                setTemplate(date, swapArrayItems(template, a, a-1))
            })
        ).addItem((i) =>
            i.setTitle("Move down")
            .setIcon("chevron-down")
            .onClick(() => {
                const template = templateForDate(date);
                const a = template.findIndex((value) => value == id);

                setTemplate(date, swapArrayItems(template, a, a+1))
            })
        );
        
        

    menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
}