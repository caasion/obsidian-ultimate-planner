import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main.ts';
import { mount, unmount } from 'svelte';
import SettingsTab from './components/SettingsTab.svelte';

export type ActionItem = {
    id: string;       // stable id for reorder
    label: string;
    color: string; 
}

export interface UltimatePlannerPluginSettings {
	actionItems: ActionItem[];
}

export const DEFAULT_SETTINGS: UltimatePlannerPluginSettings = {
	actionItems: [{
        id: '1',
        label: 'First Action Item',
        color: "#00bcd4"
    }]
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

        mount(SettingsTab, { target: containerEl, props: 
            { 
                settings: this.plugin.settings,
                save: (newSettings: UltimatePlannerPluginSettings) => {
                    this.plugin.settings = newSettings;
                    this.plugin.saveSettings();
                }
            }
        });
	}

    hide(): void {
        unmount(SettingsTab);
    }
}