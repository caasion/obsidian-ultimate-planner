import { Modal, Setting } from "obsidian";
import type { App } from 'obsidian'
import type { ActionItemMeta } from "../types";

export class RenameActionItemModal extends Modal {

    constructor(app: App, initial: ActionItemMeta, onSubmit: (label: string, color: string) => void) {
        super(app);
        
        const { contentEl } = this;
        let {label, color} = initial;
        new Setting(contentEl)
            .setName("New name")
            .addText((t) => t.setValue(label).onChange((v) => (label = v)));
        new Setting(contentEl)
            .setName("New color")
            .addColorPicker(c => c  
                .setValue(color)
                .onChange((v) => color = v)
            );
        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Save").setCta().onClick(() => { 
                onSubmit(label, color); 
                this.close(); }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        }

}

export class ReplaceActionItemModal extends Modal {

    constructor(app: App, initial: ActionItemMeta, onSubmit: (label: string, color: string) => void) {
        super(app);
        
        const { contentEl } = this;
        let {label, color} = initial;
        new Setting(contentEl)
            .setName("New name")
            .addText((t) => t.setValue(label).onChange((v) => (label = v)));
        new Setting(contentEl)
            .setName("New color")
            .addColorPicker(c => c  
                .setValue(color)
                .onChange((v) => color = v)
            );
        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Save").setCta().onClick(() => { 
                onSubmit(label, color); 
                this.close(); }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        }

}