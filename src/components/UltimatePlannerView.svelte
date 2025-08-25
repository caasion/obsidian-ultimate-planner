<script lang="ts">
    import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
    import type { Day } from 'date-fns';
    import { templateForDate } from '../templates'

    //Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table. 

    import type { ISODate, ActionItem, PlannerState, DayData } from '../types'
	import { onMount, tick } from 'svelte';
	import InputCell from './InputCell.svelte';

    interface ViewProps {
        planner: PlannerState;
        save: () => void;
    }

    let { planner, save }: ViewProps = $props();

    let plannerState = $state<PlannerState>({
        cells: {},
        days: {},
        templates: {
            ["2025-08-10"]: [
                {
                    id: "ai-6d77235b-073a-48fa-a104-2bc18ffcb7d0",
                    index: 0,
                    label: "FIrst Action Item",
                    color: "#cccccc"
                }, 
                {
                    id: "ai-7f0f4774-53e2-46ee-88e5-dd1532a9a795",
                    index: 0,
                    label: "Second Action Item",
                    color: "#cccccc"
                }
            ],
            ["2025-08-27"]: [
                {
                    id: "ai-6d77235b-073a-48fa-a104-2bc18ffcb7d0",
                    index: 0,
                    label: "FIrst Action Item",
                    color: "#cccccc"
                }, 
                {
                    id: "ai-7f0f4774-53e2-46ee-88e5-dd1532a9a795",
                    index: 0,
                    label: "Second Action Item",
                    color: "#cccccc"
                },
                {
                    id: generateID(),
                    index: 0,
                    label: "Third Action Item",
                    color: "#cccccc"
                }
            ] 
        }
    })

    /* Helper Functions */
    function generateID() {
        return "ai-" + crypto.randomUUID();
    }

    function getISODate(date: Date): ISODate {
        return format(date, "yyyy-MM-dd")
    }

    function getLabelFromRowID(date: ISODate, rowID: string) {
        return plannerState.days[date] 
            ? plannerState.days[date].items.filter(item => item.id === rowID)[0]?.label ?? ""
            : templateForDate(plannerState.templates, date).filter(item => item.id === rowID)[0]?.label ?? ""
    }

    function generateDayData(template: ActionItem[]): DayData {
        return { items: template, isDirty: false };
    }

    /* Day Data Functions */

    function updateDayData(date: ISODate, rowID, label, color) {
        const today = getISODate(new Date());

        /** Expected Behavior
          * Changing the past will only make the day "dirty"
          * Changing the present will create a new template that applies from today on
          * Changing the future will also create a new template that applies from that date 
        **/ 

        if (date === today) { // If it's today, then we add to or update the template
            console.log("updating today!")
            const current = templateForDate(plannerState.templates, today)

            plannerState.templates[date] ??= []; // Initialize template

            const newTemplate = current.some(ai => ai.id === rowID)
                ? current.map(ai => ai.id === rowID ? {...ai, index: 0, label, color} : ai)
                : [...current, {id: rowID, index: 0, label, color}]
            
            plannerState.templates = {...plannerState.templates, [date]: newTemplate};
            planner.templates = plannerState.templates;
            // TODO: Add Index logic (involves the rowsNeeded Function too)
        }

        if (!plannerState.days[date]) {
            plannerState.days[date] = generateDayData(templateForDate(plannerState.templates, date));
        }
    }   

    /* Cell Functions */
    function setCell(date: ISODate, rowID, text): void {
        
        // Update Cell Information
        plannerState.cells[date] ??= {}; // Initialize Cell

        plannerState.cells[date][rowID] = text;
        planner.cells = plannerState.cells;
        // save();

        // Update Day Information
        if (!plannerState.days[date]) {
            plannerState.days[date] = generateDayData(templateForDate(plannerState.templates, date));
        }
    }

    function getCell(date, rowID): string {

        if (!plannerState.cells[date] || !plannerState.cells[date][rowID]) {
            return "";
        }

        return plannerState.cells[date][rowID];
    }

    /* Table Rendering */
    let anchorDate = $state<ISODate>(getISODate(new Date()));
    let weeksVisible = 1;

    function getISODatesOfWeek(anchorDate: ISODate, weekStartsOn: Day = 0): ISODate[] {
        const date = parseISO(anchorDate);
    
        const start = startOfWeek(date, { weekStartsOn });
        const end = endOfWeek(date, { weekStartsOn });
    
        const days = eachDayOfInterval({ start, end });
    
        return days.map(day => format(day, "yyyy-MM-dd"))
    }

    let daysOfTheWeek = $derived<ISODate[]>(getISODatesOfWeek(anchorDate));

    const colCount = 7;
    let rows = $derived(rowsNeeded(daysOfTheWeek));

    function rowsNeeded(dates: ISODate[]): string[] {
        const actionItems = dates.map(date => plannerState.days[date] ? plannerState.days[date].items : templateForDate(plannerState.templates, date)).flat().map(ai => ai.id);

        return Array.from(new Set(actionItems.map(obj => JSON.stringify(obj)))).map(e => JSON.parse(e))
    }

    

    // Navigation Between Weeks
    function addDaysISO(iso: ISODate, n: number): ISODate {
        return getISODate(addDays(parseISO(iso), n));
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
    
    let focus: { row: number, col: number, } = $state({row: 0, col: 0}); // Track focus to preserve focus at the same row

    function focusCell(row, col): boolean {
        const rowCount = rows.length;
        
        if (row > rowCount - 1 || row < 0 || col > colCount - 1 || col < 0) {
            console.warn("Attempted to focus on cell out of table bounds")
            return false; // Informs the caller whether if the focus actually worked
        }

        document.getElementById(`cell-${row}-${col}`).focus();
        focus = {row, col};
        return true;
    }

    function handleKeyDown(event, row, col) {
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

<h1>The Ultimate Planner</h1>

<pre>
    {JSON.stringify(plannerState, null, 2)}
</pre>

<div class="header">
    <div>
        <button onclick={() => goTo(addDaysISO(anchorDate, -7))}>prev</button>
        <button onclick={() => goTo(getISODate(new Date()))}>today</button>
        <button onclick={() => goTo(addDaysISO(anchorDate, 7))}>next</button>
    </div>
    <div>
        <label for="date-input">{calendarLabel}</label>
        <input type="date" bind:value={anchorDate} /></div>
        <!-- TODO: Custom Calendar Input that Supports Multiple Weeks -->
    
</div>
<div class="grid">
    <div class="row">
        {#each daysOfTheWeek as date}
            <div>{format(parseISO(date), "dd")}</div>
        {/each}
    </div>
    {#each rows as rowID, i (rowID)}
        <div class="row">
            {#each daysOfTheWeek as date, j (date)}
                <div>
                    <span>{rowID}</span>
                    <input class="row-label" value={getLabelFromRowID(date, rowID)} onchange={(e) => updateDayData(date, rowID, (e.target as HTMLInputElement).value, "#dddddd")} />
                    <InputCell 
                        className={date == activeDate ? "active" : ""} {date} {rowID} {setCell} {getCell} row={i} col={j} {handleKeyDown} {focusCell} 
                    />
                </div>
            {/each}
        </div>
    {/each}
</div>

<style>
    .grid {
        display: grid;
        grid-template-columns: 200px repeat(6, 1fr);
        border-collapse: collapse;
    }

    .row {
        display: contents;
    }

    .row-label {
        padding: 4px;
        border: 1px solid #ccc;
    }

        .grid > .row > div {
        padding: 4px;
        border: 1px solid #ccc;
    }
    
</style>