import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from '../main';
import type { PlannerState } from '../types';
import type { Day } from 'date-fns';


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
            .setName('Start week on')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption("0", "Sunday")
                    .addOption("1", "Monday")
                    .setValue(String(this.plugin.settings.weekStartOn))
                    .onChange(async (value) => {
                        this.plugin.settings.weekStartOn = value !== "" ? Number(value) as Day: 0;
                        await this.plugin.queueSave();
                    })

            });

        new Setting(containerEl)
            .setName('# of weeks to render')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(1, 6, 1)
                    .setValue(this.plugin.settings.weeksToRender)
                    .onChange(async (value) => {
                        this.plugin.settings.weeksToRender = value;
                        await this.plugin.queueSave();
                    })
            )

        new Setting(containerEl)
            .setName('Autosave debounce (ms)')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(100, 2000, 50)
                    .setValue(this.plugin.settings.autosaveDebounceMs)
                    .onChange(async (value) => {
                        this.plugin.settings.autosaveDebounceMs = value;
                        await this.plugin.queueSave();
                    })
            )
        
        new Setting(containerEl).setName('Remote Calendar').setHeading();

        new Setting(containerEl)
            .setName('Remote Calendar Refresh Interval (min)')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(1, 10, 1)
                    // Display as minutes by dividing when displaying and multiply when saving
                    .setValue(this.plugin.settings.refreshRemoteMs / 60 / 1000)
                    .onChange(async (value) => {
                        this.plugin.settings.refreshRemoteMs = value * 60 * 1000;
                        await this.plugin.queueSave();
                    })
            )

        new Setting(containerEl)
            .setName('Archive Past Events')
            .addToggle(toggle => 
                toggle
                    .setValue(this.plugin.settings.archivePastEvents)
                    .onChange(async (value) => {
                        this.plugin.settings.archivePastEvents = value;
                        await this.plugin.queueSave(); 
                    })
            )

        new Setting(containerEl)
            .setName('Grace Days')
            .setDesc('The number of days back, from today, where remote events still update from fetches.')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(0, 7, 1)
                    .setValue(this.plugin.settings.graceDays)
                    .onChange(async (value) => {
                        this.plugin.settings.graceDays = value;
                        await this.plugin.queueSave();
                    })
            )
        
            new Setting(containerEl)
            .setName('Retention Months')
            .setDesc('How far back (in months) remote events should be retained.')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(1, 6, 1)
                    .setValue(this.plugin.settings.retentionMonths)
                    .onChange(async (value) => {
                        this.plugin.settings.retentionMonths = value;
                        await this.plugin.queueSave();
                    })
            )
    }

    hide(): void {
    }
}