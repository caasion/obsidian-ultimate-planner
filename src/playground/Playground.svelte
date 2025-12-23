<script lang="ts">  
import { getAllDailyNotes, getDailyNote } from 'obsidian-daily-notes-interface';
import { moment } from 'obsidian';
import { onMount } from 'svelte';
import { PlannerParser } from 'src/lib/parser';
import { type ItemData } from 'src/types';

let content = $state('');
let extracted = $derived<string>(PlannerParser.extractSection(content, "Ultimate Planner"));
let parsed = $derived<ItemData[]>(PlannerParser.parseSection(extracted));

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
<pre>{JSON.stringify(parsed, null, 2)}</pre>
