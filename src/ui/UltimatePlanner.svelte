<script lang="ts">
	import { format, parseISO } from "date-fns";
	import type { App } from "obsidian";
	import type { CalendarPipeline } from "src/actions/calendarPipelines";
	import type { PlannerActions } from "src/actions/itemActions";
	import type { DataService, HelperService, ISODate, ItemID, ItemMeta, PluginSettings } from "src/types";
	import { tick } from "svelte";
	import DebugBlock from "./DebugBlock.svelte";
	import GenericCell from "./GenericCell.svelte";
	import { templates } from "src/state/plannerStore";
	import FloatBlock from "./FloatBlock.svelte";
	import TemplateEditor from "./TemplateEditor.svelte";

	// Purpose: To provide a UI to interact with the objects storing the information. The view reads the objects to generate an appropriate table.

	interface ViewProps {
		app: App;
		settings: PluginSettings;
		data: DataService;
		helper: HelperService;
		plannerActions: PlannerActions;
		calendarPipeline: CalendarPipeline;
	}

	let { app, settings, data, helper, plannerActions, calendarPipeline }: ViewProps = $props();

	let showTemplateEditor = $state<boolean>(false);

	/* Table Rendering */
	const weekFormat = settings.weekFormat;
	const columns = settings.columns;
	const blocks = settings.blocks;

	let anchor = $state<ISODate>(helper.getISODate(new Date()));

	let dates = $derived.by<ISODate[]>(() => {
		const anchorDate = parseISO(anchor);

		if (weekFormat) {
			return helper.getISODates(anchorDate, blocks, settings.weekStartOn);
		} else {
			return helper.getISODates(anchorDate, columns * blocks)
		}
	})

	interface ColumnMeta {
		date: ISODate;
		tDate: ISODate;
	}

	let columnsMeta: ColumnMeta[] = $derived.by(() => {
		const _ = $templates; // trick to ensure reactivity.

		return dates.map(date => ({
			date,
			tDate: plannerActions.getTemplateDate(date),
		}));
	});

	interface RenderItem {
		id: ItemID;
		meta: ItemMeta;
	}

	type SortedTemplates = Record<ISODate, RenderItem[]>;

	let sortedTemplates = $derived.by<SortedTemplates>(() => {
		const allTemplateDates = new Set(columnsMeta.map(c => c.tDate));

		const result: SortedTemplates = {};

		allTemplateDates.forEach(date => {
			if (date != "") {
				const rawTemplate = data.getTemplate(date); 
			
				const itemsArray: RenderItem[] = Object.entries(rawTemplate).map(([id, meta]) => ({id,meta}));

				itemsArray.sort((a, b) => a.meta.order - b.meta.order);

				result[date] = itemsArray;
			}			
		});

		return result;
	});
	
	interface BlockMeta {
		rows: number; // Use a function to get the # of rows to render
		dates: ColumnMeta[];
	}

	let blocksMeta = $derived.by<BlockMeta[]>(() => {
		let meta: BlockMeta[] = [];
		
		for (let i = 0; i < blocks; i++) {
			const columnChunk: ColumnMeta[] = columnsMeta.slice(columns * i, columns * (i + 1));
			const templateLengths: number[] = columnChunk.map(({ date, tDate}) => tDate != "" ? sortedTemplates[tDate].length : 0)

			meta.push({
				rows: Math.max(...templateLengths),
				dates: columnChunk,
			})
		}

		return meta;
	})
	

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

<!-- <DebugBlock label={"Dates:"} object={dates} />
<DebugBlock label={"Columns Meta:"} object={columnsMeta} />
<DebugBlock label={"Sorted Templates:"} object={sortedTemplates} />
<DebugBlock label={"Blocks Meta:"} object={blocksMeta} /> -->


<div class="header">
	<div class="nav-buttons">
		<button onclick={() => goTo(helper.getISODate(new Date()))}>Today</button>
    	<button onclick={() => goTo(helper.addDaysISO(anchor, settings.columns))}>&lt;</button>
		<button onclick={() => goTo(helper.addDaysISO(anchor, settings.columns))}>&gt;</button>
	</div>
	<div class="week">
		<span class="week-label">{helper.getLabelFromDateRange(parseISO(columnsMeta[0].date), parseISO(columnsMeta[columnsMeta.length - 1].date))}</span>
		<input type="date" bind:value={anchor} />
	</div>
	<div class="new-ai">
		<button onclick={(evt) => showTemplateEditor = !showTemplateEditor}>{showTemplateEditor ? "Planner View" : "Templates Editor"}</button>
	</div>
</div>

{#if !showTemplateEditor}

<FloatBlock 
	templates={sortedTemplates} 
	contextMenu={(e: MouseEvent, tDate: ISODate, id: ItemID, meta: ItemMeta) => plannerActions.openItemMenu(app, e, tDate, id, meta)} 
	focusCell={(opt: boolean) => { return false }}
/>  

<div class="main-grid-container">
    {#each blocksMeta as {rows, dates}, block (dates)}
        <div class="block-container">
            <div class="header-row" style={`grid-template-columns: repeat(${columns}, 1fr);`}>
                {#each dates as {date}, col (date)}
                    <div class="header-cell">
                        <div class="dow-label">{format(parseISO(date), "E")}</div>
                        <div class="date-label">{format(parseISO(date), "dd")}</div>
                    </div>
                {/each}
            </div>

            <div class="data-grid" style={`grid-template-columns: repeat(${columns}, 1fr);`}>
                {#each {length: rows} as _, row (row)}
                    {#each dates as {date, tDate: tDate}, col (col)}
					{#if tDate === ""}
						<div class="cell">-</div>
					{:else if row < Object.keys(sortedTemplates[tDate]).length}
                        <div class="cell">
                            <GenericCell 
                                {date}
                                id={sortedTemplates[tDate][row].id}
                                meta={sortedTemplates[tDate][row].meta}
                                {tDate}
                                row={row}
                                col={col}
                                contextMenu={(e: MouseEvent) => plannerActions.openItemMenu(app, e, date, sortedTemplates[tDate][row].id, sortedTemplates[tDate][row].meta)}
                                {focusCell}
                            />
                        </div>
					{:else}
						<div class="cell">-</div>
					{/if}
                    {/each}
                {/each}
            </div>
        </div>
    {/each}
</div>
{:else}
<TemplateEditor {app} {plannerActions} {helper} />
{/if}

<style>
	/* Navigation Menu */
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

	/* Table Header */
	.dow-label {
		text-align: center;
		background-color: var(--theme-color);
		color: white;
		mix-blend-mode: exclusion;
	}

	.date-label {
		text-align: right;
	}

	/* Grid Layout */
	.main-grid-container {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.block-container {
		border: 1px solid #ccc; 
	}

	.header-row {
		display: grid;
		/* grid-template-columns is set dynamically in the Svelte component */
		border-bottom: 2px solid #ccc;
	}

	.header-cell {
		padding: 4px;
		border-right: 1px solid #ccc; 
	}

	.header-cell:last-child {
		border-right: none;
	}

	.data-grid {
		display: grid;
		/* grid-template-columns is set dynamically in the Svelte component */
			grid-auto-rows: minmax(40px, auto); 
	}

	.cell {
		padding: 4px;
		border-right: 1px dotted #ccc;
		border-bottom: 1px dashed #ccc;
		border-collapse: collapse;
		min-height: 40px; 
	}
</style>
