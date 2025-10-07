import { format } from "date-fns";
import IcalExpander from "ical-expander";
import ICAL from "ical.js";
import type { occurrenceDetails } from "ical.js/dist/types/event";
import { calendarStore } from "src/state/calendarStore";
import type { ISODate, NormalizedEvent } from "src/types";
import { get } from "svelte/store";

export function parseICS(ics: string, calendarId: string): NormalizedEvent[] {
    const icalExpander = new IcalExpander({ics, maxIterations: 10})

    const results = icalExpander.all();

    const mappedEvents: NormalizedEvent[] = results.events.map(e => normalizeEvent(e, calendarId)); // only contains one-off events
    const mappedOccurrences = results.occurrences.map(o => normalizeOccurrenceEvent(o, calendarId));
    const allEvents = [...mappedEvents, ...mappedOccurrences]; // contains recurring events

    return allEvents;
}


//TODO: Overload one function instead
export function normalizeEvent(event: ICAL.Event, calendarId: string) {
    return { 
        id: event.uid,
        start: event.startDate.toJSDate(), // Normalize dates to JS Date object instead of ical TIME object
        end: event.endDate.toJSDate(),
        allDay: event.startDate.isDate,
        summary: event.summary,
        location: event.location,
        description: event.description,
        calendarId
    }
}

export function normalizeOccurrenceEvent(occurance: occurrenceDetails, calendarId: string) {
    const event = occurance.item;

    return { 
        id: event.uid,
        recurrId: occurance.recurrenceId.toJSDate(), // Normalize dates to JS Date object instead of ical TIME object
        start: occurance.startDate.toJSDate(),
        end: occurance.endDate.toJSDate(),
        allDay: event.startDate.isDate,
        summary: event.summary,
        location: event.location,
        description: event.description,
        calendarId
    }
}