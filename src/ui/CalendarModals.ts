import { Modal, App, Setting } from "obsidian";
import { generateID } from "src/actions/helpers";
import type { ISODate, CalendarMeta } from "src/types";

export class NewCalendarModal extends Modal {
    constructor(app: App, onSubmit: (date: ISODate, meta: CalendarMeta) => void) {
        super(app);
        
        const { contentEl } = this;

        const meta: CalendarMeta = {
            id: generateID(),
            label: "",
            color: "",
            url: "",
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
            .setName("Remote Calendar URL: ")
            .addText((t) => t.onChange((v) => (meta.url = v)));
        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Save").setCta().onClick(() => { 
                onSubmit(date, meta); 
                this.close(); }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        }
}