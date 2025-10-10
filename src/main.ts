import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { plannerStore } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, EMPTY_PLANNER, type ActionItemID, type NormalizedEvent, type PluginData, type PluginSettings } from './types';
import { calendarState, calendarStore } from './state/calendarStore';
import { fetchFromUrl, hashText, detectFetchChange, shouldFetch, stripICSVariance } from './actions/calendarFetch';
import IcalExpander from 'ical-expander';
import { buildEventDictionaries, getEvents, normalizeEvent, normalizeOccurrenceEvent, parseICS, parseICSBetween } from './actions/calendarParse';
import { cacheEvents, freezeEvents, getEventLabels, setCalendarStatus } from './actions/calendarIndexFreeze';
import { addDays } from 'date-fns';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private plannerSubscription: Unsubscriber;
	private calendarSubscription: Unsubscriber;
	private refreshToken = 0;
	// private _calendarStateSubscription: Unsubscriber;
	private _defaultCalendar: ActionItemID = "cal-abcdefji-fsdkj-fjdskl";

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

		// this._calendarStateSubscription = calendarState.subscribe((state) => console.log(state));

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
				// Check if we should fetch; bail if currently fetching
				if (get(calendarState).status === "fetching") return; 

				// Otherwise, set store to 'fetching' and clear lastError
				calendarState.set({ status: "fetching" });

				// We are not going to use the time-guarded shouldFetch for the manual fetching

				// Set up variables to check if we should fetch or continue to fetch
				const myToken = ++this.refreshToken; // Increment refreshToken, then assign to myToken
				const startUrl = this.settings.remoteCalendarUrl;

				this.fetchPipeline(myToken, startUrl);
		}
		});
		
		this.addCommand({
			id: 'debug-freeze-cache',
			name: 'Debug: Freeze Cache',
			callback: () => {
				const calendar = get(calendarStore);

				Object.keys(calendar.index).forEach(date => {
					const labels = getEventLabels(getEvents(date));

					plannerStore.update(store => {
						return {
							...store,
							calendarCells: {
								...get(plannerStore).calendarCells,
								[date]: { [this._defaultCalendar]: labels}
							}
						}
					})
				})
				
			}
		})

		this.addCommand({
			id: 'debug-fetch-freeze',
			name: 'Debug: Fetch (Full Pipeline) and Freeze',
			callback: async () => {
				// Check if we should fetch. If we do fetch, set status.
				if (get(calendarState).status === "fetching") return; 
				setCalendarStatus("fetching");

				// We are not using the time-guarded shouldFetch for the manual fetching

				// Set up variables to check if we should fetch or continue to fetch
				const myToken = ++this.refreshToken; // Increment refreshToken, then assign to myToken
				const startUrl = this.settings.remoteCalendarUrl;

				this.fetchPipeline(myToken, startUrl);
			}
		})
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
		// this._calendarStateSubscription();

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
			version: 2,
			settings: this.settings,
			planner: get(plannerStore),
			calendar: get(calendarStore)
		}
	}

	public queueSave() {
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

	async fetchPipeline(myToken: number, startUrl: string) {
		try { // Wrap in try because fetchFromUrl throws Exception
			const response = await fetchFromUrl(this.settings.remoteCalendarUrl); 	

			// Update lastFetched status in store
			calendarStore.update(cache => ({...cache, lastFetched: Date.now()}));

			// Prepare contentHash for detectFetchChange
			const contentHash = await hashText(stripICSVariance(response.text));

			// [GUARD] If a new refresh token is generated, that means our fetch is stale (old data). We want to drop that.
			if (myToken !== this.refreshToken) {
				console.warn("Fetch request is stale. Aborted.");
				setCalendarStatus("unchanged");
				return;
			};

			// [GUARD] If the old URL is different from the current one, the URL changed and we should drop the fetch
			if (startUrl !== this.settings.remoteCalendarUrl) {
				new Notice("URL changed during fetch. Please fetch again.");
				console.warn("URL changed during fetch. Aborted.");
				setCalendarStatus("unchanged");
				return;
			};
			
			// Check if response has changed from calendarStore
			if (detectFetchChange(response, contentHash)) {
				// Update cache information 
				calendarStore.update(cal => ({...cal, etag: response.headers.etag ?? "", lastModified: response.headers.lastModified ?? Date.now(), contentHash}))

				// Parse ALL events, build dictionaries, and freeze
				const allEvents = parseICS(response.text, this._defaultCalendar);
				freezeEvents(allEvents, this._defaultCalendar);
			
				// Parse events (between dates), build dictionaries, update calendarStore, and update calendarState status
				const after = addDays(Date.now(), -this.settings.graceDays)
				const before = addDays(Date.now(), 60)
				// TODO: Make this round to the nearest day, instead of caring bout time
				
				const allEventsBetween = parseICSBetween(response.text, this._defaultCalendar, after, before);
				cacheEvents(allEventsBetween, this._defaultCalendar);

				setCalendarStatus("updated");
			} else {
				setCalendarStatus("unchanged");
			}
		} catch (error) {
			calendarState.update(() => { return { status: "error", lastError: error } });
			new Notice("An error occured while fetching. See console for details");
			console.error("An error occured while fetching:", error.message)
		}
				
	}
}