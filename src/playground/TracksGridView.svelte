<script lang="ts">
  import type { App } from "obsidian";
  import type { TrackNoteService } from "src/tracks/logic/trackNote";
  import type { ProjectCardFunctions } from "src/tracks/ui/ProjectCard.svelte";
  import type { HabitFunctions } from "src/tracks/ui/HabitElement.svelte";
  import type { Track } from "src/plugin/types";
  import { getISODate } from "src/plugin/helpers";
  import {
    getViewportBounds,
    getViewportTitle,
    getViewportWidth,
    getHeaderTicks,
    navigateViewport,
    PX_PER_DAY,
    type Zoom,
  } from "./gantt/ganttUtils";
  import GanttHeader from "./gantt/GanttHeader.svelte";
  import GanttTrackGroup from "./gantt/GanttTrackGroup.svelte";

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

  let zoom = $state<Zoom>("month");
  let anchor = $state(getISODate(new Date()));

  const viewport = $derived(getViewportBounds(anchor, zoom));
  const viewportStart = $derived(viewport.start);
  const viewportEnd = $derived(viewport.end);
  const pxPerDay = $derived(PX_PER_DAY[zoom]);
  const totalWidth = $derived(getViewportWidth(viewportStart, viewportEnd, pxPerDay));
  const title = $derived(getViewportTitle(viewportStart, zoom));
  const ticks = $derived(getHeaderTicks(viewportStart, viewportEnd, pxPerDay, zoom));

  const sortedTracks = $derived(
    Object.values(parsedTracks).sort((a, b) => a.order - b.order)
  );

  const today = $derived(getISODate(new Date()));
  const todayX = $derived(() => {
    if (today < viewportStart || today > viewportEnd) return null;
    const diff =
      (new Date(today).getTime() - new Date(viewportStart).getTime()) /
      (1000 * 60 * 60 * 24);
    return diff * pxPerDay + pxPerDay / 2;
  });

  function navigate(dir: 1 | -1) {
    anchor = navigateViewport(anchor, zoom, dir);
  }

  function goToToday() {
    anchor = getISODate(new Date());
  }

  function toggleZoom() {
    zoom = zoom === "month" ? "year" : "month";
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
</script>

<div class="gantt-view">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="nav-group">
      <button class="nav-btn" onclick={() => navigate(-1)}>‹</button>
      <span class="title">{title}</span>
      <button class="nav-btn" onclick={() => navigate(1)}>›</button>
    </div>
    <div class="toolbar-right">
      <button class="today-btn" onclick={goToToday}>Today</button>
      <button class="zoom-btn" onclick={toggleZoom}>
        {zoom === "month" ? "Month" : "Year"}
      </button>
    </div>
  </div>

  <!-- Gantt scroll container -->
  <div class="gantt-scroll">
    <div class="gantt-inner" style={`width: ${totalWidth}px;`}>
      <!-- Time axis header -->
      <GanttHeader
        {viewportStart}
        {viewportEnd}
        {pxPerDay}
        {zoom}
        {totalWidth}
      />

      <!-- Body: grid lines + track groups -->
      <div class="gantt-body">
        <!-- Grid lines -->
        <div class="grid-lines" style={`width: ${totalWidth}px;`}>
          {#each ticks as tick}
            <div class="grid-line" style={`left: ${tick.gridX}px;`}></div>
          {/each}
          {#if todayX() !== null}
            <div class="today-line" style={`left: ${todayX()}px;`}></div>
          {/if}
        </div>

        <!-- Track groups -->
        {#each sortedTracks as track (track.id)}
          <GanttTrackGroup
            {track}
            {viewportStart}
            {viewportEnd}
            {pxPerDay}
            {zoom}
            onEffectiveChange={(next) =>
              trackNoteService.updateTrackFrontmatter(track.id, { effective: next })}
            createProjectFunctions={createProjectFunctionsFactory(track.id)}
            createHabitFunctions={createHabitFunctionsFactory(track.id)}
          />
        {/each}
      </div>
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
  }

  .nav-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title {
    font-size: 1em;
    font-weight: 600;
    min-width: 120px;
    text-align: center;
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
  }

  .nav-btn:hover {
    background: var(--background-modifier-hover);
  }

  .toolbar-right {
    display: flex;
    gap: 8px;
  }

  .today-btn,
  .zoom-btn {
    font-size: 0.82em;
    padding: 4px 10px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 5px;
    background: var(--background-secondary);
    color: var(--text-normal);
    cursor: pointer;
  }

  .today-btn:hover,
  .zoom-btn:hover {
    background: var(--background-modifier-hover);
  }

  /* Scroll area */
  .gantt-scroll {
    overflow-x: auto;
    overflow-y: auto;
    flex: 1;
    padding: 12px;
  }

  .gantt-inner {
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }

  /* Body */
  .gantt-body {
    position: relative;
    flex: 1;
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
