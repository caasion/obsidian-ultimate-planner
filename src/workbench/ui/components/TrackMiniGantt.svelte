<script lang="ts">
	import type { Track, ISODate } from "src/plugin/types";
	import { getISODate } from "src/plugin/helpers";
	import { parseISO, addDays, differenceInDays } from "date-fns";
	import {
		getRollingViewport,
		dateToX,
	} from "src/gantt/logic/ganttUtils";
	import GanttControls from "src/gantt/ui/components/GanttControls.svelte";
	import GanttCanvas from "src/gantt/ui/components/GanttCanvas.svelte";

	interface Props {
		track: Track;
	}

	let { track }: Props = $props();

	const today = $derived(getISODate(new Date()));

	// Rolling window state (same pattern as ProjectGanttView)
	let windowDays = $state<number>(180);
	let panDays = $state(0);

	// Container width measured from probe div
	let containerWidth = $state(0);

	const centerDate = $derived(
		panDays === 0 ? today : getISODate(addDays(parseISO(today), panDays))
	);

	const viewport = $derived(getRollingViewport(windowDays, centerDate));
	const viewportStart = $derived(viewport.start);
	const viewportEnd = $derived(viewport.end);

	const pxPerDay = $derived(containerWidth > 0 ? containerWidth / windowDays : 0);
	const totalWidth = $derived(containerWidth);

	const todayX = $derived(
		today >= viewportStart && today <= viewportEnd
			? dateToX(today, viewportStart, pxPerDay) + pxPerDay / 2
			: null
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

	// Wrap single track in array for GanttCanvas
	const tracks = $derived([track]);

	// Check if there are any phases with dates
	const hasPhases = $derived(
		Object.values(track.projects).some(p =>
			p.phases.some(ph => ph.startDate)
		)
	);
</script>

<div class="mini-gantt-wrapper">
	<div class="gantt-controls-wrapper">
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

	<div class="mini-gantt-chart">
		{#if !hasPhases}
			<div class="mini-gantt-empty">
				<p>No phases with dates to display.</p>
			</div>
		{:else}
			<div class="mini-gantt-width-probe" bind:clientWidth={containerWidth}>
				{#if containerWidth > 0}
					<GanttCanvas
						{tracks}
						{viewportStart}
						{viewportEnd}
						{pxPerDay}
						{totalWidth}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.mini-gantt-wrapper {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mini-gantt-chart {
		position: relative;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		overflow: hidden;
	}

	.mini-gantt-width-probe {
		width: 100%;
	}

	.mini-gantt-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 80px;
		color: var(--text-faint);
		font-style: italic;
		font-size: 0.85em;
	}

	.gantt-controls-wrapper {
		width: 100%;
		display: flex;
		justify-content: flex-end;
	}
</style>
