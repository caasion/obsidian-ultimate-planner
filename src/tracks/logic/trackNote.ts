import { TFolder, type App, TFile, getAllTags, type FrontMatterCache, type EventRef, Menu, Notice, getFrontMatterInfo, parseYaml } from "obsidian";
import { PlannerParser } from "src/planner/logic/parser";
import { generateBlockId, getISODate } from "src/plugin/helpers";
import type { DateInterval, Element, Habit, ISODate, Phase, PluginSettings, Project, RenderTrack, Track, TrackFileFrontmatter, TrackSnapshot } from "src/plugin/types";
import { type Writable, get, writable } from "svelte/store";
import { hashTrackFileCacheEntries } from "./trackSnapshotHash";

interface TrackFiles {
    id: string | null;
    track: TFile | null;
    activeProjectId: string | null;
    projects: Record<string, TFile>;
}

export interface TrackNoteServiceDeps {
    app: App;
    settings: PluginSettings;
    parsedTracksContent: Writable<Record<string, Track>>;
    bootstrapTracks?: Record<string, Track>;
    onTracksSnapshot?: (snapshot: TrackSnapshot) => void;
}

export class TrackNoteService {
    private app: App;
    private settings: PluginSettings;

    public parsedTracksContent: Writable<Record<string, Track>>;
    public trackMetaRevision: Writable<number>;

    private trackFileCache: Record<string, TrackFiles> = {};
    private revisionCounter = 0;
    private onTracksSnapshot?: (snapshot: TrackSnapshot) => void;
    
    // Guard to prevent file watcher from reacting to our own programmatic writes.
    // Uses a counter (not a boolean) so overlapping async writes don't cancel each other.
    // Decremented after a short delay so the vault event has time to fire and be filtered.
    private internalUpdateCount = 0;
    private get isUpdatingInternally(): boolean {
        return this.internalUpdateCount > 0;
    }
    private beginInternalUpdate(): void {
        this.internalUpdateCount++;
    }
    private endInternalUpdate(): void {
        setTimeout(() => { this.internalUpdateCount = Math.max(0, this.internalUpdateCount - 1); }, 100);
    }
    
    // File watcher references
    private fileModifyRef: EventRef | null = null;
    private fileCreateRef: EventRef | null = null;
    private fileDeleteRef: EventRef | null = null;
    private fileRenameRef: EventRef | null = null;

    constructor(deps: TrackNoteServiceDeps) {
        this.app = deps.app;
        this.settings = deps.settings;
        this.parsedTracksContent = deps.parsedTracksContent;

        this.trackMetaRevision = writable<number>(0);
        this.onTracksSnapshot = deps.onTracksSnapshot;

        if (deps.bootstrapTracks && Object.keys(deps.bootstrapTracks).length > 0) {
            this.hydrateFromSnapshot(deps.bootstrapTracks);
        }
    }

    /** Compute tracksByDate index on-demand for only the requested dates */
    getTracksForDates(dates: ISODate[], columns: number = dates.length): Record<ISODate, RenderTrack[]> {
        const tracks = get(this.parsedTracksContent);
        const today = getISODate(new Date());
        const index: Record<ISODate, RenderTrack[]> = {};

        for (const date of dates) {
            index[date] = [];
        }

        const sortedTrackIds = Object.entries(tracks)
            .sort(([, a], [, b]) => {
                const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
                const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;

                if (orderA !== orderB) return orderA - orderB;
                return a.label.localeCompare(b.label);
            })
            .map(([trackId]) => trackId);

        const safeColumns = Math.max(1, columns);

        for (let blockStart = 0; blockStart < dates.length; blockStart += safeColumns) {
            const blockDates = dates.slice(blockStart, blockStart + safeColumns);
            const rowAssignments: Array<string | null> = [];
            const assignedTrackIds = new Set<string>();

            for (let dayIndex = 0; dayIndex < blockDates.length; dayIndex++) {
                const date = blockDates[dayIndex];
                const activeTrackIds = sortedTrackIds.filter((trackId) => {
                    const track = tracks[trackId];
                    return track ? this.isTrackActiveOnDate(track, date, today) : false;
                });
                const activeTrackSet = new Set(activeTrackIds);

                for (let row = 0; row < rowAssignments.length; row++) {
                    const trackId = rowAssignments[row];
                    if (!trackId) continue;

                    if (!activeTrackSet.has(trackId)) {
                        rowAssignments[row] = null;
                        assignedTrackIds.delete(trackId);
                    }
                }

                const unassignedActiveTrackIds = activeTrackIds.filter((trackId) => !assignedTrackIds.has(trackId));
                const startingTrackIds = unassignedActiveTrackIds.filter((trackId) => {
                    const track = tracks[trackId];
                    return track ? this.isTrackStartingOnDate(track, date) : false;
                });
                const carryOverTrackIds = unassignedActiveTrackIds.filter((trackId) => !startingTrackIds.includes(trackId));

                const placementQueue = dayIndex === 0
                    ? unassignedActiveTrackIds
                    : [...startingTrackIds, ...carryOverTrackIds];

                for (const trackId of placementQueue) {
                    let row = rowAssignments.findIndex((value) => value === null);

                    if (row === -1) {
                        row = rowAssignments.length;
                        rowAssignments.push(trackId);
                    } else {
                        rowAssignments[row] = trackId;
                    }

                    assignedTrackIds.add(trackId);
                }

                const rowsForDate: RenderTrack[] = [];
                for (let row = 0; row < rowAssignments.length; row++) {
                    const trackId = rowAssignments[row];
                    if (!trackId || !activeTrackSet.has(trackId)) continue;

                    const track = tracks[trackId];
                    rowsForDate[row] = {
                        id: trackId,
                        isStartOfInterval: track ? this.isTrackStartingOnDate(track, date) : false,
                    };
                }

                index[date] = rowsForDate;
            }
        }

        return index;
    }

