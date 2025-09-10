import type { ISODate, ActionItemID, PlannerState } from './types';
import { plannerStore } from './state/plannerStore';
import { get } from 'svelte/store';

/* Cell Functions */
// !!!!!! Does it matter if I deep mutate or not? I'm using the store as the single source of truth anyways...

export function setCell(date: ISODate, rowID: ActionItemID, text: string): void {
    plannerStore.update(current => {
        current.cells[date] ??= {}; // Initialize Cell if DNE

        current.cells = { ...current.cells, [date]: { ...current.cells[date], [rowID]: text}}
        // current.cells[date][rowID] = text;
        return current;
    })
}

export function getCell(date: ISODate, rowID: ActionItemID): string {
    let planner = get(plannerStore);

    if (!planner.cells[date] || !planner.cells[date][rowID]) {
        return "";
    }

    return planner.cells[date][rowID];
}