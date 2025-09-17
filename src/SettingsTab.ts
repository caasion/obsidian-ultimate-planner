import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main';
import { mount, unmount } from 'svelte';
import type { PlannerState } from './types';

export interface UltimatePlannerSettings {
    settings: {
        weekStartOn: number,
        autosaveDebounceMs: number;
    }
    planner: PlannerState;
}

export const DEFAULT_SETTINGS: UltimatePlannerSettings = {
    settings: {
        weekStartOn: 0,
        autosaveDebounceMs: 0,
    }, 
    planner: { 
        actionItems: {},
        cells: {},
        templates: {}
    },
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