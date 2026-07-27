<script lang="ts">
	import { Menu } from "obsidian";
	import type { Element, Project, Time } from "src/plugin/types";
	import { formatTime } from "src/plugin/helpers";
	import TaskCheckbox from "src/components/TaskCheckbox.svelte";
	import TimePickerPopup from "./TimePickerPopup.svelte";
	import DurationPickerPopup from "./DurationPickerPopup.svelte";
	import ProjectPickerPopup from "./ProjectPickerPopup.svelte";

	interface TaskElementProps {
		element: Element;
		index: number;
		color: string;
		projectLabel?: string;
		showProjectLabel?: boolean;
		projects?: Project[];
		onUpdate: (index: number, updatedElement: Element) => void;
		onDelete: (index: number) => void;
		onToggle: (index: number) => void;
		onCancel: (index: number) => void;
		onCloseProjectTask?: (index: number) => void;
	}

	let { element, index, color, projectLabel, showProjectLabel = true, projects = [], onUpdate, onDelete, onToggle, onCancel, onCloseProjectTask }: TaskElementProps = $props();

	let progressPercent = $derived(
		element.progress !== undefined && element.duration
			? Math.min((element.progress / element.duration) * 100, 100)
			: undefined
	);

	// Trailing "[[Project]]" wikilink association stored inside element.text.
	const associationRegex = /\s*\[\[([^\]#]+)\]\]\s*$/;

	// The plain description with any trailing project association stripped out.
	let description = $derived(element.text.replace(associationRegex, '').trim());

	// The current association label (from a trailing "[[Project]]" link), if any.
	let associationLabel = $derived(element.text.match(associationRegex)?.[1]?.trim());

	let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);

	function startEdit() {
		isEditing = true;
		// Only the description is editable; metadata & association are managed via popups.
		editText = description;
	}

	function cancelEdit() {
		isEditing = false;
		editText = "";
		skipBlur = false;
	}

	// Rebuilds element.text from a new description while preserving the association.
	function withDescription(newDescription: string): string {
		const trimmed = newDescription.trim();
		return associationLabel ? `${trimmed} [[${associationLabel}]]`.trim() : trimmed;
	}

	function saveEdit() {
		if (skipBlur) {
			skipBlur = false;
			return;
		}

		onUpdate(index, { ...element, text: withDescription(editText) });
		cancelEdit();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
			skipBlur = true;
		} else if (e.key === 'Escape') {
			e.preventDefault();
			cancelEdit();
			skipBlur = true;
		}
	}

	function deleteElement() {
		onDelete(index);
	}

	function handleProjectClick(e: MouseEvent) {
		e.preventDefault();
		openAssociationPicker();
	}

	/* === Metadata popups === */
	type PopupKind = 'time' | 'duration' | 'project' | null;
	let activePopup = $state<PopupKind>(null);
	let metaRowEl = $state<HTMLElement | undefined>(undefined);

	function openTimePicker() { activePopup = 'time'; }
	function openDurationPicker() { activePopup = 'duration'; }
	function openAssociationPicker() { activePopup = 'project'; }
	function closePopup() { activePopup = null; }

	function saveTime(startTime: Time | undefined) {
		onUpdate(index, { ...element, startTime });
	}

	function saveDuration(duration: number | undefined, timeUnit: 'min' | 'hr' | undefined) {
		// Clearing the duration also clears any tracked progress.
		onUpdate(index, {
			...element,
			duration,
			timeUnit,
			progress: duration === undefined ? undefined : element.progress,
		});
	}

	function saveAssociation(project: Project | undefined) {
		const label = project?.label;
		const base = description;
		const newText = label ? `${base} [[${label}]]`.trim() : base;
		onUpdate(index, { ...element, text: newText });
	}

	function toggleCheckbox() {
		if (element.isTask) {
			onUpdate(index, { ...element, isTask: false, taskStatus: undefined });
		} else {
			onUpdate(index, { ...element, isTask: true, taskStatus: element.taskStatus ?? ' ' });
		}
	}

	function openContextMenu(e: MouseEvent) {
		e.preventDefault();
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle(element.isTask ? "Remove checkbox" : "Add checkbox")
				.setIcon(element.isTask ? "square" : "check-square")
				.onClick(() => toggleCheckbox())
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle(element.startTime ? "Edit time" : "Add time")
				.setIcon("clock")
				.onClick(() => openTimePicker())
		);

		menu.addItem((item) =>
			item
				.setTitle(element.duration ? "Edit duration" : "Add duration")
				.setIcon("hourglass")
				.onClick(() => openDurationPicker())
		);

		if (projects.length > 0) {
			menu.addItem((item) =>
				item
					.setTitle(associationLabel ? "Edit association" : "Add association")
					.setIcon("folder-symlink")
					.onClick(() => openAssociationPicker())
			);
		}

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle("Delete")
				.setIcon("trash")
				.onClick(() => deleteElement())
		);

		menu.showAtMouseEvent(e);
	}
</script>

