import { ItemView, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import UltimatePlannerView from './components/UltimatePlannerView.svelte';

export const MY_VIEW_TYPE = "my-custom-view"

export class MyCustomView extends ItemView {
    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return MY_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "My Custom View"
    }

    async onOpen() {
        const container = this.contentEl;
		container.empty();

        console.log("Opening view!!")
        mount(UltimatePlannerView, {target: container, props: {}})
		// new Hello({target: container, props: {}});
    }

    async onClose() {

    }
} 