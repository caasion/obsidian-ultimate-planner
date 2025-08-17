import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main.ts';
import { mount, unmount } from 'svelte';
import { ISODate, ActionItem, PlannerState } from './types.ts';

export interface UltimatePlannerSettings {

}

export const DEFAULT_SETTINGS: UltimatePlannerSettings = {

}

export class UltimatePlannerPluginTab extends PluginSettingTab {
    plugin: UltimatePlannerPlugin;

    constructor(app: App, plugin: UltimatePlannerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        
    }

    hide(): void {
    }
}