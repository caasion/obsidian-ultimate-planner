<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ISODate } from "src/plugin/types";

  interface Props {
    onPrev: () => void;
    onNext: () => void;
    onToday?: () => void;
    showToday?: boolean;
    label: string;
    anchor: ISODate;
    onDateChange: (date: ISODate) => void;
    right?: Snippet;
  }

  let {
    onPrev,
    onNext,
    onToday,
    showToday = false,
    label,
    anchor,
    onDateChange,
    right,
  }: Props = $props();

  let pickerValue = $state<ISODate>(anchor);

  $effect(() => {
    pickerValue = anchor;
  });

  $effect(() => {
    if (pickerValue !== anchor) onDateChange(pickerValue);
  });
</script>

<div class="topbar">
  <div class="topbar-left">
    <button class="nav-btn" onclick={onPrev}>‹</button>
    <button class="nav-btn" onclick={onNext}>›</button>
    {#if showToday && onToday}
      <button class="today-btn" onclick={onToday}>Today</button>
    {/if}
  </div>

  <div class="topbar-center">
    <div class="date-picker-wrap">
      <span class="date-label">{label}</span>
      <input type="date" bind:value={pickerValue} />
    </div>
  </div>

  <div class="topbar-right">
    {#if right}
      {@render right()}
    {/if}
  </div>
</div>

<style>
  .topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px solid var(--background-modifier-border);
    margin-bottom: 8px;
    gap: 8px;
  }

  .topbar-left {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .topbar-center {
    display: flex;
    justify-content: center;
  }

  .date-picker-wrap {
    position: relative;
    display: inline-flex;
    justify-content: center;
  }

  .date-label {
    font-weight: 600;
    font-size: 15px;
    padding: 4px 8px;
    white-space: nowrap;
    pointer-events: none;
    color: var(--text-normal);
  }

  .date-picker-wrap input[type="date"] {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 100%;
    z-index: 1;
    opacity: 0;
    cursor: pointer;
  }

  .date-picker-wrap input[type="date"]::-webkit-calendar-picker-indicator {
    width: 100%;
    cursor: pointer;
  }

  .date-picker-wrap input[type="date"]::-webkit-datetime-edit {
    display: none;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
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
    height: 28px;
    width: 28px;
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
</style>
