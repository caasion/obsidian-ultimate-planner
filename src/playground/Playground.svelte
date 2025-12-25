<script lang="ts">  
import { getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';
import { App, moment } from 'obsidian';
import type { DataService, HelperService, ISODate, ItemData, ItemMeta, PluginSettings } from "src/types";
import type { CalendarPipeline } from "src/actions/calendarPipelines";
import type { PlannerActions } from "src/actions/itemActions";
import { PlannerParser } from 'src/lib/parser';

interface ViewProps {
		app: App;
		settings: PluginSettings;
		data: DataService;
		helper: HelperService;
		plannerActions: PlannerActions;
		calendarPipeline: CalendarPipeline;
    parser: PlannerParser;
	}

let { app, settings, data, helper, plannerActions, calendarPipeline, parser }: ViewProps = $props();

let today = new Date().toISOString();
let content = $state('');
let extracted = $derived<string>(PlannerParser.extractSection(content, "Ultimate Planner"));
let parsed = $derived<ItemData[]>(parser.parseSection(today, extracted));

function getTodayNote() {
  return getDailyNote(moment(), getAllDailyNotes());
}

async function getTodayContents() {
  const dailyNoteFile = getTodayNote();

  if (dailyNoteFile) {
    return await this.app.vault.read(dailyNoteFile);
  } else {
    return "No daily note found";
  }
} 
</script>

<!-- svelte-ignore a11y_consider_explicit_label -->
<button onclick={async () => content = await getTodayContents()}>Update</button>
<h2>Raw Content</h2>
<pre>
  {JSON.stringify(content, null, 2)}
</pre>

<h2>Extracted Section</h2>
<pre>{JSON.stringify(extracted, null, 2)}</pre>

<h2>Parsed Lines</h2>
<pre>{JSON.stringify(parsed, null, 2)} {console.log(parsed)}</pre>
