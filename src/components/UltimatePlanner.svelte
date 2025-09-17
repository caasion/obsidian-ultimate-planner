
<script lang="ts">
    // Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table. 

    import { format, parseISO } from 'date-fns';
    import type { ISODate } from '../types'
	import { tick } from 'svelte';
	import InputCell from './InputCell.svelte';
    import type { App } from "obsidian";
    import { plannerStore } from 'src/state/plannerStore';

    interface ViewProps {
        app: App;
    }

    let { app }: ViewProps = $props();

    const DEFAULT_COLOR = "#cccccc";

    /* Template Store Reactivity */
    function templateStoreForDate(date: ISODate) {
        let best: ISODate | null = null;
        const templates = $plannerStore.templates
        for (const key in templates) {
            if (key <= date && (best === null || key > best)) best = key;
        }
        return best ? JSON.parse(JSON.stringify(templates[best])) : [];
    }

    /* Create Action Item */

    let showNewRowPrompt = $state(false);
    let newRowLabel = $state("");
    let newRowDate = $state<ISODate>(getISODate(new Date()));
    let newRowColor = $state(DEFAULT_COLOR);

    function submitNewRow(create: boolean) {
        if (create) {
            newActionItem(newRowDate, generateID(), newRowLabel, newRowColor);
        }

        newRowLabel = "";
        showNewRowPrompt = false;
        newRowColor = DEFAULT_COLOR;
    }

    /* Cell Functions */
    import { setCell, getCell } from '../actions/cellActions';
	import { newActionItem, openActionItemContextMenu } from 'src/actions/itemActions';
	import { getISODate, generateID, addDaysISO, getISODatesOfWeek, getLabelFromDateRange } from 'src/actions/helpers';

    /* Table Rendering */
    let anchorDate = $state<ISODate>(getISODate(new Date()));
    let daysOfTheWeek = $derived<ISODate[]>(getISODatesOfWeek(anchorDate));
    let weeksVisible = 1;
    const colCount = 7;
    let rows = $derived(rowsToRender(daysOfTheWeek));
    let calendarLabel = $derived(getLabelFromDateRange(daysOfTheWeek[0], daysOfTheWeek[6]));

    function rowsToRender(dates: ISODate[]): string[] {
        const actionItemIDs = dates.flatMap((date) => templateStoreForDate(date))

        return Array.from(new Set(actionItemIDs));
    }

    /* Table Navigation (Tab, Shift-tab, Enter) */
    
    let focus: { row: number, col: number, } = $state({row: 0, col: 0}); // Track focus to preserve focus at the same row

    function focusCell(row: number, col: number, fromEditor = false): boolean {
        const rowCount = rows.length;
        
        if (row > rowCount - 1 || row < 0 || col > colCount - 1 || col < 0) {
            console.warn("Attempted to focus on cell out of table bounds")
            return false; // Informs the caller whether if the focus actually worked
        }

        if (!fromEditor) {
            const cell = document.getElementById(`cell-${row}-${col}`);
            cell?.querySelector<HTMLElement>('.ProseMirror')?.focus();
        }

        focus = {row, col};
        return true;
    }

    // Currently doesn't work
    async function goTo(newDate: ISODate) { /* Maintain focus when switching weeks */
        anchorDate = newDate;
        await tick();
        focusCell(focus.row, focus.col);
    }

    // Highlight column of active day
    

    // TODO: Export to CSV or Markdown
</script>

<h1>The Ultimate Planner</h1>

<div class="header">
    <div class="nav-buttons">
        <button onclick={() => goTo(addDaysISO(anchorDate, -7))}>Previous Week</button>
        <button onclick={() => goTo(getISODate(new Date()))}>This Week</button>
        <button onclick={() => goTo(addDaysISO(anchorDate, 7))}>Next Week</button>
    </div>
    <div class="week">
        <span class="week-label">{calendarLabel}</span>
        <input type="date" bind:value={anchorDate} />
    </div>
        <!-- TODO: Custom Calendar Input that Supports Multiple Weeks -->

    <div class="new-ai">
        <button onclick={() => showNewRowPrompt = true}>+ Add</button>
        {#if showNewRowPrompt}
            <input class="new-row-label" placeholder="Enter a New Action item" bind:value={newRowLabel}>
            <input class="new-row-date" type="date" bind:value={newRowDate} />
            <input type="color" bind:value={newRowColor} />
            <button onclick={() => submitNewRow(true)}>✔</button>
            <button onclick={() => submitNewRow(false)}>❌</button>
        {/if} 
    </div>
    
</div>
<div class="grid">
    <div class="row">
        {#each daysOfTheWeek as date}
            <div class="dow-label">{format(parseISO(date), "E")}</div>
        {/each}
    </div>
    <div class="row">
        {#each daysOfTheWeek as date}
            <div class="date-label">{format(parseISO(date), "dd")}</div>
        {/each}
    </div>
    {#each rows as rowID, i (rowID)}
        <div class="row">
            {#each daysOfTheWeek as date, j (date)}
                {#if templateStoreForDate(date).includes(rowID)} <!-- only display if label is not empty (i.e. AI exists)-->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div 
                        class="cell"
                        style={`color: ${$plannerStore.actionItems[rowID].color ?? ""}`} 
                        oncontextmenu={(e) => openActionItemContextMenu(app, e, date, rowID)}
                    >
                        {#if j == 0 || !templateStoreForDate(addDaysISO(date, -1)).includes(rowID)}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                                class="row-label" 
                                oncontextmenu={(e) => openActionItemContextMenu(app, e, date, rowID)}
                            >
                                {$plannerStore.actionItems[rowID].label ?? ""}
                            </div>
                            
                        {/if}
                        <InputCell 
                            {date} {rowID} {setCell} {getCell} row={i} col={j} {focusCell} 
                        />
                    </div>
                {:else}
                    <div class="cell empty">
                        <span>-</span>
                    </div>
                    
                {/if}
            {/each}
        </div>
    {/each}
</div>

<pre>{JSON.stringify($plannerStore, null, 2) == JSON.stringify($plannerStore, null, 2)}</pre>


<pre>
    {JSON.stringify($plannerStore, null, 2)}
</pre>


<style>
    .header {
        display: flex;
        justify-content: space-between;
    }

    .week {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .week-label {
        font-weight: 600;
    }

    .date-label {
        align-content: left;
    }

    .grid {
        display: grid;
        grid-template-columns: 200px repeat(6, 1fr);
        border-collapse: collapse;
    }

    .row {
        display: contents;
    }

    .row-label {
        font-style: italic;
        font-size: small;
        padding: 4px;
    }

    .grid > .row > div {
        padding: 4px;
        border: 1px solid #ccc;
    }

    .cell.inactive {
        background-color: #3b3b3b;
    }

    .cell.empty {
        background-color: #3b3b3b;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    div.cell.active {
        /* background-color: var(--theme-color); */
    }
    
</style>