<script lang="ts">
  import { onMount } from "svelte";
  import type { ISODate, Project } from "src/plugin/types";
  import type { ProjectCardFunctions } from "src/tracks/ui/ProjectCard.svelte";
  import type { HabitFunctions } from "src/tracks/ui/HabitElement.svelte";
  import ProjectCard from "src/tracks/ui/ProjectCard.svelte";
  import Portal from "src/components/Portal.svelte";
  import { getISODate } from "src/plugin/helpers";
  import {
    dateToX,
    PROJECT_BAR_HEIGHT,
    ROW_HEIGHT,
    TRACK_HEADER_HEIGHT,
  } from "./ganttUtils";

  interface Props {
    project: Project;
    row: number;
    viewportStart: ISODate;
    pxPerDay: number;
    color: string;
    projectFunctions: ProjectCardFunctions;
    createHabitFunctions: (habitId: string) => HabitFunctions;
  }

  let {
    project,
    row,
    viewportStart,
    pxPerDay,
    color,
    projectFunctions,
    createHabitFunctions,
  }: Props = $props();

  let expanded = $state(false);
  let barEl: HTMLDivElement | undefined;
  let popupEl: HTMLDivElement | undefined;
  let popupStyle = $state("");

  const today = $derived(getISODate(new Date()));
  const left = $derived(dateToX(project.startDate, viewportStart, pxPerDay));
  const right = $derived(
    dateToX(project.endDate ?? today, viewportStart, pxPerDay) + pxPerDay
  );
  const width = $derived(Math.max(right - left, 40));
  const top = $derived(
    TRACK_HEADER_HEIGHT + row * ROW_HEIGHT + (ROW_HEIGHT - PROJECT_BAR_HEIGHT) / 2
  );
  // When the bar starts before the viewport (left < 0), shift the label right
  // so it stays within the visible portion of the bar.
  const labelPaddingLeft = $derived(Math.max(8, 8 - left));

  function toggleExpand(e: MouseEvent) {
    e.stopPropagation();
    expanded = !expanded;
    if (expanded) updatePopupPosition();
  }

  function updatePopupPosition() {
    const rect = barEl?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupHeight = 500;
    if (spaceBelow >= popupHeight) {
      popupStyle = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
    } else {
      popupStyle = `position: fixed; bottom: ${window.innerHeight - rect.top + 4}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
    }
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!expanded) return;
    const target = e.target as Node;
    if (barEl?.contains(target) || popupEl?.contains(target)) return;
    if ((target as Element).closest?.(".holos-datepicker-panel")) return;
    expanded = false;
  }

  onMount(() => {
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  });
</script>

<div
  class="project-bar"
  class:expanded
  style={`left: ${left}px; width: ${width}px; top: ${top}px; height: ${PROJECT_BAR_HEIGHT}px; padding-left: ${labelPaddingLeft}px;`}
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
  <span class="label">{project.label}</span>
</div>

{#if expanded}
  <Portal>
    <div class="popup" style={popupStyle} bind:this={popupEl}>
      <ProjectCard
        {project}
        {color}
        {projectFunctions}
        {createHabitFunctions}
      />
    </div>
  </Portal>
{/if}

<style>
  .project-bar {
    position: absolute;
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    padding: 0 8px 0 0;
    overflow: hidden;
    transition: border-color 0.15s;
    user-select: none;
    z-index: 1;
  }

  .project-bar:hover {
    border-color: var(--text-muted);
  }

  .project-bar.expanded {
    border-color: var(--text-normal);
  }

  .label {
    font-size: 0.78em;
    color: var(--text-normal);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }

  .popup {
    width: 380px;
    max-height: 70vh;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 10px;
    background: var(--background-primary);
    box-shadow: var(--shadow-r);
  }
</style>
