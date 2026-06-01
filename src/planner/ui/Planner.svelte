<script lang="ts">
	import type { App } from "obsidian";
	import type { Element, ISODate, PluginSettings, Track, TrackData } from "src/plugin/types";
	import { DailyNoteService } from "src/planner/logic/dailyNote";
	import { getISODate, getISODates, getLabelFromDateRange, addDaysISO } from "src/plugin/helpers";
	import PlannerGrid from "./grid/PlannerGrid.svelte";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";

	interface ViewProps {
		app: App;
		settings: PluginSettings;
		dailyNoteService: DailyNoteService;
		trackNoteService: TrackNoteService;
		saveSettings: () => void;
	}

	let { app, settings, dailyNoteService, trackNoteService, saveSettings }: ViewProps = $props();

	/* === Table Rendering === */
	let weekFormat = $derived(settings.weekFormat);
	let weekStartOn = $derived(settings.weekStartOn);

	let localColumns = $state<number>(settings.columns);
	let localBlocks = $state<number>(settings.blocks);
	$effect(() => { localColumns = settings.columns; });
	$effect(() => { localBlocks = settings.blocks; });

	let showProjectLabel = $state<boolean>(true);

	const today = getISODate(new Date());
	let anchor = $state<ISODate>(today);

	let dates = $derived<ISODate[]>(weekFormat ? getISODates(anchor, localBlocks, weekStartOn) : getISODates(anchor, localColumns * localBlocks))

	const todayInView = $derived(dates.includes(today));

	let trackMetaRevisionStore = $derived(trackNoteService.trackMetaRevision);
	const trackMetaRevision = $derived($trackMetaRevisionStore);
	let tracksByDate = $derived.by(() => {
		trackMetaRevision;
		return trackNoteService.getTracksForDates(dates, localColumns);
	});
	let parsedContentStore = $derived(dailyNoteService.parsedContent);
	let parsedJournalContentStore = $derived(dailyNoteService.parsedJournalContent);

	let parsedContent = $derived<Record<ISODate, Record<string, TrackData>>>($parsedContentStore);
	let parsedJournalContent = $derived<Record<ISODate, Record<string, string>>>($parsedJournalContentStore)

	$effect(() => {
		trackMetaRevision;
		dailyNoteService.loadMultipleDates(dates);
	});

	$effect(() => {
		dailyNoteService.setupFileWatcher(dates);
		return () => {
			dailyNoteService.cleanupFileWatcher();
		};
	});

	let trackStore = $derived(trackNoteService.parsedTracksContent);
	const parsedTracks = $derived($trackStore);

	$effect(() => {
		trackNoteService.loadAllTrackContent();
	});

	$effect(() => {
		trackNoteService.setupFileWatchers();
		return () => {
			trackNoteService.cleanupFileWatchers();
		};
	});

	function handleCellUpdate(date: ISODate, trackId: string, updatedData: TrackData) {
		dailyNoteService.updateTrackCell(date, trackId, updatedData);
	}

	async function addNewTrackToCell(date: ISODate, trackId: string, trackMeta: Track, items?: Element[]) {
		await dailyNoteService.addNewTrackToCell(date, trackId, trackMeta.timeCommitment, items);
	}

	async function openDailyNote(date: ISODate) {
		await dailyNoteService.openDailyNote(date);
	}

	function goTo(newDate: ISODate) {
		anchor = newDate;
	}

	async function handleTrackFileOpen(trackId: string) {
		await trackNoteService.openTrackFile(trackId);
	}

	async function handleCloseProjectTask(trackId: string, sourceRef: string, taskStatus: ' ' | 'x') {
		const match = sourceRef.match(/\[\[[^\]]+#\^([a-zA-Z0-9]+)\]\]/);
		if (!match) return;
		const blockId = match[1];
		await trackNoteService.closeProjectTaskByBlockId(trackId, blockId, taskStatus);
	}
</script>

<div class="planner">
	<div class="planner-title">
	<h1>Planner</h1>
</div>

<div class="planner-body">
	<PlannerGrid
		{dates}
		{tracksByDate}
		{parsedTracks}
		columns={localColumns}
		blocks={localBlocks}
		{parsedContent}
		{parsedJournalContent}
		{showProjectLabel}
		onUpdate={handleCellUpdate}
		onAdd={addNewTrackToCell}
		{openDailyNote}
		onTrackFileOpen={handleTrackFileOpen}
		onCloseProjectTask={handleCloseProjectTask}
	/>
</div>
</div>



<style>
	.planner {
		background: rgb(255, 255, 255, 0.05);
	}

	.planner-title {
		padding: 16px 20px 8px;
	}

	.planner-title h1 {
		font-size: 28px;
		font-weight: 700;
		color: #e6e6e6;
		margin: 0;
	}

	.planner-body {
		flex: 1;
		overflow: auto;
		padding: 0 16px 16px;
	}
</style>
