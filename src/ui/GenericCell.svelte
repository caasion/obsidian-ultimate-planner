<script lang="ts">
	import { getISODate, addDaysISO } from "src/actions/helpers";
	import { setCell, getCell } from "src/state/plannerStore";
	import InputCell from "./InputCell.svelte";
	import type { ItemID, ISODate } from "src/types";

    interface CellProps {
        date: ISODate;
        id: ItemID;
        type: "actionItem" | "calendar";
        label: string;
        color: string;
        templateDate: ISODate;
        row?: number;
        col: number;
        contextMenu: (e: MouseEvent) => void;
        focusCell?: () => void;
    }

    let { date, id, label, color, templateDate, row, col, contextMenu, focusCell }: CellProps = $props();

    let inactive = $derived(date < getISODate(new Date()));

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class={["cell", inactive]}
    style={`color: ${color ?? ""}`}
    oncontextmenu={(e) => contextMenu(e)}
> 
    <!-- The condition to render the label for the item. -->
    {#if (col == 0 && label !== "") || start == date}
        <div class="row-label">{label}</div>
    {/if}
    <InputCell {date} rowID={id} {setCell} {getCell} {row} {col} {focusCell} />
</div>

<style>
.cell {
    border-top-style: dashed;
    border-bottom-style: dashed;
}

.cell.inactive {
    background-color: #2f2f2f !important;
}

.cell.empty {
    background-color: #3b3b3b;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cell p {
    margin: 0px;
}

.row-label {
    font-style: italic;
    font-size: x-small;
    padding: 4px 0px;
}
</style>
