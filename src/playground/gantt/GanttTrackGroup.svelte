<script lang="ts">
  import { isValid, parseISO } from "date-fns";
  import { onMount, tick } from "svelte";
  import type { DateInterval, ISODate, Track } from "src/plugin/types";
  import type { ProjectCardFunctions } from "src/tracks/ui/ProjectCard.svelte";
  import type { HabitFunctions } from "src/tracks/ui/HabitElement.svelte";
  import Datepicker from "src/components/Datepicker.svelte";
  import Portal from "src/components/Portal.svelte";
  import { getISODate } from "src/plugin/helpers";
  import {
    calcTrackHeight,
    dateToX,
    getViewportWidth,
    packProjectsIntoRows,
    type Zoom,
  } from "./ganttUtils";
  import GanttProjectBar from "./GanttProjectBar.svelte";

  interface Props {
    track: Track;
    viewportStart: ISODate;
    viewportEnd: ISODate;
    pxPerDay: number;
    zoom: Zoom;
    onEffectiveChange: (next: DateInterval[]) => void;
    createProjectFunctions: (projectId: string) => ProjectCardFunctions;
    createHabitFunctions: (projectId: string) => (habitId: string) => HabitFunctions;
  }

  let {
    track,
    viewportStart,
    viewportEnd,
    pxPerDay,
    zoom,
    onEffectiveChange,
    createProjectFunctions,
    createHabitFunctions,
  }: Props = $props();

  const today = $derived(getISODate(new Date()));
  const packed = $derived(
    packProjectsIntoRows(track.projects, viewportStart, viewportEnd)
  );
  const numRows = $derived(
    packed.length === 0 ? 0 : Math.max(...packed.map((p) => p.row)) + 1
  );
  const trackHeight = $derived(calcTrackHeight(numRows));
  const totalWidth = $derived(
    getViewportWidth(viewportStart, viewportEnd, pxPerDay)
  );

  // Badge popover state
  let badgeOpen = $state(false);
  let badgeAnchorEl: HTMLButtonElement | undefined;
  let badgePopupEl: HTMLDivElement | undefined;
  let badgePopupStyle = $state("");

  function toDate(iso?: string): Date | undefined {
    if (!iso) return undefined;
    const parsed = parseISO(iso);
    return isValid(parsed) ? parsed : undefined;
  }

  async function openBadge(el: HTMLButtonElement) {
    badgeAnchorEl = el;
    badgeOpen = true;
    await tick();
    const rect = badgeAnchorEl?.getBoundingClientRect();
    if (!rect) return;
    badgePopupStyle = `position: fixed; top: ${rect.bottom + 6}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
  }

  function closeBadge() {
    badgeOpen = false;
  }

  function handleBadgeDocumentClick(e: MouseEvent) {
    if (!badgeOpen) return;
    const target = e.target as Node;
    if ((target as Element).closest?.(".track-badge")) return;
    if (badgePopupEl?.contains(target)) return;
    if ((target as Element).closest?.(".holos-datepicker-panel")) return;
    closeBadge();
  }

  onMount(() => {
    document.addEventListener("click", handleBadgeDocumentClick);
    return () => document.removeEventListener("click", handleBadgeDocumentClick);
  });

  function addRange() {
    const next: DateInterval[] = [{ start: today }, ...track.effective];
    onEffectiveChange(next);
  }

  function deleteRange(index: number) {
    const next = track.effective.filter((_, i) => i !== index);
    onEffectiveChange(next);
  }

  function handleRangeEdit(index: number, selection: unknown) {
    const range = selection as { from?: Date; to?: Date } | undefined;
    if (!range?.from) return;
    const next = track.effective.map((item, i) => {
      if (i !== index) return item;
      const updated: DateInterval = { start: getISODate(range.from!) };
      if (range.to) updated.end = getISODate(range.to);
      return updated;
    });
    onEffectiveChange(next);
  }
</script>

<div class="track-group" style={`height: ${trackHeight}px; width: ${totalWidth}px;`}>
  <!-- Effective interval backgrounds + labels -->
  {#each track.effective as interval}
    {@const iStart = interval.start}
    {@const iEnd = interval.end ?? today}
    {@const rawLeft = dateToX(iStart, viewportStart, pxPerDay)}
    {@const rawRight = dateToX(iEnd, viewportStart, pxPerDay) + pxPerDay}
    {@const clampedLeft = Math.max(0, rawLeft)}
    {@const clampedRight = Math.min(totalWidth, rawRight)}
    {@const bgWidth = clampedRight - clampedLeft}
    {#if bgWidth > 0}
      <div
        class="track-interval"
        style={`left: ${clampedLeft}px; width: ${bgWidth}px; height: ${trackHeight}px; background-color: ${track.color}28;`}
      ></div>
      <button
        class="track-badge"
        style={`left: ${clampedLeft + 8}px; background-color: ${track.color};`}
        onclick={(e) => { e.stopPropagation(); badgeOpen ? closeBadge() : openBadge(e.currentTarget as HTMLButtonElement); }}
      >
        {track.label}
      </button>
    {/if}
  {/each}

  <!-- Project bars -->
  {#each packed as { project, row }}
    <GanttProjectBar
      {project}
      {row}
      {viewportStart}
      {pxPerDay}
      color={track.color}
      projectFunctions={createProjectFunctions(project.id)}
      createHabitFunctions={createHabitFunctions(project.id)}
    />
  {/each}
</div>

<!-- Badge popup (effective date editor) -->
{#if badgeOpen}
  <Portal>
    <div class="badge-popup" style={badgePopupStyle} bind:this={badgePopupEl}>
      <div class="popup-header">
        <h3 class="popup-title">Effective Date Ranges</h3>
        <div class="popup-actions">
          <button class="popup-btn" onclick={addRange}>+ Add</button>
          <button class="popup-btn" onclick={closeBadge}>Close</button>
        </div>
      </div>
      <div class="popup-list">
        {#if track.effective.length === 0}
          <div class="empty">No ranges yet.</div>
        {:else}
          {#each track.effective as interval, i}
            <div class="range-row">
              <div class="range-input">
                <Datepicker
                  range
                  rangeFrom={toDate(interval.start)}
                  rangeTo={toDate(interval.end)}
                  openEndedLabel="Present"
                  onselect={(sel) => handleRangeEdit(i, sel)}
                />
              </div>
              <button
                class="delete-btn"
                onclick={() => deleteRange(i)}
                aria-label="Delete range"
              >×</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </Portal>
{/if}

<style>
  .track-group {
    position: relative;
    margin-bottom: 16px;
  }

  .track-interval {
    position: absolute;
    top: 0;
    border-radius: 12px;
    pointer-events: none;
  }

  .track-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.82em;
    font-weight: 600;
    color: white;
    white-space: nowrap;
    transition: opacity 0.15s;
  }

  .track-badge:hover {
    opacity: 0.85;
  }

  .badge-popup {
    width: 340px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    box-shadow: var(--shadow-r);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .popup-title {
    margin: 0;
    font-size: 13px;
  }

  .popup-actions {
    display: flex;
    gap: 6px;
  }

  .popup-btn {
    font-size: 12px;
    padding: 3px 8px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 5px;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
  }

  .popup-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 280px;
    overflow-y: auto;
  }

  .empty {
    font-size: 12px;
    color: var(--text-muted);
    padding: 8px;
  }

  .range-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .range-input {
    flex: 1;
  }

  .delete-btn {
    width: 24px;
    height: 24px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    flex-shrink: 0;
  }

  .delete-btn:hover {
    color: var(--text-error);
  }
</style>
