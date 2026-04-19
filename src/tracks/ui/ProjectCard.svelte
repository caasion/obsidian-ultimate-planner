<script lang="ts">
	import type { Element, ISODate, Project } from "src/plugin/types";
	import HabitElement, { type HabitFunctions } from "./HabitElement.svelte";
	import EditableText from "src/components/EditableText.svelte";
	import EditableMarkdownText from "src/components/EditableMarkdownText.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import { getISODate } from "src/plugin/helpers";
	import { isValid, parseISO } from "date-fns";
	import DataTaskElement from "./DataTaskElement.svelte";
	import type { App } from "obsidian";

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
		const now = getISODate(new Date());
		return now >= project.startDate && (project.endDate ? now <= project.endDate : true) 
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
  <div class="section">
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

	<!-- Tasks Section -->
  <div class="section">
    <div class="section-header">
      <h4 class="section-title">Tasks</h4>
      <button 
        class="add-button" 
				onclick={projectFunctions.onDataAdd}
        title="Add a new task"
      >
        +
      </button>
    </div>
	{#if project.data.length > 0}
			{#each project.data as element, index}
        <DataTaskElement
          element={element}
          index={index}
          color={color}
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

<style>
	.project-card {
		background-color: var(--background-primary);
		border: 1.5px solid;
		border-radius: 8px;
		padding: 12px;
		margin: 8px 0;
		transition: box-shadow 0.2s ease;
	}

	.project-card:hover {
		box-shadow: var(--shadow-s);
	}

	.project-header {
		margin-bottom: 10px;
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

	.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
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
</style>