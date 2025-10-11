import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { plannerStore } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, EMPTY_PLANNER, type ActionItemID, type NormalizedEvent, type PluginData, type PluginSettings } from './types';
import { calendarState, fetchToken } from './state/calendarStore';
import { fetchFromUrl, hashText, detectFetchChange, shouldFetch, stripICSVariance } from './actions/calendarFetch';
import IcalExpander from 'ical-expander';
import { buildEventDictionaries, getEvents, normalizeEvent, normalizeOccurrenceEvent, parseICS, parseICSBetween } from './actions/calendarParse';
import { freezeEvents, getEventLabels, setCalendarStatus } from './actions/calendarIndexFreeze';
import { addDays } from 'date-fns';
import { fetchPipelineInGracePeriod } from './actions/calendarPipelines';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private plannerSubscription: Unsubscriber;
	// private _calendarStateSubscription: Unsubscriber;
	private _defaultCalendar: ActionItemID = "cal-abcdefji-fsdkj-fjdskl";

	async onload() {
		await this.loadPersisted();

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
			id: 'debug-manual-fetch',
			name: 'Debug: Manual Fetch in Grace Period',
			callback: async () => {
				fetchPipelineInGracePeriod(get(plannerStore).calendars["cal-abcdefji-fsdkj-fjdskl"])
			}
		})

		// this.addCommand({
		// 	id: 'debug-manual-fetch-freeze',
		// 	name: 'Debug: Manual Fetch All & Freeze',
		// 	callback: async () => {
		// 		// Check if we should fetch. If we do fetch, set status.
		// 		if (get(calendarState).status === "fetching") return; 
		// 		setCalendarStatus("fetching");

		// 		// Set up variables to check if we should fetch or continue to fetch
		// 		const myToken = ++this.refreshToken; // Increment refreshToken, then assign to myToken
		// 		const startUrl = this.settings.remoteCalendarUrl;

		// 		this.fetchPipelineFreeze(myToken, startUrl);
		// 	}
		// })

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
		this.plannerSubscription = plannerStore.subscribe(() => this.queueSave());
	}

	private snapshot(): PluginData {
		return {
			version: 3,
			settings: this.settings,
			planner: get(plannerStore),
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


	// async fetchPipelineFreeze(myToken: number, startUrl: string) {
	// 	try { // Wrap in try because fetchFromUrl throws Exception
	// 		const response = await fetchFromUrl(this.settings.remoteCalendarUrl); 	

	// 		// Update lastFetched status in store
	// 		calendarStore.update(cache => ({...cache, lastFetched: Date.now()}));

	// 		// [GUARD] If a new refresh token is generated, that means our fetch is stale (old data). We want to drop that.
	// 		if (myToken !== this.refreshToken) {
	// 			console.warn("Fetch request is stale. Aborted.");
	// 			setCalendarStatus("unchanged");
	// 			return;
	// 		};

	// 		// [GUARD] If the old URL is different from the current one, the URL changed and we should drop the fetch
	// 		if (startUrl !== this.settings.remoteCalendarUrl) {
	// 			new Notice("URL changed during fetch. Please fetch again.");
	// 			console.warn("URL changed during fetch. Aborted.");
	// 			setCalendarStatus("unchanged");
	// 			return;
	// 		};
			
	// 		// [FREEZE] Parse ALL events, build dictionaries, and freeze
	// 		const allEvents = parseICS(response.text, this._defaultCalendar);
	// 		freezeEvents(allEvents, this._defaultCalendar);
			
	// 		// [HASH] Parse ICS within grace period and compute contentHash from it
	// 		const after = addDays(Date.now(), -this.settings.graceDays)
	// 		const before = addDays(Date.now(), 60)
	// 		// TODO: Make this round to the nearest day, instead of caring bout time
			
	// 		const eventsBetween = parseICSBetween(response.text, this._defaultCalendar, after, before);
	// 		const contentHash = await hashText(JSON.stringify(eventsBetween));

	// 		// [CACHE] Update calendar cache information 
	// 		calendarStore.update(cal => ({...cal, etag: response.headers.etag ?? "", lastModified: response.headers.lastModified ?? Date.now(), contentHash}))

	// 		setCalendarStatus("updated");
			
	// 	} catch (error) {
	// 		calendarState.update(() => { return { status: "error", lastError: error } });
	// 		new Notice("An error occured while fetching. See console for details");
	// 		console.error("An error occured while fetching:", error.message)
	// 	}
	// }
}