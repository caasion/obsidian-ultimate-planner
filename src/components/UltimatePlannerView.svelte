<script lang="ts">
    import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
    import type { Day } from 'date-fns';

    //Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table. 

    import type { ISODate, ActionItem, PlannerState } from '../types'
	import { onMount, tick } from 'svelte';
	import InputCell from './InputCell.svelte';
	import ActionItemsEditor from './ActionItemsEditor.svelte';
    import { actionItemsStore } from '../stores'

    // Subscribe to ActionItems storage
    let actionItems = $state<ActionItem[]>();

    $effect(() => {
        const unsub = actionItemsStore.subscribe((v) => {
            actionItems = v;
        });
        return unsub
    })

    interface ViewProps {
        planner: PlannerState;
        save: () => void;
    }

    let { planner, save }: ViewProps = $props();

    // Saving


    // Planner Data
    let plannerState = $state<PlannerState>(planner)

    function getISODate(date: Date): ISODate {
        return format(date, "yyyy-MM-dd")
    }

    function getISODateOfToday(): ISODate {
        return getISODate(new Date());
    }
    
    function setCell(date, rowID, text): void {
        
        if (!plannerState.cells[date]) {
            plannerState.cells[date] = {};
        }
        plannerState.cells[date][rowID] = text;
        planner.cells = plannerState.cells;
        save();
    }

    function getCell(date, rowID): string {

        if (!plannerState.cells[date] || !plannerState.cells[date][rowID]) {
            return "";
        }

        return plannerState.cells[date][rowID];
    }

    // Navigation between weeks
    let anchorDate = $state(getISODateOfToday());
    let weeksVisible = 1;

    let daysOfTheWeek = $derived(getISODatesOfWeek(anchorDate));

    function addDaysISO(iso: ISODate, n: number): ISODate {
        return getISODate(addDays(parseISO(iso), n));
    }

    function getISODatesOfWeek(anchorDate: ISODate, weekStartsOn: Day = 0): ISODate[] {
        const date = parseISO(anchorDate);
    
        const start = startOfWeek(date, { weekStartsOn });
        const end = endOfWeek(date, { weekStartsOn });
    
        const days = eachDayOfInterval({ start, end });
    
        return days.map(day => format(day, "yyyy-MM-dd"))
    }

    function getLabelOfWeek() {
        const first = parseISO(daysOfTheWeek[0]);
        const last = parseISO(daysOfTheWeek[6]);

        if (first.getFullYear() === last.getFullYear()) {
            if (first.getMonth() === last.getMonth()) {
                return `${format(first, "MMM")} ${format(first, "dd")} – ${format(last, "dd")}, ${format(first, "yyyy")}`
            } else {
                return `${format(first, "MMM")} ${format(first, "dd")} – ${format(last, "MMM")} ${format(last, "dd")}, ${format(first, "yyyy")}`
            }
        } else {
            return `${format(first, "MMM")} ${format(first, "dd")}, ${format(first, "yyyy")} – ${format(last, "MMM")} ${format(last, "dd")}, ${format(last, "yyyy")}`
        }

    }


    let calendarLabel = $derived(getLabelOfWeek());

    
    // Table Navigation (Tab, Shift-tab, Enter)
    
    const colCount = 7;

    let focus: { row: number, col: number, } = $state({row: 0, col: 0}); // Track focus to preserve focus at the same row

    function focusCell(row, col): boolean {
        const rowCount = actionItems.length;
        
        if (row > rowCount - 1 || row < 0 || col > colCount - 1 || col < 0) {
            console.warn("Attempted to focus on cell out of table bounds")
            return false; // Informs the caller whether if the focus actually worked
        }

        document.getElementById(`cell-${row}-${col}`).focus();
        focus = {row, col};
        return true;
    }

    function handleKeyDown(event, row, col) {
        console.log(event, row, col);

        const shift = event.shiftKey;
        const ctrl = event.ctrlKey;

        let successful;
        
        if (event.key === "Tab") {
            if (shift === true) {
                successful = focusCell(row, col - 1);
            } else {
                successful = focusCell(row, col + 1);
            }
        } else if (event.key === "Enter") {
            if (ctrl === true) { // Only navigate when "ctrl + enter" is hit
                successful = focusCell(row - 1, col);
            } else {
                successful = focusCell(row + 1, col);
            }
            
        } 

        if (successful) event.preventDefault();
    }

    // Maintain focus when switching weeks
    async function goTo(newDate: ISODate) {
        anchorDate = newDate;
        await tick();
        focusCell(focus.row, focus.col);
    }

    // Highlight column of active day
    let activeDate = $derived(daysOfTheWeek[focus.col])


    // TODO: Export to CSV or Markdown



</script>

<!-- <ActionItemsEditor {actionItemsStore} {save} /> -->

<h1>The Ultimate Planner</h1>

<pre>
    {JSON.stringify(plannerState, null, 2)}
</pre>

<div class="grid">
    <div class="header">
        <div>
            <button onclick={() => goTo(addDaysISO(anchorDate, -7))}>prev</button>
            <button onclick={() => goTo(getISODateOfToday())}>today</button>
            <button onclick={() => goTo(addDaysISO(anchorDate, 7))}>next</button>
        </div>
        <div>
            <label for="date-input">{calendarLabel}</label>
            <input type="date" bind:value={anchorDate} /></div>
            <!-- TODO: Custom Calendar Input that Supports Multiple Weeks -->
        <div class="row">
            {#each daysOfTheWeek as date}
                
                {format(parseISO(date), "dd")}
            {/each}
        </div>
    </div>
    {#each actionItems as row, i (row.id)}
        <div class="row">
            <div class="row-label">{row.label}</div>
            {#each daysOfTheWeek as date, j (date)}
                <InputCell className={date == activeDate ? "active" : 
            ""} {date} rowID={row.id} {setCell} {getCell} row={i} col={j} {handleKeyDown} {focusCell} />
            {/each}
        </div>
    {/each}
    

</div>

<style>
    .grid {
        grid-template-columns: 200px repeat(7, 1fr);
    }
    
</style>