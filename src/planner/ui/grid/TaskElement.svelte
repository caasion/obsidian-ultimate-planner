<script lang="ts">
	import type { Element, Time } from "src/plugin/types";
	import { formatTime } from "src/plugin/helpers";
	import TaskCheckbox from "src/components/TaskCheckbox.svelte";

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

	let progressPercent = $derived(
		element.progress !== undefined && element.duration
			? Math.min((element.progress / element.duration) * 100, 100)
			: undefined
	);

	let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);

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
		let taskStatus: ' ' | '/' | 'x' | '-' | undefined;
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

		const taskStatusRegex = /^\[([ x\/\-])\]/;
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

	function deleteElement() {
		onDelete(index);
	}

	function handleProjectClick(e: MouseEvent) {
		e.preventDefault();
		// TODO: implement navigation to project
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
					{#if element.taskStatus}
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
								status={element.taskStatus}
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
					{element.text.replace(/\s*\[\[[^\]]+\]\]\s*$/, '')}
				</span>
				<button class="delete-btn" onclick={deleteElement} title="Delete">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
			</div>
			<div class="element-meta-row">
				{#if element.duration && element.timeUnit}
					<span
						class="meta-tag"
						class:meta-tag-progress={progressPercent !== undefined}
						style={`--meta-tag-bg: ${color}5F;${progressPercent !== undefined ? ` --progress: ${progressPercent}%;` : ''}`}
					>
						{#if element.progress !== undefined}{element.progress}/{/if}{element.duration} {element.timeUnit == 'min' ? 'm' : 'h'}
					</span>
				{/if}
				{#if element.startTime}
					<span class="meta-tag" style={`--meta-tag-bg: ${color}5F;`}>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alarm-clock-icon lucide-alarm-clock"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/><path d="M6.38 18.7 4 21"/><path d="M17.64 18.67 20 21"/></svg>
						{formatTime(element.startTime)}
					</span>
				{/if}
				{#if projectLabel && showProjectLabel}
					<a href="#" class="project-label" title={projectLabel} onclick={handleProjectClick}>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-symlink-icon lucide-folder-symlink"><path d="M2 9.35V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h7"/><path d="m8 16 3-3-3-3"/></svg>
						{projectLabel}
					</a>
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

	.invisible-button {
		background-color: transparent;
		padding: 0;
	}

	.invisible-button:hover {
		box-shadow: none;
	}
</style>