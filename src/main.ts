import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { MY_VIEW_TYPE, MyCustomView } from './MyCustomView';
import { UltimatePlannerSettings, UltimatePlannerPluginTab, DEFAULT_SETTINGS } from './SettingsTab';


export default class UltimatePlannerPlugin extends Plugin {
	settings: UltimatePlannerSettings;
	private saveTimer: number | null = null;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new UltimatePlannerPluginTab(this.app, this));

		this.registerView(MY_VIEW_TYPE, (leaf) => new MyCustomView(leaf, this));

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-custom-view',
			name: 'Open custom (simple)',
			callback: () => {
				this.activateMyPlannerView();
			}
		});
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(MY_VIEW_TYPE);
		await this.flushSave();
	}

	async activateMyPlannerView() {
		const leaves = this.app.workspace.getLeavesOfType(MY_VIEW_TYPE);
		if (leaves.length === 0) {
			await this.app.workspace.getLeaf(false).setViewState({
				type: MY_VIEW_TYPE,
				active: true,
			});

		}

		this.app.workspace.getLeavesOfType(MY_VIEW_TYPE)[0];
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	queueSave = () => {
		
  console.log("[UP] queueSave called");
  console.log("[UP] plugin id:", this.manifest?.id, "has app?", !!this.app);
  if (this.saveTimer) window.clearTimeout(this.saveTimer);
  this.saveTimer = window.setTimeout(async () => {
    this.saveTimer = null;
    try {
      // ✅ add a visible heartbeat so you can see it persisted
      (this.settings as any)._lastSavedAt = new Date().toISOString();

      console.time("[UP] saveData");
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