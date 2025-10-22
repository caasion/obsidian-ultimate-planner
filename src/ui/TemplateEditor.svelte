<script lang="ts">
	import { PlannerActions } from "src/actions/itemActions";
	import { templates } from "src/state/plannerStore";
	import type { HelperService, ISODate, ItemID, ItemMeta } from "src/types";

    interface ViewProps {
        plannerActions: PlannerActions;
        helper: HelperService;
    }

    let { plannerActions, helper }: ViewProps = $props();

    const sortedTemplateDates: ISODate[] = Object.keys($templates).sort();

    let selectedTemplate = $state<ISODate>(plannerActions.getTemplateDate(helper.getISODate(new Date())));
    let templateItems = $derived<Record<ItemID, ItemMeta>>($templates[selectedTemplate]);
</script>

<div class="container">
    <div class="section">
        <div class="header">
            <h2>Templates</h2>
            <button>+ Add</button>
        </div>
        <div class="templates-selector">
            {#each sortedTemplateDates as tDate} 
                <div 
                    class="template" 
                    role="button"
                    tabindex="0"
                    onclick={() => selectedTemplate = tDate}
                    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ' && (selectedTemplate = tDate))}
                >
                    {tDate}
                </div>
            {/each}
        </div>

    </div>
    <div class="section">
        <h2>Template {selectedTemplate}</h2>
        This is another div
        <div class="item-container">
            {#each Object.entries(templateItems) as [id, meta] (id) }
                <div class="item">
                    {meta.label}
                </div>
            {/each}
            
        </div>
    </div>
</div>

<style>
    .container {
        margin: 5%;
        display: flex;
        max-height: 100vh;
    }

    .section {
        border: 2px solid #acacac;
        border-style: solid;
        border-radius: 4px;
        width: 100%;
        height: 100vh;
        padding: 10px;
        margin: 0px 5px;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
    }

    .item {
        border: 2px solid #acacac;
        border-style: solid;
        border-radius: 4px;
        width: 100%;
        padding: 5px;
        margin: 5px 0px;
    }

    .template {
        padding: 5px;
    }   

    .template:hover {
        background-color: var(--theme-color-translucent-01);
        
    }
</style>