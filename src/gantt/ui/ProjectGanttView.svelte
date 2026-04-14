<script lang="ts">
  import type { App } from "obsidian";
  import type { TrackNoteService } from "src/tracks/logic/trackNote";
  import type { ProjectCardFunctions } from "src/tracks/ui/ProjectCard.svelte";
  import type { HabitFunctions } from "src/tracks/ui/HabitElement.svelte";
  import type { Track } from "src/plugin/types";
  import { format, parseISO, addDays } from "date-fns";
  import { getISODate } from "src/plugin/helpers";
  import {
    getRollingViewport,
    getHeaderTicks,
    dateToX,
    WINDOW_PRESETS,
  } from "../logic/ganttUtils";
  import GanttHeader from "./GanttHeader.svelte";
  import GanttTrackGroup from "./GanttTrackGroup.svelte";

  interface Props {
    app: App;
    trackNoteService: TrackNoteService;
  }

  let { app, trackNoteService }: Props = $props();

  let parsedTracks = $state<Record<string, Track>>({});

  $effect(() => {
    return trackNoteService.parsedTracksContent.subscribe((v) => {
      parsedTracks = v;
    });
  });

  // Rolling window state
  let windowDays = $state<number>(30);
  let panDays = $state(0); // days offset from today; 0 = today centered

  // Container width is measured from the scroll inner probe div
  let containerWidth = $state(0);

  const today = $derived(getISODate(new Date()));

  // Center date shifts when panning
  const centerDate = $derived(
    panDays === 0 ? today : getISODate(addDays(parseISO(today), panDays))
  );

  const viewport = $derived(getRollingViewport(windowDays, centerDate));
  const viewportStart = $derived(viewport.start);
  const viewportEnd = $derived(viewport.end);

  // pxPerDay fills the container exactly
  const pxPerDay = $derived(containerWidth > 0 ? containerWidth / windowDays : 0);
  const totalWidth = $derived(containerWidth);

  const ticks = $derived(getHeaderTicks(viewportStart, viewportEnd, pxPerDay));

  // Today line position (null if today is outside the viewport)
  const todayX = $derived(
    today >= viewportStart && today <= viewportEnd
      ? dateToX(today, viewportStart, pxPerDay) + pxPerDay / 2
      : null
  );

  const title = $derived(
    format(parseISO(viewportStart), "d MMM") +
      " – " +
      format(parseISO(viewportEnd), "d MMM yyyy")
  );

  const sortedTracks = $derived(
    Object.values(parsedTracks).sort((a, b) => a.order - b.order)
  );

  function pan(direction: 1 | -1) {
    panDays += direction * Math.floor(windowDays / 2);
  }

  function goToToday() {
    panDays = 0;
  }

  function setWindowDays(days: number) {
    windowDays = days;
  }

  function createProjectFunctionsFactory(trackId: string) {
    return (projectId: string): ProjectCardFunctions => ({
      onLabelEdit: (label) =>
        trackNoteService.updateProjectLabel(trackId, projectId, label),
      onDescriptionEdit: (description) =>
        trackNoteService.updateProjectDescription(trackId, projectId, description),
      onOpenFile: () => trackNoteService.openProjectFile(trackId, projectId),
      onStartDateEdit: (date) =>
        trackNoteService.updateProjectStartDate(trackId, projectId, date),
      onEndDateEdit: (date) =>
        trackNoteService.updateProjectEndDate(trackId, projectId, date),
      onDelete: () => trackNoteService.deleteProject(trackId, projectId),
      onHabitAdd: () => trackNoteService.addProjectHabit(trackId, projectId),
      onDataAdd: () => trackNoteService.addProjectData(trackId, projectId),
      onDataUpdate: (index, updatedElement) =>
        trackNoteService.updateProjectData(trackId, projectId, index, updatedElement),
      onDataToggle: (index) => {
        const track = trackNoteService.getTrack(trackId);
        const element = track?.projects[projectId]?.data[index];
        if (!element?.isTask) return;
        const newStatus = element.taskStatus === "x" ? " " : "x";
        trackNoteService.updateProjectData(trackId, projectId, index, {
          taskStatus: newStatus,
        });
      },
      onDataCancel: (index) => {
        const track = trackNoteService.getTrack(trackId);
        const element = track?.projects[projectId]?.data[index];
        if (!element?.isTask) return;
        trackNoteService.updateProjectData(trackId, projectId, index, {
          taskStatus: "-",
        });
      },
      onDataDelete: (index) =>
        trackNoteService.deleteProjectData(trackId, projectId, index),
    });
  }

  function createHabitFunctionsFactory(trackId: string) {
    return (projectId: string) =>
      (habitId: string): HabitFunctions => ({
        onEdit: (habit) =>
          trackNoteService.updateProjectHabit(trackId, projectId, habitId, habit),
        onDelete: () =>
          trackNoteService.deleteProjectHabit(trackId, projectId, habitId),
      });
  }

  function presetLabel(days: number): string {
    if (days === 365) return "1y";
    if (days >= 30 && days % 30 === 0) return `${days / 30}mo`;
    return `${days}d`;
  }
