<script lang="ts">
  import type { App } from "obsidian";
  import type { TrackNoteService } from "src/tracks/logic/trackNote";
  import type { Track, ISODate } from "src/plugin/types";
  import { parseISO, addDays, differenceInDays } from "date-fns";
  import { getISODate } from "src/plugin/helpers";
  import {
    getRollingViewport,
    dateToX,
    packProjectsIntoRows,
    calcTrackHeight,
  } from "../logic/ganttUtils";
  import GanttControls from "./components/GanttControls.svelte";
  import GanttCanvas from "./components/GanttCanvas.svelte";

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

  // Today line position (null if today is outside the viewport)
  const todayX = $derived(
    today >= viewportStart && today <= viewportEnd
      ? dateToX(today, viewportStart, pxPerDay) + pxPerDay / 2
      : null
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

  function handleDateSelect(date: Date) {
    panDays = differenceInDays(date, parseISO(today));
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
</script>

<div class="gantt-view">

  <div class="gantt-header">
    <h1>Gantt</h1>

    <GanttControls
      {viewportStart}
      {viewportEnd}
      {windowDays}
      todayVisible={todayX !== null}
      onPan={pan}
      onGoToToday={goToToday}
      onSetWindowDays={setWindowDays}
      onDateSelect={handleDateSelect}
    />
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
            <div
              class="gantt-body-scroll"
              bind:this={ganttBodyEl}
              onscroll={() => syncScroll('gantt')}
            >
              <GanttCanvas
                tracks={visibleTracks}
                {viewportStart}
                {viewportEnd}
                {pxPerDay}
                {totalWidth}
                onEffectiveChange={(trackId, next) =>
                  trackNoteService.updateTrackFrontmatter(trackId, { effective: next })}
              />
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
</style>
