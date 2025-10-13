import { Modal, App, Setting } from "obsidian";
import { generateID, getISODate } from "src/actions/helpers";
import type { ISODate, CalendarMeta } from "src/types";

export class EditCalendarModal extends Modal {
    constructor(app: App, initial: CalendarMeta, onSubmit: (meta: CalendarMeta) => void) {
        super(app);
        
        const { contentEl } = this;
        const date = "2025-10-13";

        let meta: CalendarMeta = {...initial}

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
                onSubmit(meta); 
                this.close(); }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        }
}

export class NewCalendarModal extends Modal {
    constructor(app: App, onSubmit: (date: ISODate, meta: CalendarMeta) => void) {
        super(app);
        
        const { contentEl } = this;
        const meta: CalendarMeta = {
            id: generateID("cal-"),
            label: "",
            color: "",
            url: "",
        }
        let date: ISODate = "";

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
        
        const dateLabel = document.createElement("label");
        dateLabel.textContent = "Date: ";

        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.value = getISODate(new Date());

        dateInput.addEventListener("input", (e) => {
            date = (e.target as HTMLInputElement).value;
        });

        // Append to modal content
        contentEl.appendChild(dateLabel);
        contentEl.appendChild(dateInput);

        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Save").setCta().onClick(() => { 
                onSubmit(date, meta); 
                this.close(); }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        }
}