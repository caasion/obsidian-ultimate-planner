<script lang="ts">
    import type { Element, ISODate, RenderTrack, Track, TrackData } from "src/plugin/types";
    import { getISODate } from "src/plugin/helpers";
    import HeaderCell from "../components/HeaderCell.svelte";
    import TimelineItem from "./TimelineItem.svelte";

    interface Props {
        dates: ISODate[];
        tracksByDate: Record<ISODate, RenderTrack[]>;
        parsedTracks: Record<string, Track>;
        parsedContent: Record<ISODate, Record<string, TrackData>>;
        columns: number;
        openDailyNote: (date: ISODate) => void;
        onToggleTask: (date: ISODate, trackId: string, index: number) => void;
    }

    let { dates, tracksByDate, parsedTracks, parsedContent, columns, openDailyNote, onToggleTask }: Props = $props();

    const startHour = 6;
    const endHour = 17;
    const hourHeight = 60;
    const totalHours = endHour - startHour;
    const topPad = 8;
    const gridHeight = totalHours * hourHeight + topPad;
    const hours = $derived(Array.from({ length: totalHours }, (_, i) => startHour + i));

    const today = getISODate(new Date());

    interface TimelineEvent {
        element: Element;
        track: Track;
        trackId: string;
        index: number;
    }

    function getEventsForDate(date: ISODate): TimelineEvent[] {
        const events: TimelineEvent[] = [];
        const tracks = tracksByDate[date];
        if (!tracks) return events;

        for (const renderTrack of tracks) {
            if (!renderTrack?.id) continue;
            const track = parsedTracks[renderTrack.id];
            if (!track) continue;

            const trackData = parsedContent[date]?.[renderTrack.id];
            if (!trackData) continue;

            for (let i = 0; i < trackData.items.length; i++) {
                const item = trackData.items[i];
                if (item.startTime && item.duration) {
                    events.push({ element: item, track, trackId: renderTrack.id, index: i });
                }
            }
        }
        return events;
    }
</script>

<div class="timeline-grid-container">
    <div class="timeline-block">
        <!-- Header Row -->
        <div class="timeline-header-row" style={`grid-template-columns: 56px repeat(${columns}, 1fr);`}>
            <div class="timeline-header-corner"></div>
            {#each dates.slice(0, columns) as date (date)}
                <HeaderCell {date} {openDailyNote} />
            {/each}
        </div>

        <!-- Time Grid Body -->
        <div class="timeline-body">
            <!-- Hour labels column (absolute, left side) -->
            <div class="timeline-hour-labels" style={`height: ${gridHeight}px;`}>
                {#each hours as hour (hour)}
                    <div class="timeline-hour-label" style={`top: ${(hour - startHour) * hourHeight + topPad}px;`}>
                        <span>{hour.toString().padStart(2, '0')}:00</span>
                    </div>
                {/each}
            </div>

            <!-- Day columns -->
            <div class="timeline-columns" style={`grid-template-columns: repeat(${columns}, 1fr); height: ${gridHeight}px;`}>
                {#each dates.slice(0, columns) as date, col (date)}
                    {@const events = getEventsForDate(date)}
                    <div class="timeline-day-column">
                        <!-- Hour cell backgrounds -->
                        {#each hours as hour (hour)}
                            <div
                                class="timeline-hour-cell"
                                style={`top: ${(hour - startHour) * hourHeight + topPad}px; height: ${hourHeight}px;`}
                            ></div>
                        {/each}

                        <!-- Event items -->
                        {#each events as { element, track, trackId, index } (`${date}-${trackId}-${element.text}-${element.startTime?.hours}-${element.startTime?.minutes}`)}
                            <TimelineItem {element} {track} {hourHeight} {startHour} {topPad} onToggle={() => onToggleTask(date, trackId, index)} />
                        {/each}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .timeline-grid-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .timeline-block {
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* ── Header ── */
    .timeline-header-row {
        display: grid;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .timeline-header-corner {
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* ── Body ── */
    .timeline-body {
        overflow-y: auto;
        overflow-x: hidden;
        position: relative;
        display: flex;
    }

    /* ── Hour labels (left gutter) ── */
    .timeline-hour-labels {
        width: 56px;
        min-width: 56px;
        position: relative;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }

    .timeline-hour-label {
        position: absolute;
        left: 0;
        right: 0;
        display: flex;
        align-items: flex-start;
        justify-content: flex-end;
        padding-right: 10px;
        box-sizing: border-box;
        transform: translateY(-0.5em);
    }

    .timeline-hour-label span {
        font-size: 11px;
        color: #cccccc;
        font-variant-numeric: tabular-nums;
    }

    /* ── Day columns ── */
    .timeline-columns {
        display: grid;
        flex: 1;
        min-width: 0;
    }

    .timeline-day-column {
        position: relative;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
    }

    .timeline-day-column:last-child {
        border-right: none;
    }

    /* ── Hour cells (grid lines) ── */
    .timeline-hour-cell {
        position: absolute;
        left: 0;
        right: 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.0);
        transition: background 0.15s;
    }

    .timeline-hour-cell:hover {
        background: rgba(255, 255, 255, 0.03);
    }
</style>
