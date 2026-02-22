<script lang="ts">
    import type { Element, ISODate, Track, TrackData } from 'src/plugin/types';
    import EditableCell from './EditableCell.svelte';
    import EmptyCell from './EmptyCell.svelte';
    import { calculateTotalTimeSpent, formatTimeArguments } from 'src/plugin/helpers';
	import CircularProgress from './CircularProgress.svelte';
    
    interface Props {
        date: ISODate;
        showLabel: boolean;
        trackId: string;
        trackMeta: Track;
        trackData: TrackData | undefined;
        journalData: string | undefined;
        onUpdate: (date: ISODate, trackId: string, updatedData: TrackData) => void;
        onAdd: (date: ISODate, trackId: string, trackMeta: Track) => void;
    }
    
    let {date, showLabel, trackId, trackMeta, trackData, journalData, onUpdate, onAdd}: Props = $props();
    
    const totalTimeSpent = $derived(trackData ? calculateTotalTimeSpent(trackData.items) : 0);

    const totalTimeCommitment = $derived(trackData ? trackData.time : trackMeta.timeCommitment);
</script>

<div class="cell" style={`background-color: ${trackMeta.color}10;`}>
    <div class="cell-header">
        {#if showLabel}
            <div class="row-label" style={`background-color: ${trackMeta.color}80; color: white;`}>
                {trackMeta.label}
            </div>
        {/if}
        
        
        <div class="item-data-container"> 
            {#if journalData}
            <div class="journal-indicator">
                <span class="journal-icon" title={journalData}>📜</span>
            </div>
            {/if}
            {#if trackData}
            {@const {dividend: progress, divisor: duration, unit} = formatTimeArguments(totalTimeSpent, totalTimeCommitment)}
            <div class="progress-circle">
                <CircularProgress
                    {progress}
                    {duration}
                    {unit}
                    size={20}
                />
                <span class="time-badge" style={`background-color: ${trackMeta.color}80;`}>
                    {duration} {unit}
                </span>
            </div>
            {/if}
        </div>
        
    </div>

{#if trackData}
    <EditableCell {date} showLabel={false} {trackMeta} {trackId} {trackData} {onUpdate} />
{:else}
    <EmptyCell onAdd={() => onAdd(date, trackId, trackMeta)} label="+ Add" color={trackMeta.color} />
{/if}
</div>

<style>
    .row-label {
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 0.9em;
        width: fit-content;
    }

    .cell {
        display: flex;
        flex-direction: column;
        padding: 4px;
        border-right: 1px dotted #ccc;
        border-bottom: 1px dashed #ccc;
        border-collapse: collapse;
        min-height: 40px; 
    }

    .cell-header {
        display: grid;
        grid-template-columns: 1fr auto;
        width: 100%;
    }

    .item-data-container {
        grid-column: 2;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .progress-circle {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .time-badge {
		font-size: 0.85em;
		background-color: var(--interactive-accent);
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
	}
</style>