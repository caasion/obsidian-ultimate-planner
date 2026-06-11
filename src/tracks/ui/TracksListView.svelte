<script lang="ts">
	import type { Track, Project } from "src/plugin/types";
	import type { TrackNoteService } from "../logic/trackNote";
	import { isProjectActive, isTrackActive, getISODate } from "src/plugin/helpers";
	import { isValid, parseISO } from "date-fns";
	import { type App, Notice, Component, MarkdownRenderer } from "obsidian";
	import { NewTrackModal } from "./components/NewTrackModal";
	import { dropLineDnd } from "src/components/dropLineDnd";

	interface TracksListViewProps {
		app: App;
		trackNoteService: TrackNoteService;
	}

	let { app, trackNoteService }: TracksListViewProps = $props();

	const trackStore = trackNoteService.parsedTracksContent;
	const parsedTracks = $derived($trackStore);
	const sortedTracks = $derived(
		Object.values(parsedTracks).sort((a, b) => {
			const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
			const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.label.localeCompare(b.label);
		})
	);

	// Filter state: 'all' | 'active' | 'retired'
	let filterMode = $state<'all' | 'active' | 'retired'>('all');

	function isTrackRetired(track: Track): boolean {
		return !isTrackActive(track);
	}

	const filteredTracks = $derived.by(() => {
		if (filterMode === 'active') return sortedTracks.filter(isTrackActive);
		if (filterMode === 'retired') return sortedTracks.filter(isTrackRetired);
		return sortedTracks;
	});

	function formatDateRange(track: Track): string {
		if (!track.effective) return '';
		const formatDate = (d: string) => {
			const parsed = parseISO(d);
			if (!isValid(parsed)) return d;
			return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		};
		const start = formatDate(track.effective.start);
		const end = track.effective.end ? formatDate(track.effective.end) : 'Present';
		return `${start} - ${end}`;
	}

	function getActiveProjects(track: Track): Project[] {
		return Object.values(track.projects).filter(isProjectActive);
	}

	// Dynamic project tag visibility based on container width
	let visibleCounts = $state<Map<string, number>>(new Map());
	let projectContainerRefs = new Map<string, HTMLDivElement>();

	function measureProjectTags(trackId: string) {
		const container = projectContainerRefs.get(trackId);
		if (!container) return;

		const tags = Array.from(container.querySelectorAll<HTMLElement>('.project-tag:not(.overflow-tag)'));
		const overflowTag = container.querySelector<HTMLElement>('.project-tag.overflow-tag');
		if (tags.length === 0) return;

		// Temporarily show all tags for measurement
		const hiddenTags: HTMLElement[] = [];
		tags.forEach((tag) => {
			if (tag.classList.contains('dnd-measure-hidden')) {
				tag.classList.remove('dnd-measure-hidden');
				hiddenTags.push(tag);
			}
		});
		const overflowWasHidden = overflowTag?.classList.contains('dnd-measure-hidden') ?? false;
		if (overflowTag) overflowTag.classList.remove('dnd-measure-hidden');

		const containerWidth = container.clientWidth;
		const gap = 6;

		// Measure each tag's width
		const tagWidths = tags.map(t => t.offsetWidth);
		const overflowBadgeWidth = overflowTag ? overflowTag.offsetWidth : 30;

		// First check: do ALL tags fit without any badge?
		let totalWidth = 0;
		for (let i = 0; i < tagWidths.length; i++) {
			totalWidth += (i > 0 ? gap : 0) + tagWidths[i];
		}

		let fitCount: number;
		if (totalWidth <= containerWidth) {
			// Everything fits, no badge needed
			fitCount = tags.length;
		} else {
			// Not everything fits — figure out how many fit WITH a badge
			fitCount = 0;
			let usedWidth = 0;
			for (let i = 0; i < tags.length; i++) {
				const widthNeeded = (fitCount > 0 ? gap : 0) + tagWidths[i];
				// Always reserve space for the overflow badge since we know not everything fits
				const badgeSpace = gap + overflowBadgeWidth;
				if (usedWidth + widthNeeded + badgeSpace <= containerWidth) {
					usedWidth += widthNeeded;
					fitCount++;
				} else {
					break;
				}
			}
			// Ensure at least 1 tag visible
			if (fitCount === 0) fitCount = 1;
		}

		// Restore previous display values
		hiddenTags.forEach((tag) => {
			tag.classList.add('dnd-measure-hidden');
		});
		if (overflowTag && overflowWasHidden) overflowTag.classList.add('dnd-measure-hidden');

		visibleCounts.set(trackId, fitCount);
		visibleCounts = new Map(visibleCounts);
	}

	function projectContainerAction(el: HTMLDivElement, trackId: string) {
		projectContainerRefs.set(trackId, el);
		return {
			destroy() {
				projectContainerRefs.delete(trackId);
			}
		};
	}

	// Measure after render and on resize
	$effect(() => {
		// Access filteredTracks to re-run when tracks change
		filteredTracks;

		// Use tick + rAF to ensure DOM is fully painted before measuring
		const frame = requestAnimationFrame(() => {
			for (const trackId of projectContainerRefs.keys()) {
				measureProjectTags(trackId);
			}
		});

		const observer = new ResizeObserver(() => {
			for (const trackId of projectContainerRefs.keys()) {
				measureProjectTags(trackId);
			}
		});

		for (const [, el] of projectContainerRefs) {
			observer.observe(el);
		}

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

	// Track description expand state
	let expandedDescriptions = $state<Set<string>>(new Set());

	function toggleDescription(trackId: string) {
		const next = new Set(expandedDescriptions);
		if (next.has(trackId)) next.delete(trackId);
		else next.add(trackId);
		expandedDescriptions = next;
	}

	// Markdown rendering for descriptions
	let descriptionRefs = $state<Map<string, HTMLDivElement>>(new Map());
	let renderComponents = new Map<string, Component>();

	function setDescriptionRef(trackId: string, el: HTMLDivElement | undefined) {
		if (el) {
			descriptionRefs.set(trackId, el);
			descriptionRefs = new Map(descriptionRefs);
		}
	}

	$effect(() => {
		for (const [trackId, container] of descriptionRefs) {
			const track = parsedTracks[trackId];
			if (!track?.description || !container) continue;

			// Clean up previous render
			renderComponents.get(trackId)?.unload();
			container.empty();

			const comp = new Component();
			renderComponents.set(trackId, comp);

			MarkdownRenderer.render(app, track.description, container, track.file?.path ?? "", comp).catch(() => {
				container.setText(track.description);
			});
		}

		return () => {
			for (const comp of renderComponents.values()) {
				comp.unload();
			}
			renderComponents.clear();
		};
	});

	function handleDescriptionClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const internalLink = target.closest("a.internal-link");
		if (internalLink) {
			e.preventDefault();
			e.stopPropagation();
			const href = internalLink.getAttribute("data-href") || internalLink.getAttribute("href");
			if (href) {
				app.workspace.openLinkText(href, "", e.ctrlKey || e.metaKey);
			}
			return;
		}
		const externalLink = target.closest("a.external-link") || target.closest("a[href^='http']");
		if (externalLink) {
			return; // Let the browser handle external links
		}
	}

	// Load track content
	$effect(() => {
		trackNoteService.loadAllTrackContent();
	});

	$effect(() => {
		trackNoteService.setupFileWatchers();
		return () => trackNoteService.cleanupFileWatchers();
	});

	function handleNewTrack() {
		const nextOrder = sortedTracks.reduce((max, track) => Math.max(max, track.order), -1) + 1;
		new NewTrackModal(
			app,
			nextOrder,
			getISODate(new Date()),
			async (track: Track) => {
				const success = await trackNoteService.createTrack(track);
				if (success) new Notice(`Track "${track.label}" created`);
				else new Notice(`Failed to create track "${track.label}"`);
			}
		).open();
	}

	// Drag and drop
	function handleDndFinalize(reorderedItems: Track[]) {
		const orderedIds = reorderedItems.map(t => t.id);
		trackNoteService.reorderTracks(orderedIds);
	}

	function cycleFilter() {
		if (filterMode === 'all') filterMode = 'active';
		else if (filterMode === 'active') filterMode = 'retired';
		else filterMode = 'all';
	}
</script>

<div class="tracks-list-view">
	<div class="tracks-list-header">
		<h1 class="tracks-list-title">Tracks</h1>
		<div class="tracks-list-actions">
			<button class="tracks-new-btn" onclick={handleNewTrack}>+ New Track</button>
		</div>
	</div>

	<div
		class="tracks-list-container"
		use:dropLineDnd={{ items: filteredTracks, handleSelector: '.track-row-drag', direction: 'vertical', onFinalize: handleDndFinalize }}
	>
		{#each filteredTracks as track (track.id)}
			{@const active = isTrackActive(track)}
			{@const retired = isTrackRetired(track)}
			{@const projects = getActiveProjects(track)}
			{@const isDescExpanded = expandedDescriptions.has(track.id)}
			{@const vCount = visibleCounts.get(track.id) ?? projects.length}
			{@const hiddenCount = projects.length - vCount}
			<div class="track-row">
				<div class="track-row-drag" title="Drag to reorder">
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
				</div>
				<div class="track-row-main">
					<div class="track-row-top">
						<div class="track-row-left">
							<div class="track-row-info">
								<span class="track-row-color-bar" style={`background: ${track.color};`}></span>
								<span class="track-row-label" style={`color: ${track.color};`}>{track.label}</span>
								{#if active}
									<span class="track-status-badge active">Active</span>
								{:else if retired}
									<span class="track-status-badge retired">Retired</span>
								{:else}
									<span class="track-status-badge inactive">Inactive</span>
								{/if}
							</div>
							{#if formatDateRange(track)}
								<span class="track-row-dates">{formatDateRange(track)}</span>
							{/if}
						</div>
						<div
							class="track-row-projects"
							use:projectContainerAction={track.id}
						>
							{#each projects as project, i}
								<span
									class="project-tag"
									class:dnd-measure-hidden={i >= vCount}
									style:border-color={track.color}
									style:color={track.color}
								>{project.label}</span>
							{/each}
							{#if projects.length > 1}
								<span
									class="project-tag overflow-tag"
									class:dnd-measure-hidden={hiddenCount <= 0}
									style:border-color={track.color}
									style:color={track.color}
									title={projects.slice(vCount).map(p => p.label).join('\n')}
								>+{hiddenCount}</span>
							{/if}
						</div>
					</div>
					{#if track.description}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="track-row-description"
							class:track-row-description-expanded={isDescExpanded}
							onclick={(e) => {
								const target = e.target as HTMLElement;
								if (target.closest('a')) {
									handleDescriptionClick(e);
									return;
								}
								toggleDescription(track.id);
							}}
						>
							<div
								class="track-row-description-md"
								use:setDescriptionRef={[track.id]}
							></div>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.tracks-list-view {
		padding: 0;
		width: 100%;
	}

	.tracks-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 16px 20px 8px;
		flex-shrink: 0;
	}

	.tracks-list-title {
		font-size: 28px;
		font-weight: 700;
		color: #e6e6e6;
		margin: 0;
		flex-shrink: 0;
	}

	.tracks-list-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.tracks-new-btn {
		padding: 6px 14px;
		color: #cccccc;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		font-size: 13px;
	}

	.tracks-new-btn:hover {
		background-color: rgba(255, 255, 255, 0.10);
		color: var(--text-normal);
		border: none;

	}

	.tracks-list-container {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0 auto;
		max-width: 900px;
	}

	.track-row {
		display: flex;
		align-items: stretch;
		border-radius: 8px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.05);
		transition: background 150ms ease;
	}

	.track-row:hover {
		background: rgba(255, 255, 255, 0.07);
	}

	.track-row-drag {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8px;
		color: var(--text-faint);
		cursor: grab;
		flex-shrink: 0;
		opacity: 0.4;
	}

	.track-row-drag:active {
		cursor: grabbing;
	}

	.track-row:hover .track-row-drag {
		opacity: 0.8;
	}

	.track-row-main {
		flex: 1;
		min-width: 0;
		padding: 12px 16px 12px 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.track-row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.track-row-left {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex-shrink: 1;
	}

	.track-row-info {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.track-row-color-bar {
		width: 3px;
		height: 20px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.track-row-label {
		font-size: 1.05em;
		font-weight: 600;
		white-space: nowrap;
	}

	.track-status-badge {
		font-size: 0.7em;
		padding: 1px 8px;
		border-radius: 4px;
		font-weight: 500;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.track-status-badge.active {
		background: rgba(76, 175, 80, 0.2);
		color: #4caf50;
	}

	.track-status-badge.retired {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-muted);
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	.track-status-badge.inactive {
		background: rgba(255, 152, 0, 0.2);
		color: #ff9800;
	}

	.track-row-projects {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 1;
		min-width: 0;
		max-width: 50%;
		flex-wrap: nowrap;
		justify-content: flex-end;
	}

	.project-tag {
		font-size: 0.75em;
		padding: 2px 10px;
		border-radius: 4px;
		border: 1px solid;
		white-space: nowrap;
		font-weight: 500;
	}

	.overflow-tag {
		opacity: 0.7;
	}

	:global(.dnd-measure-hidden) {
		display: none;
	}

	.track-row-dates {
		font-size: 0.78em;
		color: var(--text-faint);
		padding-left: 11px;
	}

	.track-row-description {
		font-size: 0.82em;
		color: var(--text-muted);
		padding-left: 11px;
		margin-top: 2px;
		cursor: pointer;
		overflow: hidden;
	}

	.track-row-description:not(.track-row-description-expanded) {
		max-height: 1.5em;
	}

	.track-row-description:not(.track-row-description-expanded) .track-row-description-md {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.track-row-description:not(.track-row-description-expanded) .track-row-description-md :global(*) {
		display: inline;
	}

	.track-row-description:hover {
		color: var(--text-normal);
	}

	.track-row-description-md :global(p) {
		margin: 0;
	}

	.track-row-description-md :global(p + p) {
		margin-top: 4px;
	}

	.track-row-description-md :global(a) {
		color: var(--link-color);
		text-decoration: underline;
		cursor: pointer;
	}

	.track-row-description-md :global(a:hover) {
		color: var(--link-color-hover, var(--link-color));
	}
</style>
