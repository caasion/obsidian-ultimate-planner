import type { Day } from "date-fns";
import type { TFile } from "obsidian";

/* Plugin Data Types */
export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

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
    taskStatus?: ' ' | '/' | 'x' | '-';
	startTime?: Time; // in ISO time
    progress?: number;
    duration?: number;
	timeUnit?: 'min' | 'hr';
	blockId?: string;         // Obsidian block ID (e.g. "aj23k")
	scheduledDate?: ISODate;  // Scheduled date from 📅 YYYY-MM-DD
	sourceRef?: string;       // Back-reference wikilink: "[[ProjectFile#^aj23k]]"
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
	startTime?: Time;
	duration?: number;
	timeUnit?: 'min' | 'hr';
	progress?: number;
}

export interface Phase {
	id: string;
	label: string;
	startDate?: ISODate;
	endDate?: ISODate;
	data: Element[];
}

export interface Project {
	id: string
	label: string;
	description: string;
    habits: Record<string, Habit>;
	phases: Phase[];

    file?: TFile;
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

