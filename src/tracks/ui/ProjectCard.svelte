<script lang="ts">
	import type { Element, ISODate, Phase, Project } from "src/plugin/types";
	import HabitElement, { type HabitFunctions } from "./HabitElement.svelte";
	import EditableText from "src/components/EditableText.svelte";
	import EditableMarkdownText from "src/components/EditableMarkdownText.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import { getISODate } from "src/plugin/helpers";
	import { isValid, parseISO } from "date-fns";
	import DataTaskElement from "./DataTaskElement.svelte";
	import type { App } from "obsidian";
	import { ConfirmationModal } from "src/plugin/ConfirmationModal";
	import { dropLineDnd } from "src/components/dropLineDnd";

	export interface ProjectCardFunctions {
		onLabelEdit: (label: string) => void;
		onDescriptionEdit: (description: string) => void;
		onOpenFile: () => void;
		onStartDateEdit: (date: ISODate) => void;
		onEndDateEdit: (date: ISODate | null) => void;
		onDelete: () => void;

		// These are not project-specific, but handled at the project level
		onHabitAdd: () => void;
		onDataAdd: () => void;
		onDataUpdate: (index: number, updatedElement: Element) => void;
		onDataToggle: (index: number) => void;
		onDataCancel: (index: number) => void;
		onDataDelete: (index: number) => void;

		// Phase operations
		onPhaseAdd?: () => void;
		onPhaseLabelEdit?: (phaseId: string, label: string) => void;
		onPhaseDateEdit?: (phaseId: string, startDate?: ISODate, endDate?: ISODate) => void;
		onPhaseDelete?: (phaseId: string) => void;
		onPhaseReorder?: (fromIndex: number, toIndex: number) => void;
		onPhaseDataAdd?: (phaseId: string) => void;
		onPhaseDataUpdate?: (phaseId: string, index: number, updatedElement: Element) => void;
		onPhaseDataToggle?: (phaseId: string, index: number) => void;
		onPhaseDataCancel?: (phaseId: string, index: number) => void;
		onPhaseDataDelete?: (phaseId: string, index: number) => void;

		// Enable phase mode (one-way — disabling requires manual markdown edit)
		onEnablePhases?: () => void;
	}

	interface ProjectCardProps {
		app: App;
		project: Project;
		color: string;
		projectFunctions: ProjectCardFunctions;
		createHabitFunctions: (habitId: string) => HabitFunctions;
		refCountMap?: Map<string, number>;
	}

	let {
		app,
		project,
		color,
		projectFunctions,
		createHabitFunctions,
		refCountMap = new Map(),
	}: ProjectCardProps = $props();

	function getRefCount(blockId?: string): number {
		if (!blockId) return 0;
		return refCountMap.get(blockId) ?? 0;
	}

	// Check if project is currently active
	function isProjectActive(): boolean {
		const today = getISODate(new Date());
		if (!project.hasPhases) {
			return today >= project.startDate && (project.endDate ? today <= project.endDate : true) 
		} else {
			const activeByDate = project.phases.find(p => 
				p.startDate && p.startDate <= today && 
				(!p.endDate || p.endDate >= today)
			);
			if (activeByDate) return true;
		}
		return false;
	}

	function toDate(iso?: ISODate): Date | undefined {
		if (!iso) return undefined;
		const parsed = parseISO(iso);
		return isValid(parsed) ? parsed : undefined;
	}

	function handleProjectRangeSelect(selection: unknown) {
		const range = selection as { from?: Date; to?: Date } | undefined;
		if (!range?.from) return;

		projectFunctions.onStartDateEdit(getISODate(range.from));
		projectFunctions.onEndDateEdit(range.to ? getISODate(range.to) : null);
	}

	function confirmEnablePhases() {
		new ConfirmationModal(
			app,
			() => projectFunctions.onEnablePhases?.(),
			'Enable Phases',
			'This will organize your tasks into phases. Existing tasks will be moved into "Phase 1". To revert, you will need to edit the markdown file manually.'
		).open();
	}

	let hideCompleted = $state(false);
	let hideCompletedPhase = $state(false);

	function isCompletedElement(el: Element): boolean {
		return el.taskStatus === 'x' || el.taskStatus === '-';
	}

	let visibleTasks = $derived(
		hideCompleted
			? project.data.map((el, i) => ({ el, i })).filter(({ el }) => !isCompletedElement(el))
			: project.data.map((el, i) => ({ el, i }))
	);

	function handlePhaseRangeSelect(phaseId: string, selection: unknown) {
		const range = selection as { from?: Date; to?: Date } | undefined;
		if (!range?.from) return;
		projectFunctions.onPhaseDateEdit?.(
			phaseId,
			getISODate(range.from),
			range.to ? getISODate(range.to) : undefined
		);
	}

	// Drag and drop for phases
	function handlePhaseDndFinalize(_reordered: Phase[], fromIndex: number, toIndex: number) {
		projectFunctions.onPhaseReorder?.(fromIndex, toIndex);
	}
</script>

