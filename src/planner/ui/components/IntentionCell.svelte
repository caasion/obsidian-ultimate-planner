<script lang="ts">
    import type { ISODate } from "src/plugin/types";

    interface Props {
        date: ISODate;
        value: string;
        onSave: (date: ISODate, intention: string) => void;
    }

    let { date, value, onSave }: Props = $props();

    let editing = $state(false);
    let draft = $state(value);

    // Sync draft when value changes externally
    $effect(() => {
        if (!editing) draft = value;
    });

    function startEditing() {
        draft = value;
        editing = true;
    }

    function commit() {
        editing = false;
        if (draft.trim() !== value) {
            onSave(date, draft.trim());
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            commit();
        } else if (e.key === "Escape") {
            draft = value;
            editing = false;
        }
    }
</script>

<div class="intention-cell">
    {#if editing}
        <!-- svelte-ignore a11y_autofocus -->
        <input
            class="intention-input"
            type="text"
            bind:value={draft}
            onblur={commit}
            onkeydown={handleKeydown}
            placeholder="Set intention..."
            autofocus
        />
    {:else}
        <button
            class="intention-display"
            class:has-value={!!value}
            onclick={startEditing}
            title="Click to set intention of the day"
        >
            {#if value}
                <span class="intention-icon">◎</span>
                <span class="intention-text">{value}</span>
            {:else}
                <span class="intention-placeholder">+ intention</span>
            {/if}
        </button>
    {/if}
</div>

<style>
    .intention-cell {
        padding: 0 6px 6px;
        display: flex;
        align-items: center;
        min-height: 26px;
    }

    .intention-display {
        width: 100%;
        background: none;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 4px;
        min-height: 22px;
        text-align: left;
        transition: background 150ms ease;
        box-shadow: none;
    }

    .intention-display:hover {
        background: rgba(255, 255, 255, 0.06);
    }

    .intention-icon {
        font-size: 10px;
        color: var(--interactive-accent, #7c5cbf);
        flex-shrink: 0;
    }

    .intention-text {
        font-size: 11px;
        color: var(--text-muted, #999);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
    }

    .intention-placeholder {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.2);
        font-style: italic;
    }

    .intention-input {
        width: 100%;
        font-size: 11px;
        padding: 2px 4px;
        border: 1px solid var(--interactive-accent, #7c5cbf);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-normal, #ccc);
        outline: none;
        line-height: 1.3;
    }
</style>
