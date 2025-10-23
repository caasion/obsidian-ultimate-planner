import { Modal, App, Setting } from "obsidian";

export class ConfirmationModal extends Modal {
    constructor(app: App, onSubmit: () => void, message?: string) {
        super(app);

        const { contentEl } = this;

        new Setting(contentEl).setName('Are you sure?').setHeading();

        if (message) {
            new Setting(contentEl).setName(message);
        }

        new Setting(contentEl)
            .addButton((b) => b.setButtonText("Add").setCta().onClick(() => {
                onSubmit();
                this.close();
            }))
            .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
        
    }
}