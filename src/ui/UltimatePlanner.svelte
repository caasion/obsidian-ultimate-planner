<script lang="ts">
	// Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table.

	import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, type Day } from "date-fns";
	import { onMount, tick } from "svelte";
	import InputCell from "./InputCell.svelte";
	import type { App } from "obsidian";
	import { setCell, getCell, calendars } from "../state/plannerStore";
	import { newRowContextMenu } from "src/ui/NewRowContextMenu";
	import { getISODate, addDaysISO, getISODatesOfWeek, getLabelFromDateRange, } from "src/actions/helpers";
	import type { ISODate, PluginSettings, RowID } from "src/types";
	import { actionItems, calendarCells, templates } from "src/state/plannerStore";
	import { openRowContextMenu } from './GenericContextMenu';
	import { fetchPipelineInGracePeriod } from "src/actions/calendarPipelines";
	import ActionItemCell from "./ActionItemCell.svelte";

	interface ViewProps {
		app: App;
		settings: PluginSettings;
	}

	let { app, settings }: ViewProps = $props();

	// Fetch in grace period for current calendars
	onMount(() => {
		const today = getISODate(new Date());

        rows.forEach(id => {
            if (id.split("-", 1)[0] === "cal") {
                fetchPipelineInGracePeriod($calendars[id], addDays(today, -7), addDays(today, 60))
            }
        })
	})

	/* Table Rendering */
	const weekFormat = true;
	const blocks = 1;
	const columns = 7;

	let anchor = $state<ISODate>(getISODate(new Date()));

	interface BlockMeta {
		dates: ISODate[];
		ids: RowID[];
	}

	let renderMeta: BlockMeta[] = [];

	for (let i = 0; i < blocks; i++) {
		let dates: ISODate[] = [];

		if (weekFormat) dates = getDatesOfWeek(anchor, settings.weekStartOn);
		else dates = getDatesOfBlock(anchor, columns);

		const blockMeta: BlockMeta = {
			dates,
			ids: getIds(dates),
		}

		renderMeta.push(blockMeta)
	}
	
	function getIds(dates: ISODate[]): RowID[] {
		const first = dates[0];
		const last = dates[dates.length - 1];

		let ids: RowID[] = [];

		for (const ai of Object.values($actionItems)) {
			if (first > ai.start || last < ai.end) {
				ids.push(ai.id)
			}
		}

		return ids;
	}

	function getDatesOfWeek(anchor: ISODate, weekStartsOn: Day): ISODate[] {
		const date = parseISO(anchor);

		const start = startOfWeek(date, { weekStartsOn });
        const end = startOfWeek(date, { weekStartsOn });

        const dates = eachDayOfInterval({ start, end });

        return dates.map(d => getISODate(d));
	}

	function getDatesOfBlock(anchor: ISODate, days: number): ISODate[] {
		const date = parseISO(anchor);

		const dates = eachDayOfInterval({ start: date, end: addDays(date, days)})

		return dates.map(d => getISODate(d));
	}

	// TODO: Each block should have their own "rowsToRender"

	function focusCell() {
		// TODO: Re-implement row and column navigation.
	}

	// Currently doesn't work
	async function goTo(newDate: ISODate) {
		/* Maintain focus when switching weeks */
		anchor = newDate;
		await tick();
		// focusCell(focus.row, focus.col);
	}
</script>

<h1>The Ultimate Planner</h1>

<div class="header">
	<div class="nav-buttons">
		<button onclick={() => goTo(getISODate(new Date()))}>Today</button>
    <button onclick={() => goTo(addDaysISO(anchor, -7))}>&lt;</button>
		<button onclick={() => goTo(addDaysISO(anchor, 7))}>&gt;</button>
	</div>
	<div class="week">
		<span class="week-label">{getLabelFromDateRange(isoDates[0][0], isoDates[isoDates.length - 1][6])}</span>
		<input type="date" bind:value={anchor} />
	</div>
	<div class="new-ai">
		<button onclick={(evt) => newRowContextMenu(app, evt)}>+ Add</button>
	</div>
	
</div>
<div class="grid">
	<div class="row">
		{#each isoDates[0] as date}
			<div class="dow-label">{format(parseISO(date), "E")}</div>
		{/each}
	</div>
	{#each renderMeta as blockMeta, block} <!-- Create a new block for each block -->
		 <div class="row"> <!-- Set-up the rows for the date labels -->
			{#each blockMeta.dates as date} <!-- Create a column for each date -->
				<div class="date-label">{format(parseISO(date), "dd")}</div>
			{/each}
		 </div>
		 {#each blockMeta.ids as id, row} <!-- Create a row for each ID-->
		 	<div class="row">
				{#each blockMeta.dates as date, col} <!-- Create a column for each date -->
					{#if id.split("-", 1)[0] === "cal"}
						<CalendarCell />
					{:else}
						<ActionItemCell />
					{/if}
				{/each}
			</div>
		 {/each}
	{/each}
</div>

<style>
	.header {
		display: grid;
    grid-template-columns: 1fr 1fr 1fr;
	}

  .week {
    display: flex;
    justify-content: center; 
    position: relative;
  }

  .week-label {
    font-weight: 600;
    font-size: x-large;
    text-align: center;
    padding: .25rem .5rem;
    display: inline-block;
    pointer-events: none;  
  }

  .week input[type="date"] {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);

    width: 100%;
    height: 100%;
    z-index: 1;

    opacity: 0;
    cursor: pointer;
  }

  .week input[type="date"]::-webkit-calendar-picker-indicator {
    width: 100%;
    cursor: pointer;
  }

  .week input[type="date"]::-webkit-datetime-edit {
    display: none;
  }

  .new-ai {
    display: flex;
    justify-content: flex-end;
  }

  .dow-label {
    text-align: center;
    background-color: var(--theme-color);
    color: white;
    mix-blend-mode: exclusion;
  }

  .date-label {
		text-align: right;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		border-collapse: collapse;
	}

	.row {
		display: contents;
	}

	.row-label {
		font-style: italic;
		font-size: x-small;
		padding: 4px 0px;
	}

	.grid > .row > div {
		padding: 4px;
		border: 1px solid #ccc;

	}

  .cell {
    border-top-style: dashed;
    border-bottom-style: dashed;
  }

	.cell.inactive {
		background-color: #2f2f2f !important;
	}

	.cell.empty {
		background-color: #3b3b3b;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cell p {
		margin: 0px;
	}
</style>