<div class="project-card" style={`border-color: ${color};`}>
	<div class="project-header">
		<div class="project-title-row">
			<div class="project-title-section">
				{#if isProjectActive()}
					<span class="status-indicator active">●</span>
				{:else}
					<span class="status-indicator inactive">○</span>
				{/if}
				<EditableText 
					value={project.label}
					onSave={(newLabel) => projectFunctions.onLabelEdit(newLabel)}
					onCtrlClick={projectFunctions.onOpenFile}
					placeholder="Project name..."
					class="project-title" 
				/>
			</div>
			<button class="icon-button" onclick={projectFunctions.onDelete} aria-label="Delete project">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-icon lucide-trash"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
			</button>
		</div>
		{#if !project.hasPhases}
			<div class="project-date-range">
				<Datepicker
					range
					rangeFrom={toDate(project.startDate)}
					rangeTo={toDate(project.endDate)}
					openEndedLabel="Present"
					rangeSeparator=" -> "
					onselect={handleProjectRangeSelect}
					showToggleButton={false}
					inputProps={{ readonly: true }}
					inputClass="project-date-trigger-input"
				/>
			</div>
		{/if}
		<EditableMarkdownText 
			value={project.description}
			onSave={(newDescription) => projectFunctions.onDescriptionEdit(newDescription)}
			placeholder="Project description..."
			{app}
			sourcePath={project.file?.path ?? ""}
			class="project-description" 
		/>
	</div>

	<!-- Habits Section -->
	<div class="section habits-section">
		<div class="section-header">
			<h4 class="section-title">Habits</h4>
			<button 
				class="add-button" 
				onclick={projectFunctions.onHabitAdd}
				title="Add a new habit"
			>
				+
			</button>
		</div>
		<div class="section-content">
			{#if Object.entries(project.habits).length > 0}
				{#each Object.values(project.habits) as habit}
					<HabitElement
						{habit}
						{color}
						habitFunctions={createHabitFunctions(habit.id)}
					/>
				{/each}
			{:else}
				<div class="section-empty-state">No habits yet. Click + to add one.</div>
			{/if}
		</div>
	</div>

	{#if project.hasPhases}
		<!-- Phases Section -->
		<div class="section tasks-phases-section">
			<div class="section-header">
				<h4 class="section-title">Phases</h4>
				<div class="section-controls">
					<button
						class="toggle-completed-btn"
						class:active={hideCompletedPhase}
						onclick={() => hideCompletedPhase = !hideCompletedPhase}
						title={hideCompletedPhase ? "Show completed tasks" : "Hide completed tasks"}
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
					<button class="add-button" onclick={() => projectFunctions.onPhaseAdd?.()} title="Add a new phase">+</button>
				</div>
			</div>
			<div class="phases-scroll-container">
				{#if project.phases.length > 0}
					<div
						class="phases-scroll-track"
						use:dropLineDnd={{ items: project.phases, handleSelector: '.drag-handle', lineColor: color, direction: 'auto', onFinalize: handlePhaseDndFinalize }}
					>
						{#each project.phases as phase (phase.id)}
							{@const phaseTaskCount = phase.data.length}
							{@const phaseCompletedCount = phase.data.filter(el => el.taskStatus === 'x').length}
							{@const visiblePhaseData = hideCompletedPhase ? phase.data.map((el, i) => ({el, i})).filter(({el}) => !isCompletedElement(el)) : phase.data.map((el, i) => ({el, i}))}
							<div class="phase-card" style={`border-color: ${color};`}>
								<div class="phase-card-header">
									<div class="phase-card-header-left">
										<div class="drag-handle" title="Drag to reorder phase">
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
										</div>
										<div class="phase-card-title-block">
											<EditableText
												value={phase.label}
												onSave={(newLabel) => projectFunctions.onPhaseLabelEdit?.(phase.id, newLabel)}
												placeholder="Phase name..."
												class="phase-label"
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
										<button
											class="phase-delete-btn"
											onclick={() => projectFunctions.onPhaseDelete?.(phase.id)}
											title="Delete this phase"
										>
											<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
										</button>
									</div>
								</div>
								<div class="phase-card-tasks">
									{#each visiblePhaseData as {el: element, i: idx} (idx)}
										<DataTaskElement
											{element}
											index={idx}
											{color}
											refCount={getRefCount(element.blockId)}
											onUpdate={(i, el) => projectFunctions.onPhaseDataUpdate?.(phase.id, i, el)}
											onToggle={(i) => projectFunctions.onPhaseDataToggle?.(phase.id, i)}
											onCancel={(i) => projectFunctions.onPhaseDataCancel?.(phase.id, i)}
											onDelete={(i) => projectFunctions.onPhaseDataDelete?.(phase.id, i)}
										/>
									{/each}
									{#if visiblePhaseData.length === 0 && phaseTaskCount > 0}
										<div class="section-empty-state">All tasks completed</div>
									{/if}
								</div>
								<button class="add-button phase-add-task" onclick={() => projectFunctions.onPhaseDataAdd?.(phase.id)} title="Add task to phase">+ Task</button>
							</div>
						{/each}
					</div>
				{:else}
					<div class="section-empty-state">No phases yet. Click + to add one.</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Tasks Section -->
		<div class="section tasks-phases-section">
			<div class="section-header">
				<h4 class="section-title">Tasks</h4>
				<div class="section-controls">
					<button
						class="toggle-phases-btn"
						onclick={confirmEnablePhases}
						title="Organize tasks into phases"
					>
						Use Phases
					</button>
					<button
						class="toggle-completed-btn"
						class:active={hideCompleted}
						onclick={() => hideCompleted = !hideCompleted}
						title={hideCompleted ? "Show completed tasks" : "Hide completed tasks"}
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
					<button
						class="add-button"
						onclick={projectFunctions.onDataAdd}
						title="Add a new task"
					>
						+
					</button>
				</div>
			</div>
			<div class="section-content">
				{#if visibleTasks.length > 0}
					{#each visibleTasks as { el, i }}
						<DataTaskElement
							element={el}
							index={i}
							{color}
							refCount={getRefCount(el.blockId)}
							onUpdate={projectFunctions.onDataUpdate}
							onToggle={projectFunctions.onDataToggle}
							onCancel={projectFunctions.onDataCancel}
							onDelete={projectFunctions.onDataDelete}
						/>
					{/each}
				{:else}
					<div class="section-empty-state">{project.data.length > 0 ? "All tasks completed" : "No tasks yet"}</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.project-card {
		background-color: var(--background-primary);
		border: 1.5px solid;
		border-radius: 8px;
		padding: 12px;
		margin: 8px 0;
		transition: box-shadow 0.2s ease;
		width: 100%;
		display: flex;
		flex-direction: column;
		height: 100%;
		box-sizing: border-box;
	}

	.project-card:hover {
		box-shadow: var(--shadow-s);
	}

	.project-header {
		margin-bottom: 10px;
		flex-shrink: 0;
	}

	.project-title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}

	.project-date-range {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	:global(.project-date-trigger-input) {
		width: auto;
		border: none;
		background: transparent;
		padding: 0;
		text-align: left;
		cursor: pointer;
		font-size: 0.85em;
		color: var(--text-muted);
	}

	:global(.project-date-trigger-input:hover) {
		color: var(--text-normal);
	}

	.project-title-section {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
	}

	:global(.project-title) {
		font-size: 1.1em;
		font-weight: 600;
	}

	:global(.project-description) {
		font-size: 0.9em;
		color: var(--text-muted);
		font-style: italic;
		margin-top: 6px;
	}

	.status-indicator {
		font-size: 0.8em;
	}

	.status-indicator.active {
		color: var(--color-green, #4CAF50);
	}

	.status-indicator.inactive {
		color: var(--text-faint);
	}

	.icon-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 1em;
		opacity: 0.6;
		transition: opacity 0.2s ease, background-color 0.2s ease;
	}

	.icon-button:hover {
		opacity: 1;
		background-color: var(--background-modifier-hover);
	}

	.section {
		display: flex;
		flex-direction: column;
		flex: 0 1 auto;
		min-height: 0;
		margin-bottom: 8px;
	}

	.habits-section {
		max-height: 33.33%;
	}

	.tasks-phases-section {
		max-height: 60%;
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		flex-shrink: 0;
	}

	.section-content {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding-right: 4px;
	}

	.section-title {
    font-size: 0.9em;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 0px;
    margin-bottom: 0px;
  }

	.section-empty-state {
		padding: 12px;
		text-align: center;
		color: var(--text-muted);
		font-style: italic;
		font-size: 0.9em;
	}

	.add-button {
		background: transparent;
    color: var(--text-muted);
    border: none;
    border-radius: 25%;
    width: 24px;
    height: 24px;
    font-size: 1.2em;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    line-height: 1;
    transition: opacity 0.2s ease;
		opacity: 0.8;
  }

  .add-button:hover {
    opacity: 1;
    background: var(--background-modifier-hover);
  }

  .section-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Phases horizontal scroll */
  .phases-scroll-container {
    overflow-x: auto;
    padding-bottom: 4px;
    margin: 0 -12px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .phases-scroll-track {
    display: flex;
    gap: 10px;
    min-width: min-content;
  }

  .phase-card {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    border-top: 3px solid;
    padding: 10px;
    width: 260px;
    min-width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
  }

  .phase-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 8px;
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
    gap: 1px;
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

  .phase-task-count {
    font-size: 0.8em;
    font-weight: 600;
    white-space: nowrap;
  }

  :global(.phase-label) {
    font-size: 0.9em;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .phase-add-task {
    width: auto;
    font-size: 0.82em;
    padding: 2px 8px;
    margin-top: 4px;
  }

  .toggle-completed-btn {
    background: transparent;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    padding: 0;
    color: var(--text-muted);
  }

  .toggle-completed-btn:hover {
    background: var(--background-modifier-hover);
  }

  .toggle-completed-btn.active svg {
    stroke: var(--interactive-accent);
  }

  .toggle-phases-btn {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 0.82em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-phases-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .drag-handle {
    cursor: grab;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    padding: 2px;
    opacity: 0.5;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .drag-handle:hover {
    color: var(--text-muted);
    opacity: 1;
  }
</style>