<script lang="ts">
  import type { ISODate, Track } from "src/plugin/types";
  import { getISODate } from "src/plugin/helpers";
  import { dateToX, getHeaderTicks } from "../../logic/ganttUtils";
  import GanttHeader from "./GanttHeader.svelte";
  import GanttTrackGroup from "./GanttTrackGroup.svelte";

  interface Props {
    tracks: Track[];
    viewportStart: ISODate;
    viewportEnd: ISODate;
    pxPerDay: number;
    totalWidth: number;
    /** If provided, effective interval changes are propagated */
    onEffectiveChange?: (trackId: string, next: import("src/plugin/types").DateInterval) => void;
  }

  let {
    tracks,
    viewportStart,
    viewportEnd,
    pxPerDay,
    totalWidth,
    onEffectiveChange,
  }: Props = $props();

  const today = $derived(getISODate(new Date()));

  const ticks = $derived(getHeaderTicks(viewportStart, viewportEnd, pxPerDay));

  const todayX = $derived(
    today >= viewportStart && today <= viewportEnd
      ? dateToX(today, viewportStart, pxPerDay) + pxPerDay / 2
      : null
  );
</script>

<div class="gantt-canvas" style={`width: ${totalWidth}px;`}>
  <!-- Time axis header -->
  <GanttHeader {viewportStart} {viewportEnd} {pxPerDay} {totalWidth} />

  <!-- Body: grid lines + track groups -->
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
    {#each tracks as track (track.id)}
      <GanttTrackGroup
        {track}
        {viewportStart}
        {viewportEnd}
        {pxPerDay}
        onEffectiveChange={(next) => onEffectiveChange?.(track.id, next)}
      />
    {/each}
  </div>
</div>

<style>
  .gantt-canvas {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

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
