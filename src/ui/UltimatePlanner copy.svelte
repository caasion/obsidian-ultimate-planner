<script lang="ts">
	// Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table.

	import { addDays, format, parseISO } from "date-fns";
	import { onMount, tick } from "svelte";
	import InputCell from "./InputCell.svelte";
	import type { App } from "obsidian";
	import { setCell, getCell, calendars } from "../state/plannerStore";
	import { newRowContextMenu } from "src/ui/NewRowContextMenu";
	import { getISODate, addDaysISO, getISODatesOfWeek, getLabelFromDateRange, } from "src/actions/helpers";
	import type { ISODate, PluginSettings } from "src/types";
	import { actionItems, calendarCells, templates } from "src/state/plannerStore";
	import { openRowContextMenu } from './GenericContextMenu';
	import { fetchPipelineInGracePeriod } from "src/actions/calendarPipelines";

	interface ViewProps {
		app: App;
		settings: PluginSettings;
	}

	let { app, settings }: ViewProps = $props();

	/* Reactive: templateStoreForDate */
	function templateStoreForDate(date: ISODate) {
		let best: ISODate | null = null;
		for (const key in $templates) {
			if (key <= date && (best === null || key > best)) best = key;
		}
		return best ? JSON.parse(JSON.stringify($templates[best])) : [];
	}


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
	let weeksVisible = settings.weeksToRender;
	let anchorDate = $state<ISODate>(getISODate(new Date()));
	let isoDates = $derived<ISODate[][]>(getISODatesOfWeek(anchorDate, weeksVisible, settings.weekStartOn));
	
	const colCount = 7;
	let rows = $derived(rowsToRender(isoDates[0]));

	function rowsToRender(dates: ISODate[]): string[] {
		const actionItemIDs = dates.flatMap((date) =>
			templateStoreForDate(date),
		);

		return Array.from(new Set(actionItemIDs));
	}

	/* Table Navigation (Tab, Shift-tab, Enter) */
	let focus: { row: number; col: number } = $state({ row: 0, col: 0 }); // Track focus to preserve focus at the same row

	function focusCell(row: number, col: number, fromEditor = false): boolean {
		const rowCount = rows.length;

		if (row > rowCount - 1 || row < 0 || col > colCount - 1 || col < 0) {
			console.warn("Attempted to focus on cell out of table bounds");
			return false; // Informs the caller whether if the focus actually worked
		}

		if (!fromEditor) {
			const cell = document.getElementById(`cell-${row}-${col}`);
			cell?.querySelector<HTMLElement>(".ProseMirror")?.focus();
		}

		focus = { row, col };
		return true;
	}

	// Currently doesn't work
	async function goTo(newDate: ISODate) {
		/* Maintain focus when switching weeks */
		anchorDate = newDate;
		await tick();
		focusCell(focus.row, focus.col);
	}
</script>

<h1>The Ultimate Planner</h1>

<div class="header">
	<div class="nav-buttons">
		<button onclick={() => goTo(getISODate(new Date()))}>Today</button>
    <button onclick={() => goTo(addDaysISO(anchorDate, -7))}>&lt;</button>
		<button onclick={() => goTo(addDaysISO(anchorDate, 7))}>&gt;</button>
	</div>
	<div class="week">
		<span class="week-label">{getLabelFromDateRange(isoDates[0][0], isoDates[isoDates.length - 1][6])}</span>
		<input type="date" bind:value={anchorDate} />
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
	{#each isoDates as week, w (week)}
		<div class="row">
			{#each isoDates[w] as date}
				<div class="date-label">{format(parseISO(date), "dd")}</div>
			{/each}
		</div>
		{#each rows as id, i (id)}
			<div class="row">
				{#each isoDates[w] as date, j (date)}
					{#if id.split("-", 1)[0] === "cal"}
						{#if $actionItems[id]}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class={`cell ${date < getISODate(new Date()) ? "inactive" : ""}`}
								style={`color: ${$calendars[id].color ?? ""}`}
								oncontextmenu={(e) => openRowContextMenu(app, e, "calendar", date, id)}
							>
								{#if (j == 0 && $calendars[id].label != "") || !templateStoreForDate(addDaysISO(date, -1)).includes(id)}
									<div class="row-label">{$calendars[id].label ?? ""}</div>
								{/if}
								{#each $calendarCells[date]?.[id] ?? [] as label}
									<p>{label}</p>
								{/each}
							</div>
						{:else}
							<div class="cell empty">-</div>
						{/if}
					{:else}
						
							{#if templateStoreForDate(date).includes(id)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class={`cell ${date < getISODate(new Date()) ? "inactive" : ""}`}
									style={`color: ${$actionItems[id].color ?? ""}`}
									oncontextmenu={(e) => openRowContextMenu(app, e, "actionItem", date, id)}
								>
									{#if (j == 0 && $actionItems[id].label != "") || !templateStoreForDate(addDaysISO(date, -1)).includes(id)}
										<div class="row-label">{$actionItems[id].label ?? ""}</div>
									{/if}
									<InputCell {date} rowID={id} {setCell} {getCell} row={i} col={j} {focusCell} />
								</div>
							{:else}
								<div class="cell empty">-</div>
							{/if}
										
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
