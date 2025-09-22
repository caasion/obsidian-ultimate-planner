import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from './main';
import { mount, unmount } from 'svelte';
import type { PlannerState } from './types';

export interface UltimatePlannerSettings {
    settings: {
        weekStartOn: number,
        autosaveDebounceMs: number;
        remoteCalendarUrl: string;
        refreshRemote: number;
    }
    planner: PlannerState;
}

export const DEFAULT_SETTINGS: UltimatePlannerSettings = {
    settings: {
        weekStartOn: 0,
        autosaveDebounceMs: 200,
        remoteCalendarUrl: "",
        refreshRemote: 5,
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
                    .setValue(String(this.plugin.settings.settings.weekStartOn))
                    .onChange(async (value) => {
                        this.plugin.settings.settings.weekStartOn = value !== "" ? Number(value) : 0;
                        await this.plugin.saveSettings();
                    })

            });

        new Setting(containerEl)
            .setName('Autosave Debounce (ms)')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(100, 2000, 50)
                    .setValue(this.plugin.settings.settings.autosaveDebounceMs)
                    .onChange(async (value) => {
                        this.plugin.settings.settings.autosaveDebounceMs = value;
                        this.plugin.saveSettings();
                    })
            )
                
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

        new Setting(containerEl)
            .setName('Remote Calendar Refresh Interval')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(1, 10, 1)
                    .setValue(this.plugin.settings.settings.refreshRemote)
                    .onChange(async (value) => {
                        this.plugin.settings.settings.refreshRemote = value;
                        await this.plugin.saveSettings();
                    })
            )
    }

    hide(): void {
    }
}