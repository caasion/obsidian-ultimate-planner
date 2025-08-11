<script lang="ts">

	// Table-Related
	let columns: number = 7;

	let information: string[][] = $state([]);

	$effect(() => {
		const target = actionItems.length;

		while (information.length < target) {
			information.push(Array.from({length: columns}, () => ""));
		}
	})

	// Date Related

	import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

	let dates: Date[] = [];

	const today = new Date();

	const start = startOfWeek(today, { weekStartsOn: 0 });
	const end = endOfWeek(today, { weekStartsOn: 0});

	const days = eachDayOfInterval({ start, end });

	console.log(days)

	const returnMonthBasedOnMajority = (days: Date[]) => {
		return format(
			days
			.map(day => format(day, "MM"))
			.sort(
				(a, b) =>
				days.filter(d => format(d, "MM") === b).length -
				days.filter(d => format(d, "MM") === a).length
			)[0],
			"MMMM"
		);
	};
</script>

<h1>The Ultimate Planner</h1>



<table>
	<tbody>
		<tr>
			<th colspan="7">{returnMonthBasedOnMajority(days)}</th>
		</tr>
		<tr>
			<th>Sun</th>
			<th>Mon</th>
			<th>Tue</th>
			<th>Wed</th>
			<th>Thu</th>
			<th>Fri</th>
			<th>Sat</th>
		</tr>
		<tr>
			{#each days as day}
			<td class="day-number">{format(day, "dd")}</td>
			{/each}
			
		</tr>
		{#each Array(information.length) as _, i}
			<tr>
				{#each Array(columns) as _, j}
				<td>
					{#if j == 0}
						{actionItems[i]}
					{/if}
					<input bind:value={information[i][j]} />
				</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
	}

	input {
		width: 100%;
		height: 100%;
		background-color: transparent;
		border: none;
		overflow-wrap: normal;
		color: red;
	}

	tr {
		border-bottom: 1px solid #ddd !important;
	}

	td.day-number {
		text-align: right;
	}

	td, th {
		padding: 5px;
		height: 2em;
		border: 1px solid #ddd;
	}


</style> 