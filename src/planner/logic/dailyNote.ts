import type { App, EventRef, TFile } from "obsidian";
import type { Element, ISODate, PluginSettings, Track, TrackData } from "src/plugin/types";
import { getAllDailyNotes, getDailyNote, createDailyNote } from "obsidian-daily-notes-interface";
import { moment } from "obsidian";
import { Notice } from "obsidian";
import { PlannerParser } from "./parser";
import { get, writable, type Writable } from "svelte/store";

export interface DailyNoteServiceDeps {
    app: App;
    settings: PluginSettings;
    getTrackMetaSnapshot: () => Record<string, Track>;
}

export class DailyNoteService {
    private app: App;
    private settings: PluginSettings;
    private getTrackMetaSnapshot: () => Record<string, Track>;
    
    private isWriting: boolean = false;
    private writeTimers: Map<ISODate, number> = new Map();
    
    public parsedContent: Writable<Record<ISODate, Record<string, TrackData>>> = writable({});
    public parsedJournalContent: Writable<Record<ISODate, Record<string, string>>> = writable({});
    public intentions: Writable<Record<ISODate, string>> = writable({});

    // Bumped when the daily-notes cache becomes available (e.g. once the workspace
    // layout is ready). Consumers can depend on this store to re-trigger a load so
    // the view populates itself instead of waiting for the user to navigate.
    public revision: Writable<number> = writable(0);

    private fileModifyRef: EventRef | null = null;
    private watchedDates: ISODate[] = [];

    constructor(deps: DailyNoteServiceDeps) {
        this.app = deps.app;
        this.settings = deps.settings;
        this.getTrackMetaSnapshot = deps.getTrackMetaSnapshot;
    }

    // ===== Read operations ===== //

    /** Get the contents of a daily note file */
    private async getDailyNoteContents(file: TFile): Promise<string | null> {
        if (file) {
            return await this.app.vault.read(file);
        } else {
            return null;
        }
    }

    /** Load and parse content from a daily note */
    async loadDailyNoteContent(date: ISODate, trackMeta?: Record<string, Track>): Promise<Record<string, TrackData>> {
        const dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
        const contents = await this.getDailyNoteContents(dailyNoteFile);
        
        if (!contents) {
            return {};
        }
        
        const extracted = PlannerParser.extractSection(contents, this.settings.sectionHeading);
        const tracks = trackMeta ?? this.getTrackMetaSnapshot();
        const parsed = PlannerParser.parseTrackSection(extracted, tracks);
        
        return parsed;
    }

    /** Load and parse journal content from a daily note */
    async loadJournalContent(date: ISODate): Promise<Record<string, string>> {
        const dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
        const contents = await this.getDailyNoteContents(dailyNoteFile);
        
        if (!contents) {
            return {};
        }

        const extracted = PlannerParser.extractSection(contents, "📔 Logs");
        const parsed = PlannerParser.parseJournalSection(extracted);

        return parsed;
    }

    /** Load the intention frontmatter field from a daily note */
    async loadIntention(date: ISODate): Promise<string> {
        const dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
        if (!dailyNoteFile) return "";

        return new Promise((resolve) => {
            this.app.fileManager.processFrontMatter(dailyNoteFile, (fm) => {
                resolve(fm?.intention ?? "");
            });
        });
    }

    /** Save the intention frontmatter field to a daily note */
    async saveIntention(date: ISODate, intention: string): Promise<void> {
        let dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());

        if (!dailyNoteFile) {
            try {
                await createDailyNote(moment(date));
                dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
            } catch (error) {
                console.error("Error creating daily note for intention:", error);
                return;
            }
        }

        if (!dailyNoteFile) return;

        this.isWriting = true;
        try {
            await this.app.fileManager.processFrontMatter(dailyNoteFile, (fm) => {
                if (intention.trim()) {
                    fm.intention = intention.trim();
                } else {
                    delete fm.intention;
                }
            });
        } finally {
            window.setTimeout(() => {
                this.isWriting = false;
            }, 100);
        }

