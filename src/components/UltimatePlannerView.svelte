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
        {name: "First Action Item", index: 0, color: "#cccccc", contents: ""},
        {name: "Second", index: 1, color: "#ffffff", contents: "none"}
    ]

    //Helper Function to get action item object based on index
    const getActionItemFromIndex = (dailyData: DailyData, index: number) => {
        const actionItems: ActionItem[] = dailyData.actionItems;

        //Assuming no two objects will have the same index
    }

    import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
	import MarkdownCell from "./MarkdownCell.svelte";

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

    const sampleData: DailyData[] = generateWeekBasedOnDay(new Date());

    // We want to get the largest row size we need because the action item list size can change from day to day, and so we want to account for that
    const getRowSizeFromData = (data: DailyData[]) => {
        return Math.max(...data.map(dailyData => dailyData.actionItems.length));
    }
</script>

<h1>The Ultimate Planner</h1>
<table>
	<tbody>
		<tr>
			{#each sampleData as day}
			<th class="day-number">{format(day.date, "EEE dd")}</th>
			{/each}
			
		</tr>
        {#each Array(getRowSizeFromData(sampleData)) as _, i}
            <tr>
                {#each sampleData as day, j}
                    <td>
                        <!-- Display Action Item name if first column or if changed -->
                        {#if j == 0 || day.actionItems[i].name != sampleData[j-1]?.actionItems[i].name}
                            {day.actionItems[i].name}
                        {/if}
                        <MarkdownCell value={day.actionItems[i].contents} onChange={(value) => day.actionItems[i].contents = value}/>
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

	textarea {
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

	.day-number {
		text-align: right;
	}

	td, th {
		padding: 5px;
		height: 2em;
		border: 1px solid #ddd;
	}


</style> 