<div class="task-element">
	{#if isEditing}
		<input
			type="text"
			bind:value={editText}
			onkeydown={handleKeydown}
			onblur={saveEdit}
			class="element-input"
		/>
	{:else}
		<div class="element-content" ondblclick={startEdit} oncontextmenu={openContextMenu} role="button" tabindex="0">
			<div class="element-top-row">
				<div class="element-checkbox-container">
					{#if element.isTask}
						{#if element.sourceRef}
							<button
								onclick={() => onCloseProjectTask?.(index)}
								class="project-checkbox"
								title="Mark task done in project"
							>
								<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:project-checkbox-checked={element.taskStatus == "x"}>
									<path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>
									<path d="m21 3-9 9"/>
									<path d="M15 3h6v6"/>
								</svg>
							</button>
						{:else}
							<TaskCheckbox
								status={element.taskStatus ?? ' '}
								onToggle={() => onToggle(index)}
								onCancel={() => onCancel(index)}
							/>
						{/if}
					{/if}
				</div>
				<span
					class="element-text"
					class:checked={element.taskStatus == "x"}
					class:partial={element.taskStatus == "/"}
					class:cancelled={element.taskStatus == "-"}
				>
					{description}
				</span>
				<button class="delete-btn" onclick={deleteElement} title="Delete">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
			</div>
			<div class="element-meta-row" bind:this={metaRowEl}>
				{#if element.duration && element.timeUnit}
					<button
						class="meta-tag meta-tag-btn"
						class:meta-tag-progress={progressPercent !== undefined}
						style={`--meta-tag-bg: ${color}5F;${progressPercent !== undefined ? ` --progress: ${progressPercent}%;` : ''}`}
						title="Edit duration"
						onclick={openDurationPicker}
					>
						{#if element.progress !== undefined}{element.progress}/{/if}{element.duration} {element.timeUnit == 'min' ? 'm' : 'h'}
					</button>
				{/if}
				{#if element.startTime}
					<button class="meta-tag meta-tag-btn" style={`--meta-tag-bg: ${color}5F;`} title="Edit time" onclick={openTimePicker}>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alarm-clock-icon lucide-alarm-clock"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>
						{formatTime(element.startTime)}
					</button>
				{/if}
				{#if projectLabel && showProjectLabel}
					<button class="project-label" title={projectLabel} onclick={handleProjectClick}>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-symlink-icon lucide-folder-symlink"><path d="M2 9.35V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path d="m8 16 3-3-3-3"/></svg>
						{projectLabel}
					</button>
				{/if}
			</div>

			{#if activePopup === 'time'}
				<TimePickerPopup
					value={element.startTime}
					anchorEl={metaRowEl}
					onSave={saveTime}
					onClose={closePopup}
				/>
			{:else if activePopup === 'duration'}
				<DurationPickerPopup
					duration={element.duration}
					timeUnit={element.timeUnit}
					anchorEl={metaRowEl}
					onSave={saveDuration}
					onClose={closePopup}
				/>
			{:else if activePopup === 'project'}
				<ProjectPickerPopup
					{projects}
					{color}
					currentLabel={associationLabel}
					anchorEl={metaRowEl}
					onSelect={saveAssociation}
					onClose={closePopup}
				/>
			{/if}
		</div>
	{/if}

	{#if element.children.length > 0}
		<div class="children">
			{#each element.children as child}
				<div class="child-item">• {child}</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.task-element {
		width: 100%;
	}

	.element-content {
		cursor: text;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		flex-direction: column;
	}

	.element-content:hover {
		background-color: var(--background-modifier-hover);
	}

	.element-top-row {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		gap: 6px;
	}

	.element-checkbox-container {
		height: 18px;
		min-width: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		margin-top: 1px;
	}

	.project-checkbox {
		cursor: pointer;
		background: transparent;
		border: none;
		padding: 0;
		box-shadow: none;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
	}

	.project-checkbox:hover {
		box-shadow: none;
		opacity: 0.8;
	}

	.project-checkbox-checked {
		fill: var(--interactive-accent);
	}

	.element-text {
		flex: 1;
		line-height: 1.4;
		word-break: break-word;
	}

	.checked {
		text-decoration: line-through;
		opacity: 0.5;
	}

	.partial {
		opacity: 0.9;
	}

	.cancelled {
		text-decoration: line-through;
		opacity: 0.5;
	}

	.element-meta-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-left: 24px;
		overflow: hidden;
	}

	.meta-tag {
		font-size: 0.8em;
		color: var(--text-normal);
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid var(--meta-tag-bg);
		background: var(--meta-tag-bg);
		white-space: nowrap;
		line-height: 1.4;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		position: relative;
		overflow: hidden;
		transition: filter 150ms ease;
		cursor: default;
	}

	.meta-tag:hover {
		filter: brightness(1.2);
	}

	.meta-tag-btn {
		font-family: inherit;
		box-shadow: none;
		cursor: pointer;
		height: auto;
		min-height: 0;
		padding: 1px 6px;
	}

	.meta-tag-progress {
		background: linear-gradient(
			to right,
			var(--meta-tag-bg) var(--progress),
			transparent var(--progress)
		);
	}

	.project-label {
		font-size: 0.8em;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: 3px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		cursor: pointer;
		transition: color 150ms ease, text-decoration 150ms ease, filter 150ms ease;
	}

	.project-label:hover {
		color: var(--text-normal);
		text-decoration: underline;
		filter: brightness(1.2);
	}

	.project-label svg {
		flex-shrink: 0;
	}

	.element-input {
		width: 100%;
		padding: 4px;
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.delete-btn {
		opacity: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		flex-shrink: 0;
		box-shadow: none;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		margin-top: 1px;
	}

	.element-content:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		color: var(--text-error);
	}

	.children {
		margin-left: 24px;
		font-size: 0.9em;
		color: var(--text-muted);
	}

	.child-item {
		padding: 2px 0;
	}

</style>