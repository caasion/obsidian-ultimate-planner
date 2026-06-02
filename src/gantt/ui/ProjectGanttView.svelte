<script lang="ts">
  import type { App } from "obsidian";
  import type { TrackNoteService } from "src/tracks/logic/trackNote";
  import type { ProjectCardFunctions } from "src/tracks/ui/ProjectCard.svelte";
  import type { HabitFunctions } from "src/tracks/ui/HabitElement.svelte";
  import type { Track, ISODate } from "src/plugin/types";
  import { format, parseISO, addDays, differenceInDays } from "date-fns";
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

      // Phase operations
      onPhaseAdd: () => trackNoteService.addProjectPhase(trackId, projectId),
      onPhaseLabelEdit: (phaseId, label) => trackNoteService.updateProjectPhaseLabel(trackId, projectId, phaseId, label),
      onPhaseDelete: (phaseId) => trackNoteService.deleteProjectPhase(trackId, projectId, phaseId),
      onPhaseReorder: (fromIndex, toIndex) => trackNoteService.reorderProjectPhase(trackId, projectId, fromIndex, toIndex),
      onPhaseDataAdd: (phaseId) => trackNoteService.addPhaseData(trackId, projectId, phaseId),
      onPhaseDataUpdate: (phaseId, index, el) => trackNoteService.updatePhaseData(trackId, projectId, phaseId, index, el),
      onPhaseDataToggle: (phaseId, index) => trackNoteService.togglePhaseData(trackId, projectId, phaseId, index),
      onPhaseDataCancel: (phaseId, index) => trackNoteService.cancelPhaseData(trackId, projectId, phaseId, index),
      onPhaseDataDelete: (phaseId, index) => trackNoteService.deletePhaseData(trackId, projectId, phaseId, index),

      // Enable phase mode (one-way)
      onEnablePhases: () => trackNoteService.toggleProjectPhases(trackId, projectId, true),
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

  /* === Hide completed === */
  let hideCompleted = $state(false);

  const visibleTracks = $derived(
    hideCompleted
      ? sortedTracks.filter(track =>
          Object.values(track.projects).some(p => {
            const hasActiveData = (items: { isTask?: boolean; taskStatus?: string }[]) =>
              items.some(el => el.isTask && el.taskStatus !== 'x' && el.taskStatus !== '-');
            if (p.hasPhases) return p.phases.some(phase => hasActiveData(phase.data));
            return hasActiveData(p.data);
          })
        )
      : sortedTracks
  );

  /* === Date picker === */
  let dateInput: HTMLInputElement;
  let pickerValue = $state<ISODate>(centerDate);
  $effect(() => { pickerValue = centerDate; });

  function presetLabel(days: number): string {
    if (days === 365) return "1y";
    if (days >= 30 && days % 30 === 0) return `${days / 30}mo`;
    return `${days}d`;
  }

  function handleDateChange(date: string) {
    panDays = differenceInDays(parseISO(date), parseISO(today));
  }
</script>

<div class="gantt-view">

  <div class="gantt-header">
    <h1>Gantt</h1>

    <div class="header-controls">
      <button
        class="detail-toggle-btn"
        class:active={hideCompleted}
        onclick={() => hideCompleted = !hideCompleted}
        title={hideCompleted ? "Show all" : "Hide completed"}
      >
        {#if !hideCompleted}
          <!-- All tasks -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M21 9H3"/>
            <path d="M21 15H3"/>
          </svg>
        {:else}
          <!-- Active projects -->
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <g stroke="currentColor" stroke-width="2">
              <rect width="18" height="18" x="3" y="3" rx="2"/>
              <path d="M21 9H3"/>
              <path d="M21 15H3"/>
            </g>
            <circle cx="19.5" cy="19.5" r="4.5" fill="currentColor" stroke="none"/>
            <g transform="translate(15.75, 15.75)" stroke="white" stroke-width="0.75" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7.33 4h-.83a.67.67 0 0 0-.64.49l-.78 2.79a.08.08 0 0 1-.16 0L3.08.73a.08.08 0 0 0-.16 0l-.78 2.79A.67.67 0 0 1 1.5 4H.67"/>
            </g>
          </svg>
        {/if}
      </button>

      <span class="date-label">{title}</span>

      {#if todayX === null}
        <button class="today-btn" onclick={goToToday}>Today</button>
      {/if}
      <button class="nav-btn" onclick={() => pan(-1)} aria-label="Previous">‹</button>
      <button class="nav-btn" onclick={() => pan(1)} aria-label="Next">›</button>

      <div class="datepicker-wrap">
        <button class="icon-btn" onclick={() => dateInput?.showPicker()} aria-label="Jump to date">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2v4"/><path d="M21 11.75V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.25"/><path d="m22 22-1.875-1.875"/><path d="M3 10h18"/><path d="M8 2v4"/><circle cx="18" cy="18" r="3"/></svg>
        </button>
        <input
          type="date"
          class="hidden-date-input"
          bind:this={dateInput}
          bind:value={pickerValue}
          onchange={() => handleDateChange(pickerValue)}
        />
      </div>

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
              {#each visibleTracks as track (track.id)}
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

  /* === Header === */
  .gantt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 20px 8px;
    flex-shrink: 0;
  }

  .gantt-header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #e6e6e6;
    margin: 0;
    flex-shrink: 0;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .detail-toggle-btn {
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--text-muted);
    margin-right: 4px;
  }

  .detail-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .detail-toggle-btn.active svg {
    stroke: var(--interactive-accent);
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

  .hidden-date-input {
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

  /* === Scroll area === */
  .gantt-scroll {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0 12px 12px;
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
