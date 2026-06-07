import { Modal, App } from "obsidian";
import type { Track } from "src/plugin/types";

const MODAL_STYLE_ID = "holos-reorder-modal-styles";
const MODAL_STYLES = `
.holos-reorder-modal { max-width: 420px; }
.holos-reorder-hint { color: var(--text-muted); margin-bottom: 12px; }
.holos-reorder-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 16px;
}
.holos-reorder-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: grab;
    user-select: none;
}
.holos-reorder-item.is-dragging { opacity: 0.4; }
.holos-reorder-item.drag-over {
    border-color: var(--interactive-accent);
    background: var(--background-modifier-hover);
}
.holos-reorder-swatch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
}
.holos-reorder-handle {
    color: var(--text-muted);
    font-size: 16px;
    line-height: 1;
    cursor: grab;
}
.holos-reorder-label { flex: 1; font-weight: 500; }
.holos-reorder-buttons { display: flex; gap: 8px; justify-content: flex-end; }
`;

export class ReorderTracksModal extends Modal {
    private orderedTracks: Track[];
    private onSubmit: (orderedIds: string[]) => void;

    constructor(app: App, tracks: Track[], onSubmit: (orderedIds: string[]) => void) {
        super(app);
        this.orderedTracks = [...tracks];
        this.onSubmit = onSubmit;
    }

    onOpen() {
        if (!document.getElementById(MODAL_STYLE_ID)) {
            const styleEl = document.createElement("style");
            styleEl.id = MODAL_STYLE_ID;
            styleEl.textContent = MODAL_STYLES;
            document.head.appendChild(styleEl);
        }

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
            swatch.style.backgroundColor = track.color;

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
