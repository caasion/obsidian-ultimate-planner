<script lang="ts">
    import Portal from 'src/components/Portal.svelte';
    import { onMount } from 'svelte';

    interface Props {
        duration?: number;
        timeUnit?: 'min' | 'hr';
        anchorEl: HTMLElement | undefined;
        onSave: (duration: number | undefined, timeUnit: 'min' | 'hr' | undefined) => void;
        onClose: () => void;
    }

    let { duration, timeUnit, anchorEl, onSave, onClose }: Props = $props();

    let amount = $state<number>(duration ?? 30);
    let unit = $state<'min' | 'hr'>(timeUnit ?? 'min');

    let popupEl: HTMLDivElement | undefined = $state();
    let popupStyle = $state('');

    const MIN_PRESETS = [15, 30, 45, 60];
    const HR_PRESETS = [1, 2, 4, 8];

    function applyPreset(value: number) {
        amount = value;
    }

    function normalizeAmount(v: number): number {
        if (isNaN(v) || v < 0) return 0;
        return unit === 'hr' ? v : Math.floor(v);
    }

    function save() {
        const normalized = normalizeAmount(amount);
        if (normalized <= 0) {
            onSave(undefined, undefined);
        } else {
            onSave(normalized, unit);
        }
        onClose();
    }

    function clear() {
        onSave(undefined, undefined);
        onClose();
    }

    function computePosition() {
        const rect = anchorEl?.getBoundingClientRect();
        if (!rect) return;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow >= 200) {
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
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    }

    let presets = $derived(unit === 'hr' ? HR_PRESETS : MIN_PRESETS);

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
        <div class="popup-title">Duration</div>

        <div class="input-row">
            <input
                type="number"
                min="0"
                step={unit === 'hr' ? '0.25' : '1'}
                bind:value={amount}
                aria-label="Duration amount"
            />
            <div class="unit-toggle">
                <button class="unit-btn" class:active={unit === 'min'} onclick={() => unit = 'min'}>min</button>
                <button class="unit-btn" class:active={unit === 'hr'} onclick={() => unit = 'hr'}>hr</button>
            </div>
        </div>

        <div class="presets">
            {#each presets as p}
                <button class="preset-btn" class:active={amount === p} onclick={() => applyPreset(p)}>
                    {p}{unit === 'hr' ? 'h' : 'm'}
                </button>
            {/each}
        </div>

        <div class="actions">
            {#if duration}
                <button class="btn btn-clear" onclick={clear}>Remove</button>
            {/if}
            <button class="btn" onclick={onClose}>Cancel</button>
            <button class="btn btn-cta" onclick={save}>Save</button>
        </div>
    </div>
</Portal>

<style>
    .popup {
        min-width: 220px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        box-shadow: var(--shadow-r);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .popup-title {
        font-size: 0.75em;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
    }

    .input-row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .input-row input {
        flex: 1;
        text-align: center;
        font-size: 1.1em;
        padding: 4px 6px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
    }

    .unit-toggle {
        display: flex;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        overflow: hidden;
    }

    .unit-btn {
        background: var(--background-primary-alt);
        color: var(--text-muted);
        border: none;
        border-right: 1px solid var(--background-modifier-border);
        padding: 4px 10px;
        font-size: 0.82em;
        cursor: pointer;
        box-shadow: none;
    }

    .unit-btn:last-child {
        border-right: none;
    }

    .unit-btn.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
    }

    .presets {
        display: flex;
        gap: 6px;
    }

    .preset-btn {
        flex: 1;
        background: var(--background-primary-alt);
        color: var(--text-muted);
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        padding: 4px 0;
        font-size: 0.8em;
        cursor: pointer;
        box-shadow: none;
    }

    .preset-btn:hover {
        background: var(--background-modifier-hover);
        color: var(--text-normal);
    }

    .preset-btn.active {
        border-color: var(--interactive-accent);
        color: var(--text-normal);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
    }

    .btn {
        font-size: 0.82em;
        padding: 3px 10px;
        border-radius: 4px;
        cursor: pointer;
    }

    .btn-cta {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border: none;
    }

    .btn-clear {
        margin-right: auto;
        color: var(--text-error);
        background: transparent;
        border: none;
        box-shadow: none;
    }
</style>
