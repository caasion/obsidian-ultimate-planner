import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main.ts';

export interface UltimatePlannerPluginSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: UltimatePlannerPluginSettings = {
	mySetting: 'default'
}

export class UltimatePlannerPluginTab extends PluginSettingTab {
	plugin: UltimatePlannerPlugin;

	constructor(app: App, plugin: UltimatePlannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}