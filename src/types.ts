import type { Day } from "date-fns";

/* Plugin Data Types */
export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

export type ActionItemID = string;
export type CalendarID = string;
export type RowID = ActionItemID | CalendarID;

export interface ActionItemMeta {
    id: ActionItemID;
    label: string;
    color: string;
    start: ISODate;
    end: ISODate;
}

export interface CalendarMeta {
    id: CalendarID;
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
    calendars: Record<CalendarID, CalendarMeta>;
    cells: Record<ISODate, Record<ActionItemID, string>>; 
    calendarCells: Record<ISODate, Record<CalendarID, string[] >>;
    templates: Record<ISODate, RowID[]>;
    globalRowOrder: RowID[];
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