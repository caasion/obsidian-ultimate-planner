import type { ISODate, ActionItemID, PlannerState } from '../types';
import { plannerStore } from '../state/plannerStore';
import { get } from 'svelte/store';
import { App, Menu, Notice } from 'obsidian';
import { addDaysISO } from './helpers';
import { RenameActionItemModal } from '../components/ActionItemModals';

/* Template */
/** Returns a deep copy of the template that should apply on `date`
 *  Loops through all the keys (which are dates) in templates and compares them with the date provided.
 *  If no template exists at or before `date`, it return an empty array
 */
export function templateForDate(date: ISODate): ActionItemID[] {
    let best: ISODate | null = null;
    const templates = get(plannerStore).templates
    for (const key in templates) {
        if (key <= date && (best === null || key > best)) best = key;
    }
    return best ? JSON.parse(JSON.stringify(templates[best])) : [];
}

/* Action Items */
export function modifyActionItem(rowID: ActionItemID, label: string, color: string) {
    plannerStore.update(current => {
        // const next = { ...current, actionItems: { ...current.actionItems, [rowID]: { label, color}}};
        current.actionItems[rowID] = { label, color };
        return current;
    })
}

export function newActionItem(date: ISODate, rowID: ActionItemID, label: string, color: string) {
    plannerStore.update(current => {
        /* Update Templates */
        const today = templateForDate(date); // Get today's template (deep copy)
        today.push(rowID); // Pushes the new item to the deep copy
        current.templates[date] = today; // Directly replaces the copy

        /* Update Action Item List */
        current.actionItems[rowID] = { label, color };

        return current
    })
}

// !! Need to fix reactivity!
export function addItemToTemplate(date: ISODate, rowID: ActionItemID) {
    plannerStore.update(current => {
        current.templates[date] ??= templateForDate(date);

        if (!current.templates[date].contains(rowID)) {
            current.templates[date].push(rowID)
        } else {
            new Notice("Item Already in Template");
        }

        return current;
    })
}

export function removeItemFromTemplate(date: ISODate, rowID: ActionItemID) {
    plannerStore.update(current => {
        current.templates[date] ??= templateForDate(date);

        const template = current.templates[date];
        const i = template.indexOf(rowID);

        if (i >= 0) {
            template.splice(i, 1)
        }

        return current;
    })
}

/* Context Menu */
export function openActionItemContextMenu(app: App, evt: MouseEvent, date: ISODate, rowID: ActionItemID) {
    evt.preventDefault();
    evt.stopPropagation();

    const menu = new Menu();

    const initial = get(plannerStore).actionItems[rowID];

    menu
        .addItem((i) =>
            i.setTitle(`ID: ${rowID}`)
            .setIcon("info")
        )
        .addSeparator()
        .addItem((i) =>
            i.setTitle("Rename")
            .setIcon("pencil")
            .onClick(() => {
                new RenameActionItemModal(app, initial, (label, color) => modifyActionItem(rowID, label, color)).open();
            })
        )
        .addItem((i) =>
            i.setTitle("Extend until next template")
            .setIcon("calendar-plus")
            .onClick(() => {
                addItemToTemplate(addDaysISO(date, 1), rowID);
            })
        )
        .addItem((i) =>
            i.setTitle("Extend to previous template")
            .setIcon("calendar-plus")
            .onClick(() => {
                addItemToTemplate(addDaysISO(date, -1), rowID);
            })
        )
        .addItem((i) =>
            i.setTitle("Remove from this date (until next template)")
            .setIcon("calendar-plus")
            .onClick(() => {
                removeItemFromTemplate(date, rowID);
            })
        );
        
        

    menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
}