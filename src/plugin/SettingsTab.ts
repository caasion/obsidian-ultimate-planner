import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import HolosPlugin from '../main';
import type { Day } from 'date-fns';


export class HolosSettingsTab extends PluginSettingTab {
    plugin: HolosPlugin;

    constructor(app: App, plugin: HolosPlugin) {
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
            .setName('Section Heading')
            .setDesc('The heading in your daily notes where tasks are stored (e.g., "Holos", "Tasks", "Daily Plan")')
            .addText((text) => {
                text
                    .setPlaceholder('Holos')
                    .setValue(this.plugin.settings.sectionHeading)
                    .onChange(async (value) => {
                        this.plugin.settings.sectionHeading = value || 'Holos';
                        await this.plugin.queueSave();
                    });
            });

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

        new Setting(containerEl).setName('Track Settings').setHeading();

        new Setting(containerEl)
            .setName('Create projects as folder notes')
            .setDesc('When enabled, new projects are created as <Project>/<Project>.md. Existing projects continue to work in either format.')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.projectNotesAsFolders)
                    .onChange(async (value) => {
                        this.plugin.settings.projectNotesAsFolders = value;
                        await this.plugin.queueSave();
                    });
            });
        
        new Setting(containerEl).setName('Remote Calendar').setHeading();

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

        new Setting(containerEl).setName('Migration').setHeading();

        new Setting(containerEl)
            .setName('Migrate projects to phases')
            .setDesc('Convert all task-based projects to the phase-based format. This is a one-time operation — already migrated projects are skipped.')
            .addButton(button => {
                button
                    .setButtonText('Migrate')
                    .onClick(async () => {
                        button.setDisabled(true);
                        button.setButtonText('Migrating...');
                        try {
                            const count = await this.plugin.trackNoteService.migrateProjectsToPhases();
                            if (count > 0) {
                                new Notice(`Migrated ${count} project${count === 1 ? '' : 's'} to phase format.`);
                            } else {
                                new Notice('All projects are already migrated.');
                            }
                        } catch (e) {
                            console.error('[Holos] Migration failed', e);
                            new Notice('Migration failed. See console for details.');
                        } finally {
                            button.setDisabled(false);
                            button.setButtonText('Migrate');
                        }
                    });
            });

        new Setting(containerEl).setName('Developer Mode').setHeading();

        new Setting(containerEl)
            .setName('Debug Mode')
            .setDesc('Activate Playground View, debug commands, and debug logs. (Reload plugin to reflect changes)')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.debug)
                    .onChange(value => {
                        this.plugin.settings.debug = true;
                        this.plugin.queueSave();
                    }
                    )
            })
    }

    hide(): void {
    }
}