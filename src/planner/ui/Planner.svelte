<script lang="ts">
	import type { App } from "obsidian";
	import type { CalendarPipeline } from "src/calendar/calendarPipelines";
	import type { TemplateActions } from "src/templates/templateActions";
	import type { DataService, Element, HelperService, ISODate, PluginSettings, Track, TrackData } from "src/plugin/types";
	import { PlannerParser } from "src/planner/logic/parser";
	import { DailyNoteService } from "src/planner/logic/dailyNote";
	import TemplateEditor from "src/templates/Templates.svelte";
	import { getISODate, getISODates, getLabelFromDateRange } from "src/plugin/helpers";
	import Navbar from "./Navbar.svelte";
	import PlannerGrid from "./grid/PlannerGrid.svelte";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";

	// Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table.

	interface ViewProps {
		app: App;
		settings: PluginSettings;
		data: DataService;
		helper: HelperService;
		templateActions: TemplateActions;
		calendarPipeline: CalendarPipeline;
		parser: PlannerParser;
		dailyNoteService: DailyNoteService;
		trackNoteService: TrackNoteService;
	}

	let { app, settings, data, helper, templateActions, calendarPipeline, parser, dailyNoteService, trackNoteService }: ViewProps = $props();

	
	/* === View Rendering === */
	let inTemplateEditor = $state<boolean>(false);

	/* === Table Rendering === */
	let weekFormat = $derived(settings.weekFormat);
	let columns = $derived(settings.columns);
	let blocks = $derived(settings.blocks);
	let weekStartOn = $derived(settings.weekStartOn);

	// Set default anchor date to today
	const today = getISODate(new Date());
	let anchor = $state<ISODate>(today);

	// Create an array of relevant ISODates from function getISODates()
	let dates = $derived<ISODate[]>(weekFormat ? getISODates(anchor, blocks, weekStartOn) : getISODates(anchor, columns * blocks))

	let tracksByDateStore = $derived(trackNoteService.tracksByDate);
	let tracksByDate = $derived<Record<ISODate, string[]>>($tracksByDateStore);

	// Get parsed content from the service store
	let parsedContentStore = $derived(dailyNoteService.parsedContent);
	let parsedJournalContentStore = $derived(dailyNoteService.parsedJournalContent);

	let parsedContent = $derived<Record<ISODate, Record<string, TrackData>>>($parsedContentStore);
	let parsedJournalContent = $derived<Record<ISODate, Record<string, string>>>($parsedJournalContentStore)
	
	// Load daily note content when dates change
	$effect(() => {
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
	async function addNewTrackToCell(date: ISODate, trackId: string, trackMeta: Track) {
		await dailyNoteService.addNewTrackToCell(date, trackId, trackMeta.timeCommitment);
	}

	// Open daily note for a specific date
	async function openDailyNote(date: ISODate) {
		await dailyNoteService.openDailyNote(date);
	}

	function goTo(newDate: ISODate) {
			anchor = newDate;
	}
	
	
</script>

<h1>Holos</h1> 

<Navbar
	{goTo}
	incrementAmount={columns}

	label={getLabelFromDateRange(dates[0], dates[dates.length - 1])}
	{anchor}

	view={inTemplateEditor ? "Planner" : "Templates Editor"}
	toggleView={() => inTemplateEditor = !inTemplateEditor}
/>

{#if inTemplateEditor}

<TemplateEditor {app} templatesAct={templateActions} />

{:else}

<PlannerGrid 
	{dates}
	{tracksByDate}
	{parsedTracks}
	{columns}
	{blocks}
	{parsedContent}
	{parsedJournalContent}
	onUpdate={handleCellUpdate}
	onAdd={addNewTrackToCell}
	{openDailyNote}
/>

{/if}