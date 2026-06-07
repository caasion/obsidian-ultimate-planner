<script lang="ts">
	import type { App } from "obsidian";
	import type { PluginSettings } from "src/plugin/types";
	import type { DailyNoteService } from "src/planner/logic/dailyNote";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";
	import ViewSwitcher from "src/components/ViewSwitcher.svelte";
	import Planner from "src/planner/ui/Planner.svelte";
	import Timeline from "src/planner/ui/timeline/TimelineView.svelte";
	import ProjectView from "src/workbench/ui/WorkbenchView.svelte";
	import TracksListView from "src/tracks/ui/TracksListView.svelte";
	import ProjectGanttView from "src/gantt/ui/ProjectGanttView.svelte";
	import TasksView from "src/tasks/ui/TasksView.svelte";

	type ViewId = 'planner' | 'timeline' | 'workbench' | 'tracks' | 'gantt';

	interface Props {
		app: App;
		settings: PluginSettings;
		dailyNoteService: DailyNoteService;
		trackNoteService: TrackNoteService;
		saveSettings: () => void;
	}

	let { app, settings, dailyNoteService, trackNoteService, saveSettings }: Props = $props();

	let currentView = $state<ViewId>('planner');

	const views = [
		{
			id: 'planner' as ViewId,
			label: 'Planner',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-notebook-icon lucide-notebook"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M16 2v20"/></svg>',
		},
		{
			id: 'timeline' as ViewId,
			label: 'Timeline',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-timeline-icon lucide-timeline"><path d="M4 12h.01"/><path d="M4 16h.01"/><path d="M4 20h.01"/><path d="M4 4h.01"/><path d="M4 8h.01"/><path d="M9.414 13.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 12z"/><path d="M9.414 21.414a2 2 0 0 0 1.414.586H19a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 20z"/><path d="M9.414 5.414A2 2 0 0 0 10.828 6H19a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-8.172a2 2 0 0 0-1.414.586L8 4z"/></svg>',
		},
		{
			id: 'tasks' as ViewId,
			label: 'Tasks',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-todo-icon lucide-list-todo"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/></svg>'
		},
		{ type: 'divider' as const },
		{
			id: 'workbench' as ViewId,
			label: 'Workbench',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15h4"/><path d="m14.817 10.995-.971-1.45 1.034-1.232a2 2 0 0 0-2.025-3.238l-1.82.364L9.91 3.885a2 2 0 0 0-3.625.748L6.141 6.55l-1.725.426a2 2 0 0 0-.19 3.756l.657.27"/><path d="m18.822 10.995 2.26-5.38a1 1 0 0 0-.557-1.318L16.954 2.9a1 1 0 0 0-1.281.533l-.924 2.122"/><path d="M4 12.006A1 1 0 0 1 4.994 11H19a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></svg>',
		},
		{
			id: 'gantt' as ViewId,
			label: 'Gantt',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-no-axes-gantt-icon lucide-chart-no-axes-gantt"><path d="M6 5h12"/><path d="M4 12h10"/><path d="M12 19h8"/></svg>',
		},
		{
			id: 'tracks' as ViewId,
			label: 'Tracks',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>',
		},
	];
</script>

<div class="holos-app">
	<ViewSwitcher {currentView} onNavigate={(view) => currentView = view} {views} />

	{#if currentView === 'planner'}
		<Planner {app} {settings} {dailyNoteService} {trackNoteService} {saveSettings} />
	{:else if currentView === 'timeline'}
		<Timeline {app} {settings} {dailyNoteService} {trackNoteService} {saveSettings} />
	{:else if currentView === 'tasks'}
		<TasksView {app} {settings} {dailyNoteService} {trackNoteService} {saveSettings} />
	{:else if currentView === 'workbench'}
		<ProjectView {app} {trackNoteService} {dailyNoteService} />
	{:else if currentView === 'gantt'}
		<ProjectGanttView {app} {trackNoteService} />
	{:else if currentView === 'tracks'}
		<TracksListView {app} {trackNoteService} />
	{/if}
</div>

<style>
	.holos-app {
		display: flex;
		flex-direction: column;
		height: 100%;
		color: #cccccc;
	}
</style>
