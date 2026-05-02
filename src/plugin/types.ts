import type { Day } from "date-fns";
import type { Writable } from "svelte/store";
import ICAL from "ical.js";
import type { occurrenceDetails } from "ical.js/dist/types/types";
import type { RequestUrlResponse, TFile } from "obsidian";

/* Plugin Data Types */
export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)
export type CalendarID = string;

/* Plugin Daydata Datatypes */
export type Time = {
	hours: number; 
	minutes: number; 
}

export interface LineInfo {
	raw: string;
    level: number;
    text: string;
    isTask: boolean;
    checked?: boolean;
    metadata?: string;
}

// An object represents a task or an event\
export interface Element {
	raw: string;
	text: string;
	children: string[];
	isTask: boolean;
    taskStatus?: ' ' | 'x' | '-';
	startTime?: Time; // in ISO time
    progress?: number;
    duration?: number;
	timeUnit?: 'min' | 'hr';
}

/* NEW Plugin Template Datatypes */
export interface DateInterval {
    start: ISODate;
    end?: ISODate;
}

export interface Habit {
	id: string;
    raw: string;
	label: string;
	rrule: string;
}

export type PhaseStatus = 'unscheduled' | 'doing' | 'scheduled' | 'done';

export interface Phase {
	id: string;
	label: string;
	status?: PhaseStatus;
	startDate?: ISODate;
	endDate?: ISODate;
	data: Element[];
}

export interface Project {
	id: string
	label: string;
	description: string;
	startDate: ISODate;
    endDate?: ISODate;
    habits: Record<string, Habit>;
    data: Element[];
	phases: Phase[];
	hasPhases: boolean;

    file?: TFile;
}

export interface CalendarMeta {
    url: string;
    etag?: string;
    lastFetched?: number;
    lastModified?: string;
    contentHash?: string;
}

export interface Track {
    id: string;
    order: number;
    color: string;
    effective: DateInterval[];
    timeCommitment: number; 
	journalHeader: string;

    file?: TFile;
    
    label: string;
    description: string;
    projects: Record<string, Project>;
}

export interface TrackSnapshot {
    generatedAt: number;
    tracksHash?: string;
    tracks: Record<string, Track>;
}

export interface TrackFileFrontmatter {
    id: string;
    order: number;
    color: string;
    effective: DateInterval[];
    timeCommitment: number;
    journalHeader: string;
}

export interface TrackData {
    id: string;
    time?: number;
    items: Element[];
}

export interface RenderTrack {
    id: string;
    isStartOfInterval: boolean;
}

/* Plugin Template Datatypes */
export type TDate = ISODate;

export interface Template {
  id: string;
  name: string;
  effectiveFrom: ISODate; 
  tracks: string[];
}

export type Templates = Record<TDate, Template>;

export interface PlannerState {
    templates: Templates;
}

/* Planner Table Rendering */
export interface DateMapping {
    date: ISODate;
    tDate: TDate;
}

export interface BlockMeta {
    rows: number;
    dateTDateMapping: DateMapping[];
}

/* Data persistence */
export interface PluginData {
    version: number;
    settings: PluginSettings;
    trackSnapshot?: TrackSnapshot;
}

export interface PluginSettings {
    /* Rendering Settings */
    blocks: number;
    columns: number;
    weekFormat: boolean;
    weekStartOn: Day;

    /* Data Saving */
    autosaveDebounceMs: number;
    sectionHeading: string;

    /* Calendar Settings */
    refreshRemoteMs: number;
    lookaheadDays: number;

    /* Track Settings */
    trackFolder: string;
    projectNotesAsFolders: boolean;

    /* Developer Mode */
    debug: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
    blocks: 1,
    columns: 7,
    weekFormat: true,
    weekStartOn: 0,

    autosaveDebounceMs: 200,
    sectionHeading: "Holos",

    trackFolder: "Tracks",
    projectNotesAsFolders: false,

    refreshRemoteMs: 5 * 60 * 1000,
    lookaheadDays: 14,

    debug: false,
}

export type CalendarStatus = "idle" | "fetching" | "unchanged" | "updated" | "error";

/* Core Data Service */
export interface DataService {
    // Svelte Stores (The Writable objects themselves)
    templates: Writable<Record<ISODate, Record<string, Track>>>;
    calendarState: Writable<CalendarState>;
    fetchToken: Writable<number>;
}

// Core Helper Service Contract (Pure Functions from helper.ts)
export interface HelperService {
    hashText: (text: string) => Promise<string>;
    generateID: (prefix: string) => string;
    getISODate: (date: Date) => ISODate;
    getISODates: (anchor: ISODate, amount: number, weekStartsOn?: Day) => ISODate[];
    getLabelFromDateRange: (first: ISODate, last: ISODate) => string;
    addDaysISO: (iso: ISODate, n: number) => ISODate;
    swapArrayItems: <T>(array: T[], a: number, b: number) => T[]; 
    idUsedInTemplates: (templates: Record<ISODate, Record<string, Track>>, rowID: string) => boolean;
}

export interface CalendarHelperService {
    parseICS: (ics: string, calendarId: string) => NormalizedEvent[];
    parseICSBetween: (ics: string, calendarId: CalendarID, after: Date, before: Date) => NormalizedEvent[];
    normalizeEvent: (event: ICAL.Event, calendarId: CalendarID) => NormalizedEvent;
    normalizeOccurrenceEvent: (occurance: occurrenceDetails, calendarId: string) => NormalizedEvent;
    buildEventDictionaries: (events: NormalizedEvent[]) => { index: Record<ISODate, string[]>, eventsById: Record<string, NormalizedEvent> }
    getEventLabels: (events: NormalizedEvent[]) => string;
}

export interface FetchService {
    fetchFromUrl: (url: string, etag?: string, lastFetched?: string) => Promise<RequestUrlResponse>;
    detectFetchChange: (response: RequestUrlResponse, contentHash: string, oldContentHash?: string) => boolean;
}

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