import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main.ts';

export interface UltimatePlannerPluginSettings {
	actionItemsText: string;
}

export const DEFAULT_SETTINGS: UltimatePlannerPluginSettings = {
	actionItemsText: 'Action Item 1'
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
            .setName("Action Items")
            .setDesc("List out Action Items, separated by a new line")
            .addTextArea(textArea => textArea
                .setPlaceholder('Action Item 1')
                .setValue(this.plugin.settings.actionItemsText)
                .onChange(async (value) => {
                    this.plugin.settings.actionItemsText = value;
                    await this.plugin.saveSettings();
                })
            )
	}
}