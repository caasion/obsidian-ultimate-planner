import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main';
import { mount, unmount } from 'svelte';
import type { PlannerState } from './types';

export interface UltimatePlannerSettings {
    settings: {
        weekStartOn: string,
        autosaveDebounceMs: string;
        remoteCalendarUrl: string;
    }
    planner: PlannerState;
}

export const DEFAULT_SETTINGS: UltimatePlannerSettings = {
    settings: {
        weekStartOn: "0",
        autosaveDebounceMs: "200",
        remoteCalendarUrl: ""
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

        new Setting(containerEl)
            .setName('Start Week On')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("0", "Sunday")
                    .addOption("1", "Monday")
                    .setValue(this.plugin.settings.settings.weekStartOn)
                    .onChange(async (value) => {
                        this.plugin.settings.settings.weekStartOn = value;
                        await this.plugin.saveSettings();
                    })

            });

        new Setting(containerEl)
            .setName('Default value')
            .addText((text) =>
                text
                .setPlaceholder("200")
                .setValue(this.plugin.settings.settings.autosaveDebounceMs)
                .onChange(async (value) => {
                    this.plugin.settings.settings.autosaveDebounceMs = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName('Remote Calendar')
            .addText((text) => {
                text
                    .setPlaceholder('link')
                    .setValue(this.plugin.settings.settings.remoteCalendarUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.settings.remoteCalendarUrl = value;
                        await this.plugin.saveSettings();
                    })
            })
    }

    hide(): void {
    }
}