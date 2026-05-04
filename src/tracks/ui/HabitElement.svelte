<script lang="ts">
	import type { Habit, Time } from "src/plugin/types";
	import { formatTime, formatProgressDuration } from "src/plugin/helpers";
	import { RRuleService } from "../logic/rrule";

	export interface HabitFunctions {
		onEdit: (habit: Habit) => void;
		onDelete: () => void;
	}

	interface HabitBlockProps {
		habit: Habit;
		color: string;
		habitFunctions: HabitFunctions;
	}

	let { habit, color, habitFunctions }: HabitBlockProps = $props();

  let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);

	function startEdit() {
		isEditing = true;
		// Build editable text from all structured fields
		let text = habit.label;
		if (habit.startTime) {
			text += ' @ ' + formatTime(habit.startTime);
		}
		if (habit.duration && habit.timeUnit) {
			text += ' ' + formatProgressDuration(habit.progress, habit.duration, habit.timeUnit);
		}
		if (habit.rrule !== "") {
			text += ` (${RRuleService.formatRRule(habit.rrule)})`;
		}
		editText = text;
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

		let text = editText;
		let label: string;
		let rrule: string = habit.rrule;
		let startTime: Time | undefined;
		let duration: number | undefined;
		let timeUnit: 'min' | 'hr' | undefined;
		let progress: number | undefined;

		const startTimeRegex = /@\s*(\d{1,2}):(\d{2})/;
		const progressDurationRegex = /\[(?:(\d+)?(\/))?(\d+)\s*(hr|min)\]/;
		const rruleRegex = /\(([^)]*)\)\s*$/;

		const startTimeMatch = text.match(startTimeRegex);
		if (startTimeMatch) {
			const [fullMatch, hours, minutes] = startTimeMatch;
			text = text.replace(fullMatch, '').trim();
			startTime = { hours: parseInt(hours), minutes: parseInt(minutes) };
		}

		const progressDurationMatch = text.match(progressDurationRegex);
		if (progressDurationMatch) {
			const [fullMatch, progressMatch, hasProgress, durationMatch, unitMatch] = progressDurationMatch;
			text = text.replace(fullMatch, '').trim();
			progress = hasProgress ? (parseInt(progressMatch) || 0) : undefined;
			duration = parseInt(durationMatch);
			timeUnit = unitMatch as 'min' | 'hr';
		}

		const rruleMatch = text.match(rruleRegex);
		if (rruleMatch) {
			const [fullMatch, rruleContent] = rruleMatch;
			text = text.replace(fullMatch, '').trim();
			rrule = RRuleService.parseRRule(rruleContent);
		}

		label = text.trim();

		// Reconstruct raw
		let raw = '- ' + label;
		if (startTime) {
			raw += ' @ ' + formatTime(startTime);
		}
		if (duration && timeUnit) {
			raw += ' ' + formatProgressDuration(progress, duration, timeUnit);
		}
		if (rrule !== "") {
			raw += ` (${RRuleService.formatRRule(rrule)})`;
		}

		const newHabit: Habit = {
			...habit,
			raw,
			label,
			rrule,
			startTime,
			duration,
			timeUnit,
			progress,
		};

		habitFunctions.onEdit(newHabit);
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
				<span>↻ {habit.label}</span>

				<div class="time-badge-container">
					{#if habit.duration && habit.timeUnit}
						<span class="time-badge" style={`background-color: ${color}80;`}>
							{habit.duration} {habit.timeUnit}
						</span>
					{/if}
					{#if habit.startTime}
						<span class="time-badge" style={`background-color: ${color}80;`}>
							{formatTime(habit.startTime)}
						</span>
					{/if}
					{#if habit.rrule !== ""}
						<div class="time-badge" style={`background-color: ${color}80;`}>
							{RRuleService.formatRRule(habit.rrule)}
						</div>
					{/if}
				</div>
			</div>
			<button class="delete-btn" onclick={habitFunctions.onDelete} title="Delete">×</button>
		{/if}

	</div>
</div>

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
		overflow: scroll;
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
		position: relative;
	}

	.time-badge {
		font-size: 0.85em;
		background-color: var(--interactive-accent);
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		cursor: pointer;
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
</style>
