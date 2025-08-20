<script lang="ts">
	import type { PlannerState, ActionItem } from "../types";

    interface ViewProps {
        actionItems: ActionItem[];
        planner: PlannerState;
        save: () => void;
    }

    let { planner, actionItems, save }: ViewProps = $props();

    let actionItemsState = $state<ActionItem[]>(actionItems);

    function generateID() {
        return "ai-" + crypto.randomUUID();
    }

    function addActionItem() {
        actionItemsState.push({
            id: generateID(),
            label: "New",
            index: actionItems.length,
            color: "#cccccc"
        })

        actionItems = [...actionItemsState];
        save();
    }

    function deleteActionItem(id: string) {
        actionItemsState.filter(item => item.id !== id);

        actionItems = [...actionItemsState];
        save();
    }
</script>

<h1>Action Item Editor</h1>

<pre>
    {JSON.stringify(actionItems, null, 2)}
</pre>

{#each actionItemsState as item (item.id)}
<div>
    <input bind:value={item.label}/>
    <input type="color" bind:value={item.color}/>
    <button>x</button>
</div>
{/each}

<input 
    type="button"
    value="+ Add"
    onclick={() => addActionItem()}
/>