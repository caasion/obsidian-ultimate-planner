<script lang="ts">
  import type { ISODate } from "src/plugin/types";
  import { format, parseISO } from "date-fns";
  import { WINDOW_PRESETS } from "../../logic/ganttUtils";
  import Datepicker from "src/components/Datepicker.svelte";

  interface Props {
    viewportStart: ISODate;
    viewportEnd: ISODate;
    windowDays: number;
    todayVisible: boolean;
    onPan: (direction: 1 | -1) => void;
    onGoToToday: () => void;
    onSetWindowDays: (days: number) => void;
    onDateSelect: (date: Date) => void;
  }

  let {
    viewportStart,
    viewportEnd,
    windowDays,
    todayVisible,
    onPan,
    onGoToToday,
    onSetWindowDays,
    onDateSelect,
  }: Props = $props();

  const title = $derived(
    format(parseISO(viewportStart), "d MMM") +
      " – " +
      format(parseISO(viewportEnd), "d MMM yyyy")
  );

  let datepickerValue = $state<Date | undefined>(undefined);
  let datepickerRef: ReturnType<typeof Datepicker> | undefined;
  let datepickerAnchor: HTMLDivElement;

  function presetLabel(days: number): string {
    if (days === 365) return "1y";
    if (days >= 30 && days % 30 === 0) return `${days / 30}mo`;
    return `${days}d`;
  }
</script>

<div class="gantt-controls">
  <span class="date-label">{title}</span>

  {#if !todayVisible}
    <button class="today-btn" onclick={onGoToToday}>Today</button>
  {/if}
  <button class="nav-btn" onclick={() => onPan(-1)} aria-label="Previous">‹</button>
  <button class="nav-btn" onclick={() => onPan(1)} aria-label="Next">›</button>

  <div class="datepicker-wrap" bind:this={datepickerAnchor}>
    <Datepicker
      bind:this={datepickerRef}
      bind:value={datepickerValue}
      inline={false}
      autohide={true}
      showToggleButton={false}
      placeholder=""
      inputClass="datepicker-hidden-input"
      anchorElement={datepickerAnchor}
      onselect={(date: Date) => onDateSelect(date)}
    />
    <button class="icon-btn" onclick={(e) => { e.stopPropagation(); datepickerRef?.open(); }} aria-label="Jump to date">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2v4"/><path d="M21 11.75V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.25"/><path d="m22 22-1.875-1.875"/><path d="M3 10h18"/><path d="M8 2v4"/><circle cx="18" cy="18" r="3"/></svg>
    </button>
  </div>

  <div class="preset-group">
    {#each WINDOW_PRESETS as preset}
      <button
        class="preset-btn"
        class:active={windowDays === preset}
        onclick={() => onSetWindowDays(preset)}
      >
        {presetLabel(preset)}
      </button>
    {/each}
  </div>
</div>

<style>
  .gantt-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .date-label {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-normal);
    white-space: nowrap;
    margin: 0 4px;
  }

  .nav-btn {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary-alt);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 1.1em;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .nav-btn:hover {
    background: var(--background-modifier-hover);
  }

  .today-btn {
    font-size: 0.82em;
    padding: 0 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary-alt);
    color: var(--text-normal);
    cursor: pointer;
    white-space: nowrap;
    height: 28px;
    flex-shrink: 0;
  }

  .today-btn:hover {
    background: var(--background-modifier-hover);
  }

  .icon-btn {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary-alt);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    width: 28px;
    flex-shrink: 0;
  }

  .icon-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  /* === Datepicker === */
  .datepicker-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .datepicker-wrap :global(.datepicker-hidden-input) {
    position: absolute;
    width: 0;
    height: 0;
    padding: 0;
    border: none;
    opacity: 0;
    pointer-events: none;
  }

  /* === Preset Group === */
  .preset-group {
    display: flex;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
    margin-left: 4px;
  }

  .preset-btn {
    font-size: 0.82em;
    padding: 4px 8px;
    border: none;
    border-right: 1px solid var(--background-modifier-border);
    background: var(--background-primary-alt);
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
    height: 28px;
  }

  .preset-btn:last-child {
    border-right: none;
  }

  .preset-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .preset-btn.active {
    background: var(--interactive-accent);
    color: white;
  }
</style>
