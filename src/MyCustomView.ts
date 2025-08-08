import { ItemView, WorkspaceLeaf } from "obsidian";

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
        const container = this.containerEl.children[1];
		container.empty();
		container.createEl("h2", { text: "Welcome to My Custom View!" });
    }

    async onClose() {

    }
} 