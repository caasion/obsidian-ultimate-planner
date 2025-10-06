import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { plannerStore } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, EMPTY_PLANNER, type NormalizedEvent, type PluginData, type PluginSettings } from './types';
import { calendarStore } from './state/calendarStore';
import { fetchFromUrl, hashText, detectFetchChange, shouldFetch, stripICSVariance } from './actions/calendarFetch';
import IcalExpander from 'ical-expander';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private plannerSubscription: Unsubscriber;
	private calendarSubscription: Unsubscriber;

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

		this.addCommand({
			id: 'debug-fetch-url-check',
			name: 'Debug: Fetch URL & Check',
			callback: async () => {
				const calendar = get(calendarStore);

				if (!shouldFetch(this.settings.refreshRemoteMs, calendar.lastFetched ?? undefined)) {
					console.log("wait a bit more bruh", (calendar.lastFetched ?? 0) - Date.now())
					return;
				}

				
				const response = await fetchFromUrl(this.settings.remoteCalendarUrl); // TODO: I probably need to catch this error now
				
				if (await detectFetchChange(response)) {
					console.log("hey! something changed... you should update the cache.")
				}
		}
		});

		this.addCommand({
			id: 'debug-fetch-url-parse',
			name: 'Debug: Fetch URL & Parse',
			callback: async () => {				
				const response = await fetchFromUrl(this.settings.remoteCalendarUrl); // TODO: I probably need to catch this error now

				const icalExpander = new IcalExpander({ics: response.text, maxIterations: 10})

				const results = icalExpander.all();

				console.log(results.events)

				const mappedEvents: NormalizedEvent[] = results.events.map(e => ({ 
					id: e.uid,
					start: e.startDate,
					end: e.endDate,
					allDay: false,
					summary: e.summary,
					location: e.location,
					description: e.description,
					calendarId: "hi"
				})); // only contains one-off events
				const mappedOccurrences = results.occurrences.map(o => ({ start: o.startDate, summary: o.item.summary }));
				const allEvents = [...mappedEvents, ...mappedOccurrences]; // contains recurring events

				console.log(mappedEvents, mappedOccurrences)

				console.log(allEvents.map(e => `${e.start.toJSDate().toISOString()} - ${e.summary}`).join('\n'));
				
				if (await detectFetchChange(response)) {
					console.log("hey! something changed... you should update the cache.")
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
		};


	private async flushSave() {
		if (this.saveTimer) {
			window.clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}

		await this.saveData(this.snapshot());
	}
}