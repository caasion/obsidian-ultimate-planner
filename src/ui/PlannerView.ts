import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import UltimatePlannerView from './UltimatePlanner.svelte';
import UltimatePlannerPlugin from '../main';

export const PLANNER_VIEW_TYPE = "ultimate-planner-view"

export class PlannerView extends ItemView {
    plugin: UltimatePlannerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: UltimatePlannerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return PLANNER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Ultimate Planner View"
    }

    async onOpen() {
        const container = this.contentEl;
		container.empty();
        
        mount(UltimatePlannerView, {target: container, props: {
            app: this.plugin.app,
            settings: this.plugin.settings,
        }})
    }

    async onClose() {

    }
} 