    private resolveIntervalEnd(intervalStart: ISODate, intervalEnd: ISODate | undefined, today: ISODate): ISODate {
        if (intervalEnd) return intervalEnd;
        return intervalStart > today ? intervalStart : today;
    }

    private isTrackActiveOnDate(track: Track, date: ISODate, today: ISODate): boolean {
        const { start, end } = track.effective;
        const resolvedEnd = this.resolveIntervalEnd(start, end, today);
        return date >= start && date <= resolvedEnd;
    }

    private isTrackStartingOnDate(track: Track, date: ISODate): boolean {
        return track.effective.start === date;
    }

    private stripFileReferences(tracks: Record<string, Track>): Record<string, Track> {
        const stripped: Record<string, Track> = {};

        for (const [trackId, track] of Object.entries(tracks)) {
            const { file: _trackFile, projects, ...trackWithoutFile } = track;
            const sanitizedProjects: Record<string, Project> = {};

            for (const [projectId, project] of Object.entries(projects)) {
                const { file: _projectFile, ...projectWithoutFile } = project;
                sanitizedProjects[projectId] = projectWithoutFile;
            }

            stripped[trackId] = {
                ...trackWithoutFile,
                projects: sanitizedProjects,
            };
        }

        return stripped;
    }

    private publishTrackState(
        tracks: Record<string, Track>,
        persistSnapshot: boolean
    ): void {
        this.parsedTracksContent.set(tracks);

        this.revisionCounter += 1;
        this.trackMetaRevision.set(this.revisionCounter);

        if (persistSnapshot && this.onTracksSnapshot) {
            this.onTracksSnapshot({
                generatedAt: Date.now(),
                tracksHash: hashTrackFileCacheEntries(Object.values(this.trackFileCache)),
                tracks: this.stripFileReferences(tracks),
            });
        }
    }

    private hydrateFromSnapshot(tracks: Record<string, Track>): void {
        const normalized: Record<string, Track> = {};
        for (const [trackId, track] of Object.entries(tracks)) {
            const projects: Record<string, Project> = {};
            for (const [projectId, project] of Object.entries(track.projects)) {
                projects[projectId] = {
                    id: project.id,
                    label: project.label,
                    description: project.description ?? '',
                    habits: project.habits ?? {},
                    phases: project.phases ?? [],
                    file: project.file,
                };
            }
            normalized[trackId] = { ...track, projects };
        }
        this.publishTrackState(normalized, false);
    }

    private normalizeISODate(value: unknown): string | null {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed ? trimmed : null;
        }

        if (typeof value === 'number') {
            return String(value);
        }

