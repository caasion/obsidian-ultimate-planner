import type { Day } from "date-fns";

/* Plugin Data Types */
export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

export type ActionItemID = string;

export interface ActionItemMeta {
    label: string;    // e.g. "FITNESS ★"
    color: string;   // cosmetic only (optional)
    active?: boolean;
}

export interface PlannerState {
    actionItems: Record<ActionItemID, ActionItemMeta>;
    templates: Record<ISODate, ActionItemID[]>;
    cells: Record<ISODate, Record<ActionItemID, string /* contents */>>; // Records are much more efficient objects for look-ups
}

/* Data persistence */
export interface PluginData {
    version: number;
    settings: PluginSettings;
    planner: PlannerState;
    calendar: CalendarCache;
}

export interface PluginSettings {
    weekStartOn: Day;
    autosaveDebounceMs: number;
    weeksToRender: number;
    remoteCalendarUrl: string;
    refreshRemote: number;
}

export interface CalendarCache {
    data?: string;
}

/* DEFAULT VALUES */
export const DEFAULT_SETTINGS: PluginSettings = {
    weekStartOn: 0,
    autosaveDebounceMs: 200,
    weeksToRender: 1,
    remoteCalendarUrl: "",
    refreshRemote: 5,
}

export const EMPTY_PLANNER: PlannerState = {
    actionItems: {},
    cells: {},
    templates: {}
}
