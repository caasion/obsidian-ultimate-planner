import { Plugin } from 'obsidian';
import { HOLOS_VIEW_TYPE, HolosView } from './HolosView';
import { HolosSettingsTab } from './plugin/SettingsTab';
import { get, writable, type Unsubscriber, type Writable } from 'svelte/store';
import { DEFAULT_SETTINGS, type PluginData, type PluginSettings, type Track, type TrackSnapshot } from './plugin/types';
import { DailyNoteService } from './planner/logic/dailyNote';
import { TrackNoteService } from './tracks/logic/trackNote';
import { hashTrackFolder } from './tracks/logic/trackSnapshotHash';
import { normalizeTrackSnapshot, resolveBootstrapTrackSnapshot } from './tracks/logic/trackSnapshot';

export default class HolosPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private storeSubscriptions: Unsubscriber[] = [];
	private trackSnapshot: TrackSnapshot | undefined;
	public dailyNoteService: DailyNoteService;
	public trackNoteService: TrackNoteService;
	private parsedTracksContent: Writable<Record<string, Track>> = writable<Record<string, Track>>({});

	async onload() {
		await this.loadPersisted();
		const trackFolder = this.app.vault.getFolderByPath(this.settings.trackFolder);
		const currentTracksHash = trackFolder ? hashTrackFolder(trackFolder) : undefined;
		const bootstrapSnapshot = resolveBootstrapTrackSnapshot(this.trackSnapshot, currentTracksHash);
		this.parsedTracksContent = writable<Record<string, Track>>(bootstrapSnapshot?.tracks ?? {});

		this.dailyNoteService = new DailyNoteService({
			app: this.app,
			settings: this.settings,
			getTrackMetaSnapshot: () => this.trackNoteService ? get(this.trackNoteService.parsedTracksContent) : { }
		});

		await this.initializeTrackNoteService(bootstrapSnapshot);
		this.initializeTrackMetadataLoad();

		// Add Settings Tab using Obsidian's API
		this.addSettingTab(new HolosSettingsTab(this.app, this));

		// Register single unified view
		this.registerView(HOLOS_VIEW_TYPE, (leaf) => new HolosView(leaf, this));

		this.addCommand({
			id: 'open-view',
			name: 'Open view',
			callback: () => {
				void this.activateView(HOLOS_VIEW_TYPE);
			}
		});

		if (this.settings.debug) {
			this.addCommand({
				id: 'debug-log-snaposhot',
				name: 'Debug: Log snapshot',
				callback: () => {
					console.log(this.snapshot())
				}
			});
		}
	} 

	onunload() {
		// Unsubscribe to stores
		this.storeSubscriptions.forEach(unsub => unsub());

		// Clean up track note service if it was initialized
		if (this.trackNoteService) {
			this.trackNoteService.destroy();
		}

		void this.flushSave(); // Save immediately
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
		const leaf = this.app.workspace.getLeavesOfType(view)[0];
		if (leaf) await this.app.workspace.revealLeaf(leaf);
	}

	async loadPersisted() {
		const data = (await this.loadData() ?? {}) as PluginData;
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
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			this.saveData(this.snapshot()).catch((e) => {
				console.error("[Holos] save FAILED", e);
			});
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