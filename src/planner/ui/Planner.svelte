<script lang="ts">
	import type { App } from "obsidian";
	import type { Element, ISODate, PluginSettings, Track, TrackData } from "src/plugin/types";
	import { DailyNoteService } from "src/planner/logic/dailyNote";
	import { getISODate, getISODates, getLabelFromDateRange, addDaysISO } from "src/plugin/helpers";
	import Topbar from "src/components/Topbar.svelte";
	import PlannerGrid from "./grid/PlannerGrid.svelte";
	import ViewSwitcher from "src/components/ViewSwitcher.svelte";
	import { PLANNER_VIEW_TYPE } from "src/planner/PlannerView";
	import { TRACKS_VIEW_TYPE } from "src/tracks/TracksView";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";

	// Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table.

	interface ViewProps {
		app: App;
		settings: PluginSettings;
		dailyNoteService: DailyNoteService;
		trackNoteService: TrackNoteService;
		saveSettings: () => void;
	}

	let { app, settings, dailyNoteService, trackNoteService, saveSettings }: ViewProps = $props();


	/* === View Rendering === */
	let inTemplateEditor = $state<boolean>(false);

	/* === Table Rendering === */
	let weekFormat = $derived(settings.weekFormat);
	let weekStartOn = $derived(settings.weekStartOn);

	// Local quick-controls, synced from settings and persisted on change
	let localColumns = $state<number>(settings.columns);
	let localBlocks = $state<number>(settings.blocks);
	$effect(() => { localColumns = settings.columns; });
	$effect(() => { localBlocks = settings.blocks; });

	let showProjectLabel = $state<boolean>(true);

	// Set default anchor date to today
	const today = getISODate(new Date());
	let anchor = $state<ISODate>(today);

	// Create an array of relevant ISODates from function getISODates()
	let dates = $derived<ISODate[]>(weekFormat ? getISODates(anchor, localBlocks, weekStartOn) : getISODates(anchor, localColumns * localBlocks))

	const todayInView = $derived(dates.includes(today));

	// Compute tracksByDate on-demand for visible dates only
	let trackMetaRevisionStore = $derived(trackNoteService.trackMetaRevision);
	const trackMetaRevision = $derived($trackMetaRevisionStore);
	let tracksByDate = $derived.by(() => {
		trackMetaRevision; // react to track data changes
		return trackNoteService.getTracksForDates(dates, localColumns);
	});
	let parsedContentStore = $derived(dailyNoteService.parsedContent);
	let parsedJournalContentStore = $derived(dailyNoteService.parsedJournalContent);

	let parsedContent = $derived<Record<ISODate, Record<string, TrackData>>>($parsedContentStore);
	let parsedJournalContent = $derived<Record<ISODate, Record<string, string>>>($parsedJournalContentStore)

	// Load daily note content when dates change
	$effect(() => {
		trackMetaRevision;
		dailyNoteService.loadMultipleDates(dates);
	});

	// Setup file watcher when dates change
	$effect(() => {
		dailyNoteService.setupFileWatcher(dates);

		return () => {
			dailyNoteService.cleanupFileWatcher();
		};
	});

	let trackStore = $derived(trackNoteService.parsedTracksContent);
	const parsedTracks = $derived($trackStore);

  // Load track content when component mounts
  $effect(() => {
    trackNoteService.loadAllTrackContent();
  });

  // Setup file watcher with cleanup
  $effect(() => {
    trackNoteService.setupFileWatchers();

    return () => {
      trackNoteService.cleanupFileWatchers();
    };
  });

	// Update handler for editable cells
	function handleCellUpdate(date: ISODate, trackId: string, updatedData: TrackData) {
		dailyNoteService.updateTrackCell(date, trackId, updatedData);
	}

	// Add new track to an empty cell
	async function addNewTrackToCell(date: ISODate, trackId: string, trackMeta: Track, items?: Element[]) {
		await dailyNoteService.addNewTrackToCell(date, trackId, trackMeta.timeCommitment, items);
	}

	// Open daily note for a specific date
	async function openDailyNote(date: ISODate) {
		await dailyNoteService.openDailyNote(date);
	}

	function goTo(newDate: ISODate) {
			anchor = newDate;
	}

	async function handleTrackOpen(_trackId: string) {
		const leaves = app.workspace.getLeavesOfType(TRACKS_VIEW_TYPE);
		if (leaves.length === 0) {
			await app.workspace.getLeaf(false).setViewState({ type: TRACKS_VIEW_TYPE, active: true });
		}
		const leaf = app.workspace.getLeavesOfType(TRACKS_VIEW_TYPE)[0];
		if (leaf) app.workspace.revealLeaf(leaf);
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

<div class="planner-container">
	<ViewSwitcher {app} currentView={PLANNER_VIEW_TYPE} />

	<Topbar
		onPrev={() => goTo(addDaysISO(anchor, -localColumns))}
		onNext={() => goTo(addDaysISO(anchor, localColumns))}
		onToday={() => goTo(today)}
		showToday={!todayInView}
		label={getLabelFromDateRange(dates[0], dates[dates.length - 1])}
		anchor={anchor}
		onDateChange={goTo}
	>
		{#snippet right()}
			<div class="holos-controls">
				<button
					class="holos-ctrl-btn"
					class:active={showProjectLabel}
					onclick={() => showProjectLabel = !showProjectLabel}
					title={showProjectLabel ? 'Collapse project labels' : 'Expand project labels'}
				>P</button>
				<label class="holos-ctrl">
					<span class="holos-ctrl-lbl">Cols</span>
					<input type="number" class="holos-ctrl-input" min="1" max="31" value={localColumns}
						oninput={(e) => { localColumns = +e.currentTarget.value; settings.columns = localColumns; saveSettings(); }} />
				</label>
				<label class="holos-ctrl">
					<span class="holos-ctrl-lbl">Blocks</span>
					<input type="number" class="holos-ctrl-input" min="1" max="52" value={localBlocks}
						oninput={(e) => { localBlocks = +e.currentTarget.value; settings.blocks = localBlocks; saveSettings(); }} />
				</label>
			</div>
		{/snippet}
	</Topbar>

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
		onTrackOpen={handleTrackOpen}
		onTrackFileOpen={handleTrackFileOpen}
		onCloseProjectTask={handleCloseProjectTask}
	/>
</div>

<style>
	.planner-container {
		padding: 12px;
	}

	.holos-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.holos-ctrl {
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: default;
	}

	.holos-ctrl-lbl {
		font-size: 0.78em;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.holos-ctrl-input {
		width: 48px;
		padding: 3px 6px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-secondary);
		color: var(--text-normal);
		font-size: 0.82em;
		text-align: center;
	}

	.holos-ctrl-btn {
		font-size: 0.78em;
		font-weight: bold;
		padding: 2px 6px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		background: var(--background-secondary);
		color: var(--text-muted);
		cursor: pointer;
	}

	.holos-ctrl-btn.active {
		background: var(--interactive-accent);
		color: white;
		border-color: var(--interactive-accent);
	}
</style>
