import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import UltimatePlannerView from './UltimatePlanner.svelte';
import UltimatePlannerPlugin from '../main';
import TemplateEditor from "./TemplateEditor.svelte";

export const PLAYGROUND_VIEW_TYPE = "playground-view"

export class PlaygroundView extends ItemView {
    plugin: UltimatePlannerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: UltimatePlannerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return PLAYGROUND_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Playground View"
    }

    async onOpen() {
        const container = this.contentEl;
		container.empty();
        
        mount(UltimatePlannerView, {target: container, props: {
            app: this.plugin.app,
            settings: this.plugin.settings,
            data: this.plugin.dataService,
            helper: this.plugin.helperService,
            plannerActions: this.plugin.plannerActions,
            calendarPipeline: this.plugin.calendarPipeline,
        }})
    }

    async onClose() {

    }
} 