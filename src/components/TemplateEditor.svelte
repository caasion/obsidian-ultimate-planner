<script lang="ts">
	import { plannerStore } from "src/state/plannerStore";
	import type { ActionItemID, ISODate, PlannerState } from "src/types";

    interface ViewProps {
        save: () => void;
    }

    let { save }: ViewProps = $props();

    let planner = $state<PlannerState>($plannerStore);

    const dates = $derived<ISODate[]>(Object.keys(planner.templates).sort());

    function swapActionItems(date: ISODate, a: number, b: number) {
    
        const current = planner.templates[date] ?? [];
        const next = [...current];

        if (a <= 0 && b <= 0) return;
        if (a >= next.length || b >= next.length) return;

        [next[a], next[b]] = [next[b], next[a]];
        planner.templates[date] = next;
        // plannerStore.set(planner);
        // save();
        
    }
</script>

{#each dates as date (date)}
    <h3>{date}</h3>
    {#each planner.templates[date] as rowID, i}
        <div class="action-item">
            <p>{planner.actionItems[rowID].label}</p>
            <button onclick={() => swapActionItems(date, i, i-1)}>↑</button>
            <button onclick={() => swapActionItems(date, i, i+1)}>↓</button>
        </div>
    {/each}
{/each}

<pre>
    {JSON.stringify(planner.templates, null, 2)}
</pre>

<style>
    .action-item {
        display: flex;
        align-items: center;
    }
</style>