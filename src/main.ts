import { Plugin } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { addToTemplate, dayData, getCell, removeFromCellsInTemplate, removeFromTemplate, setCell, setTemplate, templates, updateItemMeta } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, type CalendarHelperService, type DataService, type FetchService, type HelperService, type PluginData, type PluginSettings } from './types';
import { CalendarPipeline } from './actions/calendarPipelines';
import { PlannerActions } from './actions/itemActions';
import { calendarState, fetchToken } from './state/calendarState';
import { hashText, generateID, getISODate, addDaysISO, swapArrayItems } from './actions/helpers';
import { parseICS, parseICSBetween, normalizeEvent, normalizeOccurrenceEvent, buildEventDictionaries, getEventLabels } from './actions/calendarHelper';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private storeSubscriptions: Unsubscriber[] = [];
	public dataService: DataService;
	public helperService: HelperService;
	public calendarHelperService: CalendarHelperService;
	public fetchService: FetchService;
	public plannerActions: PlannerActions;
	public calendarPipeline: CalendarPipeline;


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

		this.dataService = {
			dayData,
			templates,
			calendarState,
			fetchToken,
			
			setTemplate,
			addToTemplate,
			removeFromTemplate,
			removeFromCellsInTemplate,
			getItemMeta: () => {}, // NOT IMPLEMENTED
			updateItemMeta,
			setCell,
			getCell
		}

		this.helperService = {
			hashText,
			generateID,
			getISODate,
			addDaysISO,
			swapArrayItems,
			idUsedInTemplates: () => true, // NOT IMPLEMENTED
		}

		this.calendarHelperService = {
			parseICS,
			parseICSBetween,
			normalizeEvent,
			normalizeOccurrenceEvent,
			buildEventDictionaries,
			getEventLabels
		}
		
		this.calendarPipeline = new CalendarPipeline({
			data: this.dataService, 
			fetch: this.fetchService, 
			helpers: this.helperService, 
			calHelpers: this.calendarHelperService
		})

		this.plannerActions = new PlannerActions({
			data: this.dataService, 
			helpers: this.helperService, 
			calendarPipelines: this.calendarPipeline})

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
		await this.storeSubscriptions.forEach(unsub => unsub());

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
		templates.set(Object.assign({}, {}, data.planner.templates));
		dayData.set(Object.assign({}, {}, data.planner.dayData))
		this.storeSubscriptions = [
			dayData.subscribe(() => this.queueSave()),
			templates.subscribe(() => this.queueSave())
		]
	}

	private snapshot(): PluginData {
		return {
			version: 5,
			settings: this.settings,
			planner: {
				dayData: get(dayData),
				templates: get(templates),
			},
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
}