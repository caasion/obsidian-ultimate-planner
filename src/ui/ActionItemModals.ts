import { Modal, Setting } from "obsidian";
import type { App } from 'obsidian'
import type { ActionItemMeta, ISODate } from "../types";
import { generateID } from "src/actions/helpers";

export class EditActionItemModal extends Modal {
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

export class NewActionItemModal extends Modal {
    constructor(app: App, onSubmit: (date: ISODate, meta: ActionItemMeta) => void) {
        super(app);
        
        const { contentEl } = this;

        const meta: ActionItemMeta = {
            id: generateID(),
            label: "",
            color: "",
        }

        const date = "2025-10-13"

        new Setting(contentEl)
            .setName("Name: ")
            .addText((t) => t.onChange((v) => (meta.label = v)));
        new Setting(contentEl)
            .setName("ID")
            .addText((t) => {
                t.setDisabled(true);
                t.setValue(meta.id);
            })
        new Setting(contentEl)
            .setName("Color: ")
            .addColorPicker(c => c  
                .onChange((v) => meta.color = v)
            );
        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Save").setCta().onClick(() => { 
                onSubmit(date, meta); 
                this.close(); }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        }
}