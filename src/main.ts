import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { PLANNER_VIEW_TYPE, PlannerView } from './PlannerView';
import { UltimatePlannerPluginTab, DEFAULT_SETTINGS } from './SettingsTab';
import type { UltimatePlannerSettings } from './SettingsTab';
import { TEMPLATES_VIEW_TYPE, TemplatesView } from './TemplatesView';
import { plannerStore } from './state/plannerStore';
import { get, type Unsubscriber } from 'svelte/store';

export default class UltimatePlannerPlugin extends Plugin {
	settings: UltimatePlannerSettings;
	private saveTimer: number | null = null;
	private plannerSubscription: Unsubscriber;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new UltimatePlannerPluginTab(this.app, this));

		this.registerView(PLANNER_VIEW_TYPE, (leaf) => new PlannerView(leaf, this));

		this.registerView(TEMPLATES_VIEW_TYPE, (leaf) => new TemplatesView(leaf, this));

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-planner-view',
			name: 'Open Ultimate Planner',
			callback: () => {
				this.activateView(PLANNER_VIEW_TYPE);
			}
		});

		this.addCommand({
			id: 'open-templates-view',
			name: 'Open Templates Editor',
			callback: () => {
				this.activateView(TEMPLATES_VIEW_TYPE);
			}
		});

	}

	async onunload() {
		// this.app.workspace.detachLeavesOfType(PLANNER_VIEW_TYPE);
		// this.app.workspace.detachLeavesOfType(TEMPLATES_VIEW_TYPE);
		this.plannerSubscription();
		await this.flushSave();
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

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		plannerStore.set(this.settings.planner); // Initialize Store
		this.plannerSubscription = plannerStore.subscribe(() => this.queueSave());

	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	public queueSave = () => {
		console.log("[UP] queueSave called");
		// console.log("[UP] plugin id:", this.manifest?.id, "has app?", !!this.app);
		if (this.saveTimer) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(async () => {
			this.saveTimer = null;
			try {
				// ✅ add a visible heartbeat so you can see it persisted
				(this.settings as any)._lastSavedAt = new Date().toISOString();

				console.time("[UP] saveData");
				this.settings.planner = get(plannerStore);
				await this.saveData(this.settings);   // <-- must be awaited
				console.timeEnd("[UP] saveData");
				console.log("[UP] save ok", this.settings);
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

		await this.saveData(this.settings);
	}
}