<script lang="ts">
	import type { Element, Time } from "src/plugin/types";
	import CircularProgress from "./CircularProgress.svelte";
	import { formatTime } from "src/plugin/helpers";
	import { longpress } from "src/plugin/actions"

	interface TaskElementProps {
		element: Element;
		index: number;
		color: string;
		projectLabel?: string;
		showProjectLabel?: boolean;
		onUpdate: (index: number, updatedElement: Element) => void;
		onDelete: (index: number) => void;
		onToggle: (index: number) => void;
		onCancel: (index: number) => void;
		onCloseProjectTask?: (index: number) => void;
	}

	let { element, index, color, projectLabel, showProjectLabel = true, onUpdate, onDelete, onToggle, onCancel, onCloseProjectTask }: TaskElementProps = $props();

	let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);
	let checkboxRef = $state<HTMLInputElement>();

	// Handle longpress event
	$effect(() => {
		if (checkboxRef) {
			const handler = () => onCancel(index);
			checkboxRef.addEventListener('longpress', handler);
			return () => checkboxRef?.removeEventListener('longpress', handler);
		}
	});

	function startEdit() {
		isEditing = true;
		editText = element.raw.replace(/^\t- /, '').trim();
	}

	function cancelEdit() {
		isEditing = false;
		editText = "";
		skipBlur = false;
	}

	function saveEdit() {
		if (skipBlur) {
			skipBlur = false;
			return;
		}

		let isTask = false;
		let taskStatus: ' ' | 'x' | '-' | undefined;
		let startTime: Time | undefined;
		let progress: number | undefined;
		let duration: number | undefined;
		let timeUnit: 'min' | 'hr' | undefined;
		let sourceRef: string | undefined = element.sourceRef;

		// Extract source reference: [[File#^blockId]]
		const sourceRefRegex = /(\[\[[^\]]+#\^[a-zA-Z0-9]+\]\])/;
		const sourceRefMatch = editText.match(sourceRefRegex);
		if (sourceRefMatch) {
			const [fullMatch, ref] = sourceRefMatch;
			editText = editText.replace(fullMatch, '').trim();
			sourceRef = ref;
		}

		const taskStatusRegex = /^\[([ x-])\]/;
		const startTimeRegex = /@\s*(\d{1,2}):(\d{2})/;
		const progressDurationRegex = /\[(?:(\d+)?(\/))?(\d+)\s*(hr|min)\]/;

		const taskStatusMatch = editText.match(taskStatusRegex);
		if (taskStatusMatch) {
			const [fullMatch, checkmark] = taskStatusMatch;
			editText = editText.replace(fullMatch, '').trim();
			isTask = true;
			taskStatus = checkmark as typeof taskStatus;
		}

		const startTimeMatch = editText.match(startTimeRegex);
		if (startTimeMatch) {
			const [fullMatch, hours, minutes] = startTimeMatch;
			editText = editText.replace(fullMatch, '').trim();
			startTime = { hours: parseInt(hours), minutes: parseInt(minutes) };
		}

		const progressDurationMatch = editText.match(progressDurationRegex);
		if (progressDurationMatch) {
			const [fullMatch, progressMatch, hasProgress, durationMatch, unitMatch] = progressDurationMatch;
			editText = editText.replace(fullMatch, '');
			progress = hasProgress ? (parseInt(progressMatch) || 0) : undefined;
			duration = parseInt(durationMatch);
			timeUnit = unitMatch as 'min' | 'hr';
		}

		const updatedElement: Element = {
			...element,
			text: editText.trim(),
			isTask,
			taskStatus,
			startTime,
			progress,
			duration,
			timeUnit,
			sourceRef,
		}
		
		onUpdate(index, updatedElement);
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

	function toggleTask() {
		if (element.isTask) {
			onToggle(index);
		}
	}

	function deleteElement() {
		onDelete(index);
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
		<div class="element-content" ondblclick={startEdit} role="button" tabindex="0">
			<div class="element-top-row">
				<div class="element-checkbox-container">
					{#if element.taskStatus == "x" && element.duration && element.timeUnit}
						<button
							onclick={toggleTask}
							class="invisible-button"
						>
							<CircularProgress
								progress={element.progress}
								duration={element.duration}
								unit={element.timeUnit}
								size={18}
							/>
						</button>
					{:else if element.taskStatus}
						{#if element.sourceRef}
							<input
								type="checkbox"
								checked={element.taskStatus == "x"}
								onchange={() => onCloseProjectTask?.(index)}
								class="task-checkbox"
								style={`border-color: ${color};`}
								title="Mark task done in project"
							/>
						{:else}
							<input
								bind:this={checkboxRef}
								type="checkbox"
								checked={element.taskStatus == "x"}
								onchange={toggleTask}
								use:longpress={500}
								class="task-checkbox"
								title="Mark session done"
							/>
						{/if}
					{/if}
				</div>
				<span
					class="element-text"
					class:checked={element.taskStatus == "x" || (element.taskStatus !== " " && element.progress === undefined && element.duration) || (element.progress && element.duration && element.progress >= element.duration)}
					class:cancelled={element.taskStatus == "-"}
				>
					{element.text.replace(/\s*\[\[[^\]]+\]\]\s*$/, '')}
				</span>
				<button class="delete-btn" onclick={deleteElement} title="Delete">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
			</div>
			<div class="element-meta-row">
				{#if element.duration && element.timeUnit}
					<span class="meta-tag">
						{#if element.progress !== undefined}{element.progress}/{/if}{element.duration} {element.timeUnit == 'min' ? 'm' : 'h'}
					</span>
				{/if}
				{#if element.startTime}
					<span class="meta-tag">
						{formatTime(element.startTime)}
					</span>
				{/if}
				{#if projectLabel && showProjectLabel}
					<span class="project-label" title={projectLabel}>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-symlink-icon lucide-folder-symlink"><path d="M2 9.35V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path d="m8 16 3-3-3-3"/></svg>
						{projectLabel}
					</span>
				{/if}
			</div>
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

	.task-checkbox {
		cursor: pointer;
		margin: 0;
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
		border: 1px solid var(--background-modifier-border);
		background: var(--background-secondary);
		white-space: nowrap;
		line-height: 1.4;
		flex-shrink: 0;
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

	.invisible-button {
		background-color: transparent;
		padding: 0;
	}

	.invisible-button:hover {
		box-shadow: none;
	}
</style>