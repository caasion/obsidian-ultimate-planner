import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import Playground from './Playground.svelte';
import UltimatePlannerPlugin from '../main';

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
                
        mount(Playground, {target: container})
    }

    async onClose() {

    }
} 