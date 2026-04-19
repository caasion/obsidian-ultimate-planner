<script lang="ts">
  import type { App } from "obsidian";
  import { PLANNER_VIEW_TYPE } from "src/planner/PlannerView";
  import { GANTT_VIEW_TYPE } from "src/gantt/GanttView";
  import { TRACKS_VIEW_TYPE } from "src/tracks/TracksView";

  interface Props {
    app: App;
    currentView: string;
  }

  let { app, currentView }: Props = $props();

  const views = [
    { type: PLANNER_VIEW_TYPE, label: "Planner" },
    { type: GANTT_VIEW_TYPE, label: "Gantt" },
    { type: TRACKS_VIEW_TYPE, label: "Tracks" },
  ];

  async function switchTo(viewType: string) {
    if (viewType === currentView) return;
    const leaves = app.workspace.getLeavesOfType(viewType);
    if (leaves.length === 0) {
      await app.workspace.getLeaf(false).setViewState({ type: viewType, active: true });
    }
    const leaf = app.workspace.getLeavesOfType(viewType)[0];
    if (leaf) app.workspace.revealLeaf(leaf);
  }
</script>

<div class="holos-view-switcher">
  {#each views as view (view.type)}
    <button
      type="button"
      class={["holos-view-switcher-btn", currentView === view.type && "holos-view-switcher-btn-active"].filter(Boolean).join(" ")}
      onclick={() => switchTo(view.type)}
      aria-current={currentView === view.type ? "page" : undefined}
    >
      {view.label}
    </button>
  {/each}
</div>

<style>
  .holos-view-switcher {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .holos-view-switcher-btn {
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    background: var(--background-primary-alt);
    color: var(--text-normal);
    cursor: pointer;
    padding: 4px 12px;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .holos-view-switcher-btn:hover:not(.holos-view-switcher-btn-active) {
    background: var(--background-modifier-hover);
  }

  .holos-view-switcher-btn-active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }
</style>
