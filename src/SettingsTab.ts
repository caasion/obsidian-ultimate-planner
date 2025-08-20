import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main.ts';
import { mount, unmount } from 'svelte';
import { ISODate, ActionItem, PlannerState } from './types.ts';

export interface UltimatePlannerSettings {
    version: number;
    settings: {
        weekStartOn: number,
        autosaveDebounceMs: number;
    }
    actionItems: ActionItem[];
    planner: PlannerState;
}

export const DEFAULT_SETTINGS: UltimatePlannerSettings = {
    version: 1,
    settings: {
        weekStartOn: 0,
        autosaveDebounceMs: 0,
    },
    actionItems: [
        {
            id: "fitness",
            index: 0,
            label: "Fitness",
            color: "#cccccc"
        },
        {
            id: "coding",
            index: 1,
            label: "Coding",
            color: "#cccccc"
        },
    ],
    planner: { cells: {}}
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