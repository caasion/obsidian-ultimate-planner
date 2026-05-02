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
	import { dndzone } from "svelte-dnd-action";
	import { flip } from "svelte/animate";

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
	}

	let { 
		app,
		project, 
		color, 
		projectFunctions,
		createHabitFunctions,
	}: ProjectCardProps = $props();

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

	// Phase expand/collapse state — default: expand the active phase
	function getDefaultExpandedId(phases: Phase[]): string | undefined {
		if (phases.length === 0) return undefined;
		const today = getISODate(new Date());

		const activeByDate = phases.find(p => 
			p.startDate && p.startDate <= today && 
			(!p.endDate || p.endDate >= today)
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

	let expandedPhaseId = $state(getDefaultExpandedId(project.phases));

	function togglePhase(phaseId: string) {
		expandedPhaseId = expandedPhaseId === phaseId ? undefined : phaseId;
	}

	function handlePhaseRangeSelect(phaseId: string, selection: unknown) {
		const range = selection as { from?: Date; to?: Date } | undefined;
		if (!range?.from) return;
		projectFunctions.onPhaseDateEdit?.(
			phaseId,
			getISODate(range.from),
			range.to ? getISODate(range.to) : undefined
		);
	}

	// Drag and drop state for phases
	let isDraggingPhases = $state(false);
	let phaseItems = $state<{id: string, phase: Phase}[]>([]);

	// Sync local items with upstream prop
	$effect(() => {
		if (!isDraggingPhases) {
			phaseItems = project.phases.map(phase => ({ id: phase.id, phase }));
		}
	});

	function handlePhaseDndConsider(e: { detail: { items: any[] } }) {
		isDraggingPhases = true;
		phaseItems = e.detail.items;
	}

	function handlePhaseDndFinalize(e: { detail: { items: any[], info: any } }) {
		isDraggingPhases = false;
		phaseItems = e.detail.items;

		// Map the new array back to the expected fromIndex/toIndex logic
		const movedId = e.detail.info.id;
		const fromIndex = project.phases.findIndex(p => p.id === movedId);
		const toIndex = e.detail.items.findIndex((item: any) => item.id === movedId);
		
		if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
			projectFunctions.onPhaseReorder?.(fromIndex, toIndex);
		}
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
				<button class="add-button" onclick={() => projectFunctions.onPhaseAdd?.()} title="Add a new phase">+</button>
			</div>
			<div class="section-content">
				{#if project.phases.length > 0}
					<div 
						class="phases-container"
						use:dndzone={{ items: phaseItems, flipDurationMs: 200, dropTargetStyle: { outline: `1px dashed ${color}`, background: `${color}15` }, dragHandleSelector: '.drag-handle', type: `phases-${project.id}` }}
						onconsider={handlePhaseDndConsider}
						onfinalize={handlePhaseDndFinalize}
					>
						{#each phaseItems as { id, phase }, index (id)}
							{@const isExpanded = expandedPhaseId === phase.id}
							<div class="phase-item" animate:flip={{ duration: 200 }}>
								<div class="phase-row">
									<div class="drag-handle" title="Drag to reorder phase">
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
									</div>
									<button class="phase-toggle" onclick={() => togglePhase(phase.id)} aria-label={isExpanded ? 'Collapse phase' : 'Expand phase'}>
									{#if isExpanded}&#9660;{:else}&#9654;{/if}
								</button>
								<EditableText
									value={phase.label}
									onSave={(newLabel) => projectFunctions.onPhaseLabelEdit?.(phase.id, newLabel)}
									placeholder="Phase name..."
									class="phase-label"
								/>
								<div class="phase-row-right">
									<Datepicker
										range
										rangeFrom={toDate(phase.startDate)}
										rangeTo={toDate(phase.endDate)}
										openEndedLabel="?"
										rangeSeparator=" → "
										onselect={(sel) => handlePhaseRangeSelect(phase.id, sel)}
										showToggleButton={false}
										inputProps={{ readonly: true }}
										inputClass="phase-date-input"
									/>
									<button
										class="phase-delete-btn"
										onclick={() => projectFunctions.onPhaseDelete?.(phase.id)}
										title="Delete this phase"
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
									</button>
								</div>
							</div>
							{#if isExpanded}
								<div class="phase-content">
									{#each phase.data as element, index}
										<DataTaskElement
											{element}
											{index}
											{color}
											onUpdate={(idx, el) => projectFunctions.onPhaseDataUpdate?.(phase.id, idx, el)}
											onToggle={(idx) => projectFunctions.onPhaseDataToggle?.(phase.id, idx)}
											onCancel={(idx) => projectFunctions.onPhaseDataCancel?.(phase.id, idx)}
											onDelete={(idx) => projectFunctions.onPhaseDataDelete?.(phase.id, idx)}
										/>
									{/each}
									<button class="add-button phase-add-task" onclick={() => projectFunctions.onPhaseDataAdd?.(phase.id)} title="Add task to phase">+ Task</button>
								</div>
							{/if}
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
						class="add-button"
						onclick={projectFunctions.onDataAdd}
						title="Add a new task"
					>
						+
					</button>
				</div>
			</div>
			<div class="section-content">
				{#if project.data.length > 0}
					{#each project.data as element, index}
						<DataTaskElement
							{element}
							{index}
							{color}
							onUpdate={projectFunctions.onDataUpdate}
							onToggle={projectFunctions.onDataToggle}
							onCancel={projectFunctions.onDataCancel}
							onDelete={projectFunctions.onDataDelete}
						/>
					{/each}
				{:else}
					<div class="section-empty-state">No tasks yet</div>
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

  .phase-item {
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .phase-item:last-child {
    border-bottom: none;
  }

  .phase-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 0;
  }

  .phase-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 0.7em;
    color: var(--text-muted);
    flex-shrink: 0;
    line-height: 1;
  }

  .phase-toggle:hover {
    color: var(--text-normal);
  }

  :global(.phase-label) {
    font-size: 0.9em;
    font-weight: 600;
    flex: 1;
    min-width: 0;
  }

  .phase-row-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  :global(.phase-date-input) {
    width: auto;
    max-width: 160px;
    border: none;
    background: transparent;
    padding: 0;
    text-align: right;
    cursor: pointer;
    font-size: 0.78em;
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
    padding: 2px 4px;
    border-radius: 3px;
    opacity: 0.6;
    transition: opacity 0.15s, color 0.15s;
    display: flex;
    align-items: center;
  }

  .phase-delete-btn:hover {
    opacity: 1;
    color: var(--text-error);
  }

  .phase-content {
    padding: 2px 0 6px 22px;
  }

  .phase-add-task {
    width: auto;
    font-size: 0.82em;
    padding: 2px 8px;
    margin-top: 4px;
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

  /* Drag and drop phase styles */
  .phase-item {
    transition: transform 0.1s ease;
  }

  .drag-handle {
    cursor: grab;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    padding: 0 4px;
    opacity: 0.5;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .drag-handle:hover {
    color: var(--text-muted);
    opacity: 1;
  }
</style>