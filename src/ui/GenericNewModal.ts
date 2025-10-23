import { Modal, App, Setting } from "obsidian";
import { generateID } from "src/actions/helpers";
import type { ISODate, ActionItemMeta, CalendarMeta, ItemType, ItemMeta } from "src/types";

export class GenericNewModal extends Modal {
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
                color: "",
            } as ItemMeta;
        } else if (type === "calendar") {
            meta = {
                id: generateID("cal-"),
                type: "calendar",
                order: -1,
                label: "",
                color: "",
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
            .addButton((b) => b.setButtonText("Save").setCta().onClick(() => {
                onSubmit(date, meta);
                this.close();
            }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    }
}