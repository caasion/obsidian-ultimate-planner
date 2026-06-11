<script lang="ts">
  import { onMount } from "svelte";
  import type { ISODate, Phase } from "src/plugin/types";
  import Portal from "src/components/Portal.svelte";
  import DataTaskElement from "src/components/DataTaskElement.svelte";
  import { getISODate } from "src/plugin/helpers";
  import {
    dateToX,
    PHASE_BAR_HEIGHT,
    ROW_HEIGHT,
    TRACK_HEADER_HEIGHT,
  } from "../../logic/ganttUtils";

  interface Props {
    phase: Phase;
    projectLabel: string;
    row: number;
    viewportStart: ISODate;
    pxPerDay: number;
    color: string;
  }

  let {
    phase,
    projectLabel,
    row,
    viewportStart,
    pxPerDay,
    color,
  }: Props = $props();

  let expanded = $state(false);
  let barEl: HTMLDivElement | undefined;
  let popupEl = $state<HTMLDivElement | undefined>();
  let popupStyle = $state("");

  const today = $derived(getISODate(new Date()));
  const left = $derived(dateToX(phase.startDate ?? today, viewportStart, pxPerDay));
  const right = $derived(
    dateToX(phase.endDate ?? today, viewportStart, pxPerDay) + pxPerDay
  );
  const width = $derived(Math.max(right - left, 40));
  const top = $derived(
    TRACK_HEADER_HEIGHT + row * ROW_HEIGHT + (ROW_HEIGHT - PHASE_BAR_HEIGHT) / 2
  );
  const labelPaddingLeft = $derived(Math.max(8, 8 - left));
  const isOpenEnded = $derived(!phase.endDate);

  function toggleExpand(e: MouseEvent) {
    e.stopPropagation();
    expanded = !expanded;
    if (expanded) updatePopupPosition();
  }

  function updatePopupPosition() {
    const rect = barEl?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupHeight = 300;
    if (spaceBelow >= popupHeight) {
      popupStyle = `position: fixed; top: ${rect.bottom + 4}px; left: ${Math.max(380, rect.left)}px; z-index: var(--layer-popover, 100);`;
    } else {
      popupStyle = `position: fixed; bottom: ${window.innerHeight - rect.top + 4}px; left: ${Math.max(380, rect.left)}px; z-index: var(--layer-popover, 100);`;
    }
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!expanded) return;
    const target = e.target as Node;
    if (barEl?.contains(target) || popupEl?.contains(target)) return;
    expanded = false;
  }

  onMount(() => {
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  });
</script>

<div
  class="phase-bar"
  class:expanded
  class:open-ended={isOpenEnded}
  style={`left: ${left}px; width: ${width}px; top: ${top}px; height: ${PHASE_BAR_HEIGHT}px; padding-left: ${labelPaddingLeft}px; --phase-color: ${color};`}
  bind:this={barEl}
  onclick={toggleExpand}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      expanded = !expanded;
      if (expanded) updatePopupPosition();
    }
  }}
>
  <span class="project-label">{projectLabel}</span>
  <span class="label">{phase.label}</span>
</div>

{#if expanded}
  <Portal>
    <div class="popup" style={popupStyle} bind:this={popupEl}>
      <div class="popup-header">
        <h4 class="popup-title">{phase.label}</h4>
        <span class="popup-project">{projectLabel}</span>
      </div>
      {#if phase.startDate || phase.endDate}
        <div class="popup-dates">{phase.startDate ?? '?'} → {phase.endDate ?? 'Present'}</div>
      {/if}
      {#if phase.data.length > 0}
        <div class="popup-tasks">
          {#each phase.data as element, index}
            <DataTaskElement
              {element}
              {index}
              {color}
              onUpdate={() => {}}
              onToggle={() => {}}
              onCancel={() => {}}
              onDelete={() => {}}
            />
          {/each}
        </div>
      {:else}
        <div class="popup-empty">No tasks in this phase</div>
      {/if}
    </div>
  </Portal>
{/if}

<style>
  .phase-bar {
    position: absolute;
    background: var(--background-primary);
    border: 1px solid var(--text-faint);
    border-left: 3px solid var(--phase-color);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px 0 0;
    transition: border-color 0.15s;
    user-select: none;
    z-index: 1;
    overflow: visible;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .phase-bar:hover {
    border-color: color-mix(in srgb, var(--phase-color) 60%, transparent);
  }

  .phase-bar:hover.open-ended::before {
    border-left-color: color-mix(in srgb, var(--phase-color) 60%, transparent);
  }

  .phase-bar.expanded {
    border-color: color-mix(in srgb, var(--phase-color) 70%, transparent);
  }

  .phase-bar.expanded.open-ended::before {
    border-left-color: color-mix(in srgb, var(--phase-color) 70%, transparent);
  }

  .label {
    position: relative;
    z-index: 2;
    font-size: 0.65em;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: visible;
    pointer-events: none;
  }

  .project-label {
    position: relative;
    z-index: 2;
    font-size: 0.78em;
    font-weight: 600;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: visible;
    pointer-events: none;
  }

  .phase-bar.open-ended {
    border-right: none;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .phase-bar.open-ended::before {
    content: '';
    position: absolute;
    z-index: 1;
    right: -9px;
    top: -1px;
    width: 0;
    height: 0;
    border-style: solid;
    border-top: 13px solid transparent;
    border-bottom: 13px solid transparent;
    border-left: 9px solid var(--text-faint);
    border-right: none;
    transition: border-left-color 0.15s;
  }

  .phase-bar.open-ended::after {
    content: '';
    position: absolute;
    z-index: 2;
    right: -8px;
    top: 0;
    width: 0;
    height: 0;
    border-style: solid;
    border-top: 12px solid transparent;
    border-bottom: 12px solid transparent;
    border-left: 8px solid var(--background-primary);
    border-right: none;
  }

  .popup {
    width: 340px;
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    box-shadow: var(--shadow-r);
    padding: 12px;
  }

  .popup-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
  }

  .popup-title {
    margin: 0;
    font-size: 0.95em;
  }

  .popup-project {
    font-size: 0.8em;
    color: var(--text-muted);
  }

  .popup-dates {
    font-size: 0.8em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .popup-tasks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .popup-empty {
    font-size: 0.85em;
    color: var(--text-muted);
    font-style: italic;
    padding: 8px 0;
  }
</style>
