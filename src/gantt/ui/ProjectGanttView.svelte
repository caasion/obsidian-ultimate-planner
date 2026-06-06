<script lang="ts">
  import type { App } from "obsidian";
  import type { TrackNoteService } from "src/tracks/logic/trackNote";
  import type { Track, ISODate } from "src/plugin/types";
  import { format, parseISO, addDays, differenceInDays } from "date-fns";
  import { getISODate } from "src/plugin/helpers";
  import {
    getRollingViewport,
    getHeaderTicks,
    dateToX,
    packProjectsIntoRows,
    calcTrackHeight,
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

  /* === Filter to tracks active within the current viewport === */
  const visibleTracks = $derived(
    sortedTracks.filter(track =>
      track.effective.some(interval => {
        const iEnd = interval.end ?? '9999-12-31';
        return interval.start <= viewportEnd && iEnd >= viewportStart;
      })
    )
  );

  /* === Track heights (computed here so sidebar + gantt stay in sync) === */
  const trackHeights = $derived(
    visibleTracks.map(track => {
      const packedPhases = packProjectsIntoRows(track.projects, viewportStart, viewportEnd);
      const numRows = packedPhases.length === 0 ? 0 : Math.max(...packedPhases.map(p => p.row)) + 1;
      return calcTrackHeight(numRows);
    })
  );

  /* === Synced vertical scroll === */
  let sidebarEl = $state<HTMLDivElement | undefined>();
  let ganttBodyEl = $state<HTMLDivElement | undefined>();
  let scrolling = $state(false);

  function syncScroll(source: 'sidebar' | 'gantt') {
    if (scrolling) return;
    scrolling = true;
    if (source === 'gantt' && sidebarEl && ganttBodyEl) {
      sidebarEl.scrollTop = ganttBodyEl.scrollTop;
    } else if (source === 'sidebar' && sidebarEl && ganttBodyEl) {
      ganttBodyEl.scrollTop = sidebarEl.scrollTop;
    }
    scrolling = false;
  }

  /* === Track helpers === */
  function countActiveProjects(track: Track): number {
    return Object.keys(track.projects).length;
  }

  function formatTimePerWeek(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m / week`;
    if (hours > 0) return `${hours}h / week`;
    return `${mins}m / week`;
  }

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

  <!-- Main content: sidebar + gantt area side by side -->
  <div class="gantt-content">
    <!-- Left sidebar: track labels -->
    <div class="gantt-sidebar">
      <!-- Header spacer (matches GanttHeader height) -->
      <div class="sidebar-header-spacer"></div>
      <!-- Scrollable track labels, synced with gantt body -->
      <div
        class="sidebar-scroll"
        bind:this={sidebarEl}
        onscroll={() => syncScroll('sidebar')}
      >
        <div class="sidebar-body">
          {#each visibleTracks as track, i (track.id)}
            <div class="sidebar-track" style={`height: ${trackHeights[i]}px;`}>
              <div class="track-accent" style={`background-color: ${track.color};`}></div>
              <div class="track-name">{track.label}</div>
              <div class="track-meta">
                <span class="track-time">Σ {formatTimePerWeek(track.timeCommitment * 7)}</span>
              </div>
              <div class="track-projects">
                <span class="track-projects-count">{countActiveProjects(track)}</span> Active Projects
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Right: Gantt chart area -->
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
            <div
              class="gantt-body-scroll"
              bind:this={ganttBodyEl}
              onscroll={() => syncScroll('gantt')}
            >
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
                  />
                {/each}
              </div>
            </div>
          </div>
        {/if}
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

  /* === Content: sidebar + gantt side by side === */
  .gantt-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0 0 12px 0;
  }

  /* === Sidebar === */
  .gantt-sidebar {
    width: 160px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    padding-left: 12px;
  }

  .sidebar-header-spacer {
    height: 32px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sidebar-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  .sidebar-scroll::-webkit-scrollbar {
    display: none;
  }

  .sidebar-body {
    padding-top: 8px;
    background: rgba(255, 255, 255, 0.03);
  }

  .sidebar-track {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 12px 0;
    margin-bottom: 16px;
    overflow: hidden;
  }

  .track-accent {
    height: 3px;
    border-radius: 2px;
    flex-shrink: 0;
    width: 40px;
    margin-bottom: 4px;
  }

  .track-name {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 16px;
    font-weight: 500;
    color: #e6e6e6;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
  }

  .track-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .track-time {
    font-size: 12px;
    color: #808080;
    white-space: nowrap;
  }

  .track-projects {
    font-size: 13px;
    color: #808080;
    margin-top: 4px;
  }

  .track-projects-count {
    font-weight: 700;
    color: #e6e6e6;
  }

  /* === Gantt scroll area === */
  .gantt-scroll {
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    padding: 0 12px 0 0;
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