        this.intentions.update((prev) => ({ ...prev, [date]: intention.trim() }));
    }

    /** Load content for multiple dates */
    async loadMultipleDates(dates: ISODate[]): Promise<void> {
        if (this.isWriting) return;

        const result: Record<ISODate, Record<string, TrackData>> = {};
        const journalResult: Record<ISODate, Record<string, string>> = {};
        const intentionResult: Record<ISODate, string> = {};
        const trackMeta = this.getTrackMetaSnapshot();

        await Promise.all(
            dates.map(async (date) => {
                result[date] = await this.loadDailyNoteContent(date, trackMeta);
                journalResult[date] = await this.loadJournalContent(date);
                intentionResult[date] = await this.loadIntention(date);
            })
        );

        this.parsedContent.set(result);
        this.parsedJournalContent.set(journalResult);
        this.intentions.set(intentionResult);
    }

    /**
     * Signal that the environment (workspace layout / daily-notes cache) has
     * become ready. Bumps `revision` so subscribed views reload their content,
     * fixing the initial-render case where the cache was empty on first paint.
     */
    notifyReady(): void {
        this.revision.update((n) => n + 1);
    }

    // ===== Write operations ===== //

    /** Write content back to a daily note */
    async writeDailyNote(date: ISODate, tracks: Record<string, TrackData>): Promise<void> {
        this.isWriting = true;
        
        try {
            const dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
            
            if (!dailyNoteFile) {
                console.warn(`No daily note found for ${date}`);
                return;
            }
            
            const currentContent = await this.app.vault.read(dailyNoteFile);
            const trackMeta = this.getTrackMetaSnapshot();
            const newSection = PlannerParser.serializeTrackSection(trackMeta, tracks);
            const updatedContent = PlannerParser.replaceSection(currentContent, this.settings.sectionHeading, newSection);
            
            await this.app.vault.modify(dailyNoteFile, updatedContent); // Write back to file
                    } catch (error) {
            console.error(`Error writing to daily note for ${date}:`, error);
        } finally {
            // Add a small delay before allowing reads again
            window.setTimeout(() => {
                this.isWriting = false;
            }, 100);
        }
    }

    /** Debounced write function */
    debouncedWrite(date: ISODate): void {
        const existingTimer = this.writeTimers.get(date);
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        const timer = window.setTimeout(() => {
            this.writeTimers.delete(date);
            const latestByDate = get(this.parsedContent)[date];

            if (!latestByDate) return;
            void this.writeDailyNote(date, latestByDate);
        }, this.settings.autosaveDebounceMs ?? 500);

        this.writeTimers.set(date, timer);
    }

    // ===== File watchers ===== //

    /** Setup file watching for external changes */
    setupFileWatcher(dates: ISODate[]): void {
        // Clean up existing watcher
        this.cleanupFileWatcher();
        
        this.watchedDates = dates;
        
        this.fileModifyRef = this.app.vault.on('modify', async (file) => {
            if (this.isWriting) return;
            
            // Check if the modified file is one of our daily notes
            const allDailyNotes = getAllDailyNotes();
            const isDailyNote = Object.values(allDailyNotes).some(note => note.path === file.path);
            
            if (!isDailyNote) return;
            
            // Find which date(s) this file corresponds to
            for (const date of this.watchedDates) {
                const dailyNote = getDailyNote(moment(date), allDailyNotes);
                if (dailyNote && dailyNote.path === file.path) {
                    // Reload this date's content
                    const newContent = await this.loadDailyNoteContent(date);
                    this.parsedContent.update(content => ({
                        ...content,
                        [date]: newContent
                    }));
                    // Reload intention
                    const newIntention = await this.loadIntention(date);
                    this.intentions.update(prev => ({
                        ...prev,
                        [date]: newIntention
                    }));
                }
            }
        });
    }

    /** Clean up file watcher */
    cleanupFileWatcher(): void {
        if (this.fileModifyRef) {
            this.app.vault.offref(this.fileModifyRef);
            this.fileModifyRef = null;
        }
    }

    // ===== Update operations ===== //

    /** Update cell content */
    updateTrackCell(date: ISODate, trackId: string, updatedData: TrackData): void {
        if (updatedData.items.length === 0) {
            this.parsedContent.update(content => {
                const dateContent = { ...(content[date] ?? {}) };
                delete dateContent[trackId];
                return { ...content, [date]: dateContent };
            });
        } else {
            this.parsedContent.update(content => ({
                ...content,
                [date]: {
                    ...(content[date] ?? {}),
                    [trackId]: updatedData
                }
            }));
        }

        this.debouncedWrite(date);
    }

    /** Add a new item to an empty cell */
    async addNewTrackToCell(date: ISODate, trackId: string, timeCommitment?: number, initialItems?: Element[]): Promise<boolean> {
        // Check if daily note exists
        let dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
        
        if (!dailyNoteFile) {
            new Notice("Daily note doesn't exist. Creating it now...");
            
            try {
                await createDailyNote(moment(date));
                new Notice("Daily note created!");
                
                dailyNoteFile = getDailyNote(moment(date), getAllDailyNotes());
            } catch (error) {
                new Notice("Failed to create daily note");
                console.error("Error creating daily note:", error);
                return false;
            }
        }
        
        const newTrackData: TrackData = {
            id: trackId,
            time: timeCommitment ?? 0,
            items: initialItems ?? [{
                raw: "New Item",
                text: "New Item",
                children: [],
                isTask: false
            }]
        };
        
        // Update local state
        this.parsedContent.update(content => ({
            ...content,
            [date]: {
                ...content[date] || {},
                [trackId]: newTrackData
            }
        }));
        
        // Get current content and write immediately
        let currentDateContent: Record<string, TrackData> = {};
        this.parsedContent.subscribe(content => {
            if (content[date]) {
                currentDateContent = content[date];
            }
        })();
        
        await this.writeDailyNote(date, currentDateContent);
        
        // Reload content to ensure sync
        const reloadedContent = await this.loadDailyNoteContent(date);
        this.parsedContent.update(content => ({
            ...content,
            [date]: reloadedContent
        }));
        
        return true;
    }

    /** Open a daily note for a specific date */
    async openDailyNote(date: ISODate): Promise<void> {
        let dailyNoteFile: TFile | undefined = getDailyNote(moment(date), getAllDailyNotes());

        if (!dailyNoteFile) {
            // Create daily note
            new Notice("Daily note doesn't exist. Creating it now...");

            try {
                dailyNoteFile = await createDailyNote(moment(date));
                new Notice("Daily note created!");
            } catch (error) {
                new Notice("Failed to create daily note");
                console.error("Error creating daily note:", error);
                return;
            }
        }
        
        // Open the daily note
        if (dailyNoteFile) {
            await this.app.workspace.getLeaf(false).openFile(dailyNoteFile);
        }
    }

    // ===== Clean up ===== //

    /** Clean up resources */
    destroy(): void {
        this.cleanupFileWatcher();

        for (const timer of this.writeTimers.values()) {
            window.clearTimeout(timer);
        }
        this.writeTimers.clear();
    }
}
