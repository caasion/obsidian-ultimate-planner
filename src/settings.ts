import type { Day } from "date-fns";
import type { PlannerState } from "./types";

export interface UltimatePlannerSettings {
    settings: UltimatePlannerInnerSettings;
    planner: PlannerState;
}

export interface UltimatePlannerInnerSettings {
    weekStartOn: Day,
    autosaveDebounceMs: number;
    weeksToRender: number;
    remoteCalendarUrl: string;
    refreshRemote: number;
}

export const DEFAULT_SETTINGS: UltimatePlannerSettings = {
    settings: {
        weekStartOn: 0,
        autosaveDebounceMs: 200,
        weeksToRender: 1,
        remoteCalendarUrl: "",
        refreshRemote: 5,
    }, 
    planner: { 
        actionItems: {},
        cells: {},
        templates: {}
    },
}