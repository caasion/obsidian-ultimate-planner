<script lang="ts">
    import type { Habit } from "src/plugin/types";

    interface HabitPreviewProps {
        habit: Habit;
        projectLabel: string;
        color: string;
        onDismiss: () => void;
    }

    let { habit, projectLabel, color, onDismiss }: HabitPreviewProps = $props();

    const shortenedProject = $derived(
        projectLabel.length > 12 ? projectLabel.slice(0, 12) + '…' : projectLabel
    );
</script>

<div class="habit-preview">
    <div class="habit-row">
        <div class="habit-content">
            <div class="habit-checkbox-container">
                <input
                    type="checkbox"
                    disabled
                    class="task-checkbox"
                />
            </div>
            <span class="habit-symbol">↻</span>
            <span class="habit-text">{habit.label.replace("[ ] ", "")}</span>
            <div class="habit-badge-container">
                <span class="project-badge" style={`background-color: ${color}80;`}>
                    {shortenedProject}
                </span>
            </div>
        </div>
        <button class="delete-btn" onclick={onDismiss} title="Dismiss">×</button>
    </div>
</div>

<style>
    .habit-preview {
        width: 100%;
        opacity: 0.7;
    }

    .habit-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .habit-content {
        flex: 1;
        padding: 2px 4px;
        border-radius: 2px;
        display: flex;
        align-items: center;
        min-height: 24px;
        gap: 4px;
        overflow: auto;
    }

    .habit-checkbox-container {
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

    .habit-symbol {
        flex-shrink: 0;
        font-size: 0.9em;
    }

    .habit-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .habit-badge-container {
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

    .habit-row:hover .delete-btn {
        opacity: 1;
    }

    .delete-btn:hover {
        color: var(--text-error);
    }
</style>
