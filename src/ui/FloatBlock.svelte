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
            <div 
                class="float-column"
                oncontextmenu={(e) => contextMenu(e, tDate, id, meta)}
                style={`color: ${meta.color ?? ""}`}
            >
                <div class="column-label">
                    {meta.label}
                </div>
                <div class="float-cell">
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

