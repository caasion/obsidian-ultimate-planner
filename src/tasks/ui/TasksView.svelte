<script lang="ts">
	import type { App } from "obsidian";
	import type { Element, ISODate, PluginSettings, Track, TrackData, Project } from "src/plugin/types";
	import type { DailyNoteService } from "src/planner/logic/dailyNote";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";
	import { getISODate, getISODates, calculateTotalTimeSpent, formatTimeArguments, reconstructRawText, extractSourceRefBlockId } from "src/plugin/helpers";
	import TaskCheckbox from "src/components/TaskCheckbox.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import Portal from "src/components/Portal.svelte";
	import { format, parseISO } from "date-fns";
	import { onMount } from "svelte";

	interface Props {
		app: App;
		settings: PluginSettings;
		dailyNoteService: DailyNoteService;
		trackNoteService: TrackNoteService;
		saveSettings: () => void;
	}

	let { app, settings, dailyNoteService, trackNoteService, saveSettings }: Props = $props();

	/* === Grouping & Sorting === */
	type GroupMode = 'track' | 'date' | 'project';
	type SortField = 'text' | 'time' | 'scheduled' | 'project' | 'track' | 'date' | 'phase';
	type SortDir = 'asc' | 'desc';

	let groupMode = $state<GroupMode>('date');
	let sortField = $state<SortField>('text');
	let sortDir = $state<SortDir>('asc');

	// Filters
	let isFilterOpen = $state(false);
	let filterBtnEl = $state<HTMLButtonElement>();
	
	let filterStatuses = $state<Record<string, boolean>>({
		' ': true,
		'/': true,
		'x': false,
		'-': false
	});

	let filterDateRangeFrom = $state<Date | null>(new Date());
	let filterDateRangeTo = $state<Date | null>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

	function toggleSort(field: SortField) {
		if (sortField === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDir = 'asc';
		}
	}

	/* === Data Loading === */
	const today = getISODate(new Date());
	let weekStartOn = $derived(settings.weekStartOn);

	// Load 4 weeks of data centered around today
	let dates = $derived<ISODate[]>(getISODates(today, 4, weekStartOn));

	let trackMetaRevisionStore = $derived(trackNoteService.trackMetaRevision);
	const trackMetaRevision = $derived($trackMetaRevisionStore);

	let parsedContentStore = $derived(dailyNoteService.parsedContent);
	let parsedContent = $derived<Record<ISODate, Record<string, TrackData>>>($parsedContentStore);

	let trackStore = $derived(trackNoteService.parsedTracksContent);
	const parsedTracks = $derived($trackStore);

	$effect(() => {
		dailyNoteService.loadMultipleDates(dates);
	});

	$effect(() => {
		dailyNoteService.setupFileWatcher(dates);
		return () => {
			dailyNoteService.cleanupFileWatcher();
		};
	});

	onMount(() => {
		trackNoteService.loadAllTrackContent();
		trackNoteService.setupFileWatchers();
		return () => trackNoteService.cleanupFileWatchers();
	});

	/* === Flatten all tasks into a unified list === */
	interface TaskRow {
		element: Element;
		trackId: string;
		trackLabel: string;
		trackColor: string;
		date?: ISODate;
		projectLabel?: string;
		projectId?: string;
		timeSpent: number;
		timeCommitment: number;
		source: 'daily' | 'project';
		// For daily note task mutations
		dailyDate?: ISODate;
		dailyItemIndex?: number;
		// For project task mutations
		phaseId?: string;
		phaseLabel?: string;
		projectDataIndex?: number;
	}

	let allTasks = $derived.by((): TaskRow[] => {
		const rows: TaskRow[] = [];

		// 1) Tasks from daily notes
		for (const date of Object.keys(parsedContent)) {
			const dateData = parsedContent[date];
			for (const trackId of Object.keys(dateData)) {
				const trackData = dateData[trackId];
				const track = parsedTracks[trackId];
				if (!track) continue;

				trackData.items.forEach((element, index) => {
					if (!element.isTask) return;

					// Find project/phase label from sourceRef
					let projectLabel: string | undefined;
					let projectId: string | undefined;
					let phaseId: string | undefined;
					let phaseLabel: string | undefined;
					if (element.sourceRef && element.blockId) {
						outer: for (const [pId, project] of Object.entries(track.projects)) {
							for (const phase of project.phases) {
								if (phase.data.some(d => d.blockId === element.blockId)) {
									projectLabel = project.label;
									projectId = pId;
									phaseId = phase.id;
									phaseLabel = phase.label;
									break outer;
								}
							}
						}
					}

					const timeSpent = calculateTotalTimeSpent([element]);
					const timeCommitment = element.duration
						? (element.timeUnit === 'hr' ? element.duration * 60 : element.duration)
						: 0;

					rows.push({
						element,
						trackId,
						trackLabel: track.label,
						trackColor: track.color,
						date,
						projectLabel,
						projectId,
						timeSpent,
						timeCommitment,
						source: 'daily',
						dailyDate: date,
						dailyItemIndex: index,
						phaseId,
						phaseLabel,
					});
				});
			}
		}

		// Block IDs of project tasks already pulled into daily notes (referenced via sourceRef).
		// A scheduled daily copy carries the project task's id inside its sourceRef ("[[File#^id]]"),
		// not in its own blockId (which stays undefined), so we match against that.
		const scheduledRefIds = new Set(
			rows
				.filter(r => r.source === 'daily')
				.map(r => extractSourceRefBlockId(r.element.sourceRef))
				.filter((id): id is string => !!id)
		);

		// 2) Tasks from project data (not already in daily notes via sourceRef)
		for (const [trackId, track] of Object.entries(parsedTracks)) {
			for (const [projectId, project] of Object.entries(track.projects)) {
				const addProjectElement = (element: Element, index: number, phaseId?: string, phaseLabel?: string) => {
					if (!element.isTask) return;

					// Skip if this task is already represented in daily notes (has a sourceRef that would appear there)
					// We include project-only tasks here (those without scheduled dates that haven't been pulled into daily notes)
					if (element.blockId && scheduledRefIds.has(element.blockId)) return;

					rows.push({
						element,
						trackId,
						trackLabel: track.label,
						trackColor: track.color,
						date: element.scheduledDate,
						projectLabel: project.label,
						projectId,
						timeSpent: calculateTotalTimeSpent([element]),
						timeCommitment: element.duration
							? (element.timeUnit === 'hr' ? element.duration * 60 : element.duration)
							: 0,
						source: 'project',
						phaseId,
						phaseLabel,
						projectDataIndex: index,
					});
				};

				for (const phase of project.phases) {
					phase.data.forEach((el, idx) => addProjectElement(el, idx, phase.id, phase.label));
				}
			}
		}

		return rows;
	});

	let filterDateStartStr = $derived(filterDateRangeFrom ? getISODate(filterDateRangeFrom) : null);
	let filterDateEndStr = $derived(filterDateRangeTo ? getISODate(filterDateRangeTo) : null);

	let filteredTasks = $derived(
		allTasks.filter(t => {
			const status = t.element.taskStatus || ' ';
			if (filterStatuses[status] === false) return false;

			if (filterDateStartStr || filterDateEndStr) {
				const taskDate = t.element.scheduledDate ?? t.date;
				if (!taskDate) return false;
				
				if (filterDateStartStr && taskDate.localeCompare(filterDateStartStr) < 0) return false;
				if (filterDateEndStr && taskDate.localeCompare(filterDateEndStr) > 0) return false;
			}
			return true;
		})
	);

	let portalStyle = $state("");

	function openFilterPopup() {
		isFilterOpen = !isFilterOpen;
		if (isFilterOpen && filterBtnEl) {
			const rect = filterBtnEl.getBoundingClientRect();
			portalStyle = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;z-index:var(--layer-popover, 100);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;box-shadow:var(--shadow-s);padding:16px;display:flex;flex-direction:column;gap:16px;width:300px;`;
		}
	}

	function handleOutsideClick(e: MouseEvent) {
		if (!isFilterOpen) return;
		const target = e.target as HTMLElement;
		if (target.closest?.('.holos-datepicker-panel')) return; // ignore clicks inside datepicker
		
		const popup = document.querySelector('.tasks-filter-popup');
		if (filterBtnEl?.contains(target) || popup?.contains(target)) {
			return;
		}
		isFilterOpen = false;
	}

	onMount(() => {
		document.addEventListener('click', handleOutsideClick);
		trackNoteService.loadAllTrackContent();
		trackNoteService.setupFileWatchers();
		return () => {
			document.removeEventListener('click', handleOutsideClick);
			trackNoteService.cleanupFileWatchers();
		};
	});

	/* === Sorting === */
	function compareTasks(a: TaskRow, b: TaskRow): number {
		const dir = sortDir === 'asc' ? 1 : -1;
		switch (sortField) {
			case 'text':
				return dir * a.element.text.localeCompare(b.element.text);
			case 'time': {
				return dir * (a.timeSpent - b.timeSpent);
			}
			case 'scheduled': {
				const aDate = a.element.scheduledDate ?? a.date ?? '';
				const bDate = b.element.scheduledDate ?? b.date ?? '';
				return dir * aDate.localeCompare(bDate);
			}
			case 'project':
				return dir * (a.projectLabel ?? '').localeCompare(b.projectLabel ?? '');
			case 'track':
				return dir * a.trackLabel.localeCompare(b.trackLabel);
			case 'date':
				return dir * (a.date ?? '').localeCompare(b.date ?? '');
			case 'phase':
				return dir * (a.phaseLabel ?? '').localeCompare(b.phaseLabel ?? '');
			default:
				return 0;
		}
	}

	/* === Grouping === */
	interface TaskGroup {
		key: string;
		label: string;
		color?: string;
		sublabel?: string;
		count: number;
		tasks: TaskRow[];
	}

	let groupedTasks = $derived.by((): TaskGroup[] => {
		const sorted = [...filteredTasks].sort(compareTasks);
		const groups = new Map<string, TaskGroup>();

		for (const task of sorted) {
			let key: string;
			let label: string;
			let color: string | undefined;
			let sublabel: string | undefined;

			switch (groupMode) {
				case 'track':
					key = task.trackId;
					label = task.trackLabel;
					color = task.trackColor;
					break;
				case 'date':
					key = task.date ?? '_unscheduled';
					label = task.date ? formatDateLabel(task.date) : 'Unscheduled';
					break;
				case 'project':
					key = task.projectId ? `${task.trackId}::${task.projectId}` : '_none';
					label = task.projectLabel ?? 'No project';
					color = task.trackColor;
					sublabel = task.trackLabel;
					break;
			}

			if (!groups.has(key)) {
				groups.set(key, { key, label, color, sublabel, count: 0, tasks: [] });
			}
			const group = groups.get(key)!;
			group.tasks.push(task);
			group.count = group.tasks.length;
		}

		// Sort groups
		const groupArr = Array.from(groups.values());
		if (groupMode === 'date') {
			groupArr.sort((a, b) => {
				if (a.key === '_unscheduled') return 1;
				if (b.key === '_unscheduled') return -1;
				return a.key.localeCompare(b.key);
			});
		} else {
			groupArr.sort((a, b) => a.label.localeCompare(b.label));
		}

		return groupArr;
	});

	function formatDateLabel(date: ISODate): string {
		const parsed = parseISO(date);
		const dayName = format(parsed, 'EEE').toUpperCase();
		const dayNum = format(parsed, 'd');
		if (date === today) return `${dayName} ${dayNum} (Today)`;
		return `${dayName} ${dayNum}`;
	}

	function formatScheduledDate(date?: ISODate): string {
		if (!date) return '';
		const parsed = parseISO(date);
		return format(parsed, 'EEE, MMM d, yyyy');
	}

	function formatTimeBadge(timeSpent: number, timeCommitment: number): string {
		if (timeCommitment === 0 && timeSpent === 0) return '';
		const { dividend, divisor, unit } = formatTimeArguments(timeSpent, timeCommitment);
		if (divisor > 0) return `${dividend} / ${divisor} ${unit}`;
		return `${dividend} ${unit}`;
	}

	/* === Task Actions === */
	function handleToggle(task: TaskRow) {
		if (!task.element.isTask) return;
		const newStatus = task.element.taskStatus === ' ' ? '/' : task.element.taskStatus === '/' ? 'x' : ' ';

		if (task.source === 'daily' && task.dailyDate !== undefined && task.dailyItemIndex !== undefined) {
			const trackData = parsedContent[task.dailyDate]?.[task.trackId];
			if (!trackData) return;
			const raw = reconstructRawText(
				task.element.text, true, newStatus,
				task.element.startTime, task.element.progress, task.element.duration, task.element.timeUnit,
				'\t- ', task.element.sourceRef, task.element.scheduledDate, task.element.blockId
			);
			const updatedItems = [...trackData.items];
			updatedItems[task.dailyItemIndex] = { ...task.element, taskStatus: newStatus, raw };
			dailyNoteService.updateTrackCell(task.dailyDate, task.trackId, { ...trackData, items: updatedItems });

			// Sync to project source if applicable (only for full complete/uncomplete, not partial)
			if (task.element.sourceRef && newStatus !== '/') {
				const refBlockId = extractSourceRefBlockId(task.element.sourceRef);
				if (refBlockId) {
					trackNoteService.closeProjectTaskByBlockId(task.trackId, refBlockId, newStatus as ' ' | 'x');
				}
			}
		} else if (task.source === 'project' && task.projectId && task.phaseId !== undefined && task.projectDataIndex !== undefined) {
			trackNoteService.togglePhaseData(task.trackId, task.projectId, task.phaseId, task.projectDataIndex);
		}
	}

	/* === Column visibility per group mode === */
	const showTrackCol = $derived(groupMode === 'date');
	const showDateCol = $derived(groupMode !== 'date');
	const showProjectCol = $derived(groupMode !== 'project');
	const showPhaseCol = $derived(groupMode === 'project');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="tasks-view">
	<div class="tasks-header">
		<h1>Tasks</h1>

		<div class="header-controls">
			<button
				bind:this={filterBtnEl}
				class="detail-toggle-btn"
				class:active={isFilterOpen || filterDateRangeFrom || filterDateRangeTo || !filterStatuses[' '] || !filterStatuses['/'] || filterStatuses['x'] || filterStatuses['-']}
				onclick={openFilterPopup}
				title="Filter tasks"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
				</svg>
			</button>

			{#if isFilterOpen}
				<Portal>
					<div class="tasks-filter-popup" style={portalStyle}>
						<div class="filter-section">
							<h4>Status</h4>
							<div class="status-options">
								<label><input type="checkbox" bind:checked={filterStatuses[' ']} /> Todo</label>
								<label><input type="checkbox" bind:checked={filterStatuses['/']} /> In Progress</label>
								<label><input type="checkbox" bind:checked={filterStatuses['x']} /> Done</label>
								<label><input type="checkbox" bind:checked={filterStatuses['-']} /> Cancelled</label>
							</div>
						</div>
						<div class="filter-section">
							<div class="date-header">
								<h4>Date Range</h4>
								{#if filterDateRangeFrom || filterDateRangeTo}
									<button class="clear-btn" onclick={() => { filterDateRangeFrom = null; filterDateRangeTo = null; }}>Clear</button>
								{/if}
							</div>
							<div class="datepicker-wrapper">
								<Datepicker 
									inline 
									range 
									bind:rangeFrom={filterDateRangeFrom} 
									bind:rangeTo={filterDateRangeTo} 
								/>
							</div>
						</div>
					</div>
				</Portal>
			{/if}

			<div class="group-toggle">
				<button
					class="group-btn"
					class:group-btn-active={groupMode === 'track'}
					onclick={() => groupMode = 'track'}
				>By track</button>
				<button
					class="group-btn"
					class:group-btn-active={groupMode === 'date'}
					onclick={() => groupMode = 'date'}
				>By date</button>
				<button
					class="group-btn"
					class:group-btn-active={groupMode === 'project'}
					onclick={() => groupMode = 'project'}
				>By project</button>
			</div>
		</div>
	</div>

	<div class="tasks-body">
		{#if groupedTasks.length === 0}
			<div class="empty-tasks-state">No tasks found</div>
		{/if}

		{#each groupedTasks as group (group.key)}
			<div class="task-group">
				<div class="group-header">
					<div class="group-header-row">
						<div class="group-title col-task">
							{#if group.color}
								<span class="group-color-bar" style={`background: ${group.color};`}></span>
							{/if}
							<span class="group-label">{group.label}</span>
							{#if group.sublabel}
								<span class="group-sublabel">{group.sublabel}</span>
							{/if}
							<span class="group-count">{group.count} {group.count === 1 ? 'item' : 'items'}</span>
						</div>
						<button class="col-header col-time" onclick={() => toggleSort('time')}>
							Time tracked {#if sortField === 'time'}<span class="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
						</button>
						{#if showDateCol}
							<button class="col-header col-scheduled" onclick={() => toggleSort('scheduled')}>
								Scheduled {#if sortField === 'scheduled'}<span class="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
							</button>
						{/if}
						{#if showProjectCol}
							<button class="col-header col-project" onclick={() => toggleSort('project')}>
								Project {#if sortField === 'project'}<span class="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
							</button>
						{/if}
						{#if showPhaseCol}
							<button class="col-header col-phase" onclick={() => toggleSort('phase')}>
								Phase {#if sortField === 'phase'}<span class="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
							</button>
						{/if}
						{#if showTrackCol}
							<button class="col-header col-track" onclick={() => toggleSort('track')}>
								Track {#if sortField === 'track'}<span class="sort-indicator">{sortDir === 'asc' ? '▲' : '▼'}</span>{/if}
							</button>
						{/if}
					</div>
				</div>

				{#each group.tasks as task}
					{@const timeBadge = formatTimeBadge(task.timeSpent, task.timeCommitment)}
					{@const isCompleted = task.element.taskStatus === 'x'}
					{@const isPartial = task.element.taskStatus === '/'}
					{@const isCancelled = task.element.taskStatus === '-'}
					<div class="task-row" class:task-completed={isCompleted} class:task-partial={isPartial} class:task-cancelled={isCancelled}>
						<div class="task-cell col-task">
							{#if task.element.taskStatus}
								<TaskCheckbox
									status={task.element.taskStatus}
									onToggle={() => handleToggle(task)}
									onCancel={() => {}}
								/>
							{/if}
							<span class="task-color-indicator" style={`background: ${task.trackColor};`}></span>
							<span class="task-text">{task.element.text}</span>
						</div>
						<div class="task-cell col-time">
							{#if timeBadge}
								<span class="time-badge" style={`border-color: ${task.trackColor};`}>{timeBadge}</span>
							{/if}
						</div>
						{#if showDateCol}
							<div class="task-cell col-scheduled">
								{formatScheduledDate(task.element.scheduledDate ?? task.date)}
							</div>
						{/if}
						{#if showProjectCol}
							<div class="task-cell col-project">
								{task.projectLabel ?? ''}
							</div>
						{/if}
						{#if showPhaseCol}
							<div class="task-cell col-phase">
								{task.phaseLabel ?? ''}
							</div>
						{/if}
						{#if showTrackCol}
							<div class="task-cell col-track">
								<span class="track-badge" style={`border-color: ${task.trackColor};`}>{task.trackLabel}</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.tasks-view {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	/* === Header === */
	.tasks-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 20px 8px;
		flex-shrink: 0;
	}

	.tasks-header h1 {
		font-size: 28px;
		font-weight: 700;
		color: #e6e6e6;
		margin: 0;
		flex-shrink: 0;
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.detail-toggle-btn {
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		width: 28px;
		height: 28px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		color: var(--text-muted);
	}

	.detail-toggle-btn:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.detail-toggle-btn.active svg {
		stroke: var(--interactive-accent);
	}

	/* === Filter Popup === */
	.tasks-filter-popup {
		color: var(--text-normal);
		font-size: 0.9em;
	}

	.filter-section h4 {
		margin: 0 0 8px 0;
		font-size: 1em;
		color: var(--text-muted);
	}

	.status-options {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.status-options label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.date-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	}

	.date-header h4 {
		margin: 0;
	}

	.clear-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 12px;
		padding: 2px 6px;
	}
	
	.clear-btn:hover {
		color: var(--text-normal);
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
	}

	.datepicker-wrapper {
		margin-top: 4px;
	}

	/* === Group Toggle === */
	.group-toggle {
		display: flex;
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		overflow: hidden;
	}

	.group-btn {
		background: var(--background-primary-alt);
		color: var(--text-muted);
		border: none;
		border-right: 1px solid var(--background-modifier-border);
		padding: 4px 12px;
		font-size: 0.82em;
		cursor: pointer;
		white-space: nowrap;
		height: 28px;
	}

	.group-btn:last-child {
		border-right: none;
	}

	.group-btn:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.group-btn-active {
		background: var(--interactive-accent);
		color: white;
	}

	.group-btn-active:hover {
		background: var(--interactive-accent);
		color: white;
	}

	/* === Body === */
	.tasks-body {
		flex: 1;
		overflow: auto;
		padding: 0 16px 16px;
	}

	.empty-tasks-state {
		color: var(--text-faint);
		font-style: italic;
		font-size: 0.85em;
		padding: 24px;
		text-align: center;
	}

	/* === Task Group === */
	.task-group {
		margin-bottom: 8px;
	}

	.group-header {
		position: sticky;
		top: 0;
		z-index: 2;
		padding-top: 12px;
	}

	.group-header-row {
		display: flex;
		align-items: baseline;
		border-bottom: 1px solid var(--background-modifier-border);
		padding: 0 4px;
	}

	.group-title {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.group-color-bar {
		width: 3px;
		height: 14px;
		border-radius: 2px;
		flex-shrink: 0;
		align-self: center;
	}

	.group-label {
		font-family: Georgia, 'Times New Roman', serif;
		font-size: 1em;
		font-weight: 700;
		color: var(--text-normal);
	}

	.group-sublabel {
		font-size: 0.75em;
		color: var(--text-faint);
	}

	.group-count {
		font-size: 0.75em;
		color: var(--text-faint);
	}

	/* === Column Headers === */
	.col-header {
		background: transparent;
		border: none;
		color: var(--text-faint);
		font-size: 0.75em;
		font-weight: 500;
		cursor: pointer;
		padding: 6px 8px;
		text-align: left;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 4px;
		box-shadow: none;
	}

	.col-header:hover {
		color: var(--text-muted);
	}

	.sort-indicator {
		font-size: 0.8em;
	}

	/* Column widths */
	.col-task {
		flex: 1;
		min-width: 0;
	}

	.col-time {
		width: 120px;
		flex-shrink: 0;
	}

	.col-scheduled {
		width: 160px;
		flex-shrink: 0;
	}

	.col-project {
		width: 140px;
		flex-shrink: 0;
	}

	.col-phase {
		width: 120px;
		flex-shrink: 0;
	}

	.col-track {
		width: 110px;
		flex-shrink: 0;
	}

	/* === Task Row === */
	.task-row {
		display: flex;
		align-items: center;
		padding: 0 4px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		min-height: 32px;
	}

	.task-row:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.task-completed .task-text,
	.task-cancelled .task-text {
		text-decoration: line-through;
		opacity: 0.5;
	}

	.task-partial .task-text {
		opacity: 0.7;
	}

	.task-cell {
		padding: 4px 8px;
		font-size: 0.85em;
		color: var(--text-normal);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.task-cell.col-task {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.task-color-indicator {
		width: 3px;
		height: 16px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.task-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* === Badges === */
	.time-badge {
		font-size: 0.85em;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid;
		white-space: nowrap;
	}

	.track-badge {
		font-size: 0.82em;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid;
		white-space: nowrap;
	}

	.task-cell.col-scheduled {
		color: var(--text-muted);
		font-size: 0.82em;
	}

	.task-cell.col-project {
		color: var(--text-muted);
		font-size: 0.82em;
	}

	.task-cell.col-phase {
		color: var(--text-muted);
		font-size: 0.82em;
	}
</style>