</script>

<div class="gantt-view">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="nav-group">
      <button class="nav-btn" onclick={() => pan(-1)}>‹</button>
      <span class="title">{title}</span>
      <button class="nav-btn" onclick={() => pan(1)}>›</button>
    </div>
    <h2>Project Gantt View</h2>
    <div class="toolbar-right">
      {#if panDays !== 0}
        <button class="today-btn" onclick={goToToday}>Today</button>
      {/if}
      <div class="preset-group">
        {#each WINDOW_PRESETS as preset}
          <button
            class="preset-btn"
            class:active={windowDays === preset}
            onclick={() => setWindowDays(preset)}
          >
            {presetLabel(preset)}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Gantt scroll container -->
  <div class="gantt-scroll">
    <!-- Width probe: fills the scroll container, reports its pixel width -->
    <div class="gantt-width-probe" bind:clientWidth={containerWidth}>
      {#if containerWidth > 0}
        <div class="gantt-inner" style={`width: ${totalWidth}px;`}>
          <!-- Time axis header -->
          <GanttHeader
            {viewportStart}
            {viewportEnd}
            {pxPerDay}
            {totalWidth}
          />

          <!-- Body: grid lines + track groups -->
          <div class="gantt-body-scroll">
            <div class="gantt-body">
              <!-- Grid lines -->
              <div class="grid-lines" style={`width: ${totalWidth}px;`}>
                {#each ticks as tick}
                  <div class="grid-line" style={`left: ${tick.gridX}px;`}></div>
                {/each}
                {#if todayX !== null}
                  <div class="today-line" style={`left: ${todayX}px;`}></div>
                {/if}
              </div>

              <!-- Track groups -->
              {#each sortedTracks as track (track.id)}
                <GanttTrackGroup
                  {track}
                  {viewportStart}
                  {viewportEnd}
                  {pxPerDay}
                  onEffectiveChange={(next) =>
                    trackNoteService.updateTrackFrontmatter(track.id, { effective: next })}
                  createProjectFunctions={createProjectFunctionsFactory(track.id)}
                  createHabitFunctions={createHabitFunctionsFactory(track.id)}
                />
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .gantt-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
    gap: 8px;
  }

  .nav-group {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .title {
    font-size: 0.9em;
    font-weight: 600;
    white-space: nowrap;
    color: var(--text-normal);
  }

  .nav-btn {
    background: none;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 1.1em;
    line-height: 1;
    color: var(--text-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .nav-btn:hover {
    background: var(--background-modifier-hover);
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .today-btn {
    font-size: 0.82em;
    padding: 4px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 5px;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
    white-space: nowrap;
  }

  .today-btn:hover {
    background: var(--background-modifier-hover);
  }

  .preset-group {
    display: flex;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    overflow: hidden;
  }

  .preset-btn {
    font-size: 0.78em;
    padding: 4px 8px;
    border: none;
    border-right: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
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
    color: var(--text-on-accent);
  }

  /* Scroll area */
  .gantt-scroll {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 12px;
  }

  .gantt-width-probe {
    display: flex;
    flex-direction: column;
    min-height: 0;
    width: 100%;
  }

  .gantt-inner {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100%;
  }

  .gantt-body-scroll {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  /* Body */
  .gantt-body {
    position: relative;
    padding-top: 8px;
  }

  /* Grid lines */
  .grid-lines {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  .grid-line {
    position: absolute;
    top: 0;
    height: 100%;
    width: 1px;
    border-left: 1px dashed var(--background-modifier-border);
    opacity: 0.5;
  }

  .today-line {
    position: absolute;
    top: 0;
    height: 100%;
    width: 1px;
    border-left: 2px solid var(--color-accent, var(--interactive-accent));
    opacity: 0.7;
    transform: translateX(-50%);
  }
</style>
