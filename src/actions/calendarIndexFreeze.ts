import { differenceInMinutes } from "date-fns";
import { format } from "date-fns";
import { plannerStore } from "src/state/plannerStore";
import type { CalendarID, CalendarStatus, NormalizedEvent } from "src/types";
import { buildEventDictionaries } from "./calendarParse";
import { calendarState } from "src/state/calendarStore";

/** Given a list of events, freeze them into the planner calendar cells. */
export function freezeEvents(events: NormalizedEvent[], calendar: CalendarID) {
    const { index: frozenIndex, eventsById: frozenEventsById } = buildEventDictionaries(events);
    
    Object.keys(frozenIndex).forEach(date => {
        // Get events from frozenIndex and frozenEventsById
        const IDs = frozenIndex[date];
        const events: NormalizedEvent[] = [];

        IDs.forEach(id => events.push(frozenEventsById[id]));

        const labels = getEventLabels(events);

        plannerStore.update(store => {
            return {
                ...store,
                calendarCells: {
                    ...store.calendarCells,
                    [date]: { [calendar]: labels}
                }
            }
        })
    })
}

/** HELPER: Set the statatus of calendarState */
export function setCalendarStatus(status: CalendarStatus) {
    calendarState.set({ status });
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

/** PURE HELPER */
function getDurationAsString(start: Date, end: Date): string {
		let diff: number = differenceInMinutes(end, start)
		let units: string = "min";

		if (diff % 60 == 0) {
			diff /= 60;
			units = "hr";
		}

		return `${diff} ${units}`
	}