        return null;
    }

    private parseEffective(frontmatter?: FrontMatterCache['frontmatter']): DateInterval {
        const rawEffective = frontmatter?.effective;

        // Support legacy array format: take the first interval
        if (Array.isArray(rawEffective) && rawEffective.length > 0) {
            const first = rawEffective[0];
            if (first && typeof first === 'object') {
                const record = first as Record<string, unknown>;
                const start = this.normalizeISODate(record.start);
                const end = this.normalizeISODate(record.end);
                if (start) return end ? { start, end } : { start };
            }
        }

        // Single object format
        if (rawEffective && typeof rawEffective === 'object' && !Array.isArray(rawEffective)) {
            const record = rawEffective as Record<string, unknown>;
            const start = this.normalizeISODate(record.start);
            const end = this.normalizeISODate(record.end);
            if (start) return end ? { start, end } : { start };
        }

        return { start: getISODate(new Date()) };
    }
    
    async initializeTracksByDate(): Promise<void> {
        await this.loadAllTrackContent();
    }
    
    // ===== Read operations ===== //

    async loadAllTrackContent(): Promise<void> {
        if (!this.trackFileCache || Object.keys(this.trackFileCache).length === 0) {
            await this.populateFileCache();
        }

        const tracks: Record<string, Track> = {};

        for (const key in this.trackFileCache) {
            const track = await this.loadTrackContent(key, this.trackFileCache[key])
            if (!track) continue;

            tracks[key] = track;
        }

        this.publishTrackState(tracks, true);
    }

    async populateFileCache(): Promise<void> {
        this.trackFileCache = {};
        
        const trackFolder = this.app.vault.getFolderByPath(this.settings.trackFolder);
        if (!trackFolder) return;
        
        for (const child of trackFolder.children) {
            if (child instanceof TFolder) {
                const trackFiles = await this.findFilesInFolder(child);
                
                // Only add to cache if we found a valid track with an ID
                if (trackFiles.id && trackFiles.track) {
                    this.trackFileCache[trackFiles.id] = trackFiles;
                }
            }
        }
    }

    private collectMarkdownFiles(folder: TFolder): TFile[] {
        const markdownFiles: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === "md") {
                markdownFiles.push(child);
                continue;
            }

            if (child instanceof TFolder) {
                for (const nestedChild of child.children) {
                    if (nestedChild instanceof TFile && nestedChild.extension === "md") {
                        markdownFiles.push(nestedChild);
                    }
                }
            }
        }

        return markdownFiles;
    }

    private async findFilesInFolder(folder: TFolder): Promise<TrackFiles> {
        const files: TrackFiles = { id: null, track: null, activeProjectId: null, projects: {}}
        const markdownFiles = this.collectMarkdownFiles(folder);

        for (const file of markdownFiles) {
            let cache = this.app.metadataCache.getFileCache(file);

            if (!cache) {
                await new Promise<void>(resolve => {
                    const ref = this.app.metadataCache.on('changed', (changedFile) => {
                        if (changedFile.path === file.path) {
                            this.app.metadataCache.offref(ref);
                            resolve();
                        }
                    });

                    setTimeout(() => {
                        this.app.metadataCache.offref(ref);
                        resolve();
                    }, 1000);
                })

                cache = this.app.metadataCache.getFileCache(file);
            }

            const frontmatter = cache?.frontmatter;
            const id = frontmatter?.id ?? null;
            if (!id) continue;

            const tags = cache ? getAllTags(cache) || [] : [];

            const isTrack = tags.includes('#holos/track') || frontmatter?.tags?.includes('holos/track');
            const isProject = tags.includes('#holos/project') || frontmatter?.tags?.includes('holos/project');
            
            const isActiveProject = frontmatter?.activeProject ?? false;

            if (isTrack) {
                files.id = id;
                files.track = file;
            } else if (isProject) {
                files.projects[id] = file;
                if (isActiveProject) files.activeProjectId = id;
            }
        }

        return files;
    }

    private async loadTrackContent(id: string, trackFiles: TrackFiles, forceFrontmatterUpdate: boolean = false): Promise<Track | null> {
        // Track content
        const trackFile = trackFiles.track ?? null;
        if (!trackFile) return null;

        const cache = this.app.metadataCache.getFileCache(trackFile);
        let frontmatter = cache?.frontmatter;
        const trackContent = await this.app.vault.read(trackFile);

        if (forceFrontmatterUpdate) {
            const frontmatterInfo = getFrontMatterInfo(trackContent)
            if (frontmatterInfo.exists) {
                frontmatter = parseYaml(frontmatterInfo.frontmatter);
            } else {
                console.warn("Manual frontmatter read and processing failed")
            }
        } 

        if (!trackContent || !frontmatter) return null;
        
        if (!("order" in frontmatter)) {
            console.warn(`${trackFile.name} is missing order. Aborting.`);
            return null;
        }

        const { order, timeCommitment, journalHeader } = frontmatter;
        const effective = this.parseEffective(frontmatter);

        const color = frontmatter.color ?? "#cccccc";

        const description = PlannerParser.extractFirstSection(trackContent);

        // Projects
        const projects: Record<string, Project> = {};

        for (const [id, file] of Object.entries(trackFiles.projects)) {
            const projectData = await this.loadProjectContent(id, file, forceFrontmatterUpdate);
            if (!projectData) continue;

            projects[id] = projectData;
        }
        
        return {
            id,
            order,
            color,
            effective,
            timeCommitment,
            journalHeader,
            file: trackFile,
            
            label: trackFile.basename,
            description,
            projects
        }
    }

    private async loadProjectContent(id: string, projectFile: TFile, forceFrontmatterUpdate: boolean = false): Promise<Project | null> {
        const cache = this.app.metadataCache.getFileCache(projectFile);
        let frontmatter = cache?.frontmatter;
        const projectContent = await this.app.vault.read(projectFile);

        if (forceFrontmatterUpdate) {
            const frontmatterInfo = getFrontMatterInfo(projectContent)
            if (frontmatterInfo.exists) {
                frontmatter = parseYaml(frontmatterInfo.frontmatter);
            } else {
                console.warn("Manual frontmatter read and processing failed")
            }
        }

        if (!projectContent || !frontmatter) return null;

        // Parse habits section
        const habitSection = PlannerParser.extractSection(projectContent, "Habits");
        const habits = PlannerParser.parseHabitSection(habitSection);

        const phasesSection = PlannerParser.extractSection(projectContent, "Phases");
        const phases = PlannerParser.parsePhasesSection(phasesSection);

        const description = PlannerParser.extractFirstSection(projectContent);

        // Auto-generate block IDs for elements that don't have them
        let needsWrite = false;
        const assignBlockIds = (elements: Element[]) => {
            for (const el of elements) {
                if (el.isTask && !el.blockId) {
                    el.blockId = generateBlockId();
                    needsWrite = true;
                }
            }
        };

        for (const phase of phases) {
            assignBlockIds(phase.data);
        }

        if (needsWrite) {
            const newPhasesSection = PlannerParser.serializePhasesSection(phases);
            let updatedContent = PlannerParser.replaceSection(projectContent, 'Phases', newPhasesSection);

            this.beginInternalUpdate();
            await this.app.vault.modify(projectFile, updatedContent);
            this.endInternalUpdate();
        }

        return {
            id,
            label: projectFile.basename,
            file: projectFile,
            description,
            habits,
            phases,
        };
    }

    // ===== Migration ===== //

    /** Migrate all task-based projects to phase-based format. Returns the number of projects migrated. */
    async migrateProjectsToPhases(): Promise<number> {
        if (!this.trackFileCache || Object.keys(this.trackFileCache).length === 0) {
            await this.populateFileCache();
        }

        let migrated = 0;

        for (const trackFiles of Object.values(this.trackFileCache)) {
            for (const [id, projectFile] of Object.entries(trackFiles.projects)) {
                const didMigrate = await this.migrateProjectFile(projectFile);
                if (didMigrate) migrated++;
            }
        }

        if (migrated > 0) {
            await this.loadAllTrackContent();
        }

        return migrated;
    }

    /** Migrate a single project file from task-based to phase-based. Returns true if migration was performed. */
    private async migrateProjectFile(projectFile: TFile): Promise<boolean> {
        const cache = this.app.metadataCache.getFileCache(projectFile);
        const frontmatter = cache?.frontmatter;
        const projectContent = await this.app.vault.read(projectFile);

        if (!projectContent || !frontmatter) return false;

        const hasPhases = frontmatter?.phases === true;
        if (hasPhases) return false; // Already migrated

        // Parse old task data
        const dataSection = PlannerParser.extractSection(projectContent, "Data") || PlannerParser.extractSection(projectContent, "Tasks");
        const data = PlannerParser.parseTaskSection(dataSection);
        const phases: Phase[] = [{
            id: 'phase-0',
            label: 'Phase 1',
            startDate: frontmatter.startDate,
            endDate: frontmatter.endDate,
            data,
        }];

        // Update frontmatter: add phases: true, remove startDate/endDate
        let updatedContent = projectContent.replace(
            /^(---[\s\S]*?)(?=\n---)/m,
            (match) => {
                let result = match;
                if (!result.includes('phases:')) {
                    result += '\nphases: true';
                } else {
                    result = result.replace(/phases:\s*false/, 'phases: true');
                }
                result = result.replace(/\nstartDate:.*$/m, '');
                result = result.replace(/\nendDate:.*$/m, '');
                return result;
            }
        );

        // Remove Data/Tasks section and add Phases section
        updatedContent = PlannerParser.replaceSection(updatedContent, 'Data', '');
        updatedContent = PlannerParser.replaceSection(updatedContent, 'Tasks', '');
        const phasesContent = PlannerParser.serializePhasesSection(phases);
        updatedContent = PlannerParser.replaceSection(updatedContent, 'Phases', phasesContent);

        this.beginInternalUpdate();
        await this.app.vault.modify(projectFile, updatedContent);
        this.endInternalUpdate();

        console.log(`[Holos] Migrated project: ${projectFile.basename}`);
        return true;
    }

    // ===== File watchers ===== //

    /** Invalidate the entire cache and reload all tracks */
    async invalidateCache(): Promise<void> {
        await this.populateFileCache();
        await this.loadAllTrackContent();
    }

    /** Refresh a single track by ID */
    async refreshTrack(trackId: string): Promise<void> {
        const trackFiles = this.trackFileCache[trackId];
        if (!trackFiles) {
            console.warn(`Track ${trackId} not found in cache`);
            return;
        }

        const track = await this.loadTrackContent(trackId, trackFiles, true);
        if (!track) {
            console.warn(`Failed to load track ${trackId}`);
            return;
        }

        const nextTracks = {
            ...get(this.parsedTracksContent),
            [trackId]: track
        };

        this.publishTrackState(nextTracks, true);
    }

    async openTrackFile(trackId: string): Promise<boolean> {
        const trackFile = this.trackFileCache[trackId]?.track;
        if (!trackFile) {
            new Notice(`Track file not found for ${trackId}`);
            return false;
        }

        await this.app.workspace.getLeaf(false).openFile(trackFile);
        return true;
    }

    async openProjectFile(trackId: string, projectId: string): Promise<boolean> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            new Notice(`Project file not found for ${projectId}`);
            return false;
        }

        await this.app.workspace.getLeaf(false).openFile(projectFile);
        return true;
    }

    /** Find the track ID for a given file path */
    private findTrackIdByPath(filePath: string): string | null {
        for (const [trackId, trackFiles] of Object.entries(this.trackFileCache)) {
            if (trackFiles.track?.path === filePath) {
                return trackId;
            }
            for (const projectFile of Object.values(trackFiles.projects)) {
                if (projectFile.path === filePath) {
                    return trackId;
                }
            }
        }
        return null;
    }

    /** Check if a file is within the track folder */
    private isInTrackFolder(filePath: string): boolean {
        return filePath.startsWith(this.settings.trackFolder + "/");
    }

    /** Setup file watchers for automatic cache updates */
    setupFileWatchers(): void {
        this.cleanupFileWatchers();

        // Watch for file modifications
        this.fileModifyRef = this.app.vault.on('modify', async (file) => {
            // Skip if we're making the change internally
            if (this.isUpdatingInternally) return;
            
            if (!(file instanceof TFile) || !this.isInTrackFolder(file.path)) return;

            const trackId = this.findTrackIdByPath(file.path);
            if (trackId) {
                await this.refreshTrack(trackId);
            }
        });

        // Watch for file creation
        this.fileCreateRef = this.app.vault.on('create', async (file) => {
            if (!(file instanceof TFile) || !this.isInTrackFolder(file.path)) return;

            await this.invalidateCache();
        });

        // Watch for file deletion
        this.fileDeleteRef = this.app.vault.on('delete', async (file) => {
            if (!(file instanceof TFile) || !this.isInTrackFolder(file.path)) return;

            await this.invalidateCache();
        });

        // Watch for file rename
        this.fileRenameRef = this.app.vault.on('rename', async (file, oldPath) => {
            if (!(file instanceof TFile)) return;
            
            const wasInTrackFolder = this.isInTrackFolder(oldPath);
            const isInTrackFolder = this.isInTrackFolder(file.path);

            // If moved into or out of track folder, or renamed within folder
            if (wasInTrackFolder || isInTrackFolder) {
                await this.invalidateCache();
            }
        });
    }

    /** Clean up file watchers */
    cleanupFileWatchers(): void {
        if (this.fileModifyRef) {
            this.app.vault.offref(this.fileModifyRef);
            this.fileModifyRef = null;
        }
        if (this.fileCreateRef) {
            this.app.vault.offref(this.fileCreateRef);
            this.fileCreateRef = null;
        }
        if (this.fileDeleteRef) {
            this.app.vault.offref(this.fileDeleteRef);
            this.fileDeleteRef = null;
        }
        if (this.fileRenameRef) {
            this.app.vault.offref(this.fileRenameRef);
            this.fileRenameRef = null;
        }
    }

    // ===== Track-level operation ===== // 

    /** Create a new track with folder structure */
    async createTrack(track: Track): Promise<boolean> {
        try {
            // Create the track folder
            const trackFolderPath = `${this.settings.trackFolder}/${track.label}`;
            const trackFolder = this.app.vault.getFolderByPath(trackFolderPath);
            
            if (!trackFolder) {
                await this.app.vault.createFolder(trackFolderPath);
            }

            // Create the track file
            const trackFilePath = `${trackFolderPath}/${track.label}.md`;
            const trackContent = this.generateTrackContent(track);
            await this.app.vault.create(trackFilePath, trackContent);

            return true;
        } catch (error) {
            console.error('Error creating track:', error);
            return false;
        }
    }

    /** Generate track file content from Track object */
    private generateTrackContent(track: Track): string {
        const lines: string[] = [];

        // Frontmatter
        lines.push('---');
        lines.push('tags:');
        lines.push('  - holos/track');
        lines.push(`id: ${track.id}`);
        lines.push(`order: ${track.order}`);
        lines.push(`color: "${track.color}"`);
        lines.push('effective:');
        lines.push(`  start: ${track.effective.start}`);
        if (track.effective.end) {
            lines.push(`  end: ${track.effective.end}`);
        }
        lines.push(`timeCommitment: ${track.timeCommitment}`);
        lines.push(`journalHeader: ${track.journalHeader}`);
        lines.push('---');
        lines.push('');

        // Description
        if (track.description) {
            lines.push(track.description);
            lines.push('');
        }

        return lines.join('\n');
    }

    /** Update track label, which updates the name of the track folder and the file. */
    async updateTrackLabel(trackId: string, label: string) {
        const trackFiles = this.trackFileCache[trackId];

        if (!trackFiles || !trackFiles.track) {
            console.warn(`Track ${trackId} not found`);
            return false;
        }

        const trackFile = trackFiles.track;
        const oldFolder = trackFile.parent;
        if (!oldFolder) {
            throw new Error(`Error while editing updating track label of track ${trackId}: Old folder not found.`)
        }
        
        const newFolderPath = `${this.settings.trackFolder}/${label}`;
        const newTrackPath = `${newFolderPath}/${label}.md`;

        // Instant responsive UI change
        this.parsedTracksContent.update(tracks => ({
            ...tracks,
            [trackId]: {
                ...tracks[trackId],
                label
            }
        }));

        // File system & cache changes (flagged as internal)
        this.beginInternalUpdate();
        try {
            // Rename folder first, then rename the track file within the renamed folder
            await this.app.fileManager.renameFile(oldFolder, newFolderPath);
            
            // After folder rename, get the updated file reference
            const renamedTrackFile = this.app.vault.getFileByPath(`${newFolderPath}/${trackFile.name}`);
            if (renamedTrackFile) {
                await this.app.fileManager.renameFile(renamedTrackFile, newTrackPath);
            }
            
            await this.invalidateCache();
        } finally {
            this.endInternalUpdate();
        }

        return true;
    }

    /** Update track properties which affect the file frontmatter atomically. */
    async updateTrackFrontmatter(trackId: string, frontmatter: Partial<TrackFileFrontmatter>) {
        const trackFiles = this.trackFileCache[trackId];

        if (!trackFiles || !trackFiles.track) {
            console.warn(`Track ${trackId} not found`);
            return false;
        }

        const trackFile = trackFiles.track;

        this.beginInternalUpdate();
        try {
            await this.app.fileManager.processFrontMatter(trackFile, (oldFrontmatter) => {
                for (const [key, value] of Object.entries(frontmatter)) {
                    oldFrontmatter[key] = value;
                }
            });
        } finally {
            this.endInternalUpdate();
        }

        // Direct update - no race condition now
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track) return tracks;

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    ...frontmatter
                }
            };
        });

        return true;
    }

    /** Update track color. */
    async updateTrackColor(trackId: string, color: string): Promise<boolean> {
        const nextColor = color.trim();
        if (!nextColor) return false;

        const success = await this.updateTrackFrontmatter(trackId, { color: nextColor });
        return success;
    }

    /** Update track description. */
    async updateTrackDescription(trackId: string, description: string) {
        try {
            const trackFiles = this.trackFileCache[trackId];
            if (!trackFiles || !trackFiles.track) {
                console.warn(`Track ${trackId} not found`);
                return false;
            }

            const file = trackFiles.track;
            const content = await this.app.vault.read(file);
            
            const updatedContent = PlannerParser.replaceFirstSection(content, description);
            
            this.beginInternalUpdate();
            try {
                await this.app.vault.modify(file, updatedContent);
            } finally {
                this.endInternalUpdate();
            }

            // Direct update - change description in memory
            this.parsedTracksContent.update(tracks => ({
                ...tracks,
                [trackId]: {
                    ...tracks[trackId],
                    description
                }
            }));
            
            return true;
        } catch (error) {
            console.error('Error updating track description:', error);
            return false;
        }
    }

    /** Create a new project in a track */
    async createProject(trackId: string, project: Project): Promise<boolean> {
        try {
            const trackFiles = this.trackFileCache[trackId];
            if (!trackFiles || !trackFiles.track) {
                console.warn(`Track ${trackId} not found`);
                return false;
            }

            const trackFolder = trackFiles.track.parent;
            if (!trackFolder) return false;

            const projectContent = this.generateProjectContent(project);

            if (this.settings.projectNotesAsFolders) {
                const projectFolderPath = `${trackFolder.path}/${project.label}`;
                if (!this.app.vault.getFolderByPath(projectFolderPath)) {
                    await this.app.vault.createFolder(projectFolderPath);
                }

                const projectFilePath = `${projectFolderPath}/${project.label}.md`;
                await this.app.vault.create(projectFilePath, projectContent);
            } else {
                const projectFilePath = `${trackFolder.path}/${project.label}.md`;
                await this.app.vault.create(projectFilePath, projectContent);
            }

            await this.invalidateCache();
            return true;
        } catch (error) {
            console.error('Error creating project:', error);
            return false;
        }
    }

    newProjectFactory(trackId: string): Project {
        const id = crypto.randomUUID();
        const today = getISODate(new Date());

        // Get existing projects in this track
        const track = this.getTrack(trackId);
        const existingLabels = track ? Object.values(track.projects).map(p => p.label) : [];
        
        // Find all "New Project" variations
        const newProjectPattern = /^New Project( (\d+))?$/;
        const numbers: number[] = [];
        
        for (const label of existingLabels) {
            const match = label.match(newProjectPattern);
            if (match) {
                if (match[2]) {
                    // "New Project N" format
                    numbers.push(parseInt(match[2], 10));
                } else {
                    // Just "New Project" - treat as 0
                    numbers.push(0);
                }
            }
        }
        
        // Determine the next label
        let label = 'New Project';
        if (numbers.length > 0) {
            const maxNumber = Math.max(...numbers);
            label = `New Project ${maxNumber + 1}`;
        }

        return {
            id,
            label,
            description: '',
            habits: {},
            phases: [{
                id: 'phase-0',
                label: 'Phase 1',
                startDate: today,
                data: [],
            }],
        }
    }

    /** Generate project file content from Project object */
    private generateProjectContent(project: Project): string {
        const lines: string[] = [];

        // Frontmatter
        lines.push('---');
        lines.push('tags:');
        lines.push('  - holos/project');
        lines.push(`id: ${project.id}`);
        lines.push('phases: true');
        lines.push('---');
        lines.push('');

        // Habits section
        lines.push('## Habits');
        lines.push('');
        for (const habit of Object.values(project.habits)) {
            const rruleStr = habit.rrule ? ` (${habit.rrule})` : '';
            lines.push(`- ${habit.label}${rruleStr}`);
        }
        lines.push('');

        // Phases section
        lines.push('## Phases');
        lines.push('');
        lines.push(PlannerParser.serializePhasesSection(project.phases));

        return lines.join('\n');
    }

    /** Delete a track and its folder */
    async deleteTrack(trackId: string): Promise<boolean> {
        try {
            const trackFiles = this.trackFileCache[trackId];
            if (!trackFiles || !trackFiles.track) {
                console.warn(`Track ${trackId} not found`);
                return false;
            }

            const trackFolder = trackFiles.track.parent;
            if (!trackFolder) return false;

            // Delete the entire track folder (including all projects)
            await this.app.vault.delete(trackFolder, true);

            new Notice('Track deleted successfully');

            return true;
        } catch (error) {
            console.error('Error deleting track:', error);
            return false;
        }
    }

    // ===== Project-level operations ===== //

    /** Update project label (renames the file) */
    async updateProjectLabel(trackId: string, projectId: string, label: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        const trackFolder = this.trackFileCache[trackId]?.track?.parent;
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }
        if (!trackFolder) {
            console.warn(`Track folder not found for track ${trackId}`);
            return;
        }

        const projectParent = projectFile.parent;
        const isFolderNote = !!projectParent && projectParent.path !== trackFolder.path;
        
        this.beginInternalUpdate();
        try {
            if (isFolderNote && projectParent) {
                const newProjectFolderPath = `${trackFolder.path}/${label}`;
                await this.app.fileManager.renameFile(projectParent, newProjectFolderPath);

                const renamedProjectFile = this.app.vault.getFileByPath(`${newProjectFolderPath}/${projectFile.name}`);
                if (!renamedProjectFile) {
                    console.warn(`Renamed project file not found for project ${projectId}`);
                    return;
                }

                await this.app.fileManager.renameFile(renamedProjectFile, `${newProjectFolderPath}/${label}.md`);
            } else {
                const newPath = `${projectParent?.path ?? trackFolder.path}/${label}.md`;
                await this.app.fileManager.renameFile(projectFile, newPath);
            }
        } finally {
            this.endInternalUpdate();
        }

        // Direct update - change project label in memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            label
                        }
                    }
                }
            };
        });
    }

    /** Update project description (first section) */
    async updateProjectDescription(trackId: string, projectId: string, description: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const updated = PlannerParser.replaceFirstSection(content, description);
        
        this.beginInternalUpdate();
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.endInternalUpdate();
        }

        // Direct update - change project description in memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            description
                        }
                    }
                }
            };
        });
    }

    /** Delete a project file or folder-note directory */
    async deleteProject(trackId: string, projectId: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        const trackFolder = this.trackFileCache[trackId]?.track?.parent;
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const projectParent = projectFile.parent;
        const isFolderNote = !!trackFolder && !!projectParent && projectParent.path !== trackFolder.path;

        if (isFolderNote && projectParent) {
            await this.app.vault.delete(projectParent, true);
        } else {
            await this.app.vault.delete(projectFile);
        }

        await this.refreshTrack(trackId);
    }

    // ===== Project Habit operations ===== //

    /** Add a new habit to a project */
    async addProjectHabit(trackId: string, projectId: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const newHabitId = `habit-${Date.now()}`;
        const newHabit: Habit = {
            id: newHabitId,
            raw: "- New Habit",
            label: "New Habit",
            rrule: ""
        };

        const content = await this.app.vault.read(projectFile);
        const habitSection = PlannerParser.extractSection(content, "Habits");
        const habits = PlannerParser.parseHabitSection(habitSection);
        
        habits[newHabitId] = newHabit;
        
        const newHabitsSection = PlannerParser.serializeHabits(habits);
        const updated = PlannerParser.replaceSection(content, 'Habits', newHabitsSection);
        
        this.beginInternalUpdate();
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.endInternalUpdate();
        }

        // Direct update - add habit to memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            habits: {
                                ...track.projects[projectId].habits,
                                [newHabitId]: newHabit
                            }
                        }
                    }
                }
            };
        });
    }

    /** Update a specific habit in a project */
    async updateProjectHabit(trackId: string, projectId: string, habitId: string, habit: Habit): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const habitSection = PlannerParser.extractSection(content, "Habits");
        const habits = PlannerParser.parseHabitSection(habitSection);
        
        habits[habitId] = habit;
        
        const newHabitsSection = PlannerParser.serializeHabits(habits);
        const updated = PlannerParser.replaceSection(content, 'Habits', newHabitsSection);
        
        this.beginInternalUpdate();
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.endInternalUpdate();
        }

        // Direct update - update habit in memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            habits: {
                                ...track.projects[projectId].habits,
                                [habitId]: habit
                            }
                        }
                    }
                }
            };
        });
    }

    /** Delete a habit from a project */
    async deleteProjectHabit(trackId: string, projectId: string, habitId: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const habitSection = PlannerParser.extractSection(content, "Habits");
        const habits = PlannerParser.parseHabitSection(habitSection);
        
        delete habits[habitId];
        
        const newHabitsSection = PlannerParser.serializeHabits(habits);
        const updated = PlannerParser.replaceSection(content, 'Habits', newHabitsSection);
        
        this.beginInternalUpdate();
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.endInternalUpdate();
        }

        // Direct update - remove habit from memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            const newHabits = { ...track.projects[projectId].habits };
            delete newHabits[habitId];

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            habits: newHabits
                        }
                    }
                }
            };
        });
    }

    // ===== Project data operations ===== //

    // ===== Project Phase operations ===== //

    /** Helper: read phases from file, apply mutation, write back, update store */
    private async mutatePhases(
        trackId: string,
        projectId: string,
        mutate: (phases: Phase[]) => Phase[]
    ): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const phasesSection = PlannerParser.extractSection(content, "Phases");
        const phases = PlannerParser.parsePhasesSection(phasesSection);
        const newPhases = mutate(phases);
        const serialized = PlannerParser.serializePhasesSection(newPhases);
        const updated = PlannerParser.replaceSection(content, 'Phases', serialized);

        this.beginInternalUpdate();
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.endInternalUpdate();
        }

        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;
            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            phases: newPhases
                        }
                    }
                }
            };
        });
    }

    /** Add a new phase to a project */
    async addProjectPhase(trackId: string, projectId: string): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) => [
            ...phases,
            {
                id: `phase-${phases.length}`,
                label: 'New Phase',
                data: [],
            }
        ]);
    }

    /** Update a phase's label */
    async updateProjectPhaseLabel(trackId: string, projectId: string, phaseId: string, label: string): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => p.id === phaseId ? { ...p, label } : p)
        );
    }

    /** Update a phase's dates */
    async updateProjectPhaseDates(trackId: string, projectId: string, phaseId: string, startDate?: ISODate, endDate?: ISODate): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => p.id === phaseId ? { ...p, startDate, endDate } : p)
        );
    }

    /** Delete a phase from a project */
    async deleteProjectPhase(trackId: string, projectId: string, phaseId: string): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.filter(p => p.id !== phaseId)
        );
    }

    /** Reorder a phase within a project */
    async reorderProjectPhase(trackId: string, projectId: string, fromIndex: number, toIndex: number): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) => {
            if (fromIndex < 0 || fromIndex >= phases.length || toIndex < 0 || toIndex >= phases.length || fromIndex === toIndex) {
                return phases; // No valid move
            }
            const newPhases = [...phases];
            const [movedItem] = newPhases.splice(fromIndex, 1);
            newPhases.splice(toIndex, 0, movedItem);
            return newPhases;
        });
    }

    /** Add a task to a specific phase */
    async addPhaseData(trackId: string, projectId: string, phaseId: string): Promise<void> {
        const newElement: Element = {
            raw: "- [ ] New Task",
            text: "New Task",
            isTask: true,
            taskStatus: " ",
            children: [],
        };

        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => p.id === phaseId ? { ...p, data: [...p.data, newElement] } : p)
        );
    }

    /** Update a task within a specific phase */
    async updatePhaseData(trackId: string, projectId: string, phaseId: string, elementIndex: number, updatedElement: Partial<Element>): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => {
                if (p.id !== phaseId) return p;
                const newData = [...p.data];
                if (elementIndex >= 0 && elementIndex < newData.length) {
                    newData[elementIndex] = { ...newData[elementIndex], ...updatedElement };
                }
                return { ...p, data: newData };
            })
        );
    }

    /** Toggle a task's completion within a phase: ' ' → '/' → 'x' → ' ' */
    async togglePhaseData(trackId: string, projectId: string, phaseId: string, elementIndex: number): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => {
                if (p.id !== phaseId) return p;
                const newData = [...p.data];
                if (elementIndex >= 0 && elementIndex < newData.length) {
                    const el = newData[elementIndex];
                    const next = el.taskStatus === ' ' ? '/' : el.taskStatus === '/' ? 'x' : ' ';
                    newData[elementIndex] = { ...el, taskStatus: next as typeof el.taskStatus };
                }
                return { ...p, data: newData };
            })
        );
    }

    /** Cancel a task within a phase */
    async cancelPhaseData(trackId: string, projectId: string, phaseId: string, elementIndex: number): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => {
                if (p.id !== phaseId) return p;
                const newData = [...p.data];
                if (elementIndex >= 0 && elementIndex < newData.length) {
                    newData[elementIndex] = { ...newData[elementIndex], taskStatus: '-' };
                }
                return { ...p, data: newData };
            })
        );
    }

    /** Delete a task within a phase */
    async deletePhaseData(trackId: string, projectId: string, phaseId: string, elementIndex: number): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => {
                if (p.id !== phaseId) return p;
                const newData = [...p.data];
                if (elementIndex >= 0 && elementIndex < newData.length) {
                    newData.splice(elementIndex, 1);
                }
                return { ...p, data: newData };
            })
        );
    }

    /** Close a project task by its block ID, searching all projects in the track */
    async closeProjectTaskByBlockId(trackId: string, blockId: string, taskStatus: ' ' | 'x' = 'x'): Promise<boolean> {
        const tracks = get(this.parsedTracksContent);
        const track = tracks[trackId];
        if (!track) {
            console.warn(`Track ${trackId} not found`);
            return false;
        }

        for (const [projectId, project] of Object.entries(track.projects)) {
            for (const phase of project.phases) {
                const phaseDataIndex = phase.data.findIndex(el => el.blockId === blockId);
                if (phaseDataIndex !== -1) {
                    await this.updatePhaseData(trackId, projectId, phase.id, phaseDataIndex, { taskStatus });
                    return true;
                }
            }
        }

        console.warn(`Task with blockId ${blockId} not found in track ${trackId}`);
        return false;
    }

    /** Reorder tracks by assigning new order values matching the given ID sequence */
    async reorderTracks(orderedIds: string[]): Promise<void> {
        const tracks = get(this.parsedTracksContent);

        // Update in-memory order immediately
        const updated: Record<string, Track> = { ...tracks };
        for (let i = 0; i < orderedIds.length; i++) {
            const id = orderedIds[i];
            if (updated[id]) {
                updated[id] = { ...updated[id], order: i };
            }
        }
        this.publishTrackState(updated, true);

        // Persist each track's new order to its frontmatter
        for (let i = 0; i < orderedIds.length; i++) {
            const id = orderedIds[i];
            const trackFile = this.trackFileCache[id]?.track;
            if (!trackFile) continue;

            this.beginInternalUpdate();
            try {
                await this.app.fileManager.processFrontMatter(trackFile, (fm) => {
                    fm.order = i;
                });
            } finally {
                this.endInternalUpdate();
            }
        }
    }

    // ===== Reading tracks ===== //

    /** Gets track metadata by ID */
    public getTrack(id: string): Track | undefined {
        const tracks = get(this.parsedTracksContent);
        return tracks[id];
    }

    /** Returns the id of a track given the label (case insensitive) */
    public getTrackIDFromLabel(label: string): string {
        const tracks = get(this.parsedTracksContent);
        
        for (const track of Object.values(tracks)) {
            if (label.toLowerCase() === track.label.toLowerCase()) {
                return track.id;
            }
        }
    
        return "";
    }

    // ===== Clean up ===== //

    /** Clean up resources */
    destroy(): void {
        this.cleanupFileWatchers();
    }
}
