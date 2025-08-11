import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { MY_VIEW_TYPE, MyCustomView } from './MyCustomView';
import { UltimatePlannerPluginSettings, UltimatePlannerPluginTab, DEFAULT_SETTINGS } from './SettingsTab';

// Remember to rename these classes and interfaces!



export default class UltimatePlannerPlugin extends Plugin {
	settings: UltimatePlannerPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new UltimatePlannerPluginTab(this.app, this));

		this.registerView(MY_VIEW_TYPE, (leaf) => new MyCustomView(leaf));

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-custom-view',
			name: 'Open custom (simple)',
			callback: () => {
				this.activateMyPlannerView();
			}
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(MY_VIEW_TYPE);
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
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}


