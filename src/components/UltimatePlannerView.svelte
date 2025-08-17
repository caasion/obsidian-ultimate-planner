<script lang="ts">
    import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
    import type { Day } from 'date-fns';

    //Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table. 

    import type { ISODate, ActionItem, PlannerState } from '../types'
	import { onMount } from 'svelte';
	import InputCell from './InputCell.svelte';

    let plannerState = $state<PlannerState>({ cells: {}})

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
    }

    function getCell(date, rowID): string {

        if (!plannerState.cells[date] || !plannerState.cells[date][rowID]) {
            return "";
        }

        return plannerState.cells[date][rowID];
    }
    
    // Multiple Action Items
    const actionItems: ActionItem[] = [
        {
            id: "fitness",
            index: 0,
            label: "Fitness",
        },
        {
            id: "coding",
            index: 1,
            label: "Coding",
        },
    ]

    // Seed the rows
    
    // daysOfTheWeek.forEach(day => {
    //         actionItems.forEach(ai => {
    //             setCell(day, ai.id, "hello world");
    //         })

    //         // setCell(day, "fitness", "hello world");
    //     })

    // Navigation
    let anchorDate = $state(getISODateOfToday());

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
    


</script>

<pre>
    {JSON.stringify(anchorDate)}
</pre>

<pre>
    {JSON.stringify(plannerState, null, 2)}
</pre>

<h1>The Ultimate Planner</h1>

<div class="grid">
    <div class="header">
        <div>
            <button onclick={() => anchorDate = addDaysISO(anchorDate, -7)}>prev</button>
            <button onclick={() => anchorDate = getISODateOfToday()}>today</button>
            <button onclick={() => anchorDate = addDaysISO(anchorDate, 7)}>next</button>
        </div>
        <div></div>
        <div class="row">
            {#each daysOfTheWeek as date}
                {date}
                {format(date, "dd")}
            {/each}
        </div>
    </div>
    {#each actionItems as row (row.id)}
        <div class="row">
            <div class="row-label">{row.label}</div>
            {#each daysOfTheWeek as date (date)}
                {date}
                <InputCell {date} rowID={row.id} {setCell} {getCell} />
            {/each}
        </div>
    {/each}
    

</div>

<style>


    .grid {
        grid-template-columns: 200px repeat(7, 1fr);
    }
    
</style>