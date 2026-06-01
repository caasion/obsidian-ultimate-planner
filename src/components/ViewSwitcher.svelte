<script lang="ts">
  type ViewId = 'planner' | 'timeline' | 'tracks' | 'gantt';

  type ViewItem =
    | { type?: 'view'; id: ViewId; label: string; svg: string }
    | { type: 'divider' };

  interface Props {
    currentView: ViewId;
    onNavigate: (view: ViewId) => void;
    views: ViewItem[];
  }

  let { currentView, onNavigate, views }: Props = $props();
</script>

<div class="holos-topbar-frame">
  <div class="holos-brand">Holos</div>
  <nav class="holos-nav">
    {#each views as view, i (view.type === 'divider' ? `divider-${i}` : view.id)}
      {#if view.type === 'divider'}
        <div class="holos-nav-divider"></div>
      {:else}
        <button
          type="button"
          class="holos-nav-btn"
          class:holos-nav-btn-active={currentView === view.id}
          onclick={() => onNavigate(view.id)}
          aria-current={currentView === view.id ? "page" : undefined}
        >
          <span class="holos-nav-icon">{@html view.svg}</span>
          {view.label}
        </button>
      {/if}
    {/each}
  </nav>
</div>

<style>
  .holos-topbar-frame {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 8px 16px;
    border-bottom: 1px solid #3a3a3a;
  }

  .holos-brand {
    font-size: 18px;
    font-weight: 700;
    color: #e6e6e6;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .holos-nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .holos-nav-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    border-radius: 6px;
    background: transparent;
    box-shadow: none;
    color: #999999;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .holos-nav-btn:hover:not(.holos-nav-btn-active) {
    background: rgba(255, 255, 255, 0.1);
    color: #cccccc;
  }

  .holos-nav-btn-active {
    position: relative;
    background: rgba(255, 255, 255, 0.1);
    color: #e6e6e6;
  }

  .holos-nav-btn-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 10%;
    width: 80%;
    height: 2px;
    background: var(--interactive-accent, #7c5cbf);
    border-radius: 1px;
  }

  .holos-nav-icon {
    display: flex;
    align-items: center;
    line-height: 1;
  }

  .holos-nav-divider {
    width: 1px;
    height: 16px;
    background: #4d4d4d;
    margin: 0 4px;
    flex-shrink: 0;
  }
</style>
