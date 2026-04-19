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
        onTrackOpen?: (trackId: string) => void;
        onTrackFileOpen?: (trackId: string) => void;
    }

    let {date, showLabel, trackId, trackMeta, trackData, journalData, onUpdate, onAdd, onTrackOpen, onTrackFileOpen}: Props = $props();

    const totalTimeSpent = $derived(trackData ? calculateTotalTimeSpent(trackData.items) : 0);

    const totalTimeCommitment = $derived(trackData ? trackData.time ? trackData.time : trackMeta.timeCommitment : trackMeta.timeCommitment);

    function handleLabelClick(event: MouseEvent) {
        if (event.ctrlKey || event.metaKey) {
            onTrackFileOpen?.(trackId);
        } else {
            onTrackOpen?.(trackId);
        }
    }
</script>

<div class="cell" style={`background-color: ${trackMeta.color}10;`}>
    <div class="cell-header">
        {#if showLabel}
            <button
                class="row-label"
                style={`background-color: ${trackMeta.color}30; color: ${trackMeta.color};`}
                onclick={handleLabelClick}
                title="Click to open Tracks view • Ctrl+click to open track file"
            >
                {trackMeta.label}
            </button>
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
        padding: 4px 10px;
        border-radius: 6px;
        border: none;
        font-weight: 600;
        margin-bottom: 4px;
        font-size: 0.82em;
        width: fit-content;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .row-label:hover {
        opacity: 0.85;
    }

    .cell {
        display: flex;
        flex-direction: column;
        padding: 4px;
        border-right: 1px dotted var(--background-modifier-border);
        border-bottom: 1px dashed var(--background-modifier-border);
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
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
	}
</style>
