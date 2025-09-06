import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import UltimatePlannerPlugin from './main';
import TemplateEditor from "./components/TemplateEditor.svelte";

export const TEMPLATES_VIEW_TYPE = "templates-editor-view"

export class TemplatesView extends ItemView {
    plugin: UltimatePlannerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: UltimatePlannerPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return TEMPLATES_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Templates Editor View"
    }

    async onOpen() {
        const container = this.contentEl;
		container.empty();
        
        mount(TemplateEditor, {target: container, props: {
            templates: this.plugin.settings.planner.templates,
            save: () => this.plugin.queueSave(),
        }})
    }

    async onClose() {

    }
} 