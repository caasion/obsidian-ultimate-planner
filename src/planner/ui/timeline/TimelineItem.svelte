<script lang="ts">
    import type { Element, Track } from "src/plugin/types";
    import { formatTime } from "src/plugin/helpers";

    interface Props {
        element: Element;
        track: Track;
        hourHeight: number;
        startHour: number;
        topPad?: number;
        onToggle?: () => void;
    }

    let { element, track, hourHeight, startHour, topPad = 0, onToggle }: Props = $props();

    const top = $derived.by(() => {
        if (!element.startTime) return 0;
        const hourOffset = element.startTime.hours - startHour;
        const minuteOffset = element.startTime.minutes / 60;
        return (hourOffset + minuteOffset) * hourHeight + topPad;
    });

    const height = $derived.by(() => {
        if (!element.duration || !element.timeUnit) return hourHeight;
        const minutes = element.timeUnit === 'hr' ? element.duration * 60 : element.duration;
        return (minutes / 60) * hourHeight;
    });

    const timeLabel = $derived.by(() => {
        if (!element.startTime || !element.duration || !element.timeUnit) return '';
        const mins = element.timeUnit === 'hr' ? element.duration * 60 : element.duration;
        return `${formatTime(element.startTime)} \u00b7 ${mins} m`;
    });

    const projectLabel = $derived.by(() => {
        if (element.sourceRef) {
            const match = element.sourceRef.match(/\[\[([^\]#]+)(?:#[^\]]+)?\]\]/);
            return match?.[1];
        }
        if (element.text.startsWith('\u21bb ')) {
            const match = element.text.match(/\[\[([^\]]+)\]\]\s*$/);
            return match?.[1];
        }
        return undefined;
    });

    const isChecked = $derived(element.taskStatus === 'x');
</script>

<div
    class="timeline-item"
    style={`
        top: ${top}px;
        height: ${height}px;
        border-color: ${track.color};
        background-color: ${track.color}80;
    `}
>
    <div class="timeline-item-header">
        <span class="timeline-item-title" class:checked={isChecked}>{element.text.replace(/\s*\[\[[^\]]+\]\]\s*$/, '')}</span>
        {#if element.isTask}
            <input
                type="checkbox"
                checked={isChecked}
                onchange={() => onToggle?.()}
                class="timeline-item-checkbox"
            />
        {/if}
    </div>
    {#if timeLabel}
        <span class="timeline-item-time">{timeLabel}</span>
    {/if}
    <span class="timeline-item-meta">
        <span class="timeline-item-meta-dot" style={`background-color: ${track.color};`}></span>
        {track.label}
        {#if projectLabel}
            <button class="project-label" title={projectLabel} onclick={handleProjectClick}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-symlink-icon lucide-folder-symlink"><path d="M2 9.35V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path d="m8 16 3-3-3-3"/></svg>
                {projectLabel}
            </button>
        {/if}
    </span>
</div>

<style>
    .timeline-item {
        position: absolute;
        left: 4px;
        right: 4px;
        border-left: 3px solid;
        border-radius: 4px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
        cursor: default;
        transition: filter 0.15s;
        box-sizing: border-box;
    }

    .timeline-item:hover {
        filter: brightness(1.15);
    }

    .timeline-item-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 4px;
    }

    .timeline-item-title {
        font-size: 12px;
        font-weight: 600;
        color: #e6e6e6;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
    }

    .timeline-item-title.checked {
        text-decoration: line-through;
        opacity: 0.5;
    }

    .timeline-item-checkbox {
        flex-shrink: 0;
        margin: 0;
        cursor: pointer;
        width: 13px;
        height: 13px;
    }

    .timeline-item-time {
        font-size: 10px;
        color: #cccccc;
        opacity: 0.8;
    }

    .timeline-item-meta {
        font-size: 10px;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0.8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .timeline-item-meta-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .project-label {
		font-size: 0.8em;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		cursor: pointer;
		transition: color 150ms ease, text-decoration 150ms ease, filter 150ms ease;
	}

	.project-label:hover {
		color: var(--text-normal);
		text-decoration: underline;
		filter: brightness(1.2);
	}

	.project-label svg {
		flex-shrink: 0;
	}
</style>
