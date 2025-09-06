<script lang="ts">
	import type { ActionItemID, ISODate } from "src/types";

    interface ViewProps {
        templates: Record<ISODate, ActionItemID[]>;
        save: () => void;
    }

    let { templates, save }: ViewProps = $props();

    let templatesState = $state<Record<ISODate, ActionItemID[]>>(templates)

    const dates = $derived<ISODate[]>(Object.keys(templates).sort());

    function swapActionItems(date: ISODate, a: number, b: number) {
        var itemB = templatesState[date][b];
        templatesState[date][b] = templatesState[date][a];
        templatesState[date][a] = itemB; 

        templates = templatesState;
        save();
    }
</script>

{#each dates as date (date)}
    <h3>{date}</h3>
    {#each templatesState[date] as rowID, i}
        <p>{rowID}</p>
        <button onclick={() => swapActionItems(date, i, i-1)}>↑</button>
        <button onclick={() => swapActionItems(date, i, i+1)}>↓</button>
    {/each}
{/each}

<pre>
    {JSON.stringify(templatesState, null, 2)}
</pre>