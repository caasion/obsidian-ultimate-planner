import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { actionItems, calendarCells, calendars, cells, templates } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, EMPTY_PLANNER, type ActionItemID, type NormalizedEvent, type PluginData, type PluginSettings } from './types';
import { addDays, startOfDay } from 'date-fns';
import { fetchAllandFreeze, fetchPipelineInGracePeriod } from './actions/calendarPipelines';
import { migrateToVersion4 } from './migration';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private storeSubscriptions: Unsubscriber[];
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

		this.addCommand({
			id: 'debug-manual-fetch',
			name: 'Debug: Manual Fetch in Grace Period',
			callback: async () => {
				fetchPipelineInGracePeriod(get(calendars)["cal-abcdefji-fsdkj-fjdskl"], addDays(startOfDay(Date.now()), -7), addDays(startOfDay(Date.now()), 60))
			}

			// TODO: Make this round to the nearest day, instead of caring bout time
		})

		this.addCommand({
			id: 'debug-manual-fetch-freeze',
			name: 'Debug: Manual Fetch All & Freeze',
			callback: async () => {
				fetchAllandFreeze(get(calendars)["cal-abcdefji-fsdkj-fjdskl"], addDays(Date.now(), -7), addDays(Date.now(), 60))
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
		this.storeSubscriptions.forEach(unsub => unsub());

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
		actionItems.set(Object.assign({}, {}, data.planner.actionItems));
		calendars.set(Object.assign({}, {}, data.planner.calendars));
		templates.set(Object.assign({}, {}, data.planner.templates));
		cells.set(Object.assign({}, {}, data.planner.cells));
		calendarCells.set(Object.assign({}, {}, data.planner.calendarCells));
		this.storeSubscriptions = [
			actionItems.subscribe(() => this.queueSave()),
			cells.subscribe(() => this.queueSave()),
			calendars.subscribe(() => this.queueSave()),
			calendarCells.subscribe(() => this.queueSave()),
			templates.subscribe(() => this.queueSave())
		]
	}

	private snapshot(): PluginData {
		return {
			version: 4,
			settings: this.settings,
			planner: {
				actionItems: get(actionItems),
				calendars: get(calendars),
				templates: get(templates),
				cells: get(cells),
				calendarCells: get(calendarCells),
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