import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import HolosPlugin from '../main';
import ProjectGanttView from "./ui/ProjectGanttView.svelte";

export const GANTT_VIEW_TYPE = "gantt-view"

export class GanttView extends ItemView {
    plugin: HolosPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: HolosPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return GANTT_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Gantt View"
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

        mount(ProjectGanttView, { target: container, props: {
            app: this.plugin.app,
            trackNoteService: this.plugin.trackNoteService
        }})
    }

    async onClose() {

    }
} 