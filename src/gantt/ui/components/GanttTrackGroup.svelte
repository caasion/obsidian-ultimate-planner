<script lang="ts">
  import type { DateInterval, ISODate, Track } from "src/plugin/types";
  import { getISODate } from "src/plugin/helpers";
  import {
    calcTrackHeight,
    dateToX,
    getViewportWidth,
    packProjectsIntoRows,
  } from "../../logic/ganttUtils";
  import GanttPhaseBar from "./GanttPhaseBar.svelte";

  interface Props {
    track: Track;
    viewportStart: ISODate;
    viewportEnd: ISODate;
    pxPerDay: number;
    onEffectiveChange: (next: DateInterval) => void;
  }

  let {
    track,
    viewportStart,
    viewportEnd,
    pxPerDay,
    onEffectiveChange,
  }: Props = $props();

  const today = $derived(getISODate(new Date()));
  const packedPhases = $derived(
    packProjectsIntoRows(track.projects, viewportStart, viewportEnd)
  );
  const numRows = $derived(
    packedPhases.length === 0 ? 0 : Math.max(...packedPhases.map((p) => p.row)) + 1
  );
  const trackHeight = $derived(calcTrackHeight(numRows));
  const totalWidth = $derived(
    getViewportWidth(viewportStart, viewportEnd, pxPerDay)
  );
</script>

<div class="track-group" style={`height: ${trackHeight}px; width: ${totalWidth}px;`}>
  <!-- Effective interval background -->
  {#if true}
    {@const iStart = track.effective.start}
    {@const iEnd = track.effective.end ?? today}
    {@const rawLeft = dateToX(iStart, viewportStart, pxPerDay)}
    {@const rawRight = dateToX(iEnd, viewportStart, pxPerDay) + pxPerDay}
    {@const clampedLeft = Math.max(0, rawLeft)}
    {@const clampedRight = Math.min(totalWidth, rawRight)}
    {@const bgWidth = clampedRight - clampedLeft}
    {#if bgWidth > 0}
      <div
        class="track-interval"
        style={`left: ${clampedLeft}px; width: ${bgWidth}px; height: ${trackHeight}px; background-color: ${track.color}10; border: 1px solid ${track.color}40; border-radius: 12px;`}
      ></div>
    {/if}
  {/if}

  <!-- Phase bars -->
  {#each packedPhases as { phase, projectLabel, row }}
    <GanttPhaseBar
      {phase}
      {projectLabel}
      {row}
      {viewportStart}
      {pxPerDay}
      color={track.color}
    />
  {/each}
</div>


<style>
  .track-group {
    position: relative;
    margin-bottom: 16px;
  }

  .track-interval {
    position: absolute;
    top: 0;
    pointer-events: none;
  }

</style>
