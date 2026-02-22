<script lang="ts">
    import type { ISODate, Track, TrackData } from "src/plugin/types";
	import HeaderCell from "./HeaderCell.svelte";
	import WrapperCell from "./WrapperCell.svelte";

    interface Props {
        dates: ISODate[];
        tracksByDate: Record<ISODate, string[]>;
        parsedTracks: Record<string, Track>;
        parsedContent: Record<ISODate, Record<string, TrackData>>;
        parsedJournalContent: Record<ISODate, Record<string, string>>;
        blocks: number;
        columns: number;
        onUpdate: (date: ISODate, trackId: string, updatedData: TrackData) => void;
        onAdd: (date: ISODate, trackId: string, trackMeta: Track) => void;
        openDailyNote: (date: ISODate) => void;
    }

    let { dates, tracksByDate, parsedTracks, parsedContent, parsedJournalContent, columns, blocks, onUpdate, onAdd, openDailyNote }: Props = $props();

    function getRows(blockDates: ISODate[]): number {
        const maxTracks = Math.max(...blockDates.map((date) => tracksByDate[date]?.length ?? 0), 0);
        return Math.max(1, maxTracks);
    }
</script>

<div class="main-grid-container">
    {#each {length: blocks} as _, block (block)} 
    {@const blockDates = dates.slice(block * columns, (block + 1) * columns)}
    {@const rows = getRows(blockDates)}
    <div class="block-container">
        <!-- Header Row -->
        <div class="header-row" style={`grid-template-columns: repeat(${columns}, 1fr);`}>
            {#each blockDates as date (date)}
            <HeaderCell {date} {openDailyNote} />
            {/each}
        </div>

        <!-- Data Grid -->
        <div class="data-grid" style={`grid-template-columns: repeat(${columns}, 1fr); grid-template-rows: repeat(${rows}, minmax(40px, auto)); grid-auto-flow: column;`}>
            {#each blockDates as date (date)}
            {#each {length: rows} as _, row (row)}
            {@const trackId = tracksByDate[date]?.[row]}
            {@const track = trackId ? parsedTracks[trackId] : undefined}

            {#if trackId && track}
                <WrapperCell
                    {date}
                    showLabel={false}
                    {trackId}
                    trackMeta={track}
                    trackData={parsedContent[date]?.[trackId]}
                    journalData={parsedJournalContent[date]?.[track.journalHeader]}
                    onUpdate={onUpdate}
                    onAdd={onAdd}
                />
            {:else}
                <div class="cell">-</div>
            {/if}
            {/each}
            {/each}
        </div>
    </div>
    {/each}
</div>

<style>
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
		padding: 8px 0;
		background-color: var(--background-primary);
	}

	.data-grid {
		display: grid;
		/* grid-template-columns is set dynamically in the Svelte component */
	}

	.cell {
		padding: 4px;
		border-right: 1px dotted #ccc;
		border-bottom: 1px dashed #ccc;
		border-collapse: collapse;
		min-height: 40px; 
	}
</style>