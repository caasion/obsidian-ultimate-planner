<script lang="ts">
	import { getISODate, addDaysISO } from "src/actions/helpers";
	import { actionItems, setCell, getCell, calendarCells } from "src/state/plannerStore";
	import type { ActionItemID, ISODate } from "src/types";

    interface CellProps {
        date: ISODate;
        id: ActionItemID;
        label: string;
        color: string;
        col: number;
        contextMenu: (e: MouseEvent) => void;
    }

    let { date, id, label, color, col, contextMenu }: CellProps = $props();

    let inactive = $derived(date < getISODate(new Date()));

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class={["cell", inactive]}
    style={`color: ${color ?? ""}`}
    oncontextmenu={(e) => contextMenu(e)}
> 
    {#if (col == 0 && label !== "") || !templateStoreForDate(addDaysISO(date, -1)).includes(id)}
        <div class="row-label">{label}</div>
    {/if}
    {#each $calendarCells[date]?.[id] ?? [] as label}
        <p>{label}</p>
    {/each}
</div>