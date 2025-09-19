import type { ISODate, ActionItemID, PlannerState } from '../types';
import { plannerStore } from '../state/plannerStore';
/* Helper Functions */
import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, type Day } from 'date-fns';
import { get } from 'svelte/store';

export function generateID() {
    return "ai-" + crypto.randomUUID();
}

// Date Helpers
export function getISODate(date: Date): ISODate {
    return format(date, "yyyy-MM-dd")
}

export function addDaysISO(iso: ISODate, n: number): ISODate {
    return getISODate(addDays(parseISO(iso), n));
}

export function getISODatesOfWeek(anchorDate: ISODate, weekStartsOn: Day = 0): ISODate[] {
    const date = parseISO(anchorDate);

    const start = startOfWeek(date, { weekStartsOn });
    const end = endOfWeek(date, { weekStartsOn });

    const days = eachDayOfInterval({ start, end });

    return days.map(day => format(day, "yyyy-MM-dd"))
}

export function getLabelFromDateRange(firstDate: ISODate, lastDate: ISODate) {
    const first = parseISO(firstDate);
    const last = parseISO(lastDate);

    if (first.getFullYear() === last.getFullYear()) {
        if (first.getMonth() === last.getMonth()) {
            return `${format(first, "MMM")} ${format(first, "dd")} – ${format(last, "dd")}, ${format(first, "yyyy")}`
        } else {
            return `${format(first, "MMM")} ${format(first, "dd")} – ${format(last, "MMM")} ${format(last, "dd")}, ${format(first, "yyyy")}`
        }
    } else {
        return `${format(first, "MMM")} ${format(first, "dd")}, ${format(first, "yyyy")} – ${format(last, "MMM")} ${format(last, "dd")}, ${format(last, "yyyy")}`
    }

}

// Templates helpers
export function idIsUsedAnywhere(
  state: PlannerState,
  rowID: ActionItemID
): boolean {
  // Check all template arrays
  for (const arr of Object.values(state.templates)) {
    if (arr.includes(rowID)) return true;
  }
  // Also check cells (optional, but usually right)
  for (const cellMap of Object.values(state.cells)) {
    if (rowID in cellMap) return true;
  }
  return false;
}