import type { ISODate, ActionItemID, PlannerState } from './types';
import { plannerStore } from './state/plannerStore';

/* Cell Functions */
export function setCell(date: ISODate, rowID: ActionItemID, text: string): void {
    plannerStore.update(current => {
        current.cells[date] ??= {}; // Initialize Cell if DNE

        // current.cells = { ...plannerState.cells, [date]: { ...plannerState.cells[date], [rowID]: text}}
        current.cells[date][rowID] = text;
        return current;
    })

    this.plugin.queueSave();
}