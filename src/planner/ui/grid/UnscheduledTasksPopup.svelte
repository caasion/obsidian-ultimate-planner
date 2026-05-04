<script lang="ts">
    import type { Element, Project } from 'src/plugin/types';
    import Portal from 'src/components/Portal.svelte';
    import { onMount } from 'svelte';

    interface UnscheduledGroup {
        project: Project;
        elements: { element: Element; index: number }[];
    }

    interface Props {
        groups: UnscheduledGroup[];
        color: string;
        anchorEl: HTMLElement | undefined;
        onSelect: (element: Element, project: Project) => void;
        onClose: () => void;
    }

    let { groups, color, anchorEl, onSelect, onClose }: Props = $props();

    let popupEl: HTMLDivElement | undefined = $state();
    let popupStyle = $state('');

    function computePosition() {
        const rect = anchorEl?.getBoundingClientRect();
        if (!rect) return;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow >= 300) {
            popupStyle = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
        } else {
            popupStyle = `position: fixed; bottom: ${window.innerHeight - rect.top + 4}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
        }
    }

    function handleDocumentClick(e: MouseEvent) {
        const target = e.target as Node;
        if (anchorEl?.contains(target) || popupEl?.contains(target)) return;
        onClose();
    }

    onMount(() => {
        computePosition();
        document.addEventListener('click', handleDocumentClick);
        return () => document.removeEventListener('click', handleDocumentClick);
    });
</script>

<Portal>
    <div class="popup" style={popupStyle} bind:this={popupEl}>
        {#if groups.length === 0}
            <div class="empty">No unscheduled tasks</div>
        {:else}
            {#each groups as { project, elements }}
                <div class="group">
                    <div class="group-label" style={`color: ${color}; border-left-color: ${color};`}>{project.label}</div>
                    {#each elements as { element }}
                        <button
                            class="task-row"
                            onclick={() => { onSelect(element, project); onClose(); }}
                        >
                            <span class="task-checkbox-indicator"></span>
                            <span class="task-text">{element.text}</span>
                        </button>
                    {/each}
                </div>
            {/each}
        {/if}
    </div>
</Portal>

<style>
    .popup {
        min-width: 240px;
        max-width: 320px;
        max-height: 60vh;
        overflow-y: auto;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        box-shadow: var(--shadow-r);
        padding: 6px 0;
    }

    .empty {
        padding: 12px 16px;
        color: var(--text-faint);
        font-style: italic;
        font-size: 0.9em;
    }

    .group {
        padding-bottom: 4px;
    }

    .group:not(:first-child) {
        margin-top: 4px;
        border-top: 1px solid var(--background-modifier-border);
        padding-top: 4px;
    }

    .group-label {
        padding: 2px 12px 4px 10px;
        font-size: 0.75em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.85;
        border-left: 2px solid;
        margin-left: 8px;
        margin-bottom: 2px;
    }

    .task-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        width: 100%;
        text-align: left;
        padding: 5px 12px 5px 16px;
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: 0.88em;
        color: var(--text-normal);
        border-radius: 0;
    }

    .task-row:hover {
        background: var(--background-modifier-hover);
    }

    .task-checkbox-indicator {
        flex-shrink: 0;
        width: 12px;
        height: 12px;
        border: 1.5px solid var(--text-muted);
        border-radius: 2px;
        opacity: 0.6;
    }

    .task-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
