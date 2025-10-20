<script lang="ts">
	import { parseISO } from "date-fns";
	import type { App } from "obsidian";
	import type { CalendarPipeline } from "src/actions/calendarPipelines";
	import { getISODates } from "src/actions/helpers";
	import type { PlannerActions } from "src/actions/itemActions";
	import { templates } from "src/state/plannerStore";
	import type { DataService, HelperService, ISODate, PluginSettings } from "src/types";
	import { arrayBuffer } from "stream/consumers";

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

	// Fetch in grace period for current calendars
	// onMount(() => {
	// 	const today = getISODate(new Date());

    //     rows.forEach(id => {
    //         if (id.split("-", 1)[0] === "cal") {
    //             fetchPipelineInGracePeriod($calendars[id], addDays(today, -7), addDays(today, 60))
    //         }
    //     })
	// })

	/** Reactive function that returns the date of the template that the given date uses. 
	 * Implemented using binary search for efficiency.
	 */
	function getTemplateDate(date: ISODate): ISODate {
		const sortedTemplateDates: ISODate[] = Object.keys($templates).sort();

		// Implement binary search to find the template date that is the greatest date less than or equal to the date provided
		let left = 0;
		let right = sortedTemplateDates.length - 1;
		let mid = 0;

		while (left <= right) {
			mid = Math.floor((left + right) / 2);
			if (sortedTemplateDates[mid] === date) {
				return sortedTemplateDates[mid];
			}
			if (sortedTemplateDates[mid] <= date) {
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}

		return "";
	}

	/* Table Rendering */
	const weekFormat = true;
	const columns = 7;
	const blocks = 2;

	let anchor = $state<ISODate>(helper.getISODate(new Date()));

	let dates = $derived.by<ISODate[]>(() => {
		const anchorDate = parseISO(anchor);

		if (weekFormat) {
			return getISODates(anchorDate, 2, settings.weekStartOn);
		} else {
			return getISODates(anchorDate, columns * blocks)
		}
	})

	interface DateColumn {
		date: ISODate;
		templateDate: ISODate;
	}

	let columnsMeta: DateColumn[] = $derived.by(() => {
		return dates.map(date => ({
			date,
			templateDate: getTemplateDate(date),
		}));
	});
	
	interface BlockMeta {
		rows: number; // Use a function to get the # of rows to render
		dates: DateColumn[];
	}

	let blocksMeta = $derived.by<BlockMeta[]>(() => {
		let blocks: BlockMeta[] = [];
		
		for (let i = 0; i < columnsMeta.length; i++) {
			const chunk = columnsMeta.slice(i, i + columns);
			const templateDates = chunk.map(c => c.templateDate);
			const uniqueTemplateDates = new Set(templateDates);
			blocks.push({
				rows: getRowsToRender(uniqueTemplateDates),
				dates: chunk,
			})
		}

		return blocks;
	})

	/** Returns the numbers of rows to render given a set of template dates. */
	function getRowsToRender(templateDates: Set<ISODate>): number {
		const templateSizes: number[] = [];

		templateDates.forEach(date => {
			templateSizes.push(Object.keys(data.getTemplate(date)).length);
		})

		return Math.max(...templateSizes);
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
		<span class="week-label">{getLabelFromDateRange(columnsMeta[0].date, columnsMeta[columnsMeta.length - 1].date)}</span>
		<input type="date" bind:value={anchor} />
	</div>
	<div class="new-ai">
		<button onclick={(evt) => newRowContextMenu(app, evt)}>+ Add</button>
	</div>
</div>
<div class="grid">
	{#each columnsMeta as columnMeta, col (columnMeta.date)} <!-- Create a column for every date-->
		<div class="column">
			<div class="dow-label">{format(parseISO(columnMeta.date), "E")}</div>
			<div class="date-label">{format(parseISO(columnMeta.date), "dd")}</div>
			{#each Object.values($templates[columnMeta.templateDate]) as itemMeta, row (itemMeta.id)} <!-- Create a row for every item in column-->
				<div class="row">
					{#if itemMeta.id.split("-", 1)[0] === "cal"}
						<GenericCell
							date={columnMeta.date}
							id={itemMeta.id}
							type={"calendar"}
							label={itemMeta.label}
							color={itemMeta.color}
							templateDate={columnMeta.templateDate}
							{col}
							contextMenu={(e: MouseEvent) => {}}
						/>
					{:else}
						<GenericCell
							date={columnMeta.date}
							id={itemMeta.id}
							type={"actionItem"}
							label={itemMeta.label}
							color={itemMeta.color}
							templateDate={columnMeta.templateDate}
							{row}
							{col}
							contextMenu={(e: MouseEvent) => {}}
							{focusCell}
						/>
					{/if}
				</div>
			{/each}
		</div>
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

	.column {
		display: flex;
		flex-direction: column;
		border: 1px solid #ccc;
	}

	.column > div {
		padding: 4px;
		border-bottom: 1px solid #ccc;
		min-height: 40px; /* Consistent row height */
	}
	
	.column > div:last-child {
		border-bottom: none;
	}

	.grid > .row > div {
		padding: 4px;
		border: 1px solid #ccc;

	}


</style>
