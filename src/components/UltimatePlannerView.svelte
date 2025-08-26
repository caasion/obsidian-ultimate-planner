<script lang="ts">
    import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
    import type { Day } from 'date-fns';
    import { templateForDate } from '../templates'

    //Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table. 

    import type { ISODate, ActionItemID, PlannerState } from '../types'
	import { onMount, tick } from 'svelte';
	import InputCell from './InputCell.svelte';
    import type { App } from "obsidian";
    import { Menu, Modal } from "obsidian";
    import { RenameActionItemModal } from './ActionItemModals'

    interface ViewProps {
        app: App;
        planner: PlannerState;
        save: () => void;
    }

    let { app, planner, save }: ViewProps = $props();

    const DEFAULT_COLOR = "#cccccc";

    let plannerState = $state<PlannerState>({
        actionItems: {
            ["ai-abc"]: {
                index: 0,
                label: "Abc",
                color: DEFAULT_COLOR
            },
            ["ai-def"]: {
                index: 0,
                label: "Def",
                color: DEFAULT_COLOR
            },
            ["ai-ghi"]: {
                index: 0,
                label: "Ghi",
                color: DEFAULT_COLOR
            },
            ["ai-jkl"]: {
                index: 0,
                label: "Jkl",
                color: DEFAULT_COLOR
            }
        },
        cells: {},
        templates: {
            ["2025-08-10"]: ["ai-abc", "ai-def"],
            ["2025-08-27"]: ["ai-abc"],
            ["2025-08-29"]: ["ai-abc", "ai-ghi", "ai-jkl"],
        }
    })

    /* Helper Functions */
    function generateID() {
        return "ai-" + crypto.randomUUID();
    }

    function getISODate(date: Date): ISODate {
        return format(date, "yyyy-MM-dd")
    }

    /* Action Item Functions */

    let showNewRowPrompt = $state(false);
    let newRowLabel = $state("");
    let newRowDate = $state<ISODate>(getISODate(new Date()));
    let newRowColor = $state(DEFAULT_COLOR);

    function submitNewRow(create: boolean) {
        if (create) {
            addActionItem(newRowDate, generateID(), newRowLabel, newRowColor)
        }

        newRowLabel = "";
        showNewRowPrompt = false;
        newRowLabel = DEFAULT_COLOR;
        newRowDate = getISODate(new Date());
    }

    function openActionItemContextMenu(evt: MouseEvent, rowID: ActionItemID) {
        evt.preventDefault();
        evt.stopPropagation();

        const menu = new Menu(app);

        menu
            .addItem((i) =>
                i.setTitle("Rename")
                .setIcon("pencil")
                .onClick(() => {
                    new RenameActionItemModal(app, plannerState.actionItems[rowID], (label, color) => modifyActionItem(rowID, label, color)).open();
                })
            )
            .addItem((i) =>
                i.setTitle("Replace from this date…")
                .setIcon("calendar-plus")
                .onClick(() => {})
            )
            .addSeparator()
            .addItem((i) =>
                i.setTitle("Copy ID")
                .setIcon("copy")
                .onClick(() => {})
            );

        menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
    }

    function modifyActionItem(rowID, label, color) {
        plannerState.actionItems[rowID] = { index: 0, label, color}
    }

    function addActionItem(date: ISODate, rowID, label, color) {
        /** Expected Behavior
          * If the template of the day already exists, modify
          * Otherwise, get the template of the day, then push a new array with the added action item
          * Add the Action item to the list
        **/ 

        if (plannerState.templates[date]) {
            plannerState.templates[date].push(rowID);
        } else {
            const current = templateForDate(plannerState.templates, date);
            current.push(rowID);
            plannerState.templates[date] = current;
        }

        plannerState.actionItems[rowID] = { index: 0, label, color};
    }


    /* Cell Functions */
    function setCell(date: ISODate, rowID, text): void {
        
        // Update Cell Information
        plannerState.cells[date] ??= {}; // Initialize Cell

        plannerState.cells[date][rowID] = text;
        planner.cells = plannerState.cells;
        // save();
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
        const actionItemIDs = dates.flatMap((date) => templateForDate(plannerState.templates, date))

        return Array.from(new Set(actionItemIDs));
    }

    function getLabelFromID(date: ISODate, rowID: string) {
        if (!plannerState.actionItems[rowID]) {
            return "";
        } else {
            return plannerState.actionItems[rowID].label;
        }
    }

    function getColorFromID(date: ISODate, rowID: string) {
        if (!plannerState.actionItems[rowID]) {
            return "";
        } else {
            return plannerState.actionItems[rowID].color;
        }
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
        <input type="date" bind:value={anchorDate} />
    </div>
        <!-- TODO: Custom Calendar Input that Supports Multiple Weeks -->

    <div>
        <button onclick={() => showNewRowPrompt = true}>+</button>
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
            <div>{format(parseISO(date), "dd")}</div>
        {/each}
    </div>
    {#each rows as rowID, i (rowID)}
        <div class="row">
            {#each daysOfTheWeek as date, j (date)}
                {#if templateForDate(plannerState.templates, date).includes(rowID)} <!-- only display if label is not empty (i.e. AI exists)-->
                    <div class={`cell ${date == activeDate ? "active" : ""}`}>
                        <span>{rowID}</span>
                        <span class="row-label" style={`color: ${getColorFromID(date, rowID)}`} oncontextmenu={(e) => openActionItemContextMenu(e, rowID)}>{getLabelFromID(date, rowID)}</span>
                        <!-- <input  value={getLabelFromID(date, rowID)} oninput={(e) => modifyTemplate(date, rowID, (e.target as HTMLInputElement).value, "#dddddd")} /> -->
                        <InputCell 
                            {date} {rowID} {setCell} {getCell} row={i} col={j} {handleKeyDown} {focusCell} 
                        />
                    </div>
                {:else}
                    <div>
                        <span>Nothing here for now</span>
                        <button onclick={() => modifyActionItem("ai-abc", "wowow", DEFAULT_COLOR)}>+</button>
                    </div>
                    
                {/if}
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

    div.cell.active {
        background-color: var(--theme-color);
    }
    
</style>