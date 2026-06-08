import { Modal, App } from "obsidian";
import type { Track } from "src/plugin/types";

export class ReorderTracksModal extends Modal {
    private orderedTracks: Track[];
    private onSubmit: (orderedIds: string[]) => void;

    constructor(app: App, tracks: Track[], onSubmit: (orderedIds: string[]) => void) {
        super(app);
        this.orderedTracks = [...tracks];
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("holos-reorder-modal");

        contentEl.createEl("h2", { text: "Reorder Tracks" });
        contentEl.createEl("p", {
            text: "Drag tracks to reorder them.",
            cls: "holos-reorder-hint"
        });

        const list = contentEl.createEl("ul", { cls: "holos-reorder-list" });

        this.renderList(list);

        const buttonRow = contentEl.createDiv({ cls: "holos-reorder-buttons" });

        const saveBtn = buttonRow.createEl("button", { text: "Save", cls: "mod-cta" });
        saveBtn.addEventListener("click", () => {
            this.onSubmit(this.orderedTracks.map(t => t.id));
            this.close();
        });

        const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
        cancelBtn.addEventListener("click", () => this.close());
    }

    private renderList(list: HTMLUListElement) {
        list.empty();

        for (let i = 0; i < this.orderedTracks.length; i++) {
            const track = this.orderedTracks[i];
            const item = list.createEl("li", { cls: "holos-reorder-item" });
            item.draggable = true;
            item.dataset.id = track.id;

            // Color swatch
            const swatch = item.createDiv({ cls: "holos-reorder-swatch" });
            swatch.setCssProps({ "--swatch-color": track.color });

            // Drag handle icon
            item.createDiv({ cls: "holos-reorder-handle", text: "⠿" });

            item.createSpan({ text: track.label, cls: "holos-reorder-label" });

            item.addEventListener("dragstart", (e) => {
                item.addClass("is-dragging");
                e.dataTransfer?.setData("text/plain", track.id);
            });

            item.addEventListener("dragend", () => {
                item.removeClass("is-dragging");
                list.querySelectorAll(".holos-reorder-item").forEach(el => {
                    el.classList.remove("drag-over");
                });
            });

            item.addEventListener("dragover", (e) => {
                e.preventDefault();
                list.querySelectorAll(".holos-reorder-item").forEach(el => {
                    el.classList.remove("drag-over");
                });
                item.addClass("drag-over");
            });

            item.addEventListener("dragleave", () => {
                item.removeClass("drag-over");
            });

            item.addEventListener("drop", (e) => {
                e.preventDefault();
                item.removeClass("drag-over");

                const draggedId = e.dataTransfer?.getData("text/plain");
                if (!draggedId || draggedId === track.id) return;

                const fromIndex = this.orderedTracks.findIndex(t => t.id === draggedId);
                const toIndex = this.orderedTracks.findIndex(t => t.id === track.id);
                if (fromIndex === -1 || toIndex === -1) return;

                const [moved] = this.orderedTracks.splice(fromIndex, 1);
                this.orderedTracks.splice(toIndex, 0, moved);

                this.renderList(list);
            });
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}
