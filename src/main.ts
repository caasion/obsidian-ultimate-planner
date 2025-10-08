import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { plannerStore } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, EMPTY_PLANNER, type NormalizedEvent, type PluginData, type PluginSettings } from './types';
import { calendarState, calendarStore } from './state/calendarStore';
import { fetchFromUrl, hashText, detectFetchChange, shouldFetch, stripICSVariance } from './actions/calendarFetch';
import IcalExpander from 'ical-expander';
import { buildEventDictionaries, getEvents, normalizeEvent, normalizeOccurrenceEvent, parseICS } from './actions/calendarParse';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private plannerSubscription: Unsubscriber;
	private calendarSubscription: Unsubscriber;
	private refreshToken = 0;
	private _calendarStateSubscription: Unsubscriber;

	async onload() {
		await this.loadPersisted();

		// Set default Calendar State
		calendarState.update(() => { return { status: "idle" } });

		// Add debug command
		this.addCommand({
			id: 'debug-log-snaposhot',
			name: 'Debug: Log snapshot',
			callback: () => {
				console.log(this.snapshot())
			}
		});

		this._calendarStateSubscription = calendarState.subscribe((state) => console.log(state));

		this.addCommand({
			id: 'debug-should-fetch',
			name: 'Debug: Test shouldFetch Function',
			callback: () => {
				const calendar = get(calendarStore);

				if (!shouldFetch(this.settings.refreshRemoteMs, calendar.lastFetched)) {
					console.log("wait a bit more bruh", (calendar.lastFetched ?? 0) - Date.now())
					return;
				}
			}
		})

		this.addCommand({
			id: 'debug-full-pipeline',
			name: 'Debug: Full Pipeline - Manual',
			callback: async () => {
				// Set up variables to check if we should fetch or continue to fetch
				const status = get(calendarState).status;
				const myToken = ++this.refreshToken; // Increment refreshToken, then assign to myToken
				const startUrl = this.settings.remoteCalendarUrl;

				console.log(startUrl);

				// Check if we should fetch; bail if currently fetching
				if (status === "fetching") return; 

				// Otherwise, set store to 'fetching' and clear lastError
				calendarState.set({ status: "fetching" });

				// We are not going to use the time-guarded shouldFetch for the manual fetching

				try { // Wrap in try because fetchFromUrl throws Exception
					const response = await fetchFromUrl(this.settings.remoteCalendarUrl); 	

					// Update lastFetched status in store
					calendarStore.update(cache => {
						return {...cache, lastFetched: Date.now()}
					})

					await new Promise(r => setTimeout(r, 5000))

					// Prepare contentHash for detectFetchChange
					const contentHash = await hashText(stripICSVariance(response.text));

					// [GUARD] If a new refresh token is generated, that means our fetch is stale (old data). We want to drop that.
					if (myToken !== this.refreshToken) {
						console.warn("Fetch request is stale. Aborted.");
						calendarState.set({ status: "unchanged" });
						return;
					};

					// [GUARD] If the old URL is different from the current one, the URL changed and we should drop the fetch
					if (startUrl !== this.settings.remoteCalendarUrl) {
						new Notice("URL changed during fetch. Please fetch again.");
						console.warn("URL changed during fetch. Aborted.");
						calendarState.set({ status: "unchanged" });
						return;
					};
					
					// Check if response has changed from calendarStore
					if (detectFetchChange(response, contentHash)) {
						// Parse events, build dictionaries, update calendarStore, and update calendarState status
						const allEvents = parseICS(response.text, "hi");

						const { index, eventsById } = buildEventDictionaries(allEvents);

						calendarStore.update(cal => {
							return {...cal, etag: response.headers.etag ?? "", lastModified: response.headers.lastModified ?? Date.now(), events: allEvents, contentHash, index, eventsById}
						}) // QUESTION: Do we really need to store allEvents? Can't we just discard it after indexing and sorting by id?

						calendarState.set({ status: "updated" });
						
					} else {
						calendarState.set({ status: "unchanged" });
					}
				} catch (error) {
					calendarState.update(() => { return { status: "error", lastError: error } });
					new Notice("An error occured while fetching. See console for details");
					console.error("An error occured while fetching:", error.message)
				}
		}
		});
		
		// Add Settings Tab using Obsidian's API
		this.addSettingTab(new UltimatePlannerPluginTab(this.app, this));

		// Register UPV using Obsidian's API
		this.registerView(PLANNER_VIEW_TYPE, (leaf) => new PlannerView(leaf, this));

		// Add a command to open UPV
		this.addCommand({
			id: 'open-planner-view',
			name: 'Open Ultimate Planner',
			callback: () => {
				this.activateView(PLANNER_VIEW_TYPE);
			}
		});
	}

	async onunload() {
		// Unsubscribe to stores
		this.plannerSubscription();
		this.calendarSubscription();
		this._calendarStateSubscription();

		await this.flushSave(); // Save immediately
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

		// Initialize Stores, Subscribe, and assign unsubscribers
		plannerStore.set(Object.assign({}, EMPTY_PLANNER, data.planner));
		calendarStore.set(Object.assign({}, data.calendar));
		this.plannerSubscription = plannerStore.subscribe(() => this.queueSave());
		this.calendarSubscription = calendarStore.subscribe(() => this.queueSave())
	}

	private snapshot(): PluginData {
		return {
			version: 1,
			settings: this.settings,
			planner: get(plannerStore),
			calendar: get(calendarStore)
		}
	}

	public queueSave = () => {
		if (this.saveTimer) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(async () => {
			this.saveTimer = null;
			try {
				await this.saveData(this.snapshot()); 
			} catch (e) {
				console.error("[UP] save FAILED", e);
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