<script lang="ts">
	import type { Track } from "src/plugin/types";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";
	import EditableText from "src/components/EditableText.svelte";
	import EditableMarkdownText from "src/components/EditableMarkdownText.svelte";
	import TrackMiniGantt from "./TrackMiniGantt.svelte";
	import Datepicker from "src/components/Datepicker.svelte";
	import { isTrackActive, getISODate } from "src/plugin/helpers";
	import { parseISO, isValid } from "date-fns";
	import { type App, Notice } from "obsidian";

	interface Props {
		track: Track;
		trackId: string;
		trackNoteService: TrackNoteService;
		app: App;
	}

	let { track, trackId, trackNoteService, app }: Props = $props();

	const isActive = $derived(isTrackActive(track));
	const projectCount = $derived(Object.keys(track.projects).length);

	let colorInputRef = $state<HTMLInputElement | undefined>(undefined);

	function handleColorChange(e: Event) {
		const input = e.target as HTMLInputElement;
		trackNoteService.updateTrackColor(trackId, input.value);
	}

	async function handleAddProject() {
		const project = trackNoteService.newProjectFactory(trackId);
		const success = await trackNoteService.createProject(trackId, project);
		if (success) new Notice(`Project "${project.label}" created`);
		else new Notice('Failed to create project');
	}

	function toDate(iso?: string): Date | undefined {
		if (!iso) return undefined;
		const parsed = parseISO(iso);
		return isValid(parsed) ? parsed : undefined;
	}

	function handleEffectiveDateSelect(selection: unknown) {
		const range = selection as { from?: Date; to?: Date } | undefined;
		const from = range?.from;
		if (!from) return;
		const effective = range?.to
			? { start: getISODate(from), end: getISODate(range.to) }
			: { start: getISODate(from) };
		trackNoteService.updateTrackFrontmatter(trackId, { effective });
	}
</script>

<div class="track-detail-content">
	<!-- Track Header -->
	<div class="track-detail-header">
		<div class="track-detail-header-top">
			<div class="track-status-badge" class:active={isActive}>
				<span class="track-status-dot">{isActive ? '●' : '○'}</span>
				<span>{isActive ? 'Active' : 'Inactive'}</span>
			</div>
			<div class="track-meta">
				<span class="track-meta-item">{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
				<button class="track-add-project-btn" onclick={handleAddProject} title="Add new project">
					+ New Project
				</button>
			</div>
		</div>

		<div class="track-title-row">
			<EditableText
				value={track.label}
				onSave={(label) => trackNoteService.updateTrackLabel(trackId, label)}
				placeholder="Track name..."
				class="track-detail-title"
			/>
			<button
				class="track-color-btn"
				style={`background: ${track.color};`}
				title="Change track color"
				onclick={() => colorInputRef?.click()}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2Z"/></svg>
			</button>
			<input
				bind:this={colorInputRef}
				type="color"
				value={track.color}
				onchange={handleColorChange}
				class="track-color-input-hidden"
			/>
		</div>

		<EditableMarkdownText
			value={track.description}
			onSave={(desc) => trackNoteService.updateTrackDescription(trackId, desc)}
			placeholder="Track description..."
			{app}
			sourcePath={track.file?.path ?? ""}
			class="track-detail-description"
		/>
	</div>

	<!-- Effective Dates -->
	<div class="track-detail-section">
		<div class="track-detail-section-header">
			<h3 class="track-detail-section-title">Effective Dates</h3>
		</div>
		<div class="effective-date-picker">
			<Datepicker
				range
				rangeFrom={toDate(track.effective.start)}
				rangeTo={toDate(track.effective.end)}
				placeholder="Select start - end"
				openEndedLabel="Present"
				onselect={handleEffectiveDateSelect}
			/>
		</div>
	</div>

	<!-- Mini Gantt Chart -->
	<div class="track-detail-section">
		<div class="track-detail-section-header">
			<h3 class="track-detail-section-title">Timeline</h3>
		</div>
		<TrackMiniGantt {track} />
	</div>
</div>

<style>
	.track-detail-content {
		padding: 24px 32px;
	}

	.track-detail-header {
		margin-bottom: 32px;
	}

	.track-detail-header-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 8px;
	}

	.track-status-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8em;
		color: var(--text-muted);
		padding: 2px 8px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.05);
	}

	.track-status-badge.active {
		color: var(--color-green, #4CAF50);
		background: rgba(76, 175, 80, 0.1);
	}

	.track-status-dot {
		font-size: 0.8em;
	}

	.track-meta {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.track-meta-item {
		font-size: 0.8em;
		color: var(--text-faint);
	}

	.track-title-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	:global(.track-detail-title) {
		font-size: 1.8em;
		font-weight: 700;
		flex: 1;
	}

	.track-color-btn {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 0;
		box-shadow: none;
		transition: border-color 150ms ease;
	}

	.track-color-btn svg {
		color: rgba(255, 255, 255, 0.8);
		mix-blend-mode: difference;
	}

	.track-color-btn:hover {
		border-color: rgba(255, 255, 255, 0.5);
	}

	.track-color-input-hidden {
		position: absolute;
		width: 0;
		height: 0;
		opacity: 0;
		pointer-events: none;
	}

	.track-add-project-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8em;
		padding: 2px 8px;
		border-radius: 4px;
		box-shadow: none;
	}

	.track-add-project-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-normal);
	}

	:global(.track-detail-description) {
		font-size: 0.9em;
		color: var(--text-muted);
		margin-top: 8px;
	}

	.track-detail-section {
		margin-bottom: 32px;
	}

	.track-detail-section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.track-detail-section-title {
		font-size: 1.1em;
		font-weight: 600;
		color: var(--text-normal);
		margin: 0;
	}

	.track-section-action-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 0.8em;
		padding: 2px 8px;
		border-radius: 4px;
		box-shadow: none;
	}

	.track-section-action-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-normal);
	}

	.effective-date-picker {
		max-width: 320px;
	}
</style>
