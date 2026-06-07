<script lang="ts">
    import type { Element, ISODate, RenderTrack, Track, TrackData } from "src/plugin/types";
	import HeaderCell from "../components/HeaderCell.svelte";
	import WrapperCell from "./WrapperCell.svelte";

    interface Props {
        dates: ISODate[];
        tracksByDate: Record<ISODate, RenderTrack[]>;
        parsedTracks: Record<string, Track>;
        parsedContent: Record<ISODate, Record<string, TrackData>>;
        parsedJournalContent: Record<ISODate, Record<string, string>>;
        blocks: number;
        columns: number;
        showProjectLabel?: boolean;
        onUpdate: (date: ISODate, trackId: string, updatedData: TrackData) => void;
        onAdd: (date: ISODate, trackId: string, trackMeta: Track, items?: Element[]) => void;
        openDailyNote: (date: ISODate) => void;
        onTrackOpen?: (trackId: string) => void;
        onTrackFileOpen?: (trackId: string) => void;
        onCloseProjectTask?: (trackId: string, sourceRef: string, taskStatus: ' ' | 'x') => void;
    }

    let { dates, tracksByDate, parsedTracks, parsedContent, parsedJournalContent, columns, blocks, showProjectLabel = true, onUpdate, onAdd, openDailyNote, onTrackOpen, onTrackFileOpen, onCloseProjectTask }: Props = $props();

    function getRows(blockDates: ISODate[]): number {
        const maxTracks = Math.max(...blockDates.map((date) => tracksByDate[date]?.length ?? 0), 0);
        return Math.max(1, maxTracks);
    }

    /** Get the unique track IDs for a given row across all dates in a block. Returns the first valid track found. */
    function getTrackForRow(blockDates: ISODate[], row: number): Track | undefined {
        for (const date of blockDates) {
            const renderTrack = tracksByDate[date]?.[row];
            if (renderTrack?.id) {
                const track = parsedTracks[renderTrack.id];
                if (track) return track;
            }
        }
        return undefined;
    }

    function countActiveProjects(track: Track): number {
        return Object.keys(track.projects).length;
    }

    function formatTimePerWeek(minutes: number): string {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours > 0 && mins > 0) return `${hours} h ${mins} m / week`;
        if (hours > 0) return `${hours} h ${mins > 0 ? mins + ' m' : ''} / week`.replace(/  /, ' ').trim();
        return `${mins} m / week`;
    }
</script>

<div class="planner-grid-container">
    {#each {length: blocks} as _, block (block)}
    {@const blockDates = dates.slice(block * columns, (block + 1) * columns)}
    {@const rows = getRows(blockDates)}
    <div class="planner-block">
        <!-- Header Row: empty corner + date columns -->
        <div class="planner-header-row" style={`grid-template-columns: 160px repeat(${columns}, minmax(0, 1fr));`}>
            <!-- Empty corner cell -->
            <div class="header-corner" style="border-right: 1px solid rgba(255, 255, 255, 0.1);"></div>
            {#each blockDates as date (date)}
            <HeaderCell {date} {openDailyNote} />
            {/each}
        </div>

        <!-- Data Rows: track label + day cells -->
        {#each {length: rows} as _, row (row)}
        {@const trackForRow = getTrackForRow(blockDates, row)}
        <div class="planner-data-row" style={`grid-template-columns: 160px repeat(${columns}, minmax(0, 1fr));`}>
            <!-- Track label cell -->
            <div class="track-label-cell">
                {#if trackForRow}
                    <div class="track-label-content">
                        <div class="track-info">
                            <div class="track-accent" style={`background-color: ${trackForRow.color};`}></div>
                            <div class="track-name">{trackForRow.label}</div>
                            <div class="track-meta">
                                <span class="track-time">Σ {formatTimePerWeek(trackForRow.timeCommitment * 7)}</span>
                            </div>
                            <div class="track-projects"><span class="track-projects-count">{countActiveProjects(trackForRow)}</span> Active Projects</div>
                        </div>
                    </div>
                {:else}
                    <div class="track-label-empty"></div>
                {/if}
            </div>

            <!-- Day cells for this track row -->
            {#each blockDates as date, col (date)}
                {#if tracksByDate[date]?.[row]}
                    {@const {id: trackId, isStartOfInterval} = tracksByDate[date]?.[row]}
                    {@const track = trackId ? parsedTracks[trackId] : undefined}

                    {#if trackId && track}
                        <WrapperCell
                            {date}
                            {trackId}
                            trackMeta={track}
                            trackData={parsedContent[date]?.[trackId]}
                            journalData={parsedJournalContent[date]?.[track.journalHeader]}
                            {showProjectLabel}
                            onUpdate={onUpdate}
                            onAdd={onAdd}
                            {onCloseProjectTask}
                        />
                    {/if}
                {:else}
                    <div class="cell-empty"></div>
                {/if}
            {/each}
        </div>
        {/each}
    </div>
    {/each}
</div>

<style>
    .planner-grid-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .planner-block {
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .planner-header-row {
        display: grid;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .planner-data-row {
        display: grid;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .planner-data-row:last-child {
        border-bottom: none;
    }

    .track-label-cell {
        padding: 0;
        background: rgba(255, 255, 255, 0.03);
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: flex-start;
        overflow: hidden;
    }

    .track-label-content {
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    .track-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        padding: 10px 12px 10px;
    }

    .track-accent {
        height: 3px;
        border-radius: 2px;
        flex-shrink: 0;
        width: 40px;
        margin-bottom: 4px;
    }

    .track-name {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 16px;
        font-weight: 500;
        color: #e6e6e6;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
    }

    .track-meta {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .track-time {
        font-size: 12px;
        color: #808080;
        white-space: nowrap;
    }

    .track-projects {
        font-size: 13px;
        color: #808080;
        margin-top: 4px;
    }

    .track-projects-count {
        font-weight: 700;
        color: #e6e6e6;
    }

    .track-label-empty {
        height: 100%;
    }

    .cell-empty {
        min-height: 80px;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        background: #363636;
    }

    .cell-empty:last-child {
        border-right: none;
    }
</style>
