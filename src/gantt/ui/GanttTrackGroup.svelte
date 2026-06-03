<script lang="ts">
  import type { DateInterval, ISODate, Track } from "src/plugin/types";
  import type { ProjectCardFunctions } from "src/tracks/ui/ProjectCard.svelte";
  import type { HabitFunctions } from "src/tracks/ui/HabitElement.svelte";
  import { getISODate } from "src/plugin/helpers";
  import {
    calcTrackHeight,
    dateToX,
    getViewportWidth,
    packProjectsIntoRows,
  } from "../logic/ganttUtils";
  import GanttProjectBar from "./GanttProjectBar.svelte";
  import GanttPhaseBar from "./GanttPhaseBar.svelte";

  interface Props {
    track: Track;
    viewportStart: ISODate;
    viewportEnd: ISODate;
    pxPerDay: number;
    onEffectiveChange: (next: DateInterval[]) => void;
    createProjectFunctions: (projectId: string) => ProjectCardFunctions;
    createHabitFunctions: (projectId: string) => (habitId: string) => HabitFunctions;
  }

  let {
    track,
    viewportStart,
    viewportEnd,
    pxPerDay,
    onEffectiveChange,
    createProjectFunctions,
    createHabitFunctions,
  }: Props = $props();

  const today = $derived(getISODate(new Date()));
  const packResult = $derived(
    packProjectsIntoRows(track.projects, viewportStart, viewportEnd)
  );
  const packed = $derived(packResult.packedProjects);
  const packedPhases = $derived(packResult.packedPhases);
  const numRows = $derived.by(() => {
    const projectRows = packed.length === 0 ? 0 : Math.max(...packed.map((p) => p.row)) + 1;
    const phaseRows = packedPhases.length === 0 ? 0 : Math.max(...packedPhases.map((p) => p.row)) + 1;
    return Math.max(projectRows, phaseRows);
  });
  const trackHeight = $derived(calcTrackHeight(numRows));
  const totalWidth = $derived(
    getViewportWidth(viewportStart, viewportEnd, pxPerDay)
  );
</script>

<div class="track-group" style={`height: ${trackHeight}px; width: ${totalWidth}px;`}>
  <!-- Effective interval backgrounds -->
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
        style={`left: ${clampedLeft}px; width: ${bgWidth}px; height: ${trackHeight}px; background-color: ${track.color}10; border: 1px solid ${track.color}40; border-radius: 12px;`}
      ></div>
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
