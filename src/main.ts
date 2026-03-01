import { Plugin } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './planner/PlannerView';
import { TRACKS_VIEW_TYPE, TracksView } from './tracks/TracksView';
import { HolosSettingsTab } from './plugin/SettingsTab';
import { get, writable, type Unsubscriber, type Writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type CalendarHelperService, type DataService, type FetchService, type HelperService, type PluginData, type PluginSettings, type Track, type TrackSnapshot } from './plugin/types';
import { CalendarPipeline } from './calendar/calendarPipelines';
import { calendarState, fetchToken } from './calendar/calendarState';
import { parseICS, parseICSBetween, normalizeEvent, normalizeOccurrenceEvent, buildEventDictionaries, getEventLabels } from './calendar/calendarHelper';
import { fetchFromUrl, detectFetchChange } from './calendar/fetch';
import { PlaygroundView, PLAYGROUND_VIEW_TYPE } from './playground/PlaygroundView';
import { DailyNoteService } from './planner/logic/dailyNote';
import { TrackNoteService } from './tracks/logic/trackNote';
import { hashTrackFolder } from './tracks/logic/trackSnapshotHash';
import { normalizeTrackSnapshot, resolveBootstrapTrackSnapshot } from './tracks/logic/trackSnapshot';

export default class HolosPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private storeSubscriptions: Unsubscriber[] = [];
	private trackSnapshot: TrackSnapshot | undefined;
	public dataService: DataService;
	public helperService: HelperService;
	public calendarHelperService: CalendarHelperService;
	public fetchService: FetchService;
	public calendarPipeline: CalendarPipeline;
	public dailyNoteService: DailyNoteService;
	public trackNoteService: TrackNoteService;
	private parsedTracksContent: Writable<Record<string, Track>> = writable<Record<string, Track>>({});

	async onload() {
		await this.loadPersisted();
		const trackFolder = this.app.vault.getFolderByPath(this.settings.trackFolder);
		const currentTracksHash = trackFolder ? hashTrackFolder(trackFolder) : undefined;
		const bootstrapSnapshot = resolveBootstrapTrackSnapshot(this.trackSnapshot, currentTracksHash);
		this.parsedTracksContent = writable<Record<string, Track>>(bootstrapSnapshot?.tracks ?? {});

		// this.calendarHelperService = {
		// 	parseICS,
		// 	parseICSBetween,
		// 	normalizeEvent,
		// 	normalizeOccurrenceEvent,
		// 	buildEventDictionaries,
		// 	getEventLabels
		// }

		this.fetchService = {
			fetchFromUrl,
			detectFetchChange
		}
		
		// this.calendarPipeline = new CalendarPipeline({
		// 	data: this.dataService, 
		// 	fetch: this.fetchService, 
		// 	helpers: this.helperService, 
		// 	calHelpers: this.calendarHelperService
		// })

		this.dailyNoteService = new DailyNoteService({
			app: this.app,
			settings: this.settings,
			getTrackMetaSnapshot: () => this.trackNoteService ? get(this.trackNoteService.parsedTracksContent) : { }
		});

		await this.initializeTrackNoteService(bootstrapSnapshot);
		this.initializeTrackMetadataLoad();

		// Add Settings Tab using Obsidian's API
		this.addSettingTab(new HolosSettingsTab(this.app, this));

		// Register views using Obsidian's API
		this.registerView(PLANNER_VIEW_TYPE, (leaf) => new PlannerView(leaf, this));
		this.registerView(TRACKS_VIEW_TYPE, (leaf) => new TracksView(leaf, this));

		// Add commands to open views
		this.addCommand({
			id: 'open-planner-view',
			name: 'Open Holos Planner',
			callback: () => {
				this.activateView(PLANNER_VIEW_TYPE);
			}
		});

		this.addCommand({
			id: 'open-tracks-view',
			name: 'Open Holos Tracks View',
			callback: () => {
				this.activateView(TRACKS_VIEW_TYPE);
			}
		});

		if (this.settings.debug) {
			this.registerView(PLAYGROUND_VIEW_TYPE, (leaf) => new PlaygroundView(leaf, this));

			this.addCommand({
				id: 'open-playground-view',
				name: 'Open Playground View',
				callback: () => {
					this.activateView(PLAYGROUND_VIEW_TYPE);
				}
			});

			// Add debug command
			this.addCommand({
				id: 'debug-log-snaposhot',
				name: 'Debug: Log snapshot',
				callback: () => {
					console.log(this.snapshot())
				}
			});
		}
	} 

	async onunload() {
		// Unsubscribe to stores
		await this.storeSubscriptions.forEach(unsub => unsub());

		// Clean up track note service if it was initialized
		if (this.trackNoteService) {
			this.trackNoteService.destroy();
		}

		await this.flushSave(); // Save immediately
	}

	async initializeTrackNoteService(bootstrapSnapshot?: TrackSnapshot) {
		if (this.trackNoteService) return;

		this.trackNoteService = new TrackNoteService({
			app: this.app,
			settings: this.settings,
			parsedTracksContent: this.parsedTracksContent,
			bootstrapTracks: bootstrapSnapshot?.tracks,
			onTracksSnapshot: (snapshot: TrackSnapshot) => {
				this.trackSnapshot = snapshot;

				this.queueSave();
			}
		});
	}

	async activateView(view: string) {
		const leaves = this.app.workspace.getLeavesOfType(view);
		if (leaves.length === 0) {
			await this.app.workspace.getLeaf(false).setViewState({
				type: view,
				active: true,
			});

		}

		this.app.workspace.getLeavesOfType(view)[0];
	}

	async loadPersisted() {
		const data: PluginData = await this.loadData() ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings) // Populate Settings
		this.trackSnapshot = normalizeTrackSnapshot(data.trackSnapshot);
	}

	private snapshot(): PluginData {
		return {
			version: 8,
			settings: this.settings,
			trackSnapshot: this.trackSnapshot,
		}
	}

	private initializeTrackMetadataLoad(): void {
		const loadTracks = async () => {
			try {
				await this.trackNoteService.initializeTracksByDate();
			} catch (error) {
				console.error('[Holos] Failed to initialize tracks by date', error);
			}
		};

		void loadTracks();
		this.app.workspace.onLayoutReady(() => {
			void loadTracks();
		});
	}

	public queueSave() {
		if (this.saveTimer) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(async () => {
			this.saveTimer = null;
			try {
				await this.saveData(this.snapshot()); 
			} catch (e) {
				console.error("[Holos] save FAILED", e);
			}
		}, 400);
	}

	private async flushSave() {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}

		await this.saveData(this.snapshot());
	}
}