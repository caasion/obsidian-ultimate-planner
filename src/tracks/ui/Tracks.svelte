<script lang="ts">
	import type { Track } from "src/plugin/types";
	import TrackCard, { type TrackCardFunctions } from "./TrackCard.svelte";
  import type { TrackNoteService } from "../logic/trackNote";
	import { App, Notice } from "obsidian";
	import { type ProjectCardFunctions } from "./ProjectCard.svelte";
	import type { HabitFunctions } from "./HabitElement.svelte";
	import { NewTrackModal } from "./NewTrackModal";
  import { ReorderTracksModal } from "./ReorderTracksModal";
	import { getISODate } from "src/plugin/helpers";
	import ViewSwitcher from "src/components/ViewSwitcher.svelte";
	import { TRACKS_VIEW_TYPE } from "src/tracks/TracksView";

  interface TracksProps {
    app: App;
    trackNoteService: TrackNoteService;
  }

  let { app, trackNoteService }: TracksProps = $props();

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

  let showInactiveTracks = $state(false);

  function isTrackActive(track: Track): boolean {
    if (!track.effective || track.effective.length === 0) return true;
    const today = getISODate(new Date());
    return track.effective.some(interval =>
      today >= interval.start && (!interval.end || today <= interval.end)
    );
  }

  const displayedTracks = $derived(
    showInactiveTracks ? sortedTracks : sortedTracks.filter(isTrackActive)
  );

  function toggleInactiveTracks() {
    showInactiveTracks = !showInactiveTracks;
  }

  // Load track content when component mounts
  $effect(() => {
    trackNoteService.loadAllTrackContent();
  });

  // Setup file watcher with cleanup
  $effect(() => {
    trackNoteService.setupFileWatchers();
    
    return () => {
      trackNoteService.cleanupFileWatchers();
    };
  });

  function handleReorderTracks() {
    new ReorderTracksModal(app, sortedTracks, (orderedIds) => {
      trackNoteService.reorderTracks(orderedIds);
    }).open();
  }

  /** Handles the creation of a new track (modal and creation) */
  function handleNewTrack() {
    const nextOrder = sortedTracks.reduce((max, track) => Math.max(max, track.order), -1) + 1;
    
    new NewTrackModal(
      app, 
      nextOrder, 
      getISODate(new Date()),
      async (track: Track) => {
      const success = await trackNoteService.createTrack(track);
      if (success) {
        new Notice(`Track "${track.label}" created successfully`);
      } else {
        new Notice(`Failed to create track "${track.label}"`);
      }
    }).open();
  }

  // Create track-level functions for a specific track
  function createTrackFunctions(trackId: string): TrackCardFunctions {
    return {
      onLabelEdit: (label: string) => trackNoteService.updateTrackLabel(trackId, label),
      onDescriptionEdit: (description: string) => trackNoteService.updateTrackDescription(trackId, description),
      onColorEdit: (color: string) => trackNoteService.updateTrackColor(trackId, color),
      onOpenFile: () => trackNoteService.openTrackFile(trackId),
      onFrontmatterEdit: (frontmatter) => trackNoteService.updateTrackFrontmatter(trackId, frontmatter),
      onDelete: () => trackNoteService.deleteTrack(trackId),
      onProjectAdd: () => trackNoteService.createProject(trackId, trackNoteService.newProjectFactory(trackId)),
    };
  }

  // Create project-level functions factory for a specific track
  // Returns a function that takes projectId and returns ProjectCardFunctions
  function createProjectFunctionsFactory(trackId: string) {
    return (projectId: string): ProjectCardFunctions => ({
      onLabelEdit: (label: string) => trackNoteService.updateProjectLabel(trackId, projectId, label),
      onDescriptionEdit: (description: string) => trackNoteService.updateProjectDescription(trackId, projectId, description),
      onOpenFile: () => trackNoteService.openProjectFile(trackId, projectId),
      onStartDateEdit: (date) => trackNoteService.updateProjectStartDate(trackId, projectId, date),
      onEndDateEdit: (date) => trackNoteService.updateProjectEndDate(trackId, projectId, date),
      onDelete: () => trackNoteService.deleteProject(trackId, projectId),
      onHabitAdd: () => trackNoteService.addProjectHabit(trackId, projectId),
      onDataAdd: () => trackNoteService.addProjectData(trackId, projectId),
      onDataUpdate: (index, updatedElement) => trackNoteService.updateProjectData(trackId, projectId, index, updatedElement),
      onDataToggle: (index) => {
        const track = trackNoteService.getTrack(trackId);
        const element = track?.projects[projectId]?.data[index];
        if (!element?.isTask) return;
        const newStatus = element.taskStatus === 'x' ? ' ' : 'x';
        trackNoteService.updateProjectData(trackId, projectId, index, { taskStatus: newStatus });
      },
      onDataCancel: (index) => {
        const track = trackNoteService.getTrack(trackId);
        const element = track?.projects[projectId]?.data[index];
        if (!element?.isTask) return;
        trackNoteService.updateProjectData(trackId, projectId, index, { taskStatus: '-' });
      },
      onDataDelete: (index) => trackNoteService.deleteProjectData(trackId, projectId, index),

      // Phase operations
      onPhaseAdd: () => trackNoteService.addProjectPhase(trackId, projectId),
      onPhaseLabelEdit: (phaseId, label) => trackNoteService.updateProjectPhaseLabel(trackId, projectId, phaseId, label),
      onPhaseDateEdit: (phaseId, startDate, endDate) => trackNoteService.updateProjectPhaseDates(trackId, projectId, phaseId, startDate, endDate),
      onPhaseDelete: (phaseId) => trackNoteService.deleteProjectPhase(trackId, projectId, phaseId),
      onPhaseReorder: (fromIndex, toIndex) => trackNoteService.reorderProjectPhase(trackId, projectId, fromIndex, toIndex),
      onPhaseDataAdd: (phaseId) => trackNoteService.addPhaseData(trackId, projectId, phaseId),
      onPhaseDataUpdate: (phaseId, index, el) => trackNoteService.updatePhaseData(trackId, projectId, phaseId, index, el),
      onPhaseDataToggle: (phaseId, index) => trackNoteService.togglePhaseData(trackId, projectId, phaseId, index),
      onPhaseDataCancel: (phaseId, index) => trackNoteService.cancelPhaseData(trackId, projectId, phaseId, index),
      onPhaseDataDelete: (phaseId, index) => trackNoteService.deletePhaseData(trackId, projectId, phaseId, index),

      // Enable phase mode (one-way)
      onEnablePhases: () => trackNoteService.toggleProjectPhases(trackId, projectId, true),
    });
  }

  // Create habit-level functions factory for a specific track
  // Returns a function that takes projectId, which returns a function that takes habitId
  function createHabitFunctionsFactory(trackId: string) {
    return (projectId: string) => (habitId: string): HabitFunctions => ({
      onEdit: (habit) => trackNoteService.updateProjectHabit(trackId, projectId, habitId, habit),
      onDelete: () => trackNoteService.deleteProjectHabit(trackId, projectId, habitId),
    });
  }
