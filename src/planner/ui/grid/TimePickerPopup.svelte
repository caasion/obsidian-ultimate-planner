<script lang="ts">
    import type { Time } from 'src/plugin/types';
    import Portal from 'src/components/Portal.svelte';
    import { onMount } from 'svelte';

    interface Props {
        value?: Time;
        anchorEl: HTMLElement | undefined;
        onSave: (time: Time | undefined) => void;
        onClose: () => void;
    }

    let { value, anchorEl, onSave, onClose }: Props = $props();

    let hours = $state<number>(value?.hours ?? 9);
    let minutes = $state<number>(value?.minutes ?? 0);

    let popupEl: HTMLDivElement | undefined = $state();
    let popupStyle = $state('');

    function clampHours(h: number): number {
        if (isNaN(h)) return 0;
        return Math.max(0, Math.min(23, Math.floor(h)));
    }

    function clampMinutes(m: number): number {
        if (isNaN(m)) return 0;
        return Math.max(0, Math.min(59, Math.floor(m)));
    }

    function stepMinutes(delta: number) {
        let total = hours * 60 + minutes + delta;
        total = ((total % 1440) + 1440) % 1440;
        hours = Math.floor(total / 60);
        minutes = total % 60;
    }

    function save() {
        onSave({ hours: clampHours(hours), minutes: clampMinutes(minutes) });
        onClose();
    }

    function clear() {
        onSave(undefined);
        onClose();
    }

    function computePosition() {
        const rect = anchorEl?.getBoundingClientRect();
        if (!rect) return;
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow >= 180) {
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
        <div class="popup-title">Start time</div>
        <div class="time-row">
            <div class="time-field">
                <button class="stepper" onclick={() => stepMinutes(60)} title="Hour up">▲</button>
                <input
                    type="number"
                    min="0"
                    max="23"
                    bind:value={hours}
                    onblur={() => hours = clampHours(hours)}
                    aria-label="Hours"
                />
                <button class="stepper" onclick={() => stepMinutes(-60)} title="Hour down">▼</button>
            </div>
            <span class="colon">:</span>
            <div class="time-field">
                <button class="stepper" onclick={() => stepMinutes(5)} title="Minute up">▲</button>
                <input
                    type="number"
                    min="0"
                    max="59"
                    bind:value={minutes}
                    onblur={() => minutes = clampMinutes(minutes)}
                    aria-label="Minutes"
                />
                <button class="stepper" onclick={() => stepMinutes(-5)} title="Minute down">▼</button>
            </div>
        </div>
        <div class="actions">
            {#if value}
                <button class="btn btn-clear" onclick={clear}>Remove</button>
            {/if}
            <button class="btn" onclick={onClose}>Cancel</button>
            <button class="btn btn-cta" onclick={save}>Save</button>
        </div>
    </div>
</Portal>

<style>
    .popup {
        min-width: 200px;
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

    .time-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }

    .time-field {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }

    .time-field input {
        width: 48px;
        text-align: center;
        font-size: 1.2em;
        padding: 4px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        -moz-appearance: textfield;
    }

    .time-field input::-webkit-outer-spin-button,
    .time-field input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .stepper {
        background: transparent;
        border: none;
        box-shadow: none;
        cursor: pointer;
        color: var(--text-muted);
        font-size: 0.7em;
        padding: 0;
        line-height: 1;
        height: 14px;
    }

    .stepper:hover {
        color: var(--text-normal);
    }

    .colon {
        font-size: 1.2em;
        color: var(--text-muted);
        margin-top: -2px;
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
