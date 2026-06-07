<script lang="ts">
	import type { Element, ISODate, Time } from "src/plugin/types";
	import { formatTime, reconstructRawText } from "src/plugin/helpers";
	import Datepicker from "src/components/Datepicker.svelte";
	import TaskCheckbox from "src/components/TaskCheckbox.svelte";
	import Portal from "src/components/Portal.svelte";
	import { onMount } from "svelte";

	interface TaskElementProps {
		element: Element;
		index: number;
		color: string;
		refCount?: number;
		onUpdate: (index: number, updatedElement: Element) => void;
		onDelete: (index: number) => void;
		onToggle: (index: number) => void;
		onCancel: (index: number) => void;
	}

	let { element, index, color, refCount = 0, onUpdate, onDelete, onToggle, onCancel }: TaskElementProps = $props();

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
		editText = element.raw.replace(/^- /, '').trim();
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
		let blockId: string | undefined = element.blockId;
		let scheduledDate: ISODate | undefined = element.scheduledDate;

		// Extract block ID at end of text: ^xxxxx
		const blockIdRegex = /\s\^([a-zA-Z0-9]+)$/;
		const blockIdMatch = editText.match(blockIdRegex);
		if (blockIdMatch) {
			const [fullMatch, id] = blockIdMatch;
			editText = editText.replace(fullMatch, '').trim();
			blockId = id;
		}

		// Extract scheduled date: 📅 YYYY-MM-DD
		const scheduledDateRegex = /📅\s*(\d{4}-\d{2}-\d{2})/;
		const scheduledDateMatch = editText.match(scheduledDateRegex);
		if (scheduledDateMatch) {
			const [fullMatch, date] = scheduledDateMatch;
			editText = editText.replace(fullMatch, '').trim();
			scheduledDate = date as ISODate;
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

		const raw = reconstructRawText(editText.trim(), isTask, taskStatus, startTime, progress, duration, timeUnit, '- ', undefined, scheduledDate, blockId);

		const updatedElement: Element = {
			...element,
			raw,
			text: editText.trim(),
			isTask,
			taskStatus,
			startTime,
			progress,
			duration,
			timeUnit,
			blockId,
			scheduledDate,
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

	/* Scheduled date picker */
	let showDatepicker = $state(false);
	let dateBadgeEl = $state<HTMLElement | undefined>(undefined);
	let datepickerPopupEl = $state<HTMLDivElement | undefined>(undefined);
	let datepickerPopupStyle = $state('');

	function openDatepicker() {
		showDatepicker = true;
		const rect = dateBadgeEl?.getBoundingClientRect();
		if (!rect) return;
		const spaceBelow = window.innerHeight - rect.bottom;
		if (spaceBelow >= 320) {
			datepickerPopupStyle = `position: fixed; top: ${rect.bottom + 4}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
		} else {
			datepickerPopupStyle = `position: fixed; bottom: ${window.innerHeight - rect.top + 4}px; left: ${rect.left}px; z-index: var(--layer-popover, 100);`;
		}
	}

	function handleScheduledDateSelect(date: Date) {
		const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` as ISODate;
		const raw = reconstructRawText(element.text, element.isTask, element.taskStatus, element.startTime, element.progress, element.duration, element.timeUnit, '- ', undefined, isoDate, element.blockId);
		onUpdate(index, { ...element, raw, scheduledDate: isoDate });
		showDatepicker = false;
	}

	function handleClearScheduledDate() {
		const raw = reconstructRawText(element.text, element.isTask, element.taskStatus, element.startTime, element.progress, element.duration, element.timeUnit, '- ', undefined, undefined, element.blockId);
		onUpdate(index, { ...element, raw, scheduledDate: undefined });
		showDatepicker = false;
	}

	function handleDatepickerOutsideClick(e: MouseEvent) {
		if (!showDatepicker) return;
		const target = e.target as Node;
		if (dateBadgeEl?.contains(target) || datepickerPopupEl?.contains(target)) return;
		if ((target as Element).closest?.('.holos-datepicker-panel')) return;
		showDatepicker = false;
	}

	onMount(() => {
		document.addEventListener('click', handleDatepickerOutsideClick);
		return () => document.removeEventListener('click', handleDatepickerOutsideClick);
	});
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
						<TaskCheckbox
							status={element.taskStatus}
							onToggle={() => onToggle(index)}
							onCancel={() => onCancel(index)}
						/>
					{/if}
				</div>
				<span
					class="element-text"
					class:checked={element.taskStatus == "x"}
					class:partial={element.taskStatus == :/}
					class:cancelled={element.taskStatus == "-"}
				>
					{element.text}
				</span>
				<div class="top-row-actions">
					{#if element.scheduledDate}
						<button
							bind:this={dateBadgeEl}
							class="schedule-overlay-btn has-date"
							onclick={openDatepicker}
							title="Change scheduled date"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
						</button>
					{:else if element.isTask}
						<button
							bind:this={dateBadgeEl}
							class="schedule-overlay-btn"
							onclick={openDatepicker}
							title="Schedule task"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
						</button>
					{/if}
				</div>
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
				{#if element.scheduledDate}
					<span
						class="meta-tag scheduled-date-tag"
						style={`--meta-tag-bg: ${color}5F;`}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
						{element.scheduledDate}
					</span>
				{/if}
				{#if refCount > 0}
					<span class="meta-tag ref-count-tag" style={`--meta-tag-bg: ${color}5F;`} title="{refCount} daily note {refCount === 1 ? 'reference' : 'references'}">
						{refCount} {refCount === 1 ? 'session' : 'sessions'}
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

{#if showDatepicker}
	<Portal>
		<div class="datepicker-popup" style={datepickerPopupStyle} bind:this={datepickerPopupEl}>
			<Datepicker
				inline={true}
				value={element.scheduledDate ? new Date(element.scheduledDate + 'T00:00:00') : undefined}
				onselect={(date: Date) => handleScheduledDateSelect(date)}
				showActionButtons={true}
				onclear={handleClearScheduledDate}
			/>
		</div>
	</Portal>
{/if}

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
		gap: 6px;
		position: relative;
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
		flex-wrap: wrap;
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
		gap: 3px;
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

	.scheduled-date-tag {
		gap: 3px;
	}

	.element-input {
		width: 100%;
		padding: 4px;
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.top-row-actions {
		position: absolute;
		right: 20px;
		top: 0;
		display: flex;
		align-items: center;
		gap: 2px;
		opacity: 0;
		pointer-events: none;
		padding-left: 4px;
		border-radius: 4px;
	}

	.element-content:hover .delete-btn {
		opacity: 1;
	}

	.element-content:hover .top-row-actions {
		opacity: 1;
		pointer-events: auto;
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

	.schedule-overlay-btn {
		background: var(--background-primary);
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

	.schedule-overlay-btn:hover {
		color: var(--text-normal);
	}

	.children {
		margin-left: 24px;
		font-size: 0.9em;
		color: var(--text-muted);
	}

	.child-item {
		padding: 2px 0;
	}


	.ref-count-tag {
		font-size: 0.75em;
		opacity: 0.8;
	}

	.datepicker-popup {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-primary);
		box-shadow: var(--shadow-s);
	}
</style>