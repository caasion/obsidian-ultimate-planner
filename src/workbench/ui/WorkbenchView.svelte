<script lang="ts">
	import type { Track, Project, Element, ISODate, Phase, TrackData } from "src/plugin/types";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";
	import type { DailyNoteService } from "src/planner/logic/dailyNote";
	import type { ProjectCardFunctions } from "./components/ProjectCard.svelte";
	import type { HabitFunctions } from "./components/HabitElement.svelte";
	import ProjectHabitCard from "./components/ProjectHabitCard.svelte";
	import DataTaskElement from "src/components/DataTaskElement.svelte";
	import EditableText from "src/components/EditableText.svelte";
	import EditableMarkdownText from "src/components/EditableMarkdownText.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import TrackDetailPanel from "./components/TrackDetailPanel.svelte";
	import { getISODate, getISODates, isProjectActive, isPhaseActive, isTrackActiveByProjects } from "src/plugin/helpers";
	import { isValid, parseISO } from "date-fns";
	import { type App } from "obsidian";
	import { onMount, untrack } from "svelte";

	interface ProjectViewProps {
		app: App;
		trackNoteService: TrackNoteService;
		dailyNoteService: DailyNoteService;
	}

	let { app, trackNoteService, dailyNoteService }: ProjectViewProps = $props();

	const trackStore = trackNoteService.parsedTracksContent;
	const parsedTracks = $derived($trackStore);
	const sortedTracks = $derived(
		Object.values(parsedTracks).sort((a, b) => {
			// Active tracks first
			const aActive = isTrackActiveByProjects(a) ? 0 : 1;
			const bActive = isTrackActiveByProjects(b) ? 0 : 1;
			if (aActive !== bActive) return aActive - bActive;
			const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
			const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.label.localeCompare(b.label);
		})
	);

	// Selection state: either a track or a project
	type SelectionMode = 'track' | 'project';
	let selectionMode = $state<SelectionMode>('project');
	let selectedTrackId = $state<string | undefined>(undefined);
	let selectedProjectId = $state<string | undefined>(undefined);

	// Sidebar collapse state per track
	let collapsedTracks = $state<Set<string>>(new Set());

	function toggleTrackCollapse(trackId: string) {
		const next = new Set(collapsedTracks);
		if (next.has(trackId)) next.delete(trackId);
		else next.add(trackId);
		collapsedTracks = next;
	}

	// Auto-select first project once data is available
	let hasAutoSelected = false;
	$effect(() => {
		const tracks = sortedTracks;
		if (tracks.length === 0) return;
		untrack(() => {
			if (hasAutoSelected) return;
			for (const track of tracks) {
				const projects = Object.values(track.projects);
				if (projects.length > 0) {
					selectedTrackId = track.id;
					selectedProjectId = projects[0].id;
					selectionMode = 'project';
					hasAutoSelected = true;
					return;
				}
			}
			// If no projects, select first track
			if (tracks.length > 0) {
				selectedTrackId = tracks[0].id;
				selectionMode = 'track';
				hasAutoSelected = true;
			}
		});
	});

	// Derived selected items
	let selectedTrack = $derived(selectedTrackId ? parsedTracks[selectedTrackId] : undefined);
	let selectedProject = $derived(
		selectedTrack && selectedProjectId && selectionMode === 'project' ? selectedTrack.projects[selectedProjectId] : undefined
	);

	function selectProject(trackId: string, projectId: string) {
		selectedTrackId = trackId;
		selectedProjectId = projectId;
		selectionMode = 'project';
	}

	function selectTrack(trackId: string) {
		selectedTrackId = trackId;
		selectedProjectId = undefined;
		selectionMode = 'track';
	}

	// Format date range for display
	function formatDateRange(track: Track): string {
		if (!track.effective || track.effective.length === 0) return '';
		const first = track.effective[0];
		const start = first.start;
		const end = first.end;
		const formatDate = (d: string) => {
			const parsed = parseISO(d);
			if (!isValid(parsed)) return d;
			return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		};
		return end ? `${formatDate(start)} - ${formatDate(end)}` : `${formatDate(start)} - Present`;
	}

	// Create project functions
	function createProjectFunctions(trackId: string, projectId: string): ProjectCardFunctions {
		return {
			onLabelEdit: (label) => trackNoteService.updateProjectLabel(trackId, projectId, label),
			onDescriptionEdit: (desc) => trackNoteService.updateProjectDescription(trackId, projectId, desc),
			onOpenFile: () => trackNoteService.openProjectFile(trackId, projectId),
			onDelete: () => trackNoteService.deleteProject(trackId, projectId),
			onHabitAdd: () => trackNoteService.addProjectHabit(trackId, projectId),
			onPhaseAdd: () => trackNoteService.addProjectPhase(trackId, projectId),
			onPhaseLabelEdit: (phaseId, label) => trackNoteService.updateProjectPhaseLabel(trackId, projectId, phaseId, label),
			onPhaseDateEdit: (phaseId, startDate, endDate) => trackNoteService.updateProjectPhaseDates(trackId, projectId, phaseId, startDate, endDate),
			onPhaseDelete: (phaseId) => trackNoteService.deleteProjectPhase(trackId, projectId, phaseId),
			onPhaseDataAdd: (phaseId) => trackNoteService.addPhaseData(trackId, projectId, phaseId),
			onPhaseDataUpdate: (phaseId, index, el) => trackNoteService.updatePhaseData(trackId, projectId, phaseId, index, el),
			onPhaseDataToggle: (phaseId, index) => trackNoteService.togglePhaseData(trackId, projectId, phaseId, index),
			onPhaseDataCancel: (phaseId, index) => trackNoteService.cancelPhaseData(trackId, projectId, phaseId, index),
			onPhaseDataDelete: (phaseId, index) => trackNoteService.deletePhaseData(trackId, projectId, phaseId, index),
		};
	}

	function createHabitFunctions(trackId: string, projectId: string, habitId: string): HabitFunctions {
		return {
			onEdit: (habit) => trackNoteService.updateProjectHabit(trackId, projectId, habitId, habit),
			onDelete: () => trackNoteService.deleteProjectHabit(trackId, projectId, habitId),
		};
	}

	// Detail panel helpers
	function toDate(iso?: ISODate): Date | undefined {
		if (!iso) return undefined;
		const parsed = parseISO(iso);
		return isValid(parsed) ? parsed : undefined;
	}

	let hideCompletedPhase = $state(false);

	function isCompletedElement(el: Element): boolean {
		return el.taskStatus === 'x' || el.taskStatus === '-';
	}

	function handlePhaseRangeSelect(phaseId: string, selection: unknown) {
		if (!selectedTrackId || !selectedProjectId) return;
		const range = selection as { from?: Date; to?: Date } | undefined;
		if (!range?.from) return;
		const fns = createProjectFunctions(selectedTrackId, selectedProjectId);
		fns.onPhaseDateEdit?.(
			phaseId,
			getISODate(range.from),
			range.to ? getISODate(range.to) : undefined
		);
	}

	// Daily note data for reference counting
	const today = getISODate(new Date());
	let dailyDates = $derived<ISODate[]>(getISODates(today, 12, 1)); // ~12 weeks of data for reference lookups

	let parsedContentStore = $derived(dailyNoteService.parsedContent);
	let parsedContent = $derived<Record<ISODate, Record<string, TrackData>>>($parsedContentStore);

	$effect(() => {
		dailyNoteService.loadMultipleDates(dailyDates);
	});

	// Build a map of blockId -> count of daily note appearances
	let refCountMap = $derived.by((): Map<string, number> => {
		const map = new Map<string, number>();
		for (const dateData of Object.values(parsedContent)) {
			for (const trackData of Object.values(dateData)) {
				for (const element of trackData.items) {
					if (element.blockId) {
						map.set(element.blockId, (map.get(element.blockId) ?? 0) + 1);
					}
				}
			}
		}
		return map;
	});

	function getRefCount(blockId?: string): number {
		if (!blockId) return 0;
		return refCountMap.get(blockId) ?? 0;
	}

	// Load track content and setup file watchers once on mount
	onMount(() => {
		trackNoteService.loadAllTrackContent();
		trackNoteService.setupFileWatchers();
		return () => trackNoteService.cleanupFileWatchers();
	});

	// Sidebar collapse/expand all
	let sidebarCollapsed = $state(false);
