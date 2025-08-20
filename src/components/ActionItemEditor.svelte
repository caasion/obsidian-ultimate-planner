<script lang="ts">
	import type { ActionItem } from "../types";

    interface ViewProps {
        actionItems: ActionItem[];
        save: () => void;
    }

    let { actionItems, save }: ViewProps = $props();

    let actionItemState = $state<ActionItem[]>(actionItems);

    function generateID() {
        return "ai-" + crypto.randomUUID();
    }

    function addActionItem() {
        actionItemState.push({
            id: generateID(),
            label: "New",
            index: actionItems.length,
            color: "#cccccc"
        })

        actionItems = actionItemState;
        save();
    }
</script>

<h1>Action Item Editor</h1>

<pre>
    {JSON.stringify(actionItems, null, 2)}
</pre>

{#each actionItemState as item (item.id)}
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