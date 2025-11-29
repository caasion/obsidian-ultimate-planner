<script lang="ts">
	import { getISODate } from "src/actions/helpers";
	import { setFloatCell, getFloatCell } from "src/state/plannerStore";
	import InputCell from "./InputCell.svelte";
	import type { ItemID, ISODate, ItemMeta } from "src/types";
	import { format } from "path";

    interface RenderItem {
		id: ItemID;
		meta: ItemMeta;
	}

    interface BlockProps {
        templates: Record<ISODate, RenderItem[]>;
        contextMenu: (e: MouseEvent, tDate: ISODate, id: ItemID, meta: ItemMeta) => void;
        focusCell: (opt: boolean) => false; // Not implemeneted
    }

    let { templates, contextMenu, focusCell }: BlockProps = $props();
</script>

<div class="float-block-container">
    {#each Object.entries(templates) as [tDate, template], block (tDate)}
    <div class="float-block">
        <div class="header-row">
            <div class="header-cell">
                {tDate}
            </div>
        </div>
        <div class="float-columns-container">
            {#each template as {id, meta}, col (id)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div>
                <div 
                    class="float-cell"
                    oncontextmenu={(e) => contextMenu(e, tDate, id, meta)}
                    style={`color: ${meta.color ?? ""}`}
                >
                    <div class="column-label">{meta.label}</div>
                    <InputCell 
                        id={`${id}-${block}-${col}`} 
                        getCell={() => getFloatCell(tDate, id)} 
                        setCell={(value: string) => setFloatCell(tDate, id, value)} 
                        {focusCell}
                    />
                </div>
            </div>
            {/each}
        </div>
    </div>
    {/each}
</div>

<style>
    .float-block-container {
		display: flex;
        flex-direction: column;
        gap: 1em;
        justify-content: center;
        align-items: center;
        padding-bottom: 4px;
	}

    .float-block {
        border: 1px solid #ccc;
        width: fit-width;
    }

    .header-row {
        border-bottom: 2px solid #ccc;
    }

    .header-cell {
        text-align: center;
		background-color: var(--theme-color);
        margin: 2px;
    }

	.float-columns-container {
		display: flex;
        justify-content: center;
        align-items: stretch;
        min-height: 3em;
	}

    .column-label {
        font-style: italic;
        font-size: small;
        padding: 4px 0px;
    }
    .float-cell {
        border-right: 1px dotted #ccc;
        padding: 4px;
        border-collapse: collapse;
        height: 100%;
        width: 10em;
    }
</style>
