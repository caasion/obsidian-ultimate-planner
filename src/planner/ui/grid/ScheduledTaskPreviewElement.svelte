<script lang="ts">
    import type { Element } from "src/plugin/types";

    interface ScheduledTaskPreviewProps {
        element: Element;
        projectLabel: string;
        color: string;
        onDismiss: () => void;
    }

    let { element, projectLabel, color, onDismiss }: ScheduledTaskPreviewProps = $props();

    const shortenedProject = $derived(
        projectLabel.length > 12 ? projectLabel.slice(0, 12) + '…' : projectLabel
    );
</script>

<div class="scheduled-preview">
    <div class="scheduled-row">
        <div class="scheduled-content">
            <div class="scheduled-checkbox-container">
                <input
                    type="checkbox"
                    disabled
                    class="task-checkbox"
                />
            </div>
            <span class="scheduled-symbol">📅</span>
            <span class="scheduled-text">{element.text}</span>
            <div class="scheduled-badge-container">
                <span class="project-badge" style={`background-color: ${color}80;`}>
                    {shortenedProject}
                </span>
            </div>
        </div>
        <button class="delete-btn" onclick={onDismiss} title="Dismiss">×</button>
    </div>
</div>

<style>
    .scheduled-preview {
        width: 100%;
        opacity: 0.7;
    }

    .scheduled-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .scheduled-content {
        flex: 1;
        padding: 2px 4px;
        border-radius: 2px;
        display: flex;
        align-items: center;
        min-height: 24px;
        gap: 4px;
        overflow: auto;
    }

    .scheduled-checkbox-container {
        height: 20px;
        width: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .task-checkbox {
        cursor: default;
        margin: 0;
        opacity: 0.5;
    }

    .scheduled-symbol {
        flex-shrink: 0;
        font-size: 0.9em;
    }

    .scheduled-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .scheduled-badge-container {
        margin-left: auto;
        flex-shrink: 0;
    }

    .project-badge {
        font-size: 0.8em;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        white-space: nowrap;
    }

    .delete-btn {
        opacity: 0;
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 1.2em;
        padding: 0 4px;
        line-height: 1;
    }

    .scheduled-row:hover .delete-btn {
        opacity: 1;
    }

    .delete-btn:hover {
        color: var(--text-error);
    }
</style>
