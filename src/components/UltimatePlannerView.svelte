<script lang="ts">
    //Purpose: To provide an interfact to interact with the objects storing the information. The view reads the objects to generate an appropriate table. 


    // Interfaces
    interface ActionItem {
        name: string;
        index: number;
        color: string;
        contents: string;
    }

    interface DailyData {
        date: Date;
        actionItems: ActionItem[];
    }

    //Test Generation
    const templateActionItems = [
        {name: "First Action Item", index: 1, color: "#cccccc", contents: ""},
        {name: "Second", index: 2, color: "#ffffff", contents: "none"}
    ]

    import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

    const generateWeekBasedOnDay = (date: Date) => {
        const start = startOfWeek(date, { weekStartsOn: 0 });
        const end = endOfWeek(date, { weekStartsOn: 0});

        const days = eachDayOfInterval({ start, end });

        let data: DailyData[] = [];

        days.forEach((day) => {
            data.push({date: day, actionItems: templateActionItems});
        })

        return data;
    }

    const sampleData = generateWeekBasedOnDay(new Date());

    
</script>

<h1>The Ultimate Planner</h1>
<table>
	<tbody>
		<tr>
			{#each sampleData as day}
			<th class="day-number">{format(day.date, "EEE dd")}</th>
			{/each}
			
		</tr>
		<!-- {#each Array(rows) as _, i}
			<tr>
				{#each Array(columns) as _, j}
				<td>
					{#if j == 0}
						{actionItems[i].label}
					{/if}
					<textarea 
					bind:value={information[i][j]}
					oninput={(e) => handleInput(i, j, (e.target as HTMLInputElement).value)}></textarea>
				</td>
				{/each}
			</tr>
		{/each} -->
	</tbody>
</table>