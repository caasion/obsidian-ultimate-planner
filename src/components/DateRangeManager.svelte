<script lang="ts">
  import { onMount } from "svelte";
  import { isValid, parseISO } from "date-fns";
  import Datepicker from "src/components/Datepicker.svelte";
  import { getISODate } from "src/plugin/helpers";
  import type { DateInterval } from "src/plugin/types";

  interface DateRangeManagerProps {
    dateIntervals?: DateInterval[];
    title?: string;
    onChange?: (next: DateInterval[]) => void;
  }

  let {
    dateIntervals = $bindable([] as DateInterval[]),
    title = "Effective Date Ranges",
    onChange
  }: DateRangeManagerProps = $props();

  let isOpen = $state(false);
  let containerEl: HTMLDivElement | undefined;

  const orderedRanges = $derived(
    [...dateIntervals]
      .map((interval, index) => ({ interval, index }))
      .sort((a, b) => b.interval.start.localeCompare(a.interval.start))
  );

  function toDate(iso?: string): Date | undefined {
    if (!iso) return undefined;
    const parsed = parseISO(iso);
    return isValid(parsed) ? parsed : undefined;
  }

  function formatLabel(interval: DateInterval): string {
    return `${interval.start} -> ${interval.end ?? "Present"}`;
  }

  function updateDateIntervals(next: DateInterval[]) {
    dateIntervals = next;
    onChange?.(next);
  }

  function openPopup() {
    isOpen = true;
  }

  function closePopup() {
    isOpen = false;
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!isOpen || !containerEl) return;
    if (!containerEl.contains(event.target as Node)) {
      closePopup();
    }
  }

  onMount(() => {
    const doc = containerEl?.ownerDocument ?? document;
    doc.addEventListener("click", handleDocumentClick);
    return () => {
      doc.removeEventListener("click", handleDocumentClick);
    };
  });

  function addRange() {
    const today = getISODate(new Date());
    const next = [{ start: today }, ...dateIntervals];
    updateDateIntervals(next);
  }

  function handleRangeSelect(index: number, selection: unknown) {
    const range = selection as { from?: Date; to?: Date } | undefined;
    const from = range?.from;
    if (!from) return;

    const next = dateIntervals.map((item, i) => {
      if (i !== index) return item;

      const updated: DateInterval = { start: getISODate(from) };
      if (range.to) {
        updated.end = getISODate(range.to);
      }
      return updated;
    });

    updateDateIntervals(next);
  }

  function handleSelectForIndex(index: number) {
    return (selection: unknown) => handleRangeSelect(index, selection);
  }

  function deleteRange(index: number) {
    const next = dateIntervals.filter((_, i) => i !== index);
    updateDateIntervals(next);
  }
</script> 

<div class="range-manager" bind:this={containerEl}>
  <button class="trigger" type="button" onclick={openPopup}>
    {#if orderedRanges.length === 0}
      <div class="empty">No date ranges yet.</div>
    {:else}
      <div class="range-row">{formatLabel(orderedRanges[0].interval)}</div>
    {/if}
  </button>

  {#if isOpen}
    <div class="popup" role="dialog" aria-label="Date range manager">
      <div class="header">
        <h3>{title}</h3>
        <div class="header-actions">
          <button class="add-btn" type="button" onclick={addRange}>+ Add Range</button>
          <button class="close-btn" type="button" onclick={closePopup}>Close</button>
        </div>
      </div>

      <div class="list">
        {#if orderedRanges.length === 0}
          <div class="empty">No date ranges yet.</div>
        {:else}
          {#each orderedRanges as item (item.index)}
            <div class="range-row">
              <div class="range-input">
                <Datepicker
                  range
                  rangeFrom={toDate(item.interval.start)}
                  rangeTo={toDate(item.interval.end)}
                  placeholder="Start - Present"
                  openEndedLabel="Present"
                  onselect={handleSelectForIndex(item.index)}
                />
              </div>
              <button class="delete" type="button" onclick={() => deleteRange(item.index)} aria-label="Delete date range">x</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .range-manager {
    position: relative;
  }

  .trigger {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-normal);
    padding: 6px 10px;
    cursor: pointer;
  }

  .popup {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 360px;
    height: 420px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    box-shadow: var(--shadow-l);
    padding: 10px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .header h3 {
    margin: 0;
    font-size: 14px;
  }

  .header-actions {
    display: flex;
    gap: 6px;
  }

  .add-btn,
  .close-btn,
  .delete {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
  }

  .add-btn,
  .close-btn {
    font-size: 12px;
    padding: 4px 8px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    min-height: 0;
  }

  .range-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .range-input {
    flex: 1;
  }

  .delete {
    width: 26px;
    height: 26px;
    line-height: 1;
  }

  .empty {
    font-size: 12px;
    color: var(--text-muted);
    padding: 8px;
  }
</style>