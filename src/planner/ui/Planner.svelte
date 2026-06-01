<script lang="ts">
	import type { App } from "obsidian";
	import type { Element, ISODate, PluginSettings, Track, TrackData } from "src/plugin/types";
	import { DailyNoteService } from "src/planner/logic/dailyNote";
	import { getISODate, getISODates, getLabelFromDateRange, addDaysISO } from "src/plugin/helpers";
	import PlannerGrid from "./grid/PlannerGrid.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
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
	let showSettings = $state<boolean>(false);

	const today = getISODate(new Date());
	let anchor = $state<ISODate>(today);

	let dates = $derived<ISODate[]>(weekFormat ? getISODates(anchor, localBlocks, weekStartOn) : getISODates(anchor, localColumns * localBlocks))

	const todayInView = $derived(dates.includes(today));
	const dateLabel = $derived(getLabelFromDateRange(dates[0], dates[dates.length - 2]));

	let datepickerValue = $state<Date | undefined>(undefined);
	let datepickerRef: ReturnType<typeof Datepicker> | undefined;
	let datepickerAnchor: HTMLDivElement;

	function goTo(newDate: ISODate) {
		anchor = newDate;
		datepickerValue = new Date(newDate + 'T00:00:00');
	}

	function handleDatepickerSelect(date: Date) {
		const iso = getISODate(date);
		goTo(iso);
	}

	let settingsRef: HTMLDivElement;

	function handleSettingsClickOutside(event: MouseEvent) {
		if (showSettings && settingsRef && !settingsRef.contains(event.target as Node)) {
			showSettings = false;
		}
	}

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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="planner" onclick={handleSettingsClickOutside}>
	<div class="planner-header">
		<h1>Planner</h1>

		<div class="header-controls">
			<span class="date-label">{dateLabel}</span>

			{#if !todayInView}
				<button class="today-btn" onclick={() => goTo(today)}>Today</button>
			{/if}			
			<button class="nav-btn" onclick={() => goTo(addDaysISO(anchor, -localColumns))} aria-label="Previous">‹</button>
			<button class="nav-btn" onclick={() => goTo(addDaysISO(anchor, localColumns))} aria-label="Next">›</button>
			

			<div class="datepicker-wrap" bind:this={datepickerAnchor}>
				<Datepicker
					bind:this={datepickerRef}
					bind:value={datepickerValue}
					inline={false}
					autohide={true}
					showToggleButton={false}
					placeholder=""
					inputClass="datepicker-hidden-input"
					anchorElement={datepickerAnchor}
					onselect={(date) => handleDatepickerSelect(date)}
				/>
				<button class="icon-btn" onclick={(e) => { e.stopPropagation(); datepickerRef?.open(); }} aria-label="Jump to date">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-search-icon lucide-calendar-search"><path d="M16 2v4"/><path d="M21 11.75V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.25"/><path d="m22 22-1.875-1.875"/><path d="M3 10h18"/><path d="M8 2v4"/><circle cx="18" cy="18" r="3"/></svg>
				</button>
			</div>

			<div class="settings-wrap" bind:this={settingsRef}>
				<button class="icon-btn" onclick={() => showSettings = !showSettings} aria-label="Settings">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings2-icon lucide-settings-2"><path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
				</button>

				{#if showSettings}
					<div class="settings-popup">
						<label class="settings-field">
							<span class="settings-label">Columns</span>
							<input
								type="number"
								class="settings-input"
								min="1"
								max="31"
								value={localColumns}
								oninput={(e) => { localColumns = +e.currentTarget.value; settings.columns = localColumns; saveSettings(); }}
							/>
						</label>
					</div>
				{/if}
			</div>
		</div>
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

	.planner-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 20px 8px;
	}

	.planner-header h1 {
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

	.datepicker-wrap :global(.datepicker-hidden-input) {
		position: absolute;
		width: 0;
		height: 0;
		padding: 0;
		border: none;
		opacity: 0;
		pointer-events: none;
	}

	/* === Settings Popup === */
	.settings-wrap {
		position: relative;
	}

	.settings-popup {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		padding: 12px;
		box-shadow: var(--shadow-s);
		z-index: 100;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 160px;
	}

	.settings-field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.settings-label {
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.settings-input {
		width: 52px;
		padding: 3px 6px;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		background: var(--background-primary-alt);
		color: var(--text-normal);
		font-size: 12px;
		text-align: center;
	}

	.planner-body {
		flex: 1;
		overflow: auto;
		padding: 0 16px 16px;
	}
</style>
