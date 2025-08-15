import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { mount } from 'svelte';
import UltimatePlannerView from './components/UltimatePlannerView.svelte';
import UltimatePlannerPlugin from './main.ts';


export const MY_VIEW_TYPE = "my-custom-view"

export class MyCustomView extends ItemView {
    plugin: UltimatePlannerPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: UltimatePlannerPlugin) {
        super(leaf);
        this.plugin = plugin;
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
        mount(UltimatePlannerView, {target: container, props: {
            settings: this.plugin.settings,
            save: async (data: string[][]) => await this.saveCSVFile(this.plugin, data, "Test"),
        }})
		// new Hello({target: container, props: {}});
    }

    async onClose() {

    }

    arrayToCSV(data: string[][]): string {
    return data.map(row =>
        row.map(cell => {
            if (cell == null) cell = ""; // handle null/undefined

            const needsQuotes = /[",\n]/.test(cell);
            let escaped = cell.replace(/"/g, `""`); // double quotes

            return needsQuotes ? `"${escaped}"` : escaped;
        }).join(",")
    ).join("\n");
}

    async saveCSVFile(plugin: UltimatePlannerPlugin, data: string[][], fileName: string) {
        const csvString = this.arrayToCSV(data);
        const filePath = `MyData/${fileName}.csv`;

        // Create folder if it doesn't exist
        if (!plugin.app.vault.getAbstractFileByPath("MyData")) {
            await plugin.app.vault.createFolder("MyData");
        }

        // Create or overwrite file
        const existingFile = plugin.app.vault.getAbstractFileByPath(filePath);
        if (existingFile) {
            await plugin.app.vault.modify(existingFile as TFile, csvString);
        } else {
            await plugin.app.vault.create(filePath, csvString);
        }

        new Notice(`Saved CSV to ${filePath}`);
    }
} 