</script>

<div class="project-view">
	<div class="project-header">
		<div style="display: flex; align-items: center; gap: 12px;">
			<h1>Workbench</h1>
			<button class="sidebar-toggle" onclick={() => sidebarCollapsed = !sidebarCollapsed} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					{#if sidebarCollapsed}
						<path d="m9 18 6-6-6-6"/>
					{:else}
						<path d="m15 18-6-6 6-6"/>
					{/if}
				</svg>
			</button>
		</div>
	</div>

	<div class="project-body">
	<!-- Sidebar -->
	<div class="sidebar" class:sidebar-collapsed={sidebarCollapsed}>
		{#if !sidebarCollapsed}
			<div class="sidebar-tree">
				{#each sortedTracks as track}
					{@const isCollapsed = collapsedTracks.has(track.id)}
					{@const trackActive = isTrackActiveByProjects(track)}
					{@const projects = Object.values(track.projects).sort((a, b) => {
						const aActive = isProjectActive(a) ? 0 : 1;
						const bActive = isProjectActive(b) ? 0 : 1;
						return aActive - bActive;
					})}
					<div class="tree-track">
						<div class="tree-track-header-row">
							<button
								class="tree-track-collapse-btn"
								onclick={() => toggleTrackCollapse(track.id)}
							>
								<span class="tree-toggle-icon">
									{#if isCollapsed}
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
									{/if}
								</span>
							</button>
							<button
								class="tree-track-label-btn"
								class:tree-track-label-active={selectionMode === 'track' && selectedTrackId === track.id}
								onclick={() => selectTrack(track.id)}
							>
								<span class="tree-track-status" class:active={trackActive}>{trackActive ? '●' : '○'}</span>
								<span class="tree-track-label" style={`color: ${track.color};`}>{track.label}</span>
							</button>
						</div>
						{#if !isCollapsed}
							<div class="tree-projects" style={`border-color: ${track.color}80;`}>
								{#each projects as project}
									<button
										class="tree-project-item"
										class:tree-project-active={selectionMode === 'project' && selectedTrackId === track.id && selectedProjectId === project.id}
										onclick={() => selectProject(track.id, project.id)}
									>
										<span class="tree-project-status" class:active={isProjectActive(project)}>{isProjectActive(project) ? '●' : '○'}</span>
										<span class="tree-project-label">{project.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Detail Panel -->
	<div class="detail-panel">
		{#if selectionMode === 'track' && selectedTrack && selectedTrackId}
			<TrackDetailPanel
				track={selectedTrack}
				trackId={selectedTrackId}
				{trackNoteService}
				{app}
			/>
		{:else if selectionMode === 'project' && selectedTrack && selectedProject && selectedTrackId && selectedProjectId}
			{@const color = selectedTrack.color}
			{@const fns = createProjectFunctions(selectedTrackId, selectedProjectId)}
			<div class="detail-content">
				<!-- Project Header -->
				<div class="detail-header">
					<div class="detail-header-top">
						<span class="detail-track-label" style={`color: ${color};`}>{selectedTrack.label}</span>
						<button class="detail-view-file-btn" onclick={fns.onOpenFile} title="View project file">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link-icon lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
							View Project File
						</button>
					</div>
					<EditableText
						value={selectedProject.label}
						onSave={(label) => fns.onLabelEdit(label)}
						onCtrlClick={fns.onOpenFile}
						placeholder="Project name..."
						class="detail-project-title"
					/>
					<EditableMarkdownText
						value={selectedProject.description}
						onSave={(desc) => fns.onDescriptionEdit(desc)}
						placeholder="Project description..."
						{app}
						sourcePath={selectedProject.file?.path ?? ""}
						class="detail-project-description"
					/>
				</div>

				<!-- Habits Section -->
				<div class="detail-section">
					<div class="detail-section-header">
						<h3 class="detail-section-title">Habits</h3>
						<div class="detail-section-controls">
							<button class="detail-add-btn" onclick={fns.onHabitAdd} title="Add habit">
								+
							</button>
						</div>
					</div>
					<div class="habits-grid">
						{#each Object.values(selectedProject.habits) as habit}
							<ProjectHabitCard
								{habit}
								{color}
								habitFunctions={createHabitFunctions(selectedTrackId, selectedProjectId, habit.id)}
							/>
						{/each}
						{#if Object.keys(selectedProject.habits).length === 0}
							<button class="define-habit-btn" onclick={fns.onHabitAdd}>
								+ define habit
							</button>
						{/if}
					</div>
				</div>

				<!-- Phases / Tasks Section -->
				<div class="detail-section phases-section">
					<div class="detail-section-header">
						<h3 class="detail-section-title">Tasks</h3>
						<div class="detail-section-controls">
							<button
								class="detail-toggle-btn"
								class:active={hideCompletedPhase}
								onclick={() => hideCompletedPhase = !hideCompletedPhase}
								title={hideCompletedPhase ? "Show completed" : "Hide completed"}
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									{#if hideCompletedPhase}
										<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
										<path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
										<path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
										<line x1="2" y1="2" x2="22" y2="22"/>
									{:else}
										<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
										<circle cx="12" cy="12" r="3"/>
									{/if}
								</svg>
							</button>
							<button class="detail-add-btn" onclick={() => fns.onPhaseAdd()} title="Add phase">+</button>
						</div>
					</div>
					{#if selectedProject.phases.length === 1}
						{@const phase = selectedProject.phases[0]}
						{@const visiblePhaseData = hideCompletedPhase ? phase.data.map((el, i) => ({el, i})).filter(({el}) => !isCompletedElement(el)) : phase.data.map((el, i) => ({el, i}))}
						<div class="single-phase-tasks">
							{#each visiblePhaseData as {el: element, i: idx} (idx)}
								{@const refCount = getRefCount(element.blockId)}
								<DataTaskElement
									{element}
									index={idx}
									{color}
									{refCount}
									onUpdate={(i, el) => fns.onPhaseDataUpdate(phase.id, i, el)}
									onToggle={(i) => fns.onPhaseDataToggle(phase.id, i)}
									onCancel={(i) => fns.onPhaseDataCancel(phase.id, i)}
									onDelete={(i) => fns.onPhaseDataDelete(phase.id, i)}
								/>
							{/each}
							{#if visiblePhaseData.length === 0 && phase.data.length > 0}
								<div class="phase-empty-state">All tasks completed</div>
							{/if}
							<button class="phase-add-task-btn" onclick={() => fns.onPhaseDataAdd(phase.id)}>+ add</button>
						</div>
					{:else if selectedProject.phases.length > 1}
						{@const sortedPhases = [...selectedProject.phases].sort((a, b) => {
							const aActive = isPhaseActive(a) ? 0 : 1;
							const bActive = isPhaseActive(b) ? 0 : 1;
							if (aActive !== bActive) return aActive - bActive;
							const aDate = a.startDate ?? '';
							const bDate = b.startDate ?? '';
							return aDate.localeCompare(bDate);
						})}
						<div class="phases-scroll-container">
							<div class="phases-scroll-track">
								{#each sortedPhases as phase (phase.id)}
									{@const phaseTaskCount = phase.data.length}
									{@const phaseCompletedCount = phase.data.filter(el => el.taskStatus === 'x').length}
									{@const visiblePhaseData = hideCompletedPhase ? phase.data.map((el, i) => ({el, i})).filter(({el}) => !isCompletedElement(el)) : phase.data.map((el, i) => ({el, i}))}
									{@const active = isPhaseActive(phase)}
									<div class="phase-card" class:phase-card-active={active} style={`border-color: ${color};`}>
										<div class="phase-card-header">
											<div class="phase-card-header-left">
												<div class="phase-card-title-block">
													<EditableText
														value={phase.label}
														onSave={(label) => fns.onPhaseLabelEdit(phase.id, label)}
														placeholder="Phase name..."
														class="phase-card-label"
													/>
													<div class="phase-card-dates">
														<Datepicker
															range
															rangeFrom={toDate(phase.startDate)}
															rangeTo={toDate(phase.endDate)}
															openEndedLabel="?"
															rangeSeparator=" - "
															onselect={(sel) => handlePhaseRangeSelect(phase.id, sel)}
															showToggleButton={false}
															inputProps={{ readonly: true }}
															inputClass="phase-date-input"
														/>
													</div>
												</div>
											</div>
											<div class="phase-card-header-right">
												<span class="phase-task-count" style={`color: ${color};`}>
													{phaseCompletedCount}/{phaseTaskCount}
												</span>
												<button class="phase-delete-btn" onclick={() => fns.onPhaseDelete(phase.id)} title="Delete phase">
													<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
												</button>
											</div>
										</div>
										<div class="phase-card-tasks">
											{#each visiblePhaseData as {el: element, i: idx} (idx)}
												{@const refCount = getRefCount(element.blockId)}
												<DataTaskElement
													{element}
													index={idx}
													{color}
													{refCount}
													onUpdate={(i, el) => fns.onPhaseDataUpdate(phase.id, i, el)}
													onToggle={(i) => fns.onPhaseDataToggle(phase.id, i)}
													onCancel={(i) => fns.onPhaseDataCancel(phase.id, i)}
													onDelete={(i) => fns.onPhaseDataDelete(phase.id, i)}
												/>
											{/each}
											{#if visiblePhaseData.length === 0 && phaseTaskCount > 0}
												<div class="phase-empty-state">All tasks completed</div>
											{/if}
										</div>
										<button class="phase-add-task-btn" onclick={() => fns.onPhaseDataAdd(phase.id)}>+ add</button>
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="phase-empty-state">No phases yet.</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="detail-empty">
				<p>Select a track or project from the sidebar</p>
			</div>
		{/if}
	</div>
	</div>
</div>

<style>
	.project-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* === Header === */
	.project-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 20px 8px;
		flex-shrink: 0;
	}

	.project-header h1 {
		font-size: 28px;
		font-weight: 700;
		color: #e6e6e6;
		margin: 0;
		flex-shrink: 0;
	}

	/* === Body === */
	.project-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* Sidebar */
	.sidebar {
		width: 220px;
		min-width: 220px;
		background: rgba(255, 255, 255, 0.03);
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		transition: width 200ms ease, min-width 200ms ease;
	}

	.sidebar-collapsed {
		width: 0;
		min-width: 0;
		border-right: none;
	}

	.sidebar-toggle {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		display: flex;
		align-items: center;
		box-shadow: none;
	}

	.sidebar-toggle:hover {
		color: var(--text-normal);
	}

	.sidebar-tree {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.tree-track {
		margin-bottom: 2px;
	}

	.tree-track-header-row {
		display: flex;
		align-items: center;
		width: 100%;
	}

	.tree-track-collapse-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 4px 4px 4px 12px;
		box-shadow: none;
		flex-shrink: 0;
	}

	.tree-track-collapse-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tree-track-label-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px 4px 4px;
		flex: 1;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		justify-content: start;
		box-shadow: none;
		border-radius: 4px;
	}

	.tree-track-label-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tree-track-label-active {
		background: rgba(255, 255, 255, 0.1);
	}

	.tree-toggle-icon {
		color: var(--text-muted);
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tree-track-label {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tree-track-status {
		font-size: 0.6em;
		color: var(--text-faint);
		flex-shrink: 0;
	}

	.tree-track-status.active {
		color: var(--color-green, #4CAF50);
	}

	.tree-project-status {
		font-size: 0.55em;
		color: var(--text-faint);
		flex-shrink: 0;
		margin-right: 4px;
	}

	.tree-project-status.active {
		color: var(--color-green, #4CAF50);
	}

	.tree-projects {
		margin-left: 18px;
		padding-left: 10px;
		border-left: 1px solid;
	}

	.tree-project-item {
		display: flex;
		align-items: center;
		padding: 3px 8px;
		width: 100%;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		border-radius: 4px;
		justify-content: start;
		box-shadow: none;
	}

	.tree-project-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.tree-project-active {
		background: rgba(255, 255, 255, 0.1);
	}

	.tree-project-label {
		font-size: 0.9em;
		color: var(--text-normal);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Detail Panel */
	.detail-panel {
		flex: 1;
		overflow-y: auto;
		min-width: 0;
	}

	.detail-content {
		padding: 24px 32px;
	}

	.detail-header {
		margin-bottom: 32px;
	}

	.detail-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.detail-track-label {
		font-size: 0.8em;
		font-weight: 500;
	}

	.detail-view-file-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		padding: 4px 10px;
		color: var(--text-muted);
		font-size: 0.8em;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.detail-view-file-btn:hover {
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-normal);
	}

	:global(.detail-project-title) {
		font-size: 1.8em;
		font-weight: 700;
		width: 100%;
	}

	:global(.detail-project-description) {
		font-size: 0.9em;
		color: var(--text-muted);
		margin-top: 8px;
	}

	.detail-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-faint);
		font-style: italic;
	}

	/* Sections */
	.detail-section {
		margin-bottom: 32px;
	}

	.detail-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.detail-section-title {
		font-size: 1.1em;
		font-weight: 600;
		color: var(--text-normal);
		margin: 0;
	}

	.detail-section-controls {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.detail-add-btn {
		background: transparent;
		color: var(--text-muted);
		border: none;
		width: 24px;
		height: 24px;
		font-size: 1.2em;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border-radius: 4px;
		box-shadow: none;
	}

	.detail-add-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-normal);
	}

	.detail-toggle-btn {
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		width: 24px;
		height: 24px;
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

	/* Habits Grid */
	.habits-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.define-habit-btn {
		background: rgba(255, 255, 255, 0.03);
		border: 1px dashed rgba(255, 255, 255, 0.15);
		border-radius: 6px;
		padding: 12px 20px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.85em;
		transition: all 150ms ease;
	}

	.define-habit-btn:hover {
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.25);
	}

	.single-phase-tasks {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	/* Phases Section - allow horizontal scroll beyond detail-content max-width */
	.phases-section {
		max-width: none;
		margin-left: -32px;
		margin-right: -32px;
		padding-left: 32px;
		padding-right: 32px;
	}

	.phases-scroll-container {
		overflow-x: auto;
		padding-bottom: 8px;
	}

	.phases-scroll-track {
		display: flex;
		gap: 12px;
		min-width: min-content;
	}

	.phase-card {
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		border-top: 3px solid;
		padding: 12px;
		width: 280px;
		min-width: 280px;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
	}

	.phase-card-active {
		background: rgba(255, 255, 255, 0.06);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-green, #4CAF50) 30%, transparent);
	}

	.phase-card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 6px;
		margin-bottom: 10px;
	}

	.phase-card-header-left {
		display: flex;
		align-items: flex-start;
		gap: 4px;
		flex: 1;
		min-width: 0;
	}

	.phase-card-title-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}

	.phase-card-dates {
		display: flex;
		align-items: center;
	}

	.phase-card-header-right {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	:global(.phase-card-label) {
		font-size: 0.95em;
		font-weight: 600;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.phase-task-count {
		font-size: 0.8em;
		font-weight: 600;
		white-space: nowrap;
		flex-shrink: 0;
	}

	:global(.phase-date-input) {
		width: auto;
		max-width: 140px;
		border: none;
		background: transparent;
		padding: 0;
		cursor: pointer;
		font-size: 0.75em;
		color: var(--text-faint);
	}

	:global(.phase-date-input:hover) {
		color: var(--text-normal);
	}

	.phase-delete-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 2px;
		border-radius: 3px;
		opacity: 0;
		display: flex;
		align-items: center;
		box-shadow: none;
	}

	.phase-card:hover .phase-delete-btn {
		opacity: 0.6;
	}

	.phase-delete-btn:hover {
		opacity: 1 !important;
		color: var(--text-error);
	}

	.phase-card-tasks {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-height: 0;
		overflow-y: auto;
	}

	.phase-empty-state {
		color: var(--text-faint);
		font-style: italic;
		font-size: 0.82em;
		padding: 8px 4px;
		text-align: center;
	}

	.phase-add-task-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8em;
		padding: 4px 6px;
		margin-top: 6px;
		border-radius: 4px;
		box-shadow: none;
		flex-shrink: 0;
	}

	.phase-add-task-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-normal);
	}
</style>
