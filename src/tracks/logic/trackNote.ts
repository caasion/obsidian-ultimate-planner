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
    
    // Flag to prevent file watcher from overwriting our own programmatic updates
    private isUpdatingInternally = false;
    
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
        for (const interval of track.effective) {
            const resolvedEnd = this.resolveIntervalEnd(interval.start, interval.end, today);
            if (date >= interval.start && date <= resolvedEnd) return true;
        }

        return false;
    }

    private isTrackStartingOnDate(track: Track, date: ISODate): boolean {
        return track.effective.some((interval) => interval.start === date);
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
        // Ensure projects from old snapshots get phases defaults
        const normalized: Record<string, Track> = {};
        for (const [trackId, track] of Object.entries(tracks)) {
            const projects: Record<string, Project> = {};
            for (const [projectId, project] of Object.entries(track.projects)) {
                projects[projectId] = {
                    ...project,
                    phases: project.phases ?? [],
                    hasPhases: project.hasPhases ?? false,
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

    private parseEffective(frontmatter?: FrontMatterCache['frontmatter']): DateInterval[] {
        const rawEffective = frontmatter?.effective;
        if (!Array.isArray(rawEffective)) return [];

        const effective: DateInterval[] = [];

        for (const interval of rawEffective) {
            if (!interval || typeof interval !== 'object') continue;

            const record = interval as Record<string, unknown>;
            const start = this.normalizeISODate(record.start);
            const end = this.normalizeISODate(record.end);

            if (!start) continue;
            effective.push(end ? { start, end } : { start });
        }

        return effective;
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

        console.log(`Loading ${id}`)

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

        console.log(frontmatter)
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
        console.log(`Loading ${id}`)

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

        const { startDate, endDate } = frontmatter;
        const hasPhases = frontmatter?.phases === true;

        // Parse habits section
        const habitSection = PlannerParser.extractSection(projectContent, "Habits");
        const habits = PlannerParser.parseHabitSection(habitSection);

        let data: Element[] = [];
        let phases: Phase[] = [];

        if (hasPhases) {
            const phasesSection = PlannerParser.extractSection(projectContent, "Phases");
            phases = PlannerParser.parsePhasesSection(phasesSection);
        } else {
            const dataSection = PlannerParser.extractSection(projectContent, "Data") || PlannerParser.extractSection(projectContent, "Tasks");
            data = PlannerParser.parseTaskSection(dataSection);
        }

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

        assignBlockIds(data);
        for (const phase of phases) {
            assignBlockIds(phase.data);
        }

        if (needsWrite) {
            let updatedContent = projectContent;
            if (hasPhases) {
                const newPhasesSection = PlannerParser.serializePhasesSection(phases);
                updatedContent = PlannerParser.replaceSection(updatedContent, 'Phases', newPhasesSection);
            } else {
                const newDataSection = this.serializeDataSection(data);
                updatedContent = PlannerParser.replaceSection(updatedContent, 'Data', newDataSection);
            }
            this.isUpdatingInternally = true;
            await this.app.vault.modify(projectFile, updatedContent);
            this.isUpdatingInternally = false;
        }

        return {
            id,
            label: projectFile.basename,
            file: projectFile,
            description,
            startDate,
            endDate,
            data,
            habits,
            phases,
            hasPhases,
        };
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
                console.log(`Track file modified externally: ${file.path}, refreshing track ${trackId}`);
                await this.refreshTrack(trackId);
            }
        });

        // Watch for file creation
        this.fileCreateRef = this.app.vault.on('create', async (file) => {
            if (!(file instanceof TFile) || !this.isInTrackFolder(file.path)) return;

            console.log(`New file created in track folder: ${file.path}, invalidating cache`);
            await this.invalidateCache();
        });

        // Watch for file deletion
        this.fileDeleteRef = this.app.vault.on('delete', async (file) => {
            if (!(file instanceof TFile) || !this.isInTrackFolder(file.path)) return;

            console.log(`File deleted from track folder: ${file.path}, invalidating cache`);
            await this.invalidateCache();
        });

        // Watch for file rename
        this.fileRenameRef = this.app.vault.on('rename', async (file, oldPath) => {
            if (!(file instanceof TFile)) return;
            
            const wasInTrackFolder = this.isInTrackFolder(oldPath);
            const isInTrackFolder = this.isInTrackFolder(file.path);

            // If moved into or out of track folder, or renamed within folder
            if (wasInTrackFolder || isInTrackFolder) {
                console.log(`File renamed: ${oldPath} -> ${file.path}, invalidating cache`);
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
                console.log(`Creating folder: ${trackFolderPath}`);
                await this.app.vault.createFolder(trackFolderPath);
            }

            // Create the track file
            console.log("Creating file")
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
        for (const interval of track.effective) {
            lines.push(`  - start: ${interval.start}`);
            if (interval.end) {
                lines.push(`    end: ${interval.end}`);
            }
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
        this.isUpdatingInternally = true;
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
            this.isUpdatingInternally = false;
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

        this.isUpdatingInternally = true;
        try {
            await this.app.fileManager.processFrontMatter(trackFile, (oldFrontmatter) => {
                for (const [key, value] of Object.entries(frontmatter)) {
                    oldFrontmatter[key] = value;
                }
            });
        } finally {
            this.isUpdatingInternally = false;
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
            
            this.isUpdatingInternally = true;
            try {
                await this.app.vault.modify(file, updatedContent);
            } finally {
                this.isUpdatingInternally = false;
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
            startDate: today,
            habits: {},
            data: [],
            phases: [],
            hasPhases: false,
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
        lines.push(`startDate: ${project.startDate}`);
        lines.push(`endDate: ${project.endDate ?? ''}`);
        if (project.hasPhases) lines.push('phases: true');
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

        if (project.hasPhases) {
            // Phases section
            lines.push('## Phases');
            lines.push('');
            lines.push(PlannerParser.serializePhasesSection(project.phases));
        } else {
            // Data section
            lines.push('## Data');
            lines.push('');
            for (const element of project.data) {
                const taskMarker = element.isTask ? `[${element.taskStatus || ' '}] ` : '';
                lines.push(`- ${taskMarker}${element.text}`);

                for (const child of element.children) {
                    lines.push(`- ${child}`);
                }
            }
        }

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
        
        this.isUpdatingInternally = true;
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
            this.isUpdatingInternally = false;
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
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
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

    /** Update project start date */
    async updateProjectStartDate(trackId: string, projectId: string, startDate: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        this.isUpdatingInternally = true;
        try {
            await this.app.fileManager.processFrontMatter(projectFile, (fm) => {
                fm.startDate = startDate;
            });
        } finally {
            this.isUpdatingInternally = false;
        }

        // Direct update - change project startDate in memory
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
                            startDate
                        }
                    }
                }
            };
        });
    }

    /** Update project end date */
    async updateProjectEndDate(trackId: string, projectId: string, endDate: string | null): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        this.isUpdatingInternally = true;
        try {
            await this.app.fileManager.processFrontMatter(projectFile, (fm) => {
                if (endDate) {
                    fm.endDate = endDate;
                } else {
                    delete fm.endDate;
                }
            });
        } finally {
            this.isUpdatingInternally = false;
        }

        // Direct update - change project endDate in memory
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
                            endDate: endDate ?? undefined
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
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
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
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
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
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
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

    /** Serialize elements array to string for Data section */
    private serializeDataSection(elements: Element[]): string {
        let result = '';
        for (const element of elements) {
            result += PlannerParser.serializeProjectElement(element);
        }
        return result;
    }

    /** Add a new data element to a project */
    async addProjectData(trackId: string, projectId: string): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const newElement: Element = {
            raw: "- [ ] New Task",
            text: "New Task",
            isTask: true,
            taskStatus: " ",
            children: [],
        };

        const content = await this.app.vault.read(projectFile);
        const dataSection = PlannerParser.extractSection(content, "Data");
        const data = PlannerParser.parseTaskSection(dataSection);
        
        data.push(newElement);
        
        const newDataSection = this.serializeDataSection(data);
        const updated = PlannerParser.replaceSection(content, 'Data', newDataSection);
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
        }

        // Direct update - add element to memory
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
                            data: [...track.projects[projectId].data, newElement]
                        }
                    }
                }
            };
        });
    }

    /** Update a specific data element in a project */
    async updateProjectData(trackId: string, projectId: string, elementIndex: number, updatedElement: Partial<Element>): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const dataSection = PlannerParser.extractSection(content, "Data");
        const data = PlannerParser.parseTaskSection(dataSection);
        
        if (elementIndex >= 0 && elementIndex < data.length) {
            data[elementIndex] = { ...data[elementIndex], ...updatedElement };
        }
        
        const newDataSection = this.serializeDataSection(data);
        const updated = PlannerParser.replaceSection(content, 'Data', newDataSection);
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
        }

        // Direct update - update element in memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            const newData = [...track.projects[projectId].data];
            if (elementIndex >= 0 && elementIndex < newData.length) {
                newData[elementIndex] = { ...newData[elementIndex], ...updatedElement };
            }

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            data: newData
                        }
                    }
                }
            };
        });
    }

    /** Delete a data element from a project */
    async deleteProjectData(trackId: string, projectId: string, elementIndex: number): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        const dataSection = PlannerParser.extractSection(content, "Data");
        const data = PlannerParser.parseTaskSection(dataSection);
        
        if (elementIndex >= 0 && elementIndex < data.length) {
            data.splice(elementIndex, 1);
        }
        
        const newDataSection = this.serializeDataSection(data);
        const updated = PlannerParser.replaceSection(content, 'Data', newDataSection);
        
        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
        }

        // Direct update - remove element from memory
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            const newData = [...track.projects[projectId].data];
            if (elementIndex >= 0 && elementIndex < newData.length) {
                newData.splice(elementIndex, 1);
            }

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: {
                            ...track.projects[projectId],
                            data: newData
                        }
                    }
                }
            };
        });
    }

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

        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
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

    /** Toggle a task's completion within a phase */
    async togglePhaseData(trackId: string, projectId: string, phaseId: string, elementIndex: number): Promise<void> {
        await this.mutatePhases(trackId, projectId, (phases) =>
            phases.map(p => {
                if (p.id !== phaseId) return p;
                const newData = [...p.data];
                if (elementIndex >= 0 && elementIndex < newData.length) {
                    const el = newData[elementIndex];
                    newData[elementIndex] = { ...el, taskStatus: el.taskStatus === 'x' ? ' ' : 'x' };
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

    /** Toggle phase mode on/off for a project */
    async toggleProjectPhases(trackId: string, projectId: string, enable: boolean): Promise<void> {
        const projectFile = this.trackFileCache[trackId]?.projects[projectId];
        if (!projectFile) {
            console.warn(`Project ${projectId} not found in track ${trackId}`);
            return;
        }

        const content = await this.app.vault.read(projectFile);
        let updated = content;

        if (enable) {
            // Enable phases: move existing tasks into a default phase
            const dataSection = PlannerParser.extractSection(content, "Data") || PlannerParser.extractSection(content, "Tasks");
            const data = PlannerParser.parseTaskSection(dataSection);

            // Create initial phase with existing tasks
            const initialPhase: Phase = {
                id: 'phase-0',
                label: 'Phase 1',
                data,
            };

            // Update frontmatter to set phases: true
            updated = content.replace(
                /^(---[\s\S]*?)(?=\n---)/m,
                (match) => {
                    if (!match.includes('phases:')) {
                        return match + '\nphases: true';
                    }
                    return match.replace(/phases:\s*false/, 'phases: true');
                }
            );

            // Remove Data/Tasks section and add Phases section
            updated = PlannerParser.replaceSection(updated, 'Data', '');
            updated = PlannerParser.replaceSection(updated, 'Tasks', '');
            const phasesContent = PlannerParser.serializePhasesSection([initialPhase]);
            updated = PlannerParser.replaceSection(updated, 'Phases', phasesContent);
        } else {
            // Disable phases: flatten all phase tasks into Data section
            const phasesSection = PlannerParser.extractSection(content, "Phases");
            const phases = PlannerParser.parsePhasesSection(phasesSection);

            // Flatten all tasks from all phases
            const allData: Element[] = [];
            for (const phase of phases) {
                allData.push(...phase.data);
            }

            // Update frontmatter to set phases: false
            updated = content.replace(
                /^(---[\s\S]*?)(?=\n---)/m,
                (match) => match.replace(/\nphases:\s*true/, '').replace(/phases:\s*true\n/, '')
            );

            // Remove Phases section and add back Data section
            updated = PlannerParser.replaceSection(updated, 'Phases', '');
            const dataContent = this.serializeDataSection(allData);
            updated = PlannerParser.replaceSection(updated, 'Data', dataContent);
        }

        this.isUpdatingInternally = true;
        try {
            await this.app.vault.modify(projectFile, updated);
        } finally {
            this.isUpdatingInternally = false;
        }

        // Update store
        this.parsedTracksContent.update(tracks => {
            const track = tracks[trackId];
            if (!track?.projects[projectId]) return tracks;

            const project = track.projects[projectId];
            let newProject: Project;

            if (enable) {
                // Create initial phase with existing tasks
                const initialPhase: Phase = {
                    id: 'phase-0',
                    label: 'Phase 1',
                    data: project.data,
                };
                newProject = {
                    ...project,
                    phases: [initialPhase],
                    data: [],
                    hasPhases: true,
                };
            } else {
                // Flatten all phase tasks into data
                const allData: Element[] = [];
                for (const phase of project.phases) {
                    allData.push(...phase.data);
                }
                newProject = {
                    ...project,
                    phases: [],
                    data: allData,
                    hasPhases: false,
                };
            }

            return {
                ...tracks,
                [trackId]: {
                    ...track,
                    projects: {
                        ...track.projects,
                        [projectId]: newProject,
                    },
                },
            };
        });
    }

    /** Close a project task by its block ID, searching all projects in the track */
    async closeProjectTaskByBlockId(trackId: string, blockId: string): Promise<boolean> {
        const tracks = get(this.parsedTracksContent);
        const track = tracks[trackId];
        if (!track) {
            console.warn(`Track ${trackId} not found`);
            return false;
        }

        for (const [projectId, project] of Object.entries(track.projects)) {
            // Search flat data
            const dataIndex = project.data.findIndex(el => el.blockId === blockId);
            if (dataIndex !== -1) {
                await this.updateProjectData(trackId, projectId, dataIndex, { taskStatus: 'x' });
                return true;
            }

            // Search phases
            for (const phase of project.phases) {
                const phaseDataIndex = phase.data.findIndex(el => el.blockId === blockId);
                if (phaseDataIndex !== -1) {
                    await this.updatePhaseData(trackId, projectId, phase.id, phaseDataIndex, { taskStatus: 'x' });
                    return true;
                }
            }
        }

        console.warn(`Task with blockId ${blockId} not found in track ${trackId}`);
        return false;
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