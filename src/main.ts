import { Plugin } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './ui/PlannerView';
import { UltimatePlannerPluginTab } from './ui/SettingsTab';
import { dayData, templates } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';
import { DEFAULT_SETTINGS, type PluginData, type PluginSettings } from './types';
import { addDays, startOfDay } from 'date-fns';
import { fetchAllandFreeze, fetchPipelineInGracePeriod } from './actions/calendarPipelines';

export default class UltimatePlannerPlugin extends Plugin {
	settings: PluginSettings;
	private saveTimer: number | null = null;
	private storeSubscriptions: Unsubscriber[] = [];

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

		// this.addCommand({
		// 	id: 'debug-manual-fetch',
		// 	name: 'Debug: Manual Fetch in Grace Period',
		// 	callback: async () => {
		// 		fetchPipelineInGracePeriod(get(calendars)["cal-abcdefji-fsdkj-fjdskl"], addDays(startOfDay(Date.now()), -7), addDays(startOfDay(Date.now()), 60))
		// 	}
		// })

		// this.addCommand({
		// 	id: 'debug-manual-fetch-freeze',
		// 	name: 'Debug: Manual Fetch All & Freeze',
		// 	callback: async () => {
		// 		fetchAllandFreeze(get(calendars)["cal-abcdefji-fsdkj-fjdskl"], addDays(Date.now(), -7), addDays(Date.now(), 60))
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