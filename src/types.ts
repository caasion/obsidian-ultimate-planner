import type { Day } from "date-fns";

/* Plugin Data Types */
export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

export type ActionItemID = string;

export interface ActionItemMeta {
    label: string;    // e.g. "FITNESS ★"
    color: string;   // cosmetic only (optional)
    active?: boolean;
}

export type CalendarID = string;

export interface CalendarMeta {
    id: ActionItemID;
    label: string;
    color: string;
    url: string;
    etag?: string;
    lastFetched?: number;
    lastModified?: string;
    contentHash?: string;
}

export interface PlannerState {
    actionItems: Record<ActionItemID, ActionItemMeta>;
    calendars: Record<ActionItemID, CalendarMeta>;
    templates: Record<ISODate, ActionItemID[]>;
    // Records are much more efficient objects for look-ups
    cells: Record<ISODate, Record<ActionItemID, string /* contents */>>; 
    calendarCells: Record<ISODate, Record<ActionItemID, string[] >>;
}

/* Data persistence */
export interface PluginData {
    version: number;
    settings: PluginSettings;
    planner: PlannerState;
}

export interface PluginSettings {
    weekStartOn: Day;
    autosaveDebounceMs: number;
    weeksToRender: number;
    refreshRemoteMs: number;
    archivePastEvents: boolean;
    graceDays: number;
    retentionMonths: number;
}

export type CalendarStatus = "idle" | "fetching" | "unchanged" | "updated" | "error";

/* Calendar State */
export interface CalendarState {
    status: CalendarStatus;
    lastError?: string;
}

export interface NormalizedEvent {
    id: string;
    recurrId?: Date;
    start: Date;
    end: Date;
    allDay: boolean;
    summary: string;
    location?: string;
    description?: string;
    calendarId: string;
}

/* DEFAULT VALUES */
export const DEFAULT_SETTINGS: PluginSettings = {
    weekStartOn: 0,
    autosaveDebounceMs: 200,
    weeksToRender: 1,
    refreshRemoteMs: 5 * 60 * 1000,
    archivePastEvents: true,
    graceDays: 7,
    retentionMonths: 0, // STALE OPTION
}

export const EMPTY_PLANNER: PlannerState = {
    actionItems: {},
    cells: {},
    calendars: {
        "cal-abcdefji-fsdkj-fjdskl": {
            id: "cal-abcdefji-fsdkj-fjdskl",
            label: "Test Calendar",
            color: "#cccccc",
            url: ""
        }
    },
    calendarCells: {},
    templates: {}
}
