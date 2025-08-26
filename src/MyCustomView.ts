import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import UltimatePlannerView from './components/UltimatePlannerView.svelte';
import UltimatePlannerPlugin from './main.ts';



export const PLANNER_VIEW_TYPE = "my-custom-view"

export class MyCustomView extends ItemView {
    plugin: UltimatePlannerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: UltimatePlannerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return PLANNER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "My Custom View"
    }

    

    async onOpen() {
        const container = this.contentEl;
		container.empty();

        console.log("Opening view!!")

        mount(UltimatePlannerView, {target: container, props: {
            app: this.plugin.app,
            planner: this.plugin.settings.planner,
            save: () => this.plugin.queueSave(),
        }})
		// new Hello({target: container, props: {}});
    }

    async onClose() {

    }
} 