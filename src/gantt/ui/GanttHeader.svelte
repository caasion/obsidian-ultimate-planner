<script lang="ts">
  import type { ISODate } from "src/plugin/types";
  import { getHeaderTicks } from "../logic/ganttUtils";

  interface Props {
    viewportStart: ISODate;
    viewportEnd: ISODate;
    pxPerDay: number;
    totalWidth: number;
  }

  let { viewportStart, viewportEnd, pxPerDay, totalWidth }: Props = $props();

  const ticks = $derived(
    getHeaderTicks(viewportStart, viewportEnd, pxPerDay)
  );
</script>

<div class="gantt-header" style={`width: ${totalWidth}px;`}>
  {#each ticks as tick}
    <span class="tick" style={`left: ${tick.x}px;`}>{tick.label}</span>
  {/each}
</div>

<style>
  .gantt-header {
    position: relative;
    height: 32px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }

  .tick {
    position: absolute;
    font-size: 0.75em;
    color: var(--text-muted);
    top: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    user-select: none;
    white-space: nowrap;
  }
</style>
