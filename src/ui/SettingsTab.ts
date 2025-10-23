import { App, PluginSettingTab, Setting } from 'obsidian';
import UltimatePlannerPlugin from '../main';
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

        new Setting(containerEl).setName('Refresh view after changing settings.')

        new Setting(containerEl).setName('Table Settings').setHeading();
        
        new Setting(containerEl)
            .setName('Week Format')
            .setDesc('whether to render dates in a week format')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.weekFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.weekFormat = value;
                        if (this.plugin.settings.weekFormat) {
                            this.plugin.settings.columns = 7;
                        }
                        await this.plugin.queueSave();
                    })

            });


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
            .setName('# of blocks to render')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(1, 4, 1)
                    .setValue(this.plugin.settings.blocks)
                    .onChange(async (value) => {
                        this.plugin.settings.blocks = value;
                        await this.plugin.queueSave();
                    })
            )

        new Setting(containerEl)
            .setName('# of columns to render')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(1, 10, 1)
                    .setValue(this.plugin.settings.columns)
                    .onChange(async (value) => {
                        this.plugin.settings.columns = value;
                        await this.plugin.queueSave();
                    })
            )

        new Setting(containerEl).setName('Data Saving').setHeading();

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

        // new Setting(containerEl)
        //     .setName('Remote Calendar Refresh Interval (min)')
        //     .addSlider(slider => 
        //         slider
        //             .setDynamicTooltip()
        //             .setLimits(1, 10, 1)
        //             // Display as minutes by dividing when displaying and multiply when saving
        //             .setValue(this.plugin.settings.refreshRemoteMs / 60 / 1000)
        //             .onChange(async (value) => {
        //                 this.plugin.settings.refreshRemoteMs = value * 60 * 1000;
        //                 await this.plugin.queueSave();
        //             })
        //     )

        new Setting(containerEl)
            .setName('Lookahead Days')
            .setDesc('The number of days forward back, from today, where remote events update from fetches.')
            .addSlider(slider => 
                slider
                    .setDynamicTooltip()
                    .setLimits(0, 30, 1)
                    .setValue(this.plugin.settings.lookaheadDays)
                    .onChange(async (value) => {
                        this.plugin.settings.lookaheadDays = value;
                        await this.plugin.queueSave();
                    })
            )
    }

    hide(): void {
    }
}