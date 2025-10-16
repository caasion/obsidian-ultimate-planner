import { differenceInMinutes } from "date-fns";
import { format } from "date-fns";
import type { CalendarID, CalendarStatus, ISODate, ItemID, NormalizedEvent } from "src/types";
import { calendarState } from "src/state/calendarStore";

/** Write into calendarCells (store) with index and eventsById. */    
export function populateCalendarCells(
    setCell: (date: ISODate, id: ItemID, value: string) => void;
    calendarId: CalendarID, 
    index: Record<string, string[]>, 
    eventsById: Record<string, NormalizedEvent>) {
    Object.keys(index).forEach(date => {
        // Get events from frozenIndex and frozenEventsById
        const IDs = index[date];
        const events: NormalizedEvent[] = [];

        IDs.forEach(id => events.push(eventsById[id]));

        const labels = getEventLabels(events);

        setCell(date, calendarId, labels);
    })
}

/** PURE HELPER: Turns a list of normalized events into a list of labels. */
export function getEventLabels(events: NormalizedEvent[]): string[] {
    return events.map(event => {
        if (event.allDay) {
            return `${event.summary}`
        } else {
            const start = format(event.start, "HH:mm")
            return `${event.summary} @ ${start} (${getDurationAsString(event.start, event.end)})`
        }
    })
}

/** [PURE HELPER] */
function getDurationAsString(start: Date, end: Date): string {
    let diff: number = differenceInMinutes(end, start)
    let units: string = "min";

    if (diff % 60 == 0) {
        diff /= 60;
        units = "hr";
    }

    return `${diff} ${units}`
}