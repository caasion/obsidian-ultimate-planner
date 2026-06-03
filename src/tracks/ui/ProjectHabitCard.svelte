<script lang="ts">
	import type { Habit } from "src/plugin/types";
	import { formatTime } from "src/plugin/helpers";
	import { RRuleService } from "../logic/rrule";
	import type { HabitFunctions } from "./HabitElement.svelte";
	import { getISODate, addDaysISO } from "src/plugin/helpers";

	interface ProjectHabitCardProps {
		habit: Habit;
		color: string;
		habitFunctions: HabitFunctions;
	}

	let { habit, color, habitFunctions }: ProjectHabitCardProps = $props();

	let isEditing = $state<boolean>(false);
	let editText = $state<string>("");
	let skipBlur = $state<boolean>(false);

	// Generate the last 7 days for habit tracking squares
	let last7Days = $derived.by(() => {
		const today = getISODate(new Date());
		const days: { date: string; status: 'done' | 'not-done' | 'not-scheduled' }[] = [];

		for (let i = 6; i >= 0; i--) {
			const date = addDaysISO(today, -i);
			const scheduled = habit.rrule ? RRuleService.occursOn(habit.rrule, date) : true;

			if (!scheduled) {
				days.push({ date, status: 'not-scheduled' });
			} else {
				// We don't have actual completion data per day, so show as not-done
				// In a real implementation, this would check against daily note data
				days.push({ date, status: 'not-done' });
			}
		}
		return days;
	});

	function startEdit() {
		isEditing = true;
		let text = habit.label;
		if (habit.startTime) {
			text += ' @ ' + formatTime(habit.startTime);
		}
		if (habit.duration && habit.timeUnit) {
			const progress = habit.progress !== undefined ? `${habit.progress}/` : '';
			text += ` [${progress}${habit.duration} ${habit.timeUnit}]`;
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
		let startTime: { hours: number; minutes: number } | undefined;
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

		let raw = '- ' + label;
		if (startTime) raw += ' @ ' + formatTime(startTime);
		if (duration && timeUnit) {
			const prog = progress !== undefined ? `${progress}/` : '';
			raw += ` [${prog}${duration} ${timeUnit}]`;
		}
		if (rrule !== "") raw += ` (${RRuleService.formatRRule(rrule)})`;

		habitFunctions.onEdit({
			...habit,
			raw,
			label,
			rrule,
			startTime,
			duration,
			timeUnit,
			progress,
		});
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

<div class="habit-card">
	{#if isEditing}
		<input
			type="text"
			bind:value={editText}
			onkeydown={handleKeydown}
			onblur={saveEdit}
			class="habit-edit-input"
		/>
	{:else}
		<div class="habit-content" ondblclick={startEdit} role="button" tabindex="0">
			<div class="habit-top-row">
				<span class="habit-icon">↻</span>
				<span class="habit-label">{habit.label}</span>
				<button class="habit-delete-btn" onclick={habitFunctions.onDelete} title="Delete">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
				</button>
			</div>
			<div class="habit-meta-row">
				{#if habit.rrule !== ""}
					<span class="habit-meta-tag" style={`--tag-bg: ${color}5F;`}>
						{RRuleService.formatRRule(habit.rrule)}
					</span>
				{/if}
				{#if habit.duration && habit.timeUnit}
					<span class="habit-meta-tag" style={`--tag-bg: ${color}5F;`}>
						{habit.duration}{habit.timeUnit === 'min' ? 'm' : 'h'}
					</span>
				{/if}
				{#if habit.startTime}
					<span class="habit-meta-tag" style={`--tag-bg: ${color}5F;`}>
						{formatTime(habit.startTime)}
					</span>
				{/if}
			</div>
			<!-- <div class="habit-squares-row">
				{#each last7Days as day}
					<div
						class="habit-square"
						class:habit-square-done={day.status === 'done'}
						class:habit-square-not-scheduled={day.status === 'not-scheduled'}
						title={day.date}
					></div>
				{/each}
			</div> -->
		</div>
	{/if}
</div>

<style>
	.habit-card {
		background: rgba(255, 255, 255, 0.03);
		border-radius: 6px;
		padding: 8px 10px;
		transition: background 150ms ease;
	}

	.habit-card:hover {
		background: rgba(255, 255, 255, 0.06);
	}

	.habit-content {
		cursor: text;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.habit-top-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.habit-icon {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.habit-label {
		flex: 1;
		font-size: 0.9em;
		font-weight: 500;
		line-height: 1.4;
		word-break: break-word;
	}

	.habit-delete-btn {
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
	}

	.habit-card:hover .habit-delete-btn {
		opacity: 1;
	}

	.habit-delete-btn:hover {
		color: var(--text-error);
	}

	.habit-meta-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-left: 20px;
		flex-wrap: wrap;
	}

	.habit-meta-tag {
		font-size: 0.75em;
		color: var(--text-normal);
		padding: 1px 6px;
		border-radius: 4px;
		border: 1px solid var(--tag-bg);
		background: var(--tag-bg);
		white-space: nowrap;
		line-height: 1.4;
	}

	.habit-squares-row {
		display: flex;
		gap: 3px;
		padding-left: 20px;
		margin-top: 2px;
	}

	.habit-square {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.habit-square-done {
		background: #4caf50;
		border-color: #4caf50;
	}

	.habit-square-not-scheduled {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.habit-edit-input {
		width: 100%;
		padding: 4px 8px;
		border: 1px solid var(--interactive-accent);
		border-radius: 4px;
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 0.9em;
	}
</style>
