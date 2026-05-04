<script lang="ts">
	import type { Element, ISODate, Time } from "src/plugin/types";
	import { formatTime, reconstructRawText } from "src/plugin/helpers";
	import { longpress } from "src/plugin/actions"
	import CircularProgress from "src/planner/ui/grid/CircularProgress.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import Portal from "src/components/Portal.svelte";
	import { onMount } from "svelte";

	interface TaskElementProps {
		element: Element;
		index: number;
		color: string;
		onUpdate: (index: number, updatedElement: Element) => void;
		onDelete: (index: number) => void;
		onToggle: (index: number) => void;
		onCancel: (index: number) => void;
	}

	let { element, index, color, onUpdate, onDelete, onToggle, onCancel }: TaskElementProps = $props();

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
		let taskStatus: ' ' | 'x' | '-' | undefined;
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

	function toggleTask() {
		if (element.isTask) {
			onToggle(index);
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
	<div class="element-row">
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
				<div class="element-checkbox-container">
					{#if element.duration && element.timeUnit}
						<CircularProgress 
							progress={element.progress}
							duration={element.duration} 
							unit={element.timeUnit}
							size={20}
						/>
					{:else if element.taskStatus}
						<input
							bind:this={checkboxRef}
							type="checkbox"
							checked={element.taskStatus == "x"}
							onchange={toggleTask}
							use:longpress={500}
							class="task-checkbox"
						/>
					{/if}
				</div>
				<span 
					class:checked={element.taskStatus == "x" || (!element.progress && element.duration) || (element.progress && element.duration && element.progress >= element.duration)} 
					class:cancelled={element.taskStatus == "-"}	
				>
					{element.text}
				</span>
				<div class="time-badge-container">
					{#if element.scheduledDate}
						<button
							bind:this={dateBadgeEl}
							class="time-badge scheduled-date-badge"
							style={`background-color: ${color}80;`}
							onclick={openDatepicker}
							title="Change scheduled date"
						>📅 {element.scheduledDate}</button>
					{:else if element.isTask}
						<button
							bind:this={dateBadgeEl}
							class="schedule-add-btn"
							onclick={openDatepicker}
							title="Schedule task"
						>📅</button>
					{/if}
					{#if element.duration && element.timeUnit}
						<span class="time-badge" style={`background-color: ${color}80;`}>
							{element.duration} {element.timeUnit}
						</span>
					{/if}
					{#if element.startTime}
						<span class="time-badge" style={`background-color: ${color}80;`}>
							{formatTime(element.startTime)}
						</span>
					{/if}
				</div>
			</div>
			<button class="delete-btn" onclick={deleteElement} title="Delete">×</button>
		{/if}
	</div>
	
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

	.element-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.element-content {
		flex: 1;
		cursor: text;
		padding: 2px 4px;
		border-radius: 2px;
		display: flex;
		align-items: center;
		min-height: 24px;
		gap: 4px;
		overflow: auto;
	}

	.element-content:hover {
		background-color: var(--background-modifier-hover);
	}

	.element-checkbox-container {
		height: 20px;
		width: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.task-checkbox {
		cursor: pointer;
		margin: 0;
	}

	.checked {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.cancelled {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.time-badge-container {
		margin-left: auto;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		justify-content: flex-end;
		align-items: center;
	}

	.time-badge {
		font-size: 0.85em;
		background-color: var(--interactive-accent);
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.element-input {
		flex: 1;
		padding: 2px 4px;
		border: 1px solid var(--interactive-accent);
		border-radius: 2px;
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.delete-btn {
		opacity: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 1.2em;
		padding: 0 4px;
		line-height: 1;
	}

	.element-row:hover .delete-btn {
		opacity: 1;
	}

	.delete-btn:hover {
		color: var(--text-error);
	}

	.children {
		margin-left: 20px;
		font-size: 0.9em;
		color: var(--text-muted);
	}

	.child-item {
		padding: 2px 0;
	}

	.scheduled-date-badge {
		font-size: 0.85em;
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		border: none;
		cursor: pointer;
		white-space: nowrap;
	}

	.scheduled-date-badge:hover {
		opacity: 0.85;
	}

	.schedule-add-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 0.9em;
		padding: 0 2px;
		opacity: 0;
		color: var(--text-muted);
	}

	.element-content:hover .schedule-add-btn {
		opacity: 0.6;
	}

	.schedule-add-btn:hover {
		opacity: 1 !important;
	}

	.datepicker-popup {
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		background: var(--background-primary);
		box-shadow: var(--shadow-s);
	}
</style>