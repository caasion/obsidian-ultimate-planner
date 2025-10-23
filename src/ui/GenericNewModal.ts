import { Modal, App, Setting } from "obsidian";
import { generateID } from "src/actions/helpers";
import type { ISODate, CalendarMeta, ItemType, ItemMeta } from "src/types";

export class NewItemModal extends Modal {
    constructor(app: App, type: ItemType, tDate: ISODate, onSubmit: (date: ISODate, meta: ItemMeta) => void) {
        super(app);

        const { contentEl } = this;
        let date: ISODate = tDate;
        let meta: ItemMeta;

        if (type === "action") {
            meta = {
                id: generateID("ai-"),
                type: "action",
                order: -1, // We set the order in when newItem is called
                label: "",
                color: "#cccccc",
            } as ItemMeta;
        } else if (type === "calendar") {
            meta = {
                id: generateID("cal-"),
                type: "calendar",
                order: -1,
                label: "",
                color: "#cccccc",
                url: "",
            } as ItemMeta;
        }
        

        new Setting(contentEl)
            .setName("Name: ")
            .addText((t) => t.onChange((v) => (meta.label = v)));

        new Setting(contentEl)
            .setName("ID")
            .addText((t) => {
                t.setDisabled(true);
                t.setValue(meta.id);
            });

        new Setting(contentEl)
            .setName("Color: ")
            .addColorPicker(c => {
                c.setValue(meta.color);
                c.onChange((v) => meta.color = v);
            }
            );

        if (type === "calendar") {
            new Setting(contentEl)
                .setName("Remote Calendar URL: ")
                .addText((t) => t.onChange((v) => ((meta as CalendarMeta).url = v)));
        }

        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Add").setCta().onClick(() => {
                onSubmit(date, meta);
                this.close();
            }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    }
}

export class NewTemplateModal extends Modal {
    constructor(app: App, date: ISODate, onSubmit: (tDate: ISODate) => void) {
        super(app);

        const { contentEl } = this

        

        const dateContainer = document.createElement("div");
            dateContainer.setCssStyles({
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
            })
        const dateLabel = document.createElement("label");
            dateLabel.textContent = "Date: ";
        const dateInput = document.createElement("input");
            dateInput.type = "date";
            dateInput.value = date;
            dateInput.addEventListener("input", (e) => {
                date = (e.target as HTMLInputElement).value;
            });
        dateContainer.appendChild(dateLabel);
        dateContainer.appendChild(dateInput);
        contentEl.appendChild(dateContainer);

        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Add").setCta().onClick(() => {
                onSubmit(date);
                this.close();
            }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    }
}