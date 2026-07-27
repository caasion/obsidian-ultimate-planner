<script lang="ts">
    import type { Project } from 'src/plugin/types';
    import Portal from 'src/components/Portal.svelte';
    import { onMount } from 'svelte';

    interface Props {
        projects: Project[];
        color: string;
        currentLabel?: string;
        anchorEl: HTMLElement | undefined;
        onSelect: (project: Project | undefined) => void;
        onClose: () => void;
    }

    let { projects, color, currentLabel, anchorEl, onSelect, onClose }: Props = $props();

    let query = $state('');
    let popupEl: HTMLDivElement | undefined = $state();
    let popupStyle = $state('');

    let filtered = $derived(
        query.trim()
            ? projects.filter(p => p.label.toLowerCase().includes(query.trim().toLowerCase()))
            : projects
    );

    function computePosition() {
        const rect = anchorEl?.getBoundingClientRect();
        if (!rect) return;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow >= 260) {
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

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }

    onMount(() => {
        computePosition();
        // Defer so the click that opened this popup doesn't immediately close it.
        const timer = window.setTimeout(() => document.addEventListener('click', handleDocumentClick), 0);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('click', handleDocumentClick);
        };
    });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<Portal>
    <div class="popup" style={popupStyle} bind:this={popupEl} onkeydown={handleKeydown}>
        <div class="popup-title">Link project</div>
        <input
            class="search"
            type="text"
            placeholder="Search projects…"
            bind:value={query}
        />
        <div class="list">
            {#if projects.length === 0}
                <div class="empty">No projects in this track</div>
            {:else if filtered.length === 0}
                <div class="empty">No matches</div>
            {:else}
                {#each filtered as project}
                    <button
                        class="project-row"
                        class:selected={currentLabel === project.label}
                        onclick={() => { onSelect(project); onClose(); }}
                    >
                        <span class="dot" style={`background: ${color};`}></span>
                        <span class="project-label">{project.label}</span>
                        {#if currentLabel === project.label}
                            <span class="check">✓</span>
                        {/if}
                    </button>
                {/each}
            {/if}
        </div>
        {#if currentLabel}
            <button class="btn btn-clear" onclick={() => { onSelect(undefined); onClose(); }}>Remove association</button>
        {/if}
    </div>
</Portal>

<style>
    .popup {
        min-width: 240px;
        max-width: 320px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        box-shadow: var(--shadow-r);
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .popup-title {
        font-size: 0.75em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
    }

    .search {
        padding: 5px 8px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.88em;
    }

    .list {
        max-height: 40vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .empty {
        padding: 10px 8px;
        color: var(--text-faint);
        font-style: italic;
        font-size: 0.88em;
    }

    .project-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        text-align: left;
        padding: 6px 8px;
        background: transparent;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.88em;
        color: var(--text-normal);
        box-shadow: none;
    }

    .project-row:hover {
        background: var(--background-modifier-hover);
    }

    .project-row.selected {
        background: var(--background-modifier-hover);
    }

    .dot {
        flex-shrink: 0;
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    .project-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .check {
        color: var(--interactive-accent);
        flex-shrink: 0;
    }

    .btn-clear {
        color: var(--text-error);
        background: transparent;
        border: none;
        box-shadow: none;
        font-size: 0.82em;
        padding: 4px;
        cursor: pointer;
        text-align: left;
    }
</style>
