import { differenceInMinutes } from "date-fns";
import { format } from "date-fns";
import type { NormalizedEvent } from "src/types";

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