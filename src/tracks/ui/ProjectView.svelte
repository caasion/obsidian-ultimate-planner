<script lang="ts">
	import type { Track, Project, Element, ISODate, Phase } from "src/plugin/types";
	import type { TrackNoteService } from "../logic/trackNote";
	import type { ProjectCardFunctions } from "./ProjectCard.svelte";
	import type { HabitFunctions } from "./HabitElement.svelte";
	import ProjectHabitCard from "./ProjectHabitCard.svelte";
	import DataTaskElement from "./DataTaskElement.svelte";
	import EditableText from "src/components/EditableText.svelte";
	import EditableMarkdownText from "src/components/EditableMarkdownText.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import { getISODate } from "src/plugin/helpers";
	import { isValid, parseISO } from "date-fns";
	import { type App } from "obsidian";
	import { ConfirmationModal } from "src/plugin/ConfirmationModal";
	import { dropLineDnd } from "src/components/dropLineDnd";
	import { onMount, untrack } from "svelte";

	interface ProjectViewProps {
		app: App;
		trackNoteService: TrackNoteService;
	}

	let { app, trackNoteService }: ProjectViewProps = $props();

	const trackStore = trackNoteService.parsedTracksContent;
	const parsedTracks = $derived($trackStore);
	const sortedTracks = $derived(
		Object.values(parsedTracks).sort((a, b) => {
			const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
			const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.label.localeCompare(b.label);
		})
	);

	// Selected project state
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
					hasAutoSelected = true;
					return;
				}
			}
		});
	});

	// Derived selected project
	let selectedTrack = $derived(selectedTrackId ? parsedTracks[selectedTrackId] : undefined);
	let selectedProject = $derived(
		selectedTrack && selectedProjectId ? selectedTrack.projects[selectedProjectId] : undefined
	);

	function selectProject(trackId: string, projectId: string) {
		selectedTrackId = trackId;
		selectedProjectId = projectId;
	}

	function isProjectActive(project: Project): boolean {
		const today = getISODate(new Date());
		if (!project.hasPhases) {
			return today >= project.startDate && (project.endDate ? today <= project.endDate : true);
		} else {
			return project.phases.some(p =>
				p.startDate && p.startDate <= today && (!p.endDate || p.endDate >= today)
			);
		}
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
			onStartDateEdit: (date) => trackNoteService.updateProjectStartDate(trackId, projectId, date),
			onEndDateEdit: (date) => trackNoteService.updateProjectEndDate(trackId, projectId, date),
			onDelete: () => trackNoteService.deleteProject(trackId, projectId),
			onHabitAdd: () => trackNoteService.addProjectHabit(trackId, projectId),
			onDataAdd: () => trackNoteService.addProjectData(trackId, projectId),
			onDataUpdate: (index, el) => trackNoteService.updateProjectData(trackId, projectId, index, el),
			onDataToggle: (index) => {
				const track = trackNoteService.getTrack(trackId);
				const element = track?.projects[projectId]?.data[index];
				if (!element?.isTask) return;
				const newStatus = element.taskStatus === 'x' ? ' ' : 'x';
				trackNoteService.updateProjectData(trackId, projectId, index, { taskStatus: newStatus });
			},
			onDataCancel: (index) => {
				const track = trackNoteService.getTrack(trackId);
				const element = track?.projects[projectId]?.data[index];
				if (!element?.isTask) return;
				trackNoteService.updateProjectData(trackId, projectId, index, { taskStatus: '-' });
			},
			onDataDelete: (index) => trackNoteService.deleteProjectData(trackId, projectId, index),
			onPhaseAdd: () => trackNoteService.addProjectPhase(trackId, projectId),
			onPhaseLabelEdit: (phaseId, label) => trackNoteService.updateProjectPhaseLabel(trackId, projectId, phaseId, label),
			onPhaseDateEdit: (phaseId, startDate, endDate) => trackNoteService.updateProjectPhaseDates(trackId, projectId, phaseId, startDate, endDate),
			onPhaseDelete: (phaseId) => trackNoteService.deleteProjectPhase(trackId, projectId, phaseId),
			onPhaseReorder: (fromIndex, toIndex) => trackNoteService.reorderProjectPhase(trackId, projectId, fromIndex, toIndex),
			onPhaseDataAdd: (phaseId) => trackNoteService.addPhaseData(trackId, projectId, phaseId),
			onPhaseDataUpdate: (phaseId, index, el) => trackNoteService.updatePhaseData(trackId, projectId, phaseId, index, el),
			onPhaseDataToggle: (phaseId, index) => trackNoteService.togglePhaseData(trackId, projectId, phaseId, index),
			onPhaseDataCancel: (phaseId, index) => trackNoteService.cancelPhaseData(trackId, projectId, phaseId, index),
			onPhaseDataDelete: (phaseId, index) => trackNoteService.deletePhaseData(trackId, projectId, phaseId, index),
			onEnablePhases: () => trackNoteService.toggleProjectPhases(trackId, projectId, true),
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

	// Phase expand/collapse
	function getDefaultExpandedId(phases: Phase[]): string | undefined {
		if (phases.length === 0) return undefined;
		const today = getISODate(new Date());
		const activeByDate = phases.find(p =>
			p.startDate && p.startDate <= today && (!p.endDate || p.endDate >= today)
		);
		if (activeByDate) return activeByDate.id;
		const future = phases
			.filter(p => p.startDate && p.startDate > today)
			.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
		if (future.length > 0) return future[0].id;
		const unscheduled = phases.find(p => !p.startDate);
		if (unscheduled) return unscheduled.id;
		return phases[0]?.id;
	}

	let expandedPhaseId = $state<string | undefined>(undefined);
	let hideCompletedPhase = $state(false);
	let hideCompleted = $state(false);

	// Reset expanded phase when selected project changes
	let prevProjectId: string | undefined = undefined;
	$effect(() => {
		const id = selectedProjectId;
		const project = selectedProject;
		untrack(() => {
			if (id !== prevProjectId) {
				prevProjectId = id;
				if (project?.hasPhases) {
					expandedPhaseId = getDefaultExpandedId(project.phases);
				}
			}
		});
	});

	function isCompletedElement(el: Element): boolean {
		return el.taskStatus === 'x' || el.taskStatus === '-';
	}

	let visibleTasks = $derived(
		selectedProject
			? (hideCompleted
				? selectedProject.data.map((el, i) => ({ el, i })).filter(({ el }) => !isCompletedElement(el))
				: selectedProject.data.map((el, i) => ({ el, i })))
			: []
	);

	function togglePhase(phaseId: string) {
		expandedPhaseId = expandedPhaseId === phaseId ? undefined : phaseId;
	}

	function handleProjectRangeSelect(selection: unknown) {
		if (!selectedTrackId || !selectedProjectId) return;
		const range = selection as { from?: Date; to?: Date } | undefined;
		if (!range?.from) return;
		const fns = createProjectFunctions(selectedTrackId, selectedProjectId);
		fns.onStartDateEdit(getISODate(range.from));
		fns.onEndDateEdit(range.to ? getISODate(range.to) : null);
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

	function confirmEnablePhases() {
		if (!selectedTrackId || !selectedProjectId) return;
		const fns = createProjectFunctions(selectedTrackId, selectedProjectId);
		new ConfirmationModal(
			app,
			() => fns.onEnablePhases?.(),
			'Enable Phases',
			'This will organize your tasks into phases. Existing tasks will be moved into "Phase 1". To revert, you will need to edit the markdown file manually.'
		).open();
	}

	// Phase drag and drop
	function handlePhaseDndFinalize(_reordered: Phase[], fromIndex: number, toIndex: number) {
		if (!selectedTrackId || !selectedProjectId) return;
		expandedPhaseId = undefined;
		const fns = createProjectFunctions(selectedTrackId, selectedProjectId);
		fns.onPhaseReorder?.(fromIndex, toIndex);
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
	<!-- Sidebar -->
	<div class="sidebar" class:sidebar-collapsed={sidebarCollapsed}>
		<div class="sidebar-header">
			{#if !sidebarCollapsed}
				<span class="sidebar-title">Projects</span>
			{/if}
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
		{#if !sidebarCollapsed}
			<div class="sidebar-tree">
				{#each sortedTracks as track}
					{@const isCollapsed = collapsedTracks.has(track.id)}
					{@const projects = Object.values(track.projects)}
					<div class="tree-track">
						<button
							class="tree-track-header"
							onclick={() => toggleTrackCollapse(track.id)}
						>
							<span class="tree-toggle-icon">
								{#if isCollapsed}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
								{:else}
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
								{/if}
							</span>
							<span class="tree-track-label" style={`color: ${track.color};`}>{track.label}</span>
						</button>
						{#if !isCollapsed}
							<div class="tree-projects" style={`border-color: ${track.color}80;`}>
								{#each projects as project}
									<button
										class="tree-project-item"
										class:tree-project-active={selectedTrackId === track.id && selectedProjectId === project.id}
										onclick={() => selectProject(track.id, project.id)}
									>
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
		{#if selectedTrack && selectedProject && selectedTrackId && selectedProjectId}
			{@const color = selectedTrack.color}
			{@const fns = createProjectFunctions(selectedTrackId, selectedProjectId)}
			<div class="detail-content">
				<!-- Project Header -->
				<div class="detail-header">
					<div class="detail-header-top">
						<span class="detail-track-label" style={`color: ${color};`}>{selectedTrack.label}</span>
						<button class="detail-view-file-btn" onclick={fns.onOpenFile} title="View project file">
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
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
					{#if !selectedProject.hasPhases}
						<div class="detail-date-range">
							<span class="detail-date-label">Span</span>
							<Datepicker
								range
								rangeFrom={toDate(selectedProject.startDate)}
								rangeTo={toDate(selectedProject.endDate)}
								openEndedLabel="Present"
								rangeSeparator=" - "
								onselect={handleProjectRangeSelect}
								showToggleButton={false}
								inputProps={{ readonly: true }}
								inputClass="detail-date-input"
							/>
						</div>
					{/if}
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

				<!-- Phases Section -->
				{#if selectedProject.hasPhases}
					<div class="detail-section">
						<div class="detail-section-header">
							<h3 class="detail-section-title">Phases</h3>
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
								<button class="detail-add-btn" onclick={() => fns.onPhaseAdd?.()} title="Add phase">+</button>
							</div>
						</div>
						<div class="phases-grid">
							{#if selectedProject.phases.length > 0}
								<div
									class="phases-dnd-container"
									use:dropLineDnd={{ items: selectedProject.phases, handleSelector: '.phase-drag-handle', lineColor: color, direction: 'auto', onFinalize: handlePhaseDndFinalize }}
								>
									{#each selectedProject.phases as phase, index (phase.id)}
										{@const isExpanded = expandedPhaseId === phase.id}
										{@const phaseTaskCount = phase.data.length}
										{@const phaseCompletedCount = phase.data.filter(el => el.taskStatus === 'x').length}
										<div class="phase-card" style={`border-left: 3px solid ${color};`}>
											<div class="phase-card-header">
												<div class="phase-drag-handle" title="Drag to reorder">
													<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
												</div>
												<button class="phase-card-toggle" onclick={() => togglePhase(phase.id)}>
													{#if isExpanded}&#9660;{:else}&#9654;{/if}
												</button>
												<EditableText
													value={phase.label}
													onSave={(label) => fns.onPhaseLabelEdit?.(phase.id, label)}
													placeholder="Phase name..."
													class="phase-card-label"
												/>
												{#if phaseTaskCount > 0}
													<span class="phase-task-count" style={`background: ${color}40;`}>
														{phaseCompletedCount}/{phaseTaskCount}
													</span>
												{/if}
												<div class="phase-card-right">
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
													<button class="phase-delete-btn" onclick={() => fns.onPhaseDelete?.(phase.id)} title="Delete phase">
														<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
													</button>
												</div>
											</div>
											{#if isExpanded}
												<div class="phase-card-content">
													{#each phase.data as element, idx (idx)}
														{#if !hideCompletedPhase || !isCompletedElement(element)}
															<DataTaskElement
																{element}
																index={idx}
																{color}
																onUpdate={(i, el) => fns.onPhaseDataUpdate?.(phase.id, i, el)}
																onToggle={(i) => fns.onPhaseDataToggle?.(phase.id, i)}
																onCancel={(i) => fns.onPhaseDataCancel?.(phase.id, i)}
																onDelete={(i) => fns.onPhaseDataDelete?.(phase.id, i)}
															/>
														{/if}
													{/each}
													<button class="phase-add-task-btn" onclick={() => fns.onPhaseDataAdd?.(phase.id)}>+ add</button>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="empty-state">No phases yet.</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- Tasks Section (flat) -->
					<div class="detail-section">
						<div class="detail-section-header">
							<h3 class="detail-section-title">Tasks</h3>
							<div class="detail-section-controls">
								<button class="detail-text-btn" onclick={confirmEnablePhases} title="Organize tasks into phases">
									Use Phases
								</button>
								<button
									class="detail-toggle-btn"
									class:active={hideCompleted}
									onclick={() => hideCompleted = !hideCompleted}
									title={hideCompleted ? "Show completed" : "Hide completed"}
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										{#if hideCompleted}
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
								<button class="detail-add-btn" onclick={fns.onDataAdd} title="Add task">+</button>
							</div>
						</div>
						<div class="tasks-list">
							{#if visibleTasks.length > 0}
								{#each visibleTasks as { el, i }}
									<DataTaskElement
										element={el}
										index={i}
										{color}
										onUpdate={fns.onDataUpdate}
										onToggle={fns.onDataToggle}
										onCancel={fns.onDataCancel}
										onDelete={fns.onDataDelete}
									/>
								{/each}
							{:else}
								<div class="tasks-list-empty-state">{selectedProject.data.length > 0 ? "All tasks completed" : "No tasks yet"}</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{:else}
			<div class="detail-empty">
				<p>Select a project from the sidebar</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.project-view {
		display: flex;
		height: 100%;
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
		width: 40px;
		min-width: 40px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}

	.sidebar-title {
		font-size: 0.85em;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
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

	.tree-track-header {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 12px;
		width: 100%;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		justify-content: start;
		box-shadow: none;
	}

	.tree-track-header:hover {
		background: rgba(255, 255, 255, 0.05);
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
		font-size: 0.85em;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		font-size: 0.82em;
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
		max-width: 900px;
		margin: 0 auto;
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

	.detail-date-range {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 4px;
	}

	.detail-date-label {
		font-size: 0.8em;
		color: var(--text-faint);
	}

	:global(.detail-date-input) {
		width: auto;
		border: none;
		background: transparent;
		padding: 0;
		cursor: pointer;
		font-size: 0.85em;
		color: var(--text-muted);
		font-weight: 600;
	}

	:global(.detail-date-input:hover) {
		color: var(--text-normal);
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

	.detail-text-btn {
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		padding: 3px 8px;
		font-size: 0.82em;
		cursor: pointer;
	}

	.detail-text-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-normal);
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

	/* Phases Grid */
	.phases-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.phases-dnd-container {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		width: 100%;
	}

	.phase-card {
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		padding: 10px 12px;
		flex: 0 0 calc(33.333% - 8px);
		min-width: 260px;
		max-width: 100%;
	}

	.phase-card-header {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.phase-drag-handle {
		cursor: grab;
		color: var(--text-faint);
		display: flex;
		align-items: center;
		padding: 0 2px;
		opacity: 0.5;
	}

	.phase-drag-handle:hover {
		opacity: 1;
		color: var(--text-muted);
	}

	.phase-card-toggle {
		background: none;
		border: none;
		cursor: pointer;
		padding: 2px 4px;
		font-size: 0.7em;
		color: var(--text-muted);
		flex-shrink: 0;
		box-shadow: none;
	}

	.phase-card-toggle:hover {
		color: var(--text-normal);
	}

	:global(.phase-card-label) {
		font-size: 0.9em;
		font-weight: 600;
		flex: 1;
		min-width: 0;
	}

	.phase-task-count {
		font-size: 0.72em;
		padding: 1px 6px;
		border-radius: 8px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.phase-card-right {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
		margin-left: auto;
	}

	:global(.phase-date-input) {
		width: auto;
		max-width: 140px;
		border: none;
		background: transparent;
		padding: 0;
		text-align: right;
		cursor: pointer;
		font-size: 0.75em;
		color: var(--text-muted);
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

	.phase-card-content {
		padding: 6px 0 2px 22px;
	}

	.phase-add-task-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8em;
		padding: 2px 6px;
		margin-top: 4px;
		border-radius: 4px;
		box-shadow: none;
	}

	.phase-add-task-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-normal);
	}

	/* Tasks List */
	.tasks-list {
		display: flex;
		flex-direction: column;
	}

	.tasks-list-empty-state {
		color: var(--text-faint);
		font-style: italic;
		font-size: 0.85em;
		padding: 12px;
	}
</style>