</script>

<div class="container">
  <ViewSwitcher {app} currentView={TRACKS_VIEW_TYPE} />
  <div class="header-row">
    <h2>Manage Tracks</h2>
    <div class="header-actions">
      {#if sortedTracks.length > 1}
        <button
          class="toggle-inactive-button"
          onclick={handleReorderTracks}
          title="Reorder tracks"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      {/if}
      <button
        class="toggle-inactive-button"
        class:active={showInactiveTracks}
        onclick={toggleInactiveTracks}
        title={showInactiveTracks ? "Hide inactive tracks" : "Show inactive tracks"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          {#if showInactiveTracks}
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          {:else}
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          {/if}
        </svg>
      </button>
      <button
        class="add-track-button"
        onclick={handleNewTrack}
      >
        + New Track
      </button>
    </div>
  </div>
	<div class="card-container">
    {#each displayedTracks as track}
      <TrackCard
        {app}
        {track}
        trackFunctions={createTrackFunctions(track.id)}
        createProjectFunctions={createProjectFunctionsFactory(track.id)}
        createHabitFunctions={createHabitFunctionsFactory(track.id)}
      />
    {/each}
  </div>

  <!-- <h2>Schedule Tracks</h2> -->

</div>

<style>
    .container {
      padding: 12px;
      max-height: 80vh;
    }

		.card-container {
			display: flex;
      flex-direction: column;
      gap: 12px;
		}

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .toggle-inactive-button {
      background: transparent;
      border: 1px solid var(--background-modifier-border);
      border-radius: 6px;
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
    }

    .toggle-inactive-button:hover {
      background: var(--background-modifier-hover);
    }

    .toggle-inactive-button.active svg {
      stroke: var(--interactive-accent);
    }

    .add-track-button {
      padding: 6px 14px;
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      border: 1px solid var(--interactive-accent);
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
    }

    .add-track-button:hover {
      background-color: var(--interactive-accent-hover);
    }
</style>