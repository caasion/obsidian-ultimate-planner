<script lang="ts">
	import type { Track } from "src/plugin/types";
	import type { TrackNoteService } from "src/tracks/logic/trackNote";
	import EditableText from "src/components/EditableText.svelte";
	import EditableMarkdownText from "src/components/EditableMarkdownText.svelte";
	import TrackMiniGantt from "./TrackMiniGantt.svelte";
	import { isTrackActiveByProjects } from "src/plugin/helpers";
	import { type App } from "obsidian";

	interface Props {
		track: Track;
		trackId: string;
		trackNoteService: TrackNoteService;
		app: App;
	}

	let { track, trackId, trackNoteService, app }: Props = $props();

	const isActive = $derived(isTrackActiveByProjects(track));
	const projectCount = $derived(Object.keys(track.projects).length);
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
			</div>
		</div>

		<EditableText
			value={track.label}
			onSave={(label) => trackNoteService.updateTrackLabel(trackId, label)}
			placeholder="Track name..."
			class="track-detail-title"
		/>

		<EditableMarkdownText
			value={track.description}
			onSave={(desc) => trackNoteService.updateTrackDescription(trackId, desc)}
			placeholder="Track description..."
			{app}
			sourcePath={track.file?.path ?? ""}
			class="track-detail-description"
		/>
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

	:global(.track-detail-title) {
		font-size: 1.8em;
		font-weight: 700;
		width: 100%;
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
</style>
