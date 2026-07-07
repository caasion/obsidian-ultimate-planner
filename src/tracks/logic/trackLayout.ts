import type { ISODate, RenderTrack, Track } from "src/plugin/types";
import { getISODate } from "src/plugin/helpers";

/**
 * Pure track-layout math. Given a set of tracks and a list of dates, computes
 * which track occupies which row on each date, laid out in column-blocks.
 *
 * This module holds no state and touches no files or Obsidian APIs: callers
 * pass the current `tracks` snapshot in, so the result is deterministic and
 * unit-testable. `today` is injectable for the same reason (defaults to now).
 */

function resolveIntervalEnd(intervalStart: ISODate, intervalEnd: ISODate | undefined, today: ISODate): ISODate {
    if (intervalEnd) return intervalEnd;
    return intervalStart > today ? intervalStart : today;
}

export function isTrackActiveOnDate(track: Track, date: ISODate, today: ISODate): boolean {
    const { start, end } = track.effective;
    const resolvedEnd = resolveIntervalEnd(start, end, today);
    return date >= start && date <= resolvedEnd;
}

export function isTrackStartingOnDate(track: Track, date: ISODate): boolean {
    return track.effective.start === date;
}

/** Compute tracksByDate index on-demand for only the requested dates */
export function getTracksForDates(
    tracks: Record<string, Track>,
    dates: ISODate[],
    columns: number = dates.length,
    today: ISODate = getISODate(new Date()),
): Record<ISODate, RenderTrack[]> {
    const index: Record<ISODate, RenderTrack[]> = {};

    for (const date of dates) {
        index[date] = [];
    }

    const sortedTrackIds = Object.entries(tracks)
        .sort(([, a], [, b]) => {
            const orderA = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
            const orderB = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;

            if (orderA !== orderB) return orderA - orderB;
            return a.label.localeCompare(b.label);
        })
        .map(([trackId]) => trackId);

    const safeColumns = Math.max(1, columns);

    for (let blockStart = 0; blockStart < dates.length; blockStart += safeColumns) {
        const blockDates = dates.slice(blockStart, blockStart + safeColumns);
        const rowAssignments: Array<string | null> = [];
        const assignedTrackIds = new Set<string>();

        for (let dayIndex = 0; dayIndex < blockDates.length; dayIndex++) {
            const date = blockDates[dayIndex];
            const activeTrackIds = sortedTrackIds.filter((trackId) => {
                const track = tracks[trackId];
                return track ? isTrackActiveOnDate(track, date, today) : false;
            });
            const activeTrackSet = new Set(activeTrackIds);

            for (let row = 0; row < rowAssignments.length; row++) {
                const trackId = rowAssignments[row];
                if (!trackId) continue;

                if (!activeTrackSet.has(trackId)) {
                    rowAssignments[row] = null;
                    assignedTrackIds.delete(trackId);
                }
            }

            const unassignedActiveTrackIds = activeTrackIds.filter((trackId) => !assignedTrackIds.has(trackId));
            const startingTrackIds = unassignedActiveTrackIds.filter((trackId) => {
                const track = tracks[trackId];
                return track ? isTrackStartingOnDate(track, date) : false;
            });
            const carryOverTrackIds = unassignedActiveTrackIds.filter((trackId) => !startingTrackIds.includes(trackId));

            const placementQueue = dayIndex === 0
                ? unassignedActiveTrackIds
                : [...startingTrackIds, ...carryOverTrackIds];

            for (const trackId of placementQueue) {
                let row = rowAssignments.findIndex((value) => value === null);

                if (row === -1) {
                    row = rowAssignments.length;
                    rowAssignments.push(trackId);
                } else {
                    rowAssignments[row] = trackId;
                }

                assignedTrackIds.add(trackId);
            }

            const rowsForDate: RenderTrack[] = [];
            for (let row = 0; row < rowAssignments.length; row++) {
                const trackId = rowAssignments[row];
                if (!trackId || !activeTrackSet.has(trackId)) continue;

                const track = tracks[trackId];
                rowsForDate[row] = {
                    id: trackId,
                    isStartOfInterval: track ? isTrackStartingOnDate(track, date) : false,
                };
            }

            index[date] = rowsForDate;
        }
    }

    return index;
}
