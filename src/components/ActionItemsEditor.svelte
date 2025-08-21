<script lang="ts">
	import type { PlannerState, ActionItem } from "../types";
    import { actionItemsStore } from '../stores'

    let actionItems = $state<ActionItem[]>();

    $effect(() => {
        const unsub = actionItemsStore.subscribe((v) => {
            actionItems = v;
        });
        return unsub
    })    

    function generateID() {
        return "ai-" + crypto.randomUUID();
    }

    function addActionItem() {
        actionItemsStore.update(store => [
            ...store,
            {
            id: generateID(),
            label: "New",
            index: store.length,
            color: "#cccccc"
        }
        ])
    }

    function changeActionItem(id, label, color) {
        console.log("updating store")
        actionItemsStore.update(store => store.map(ai => ai.id===id ? {...ai, label, color} : ai))
    }

    function deleteActionItem(id: string) {
        actionItemsStore.update(a => a.filter(ai => ai.id !== id).map((x,i)=>({...x, index:i})));
    }
</script>

<h1>Action Item Editor</h1>

<pre>
    {JSON.stringify(actionItems, null, 2)}
</pre>

{#each actionItems as item (item.id)}
<div>
    <input value={item.label} oninput={(e) => changeActionItem(item.id, (e.target as HTMLInputElement).value, item.color)}/>
    <input type="color" value={item.color} oninput={(e) => changeActionItem(item.id, item.label, (e.target as HTMLInputElement).value)}/>
    <button>x</button>
</div>
{/each}

<input 
    type="button"
    value="+ Add"
    onclick={() => addActionItem()}
/>