<script lang="ts">
	import { getISODate, addDaysISO } from "src/actions/helpers";
	import { actionItems, setCell, getCell } from "src/state/plannerStore";
	import InputCell from "./InputCell.svelte";
	import type { ActionItemID, ISODate } from "src/types";

    interface CellProps {
        date: ISODate;
        id: ActionItemID;
        label: string;
        color: string;
        row: number;
        col: number;
        contextMenu: (e: MouseEvent) => void;
        focusCell: () => void;
    }

    let { date, id, label, color , row, col, contextMenu, focusCell }: CellProps = $props();

    let inactive = $derived(date < getISODate(new Date()));

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class={["cell", inactive]}
    style={`color: ${$actionItems[id].color ?? ""}`}
    oncontextmenu={(e) => contextMenu(e)}
> 
    {#if (col == 0 && label !== "") || !templateStoreForDate(addDaysISO(date, -1)).includes(id)}
        <div class="row-label">{label}</div>
    {/if}
    <InputCell {date} rowID={id} {setCell} {getCell} {row} {col} {focusCell} />
</div>