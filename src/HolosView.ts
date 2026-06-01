import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import HolosApp from './HolosApp.svelte';
import HolosPlugin from './main';

export const HOLOS_VIEW_TYPE = "holos-view"

export class HolosView extends ItemView {
    plugin: HolosPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: HolosPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return HOLOS_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Holos"
    }

    getIcon(): string {
        return "circle-off"
    }

    async onOpen() {
        if (!this.plugin.trackNoteService) {
            await this.plugin.initializeTrackNoteService();
        }

        const container = this.contentEl;
        container.empty();

        mount(HolosApp, { target: container, props: {
            app: this.plugin.app,
            settings: this.plugin.settings,
            dailyNoteService: this.plugin.dailyNoteService,
            trackNoteService: this.plugin.trackNoteService,
            saveSettings: () => this.plugin.queueSave(),
        }});
    }

    async onClose() {

    }
}
