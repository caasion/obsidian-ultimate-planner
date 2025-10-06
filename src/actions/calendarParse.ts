import IcalExpander from "ical-expander";
import ICAL from "ical.js";
import type { occurrenceDetails } from "ical.js/dist/types/event";
import type { NormalizedEvent } from "src/types";

export function parseICS(ics: string, calendarId: string): NormalizedEvent[] {
    const icalExpander = new IcalExpander({ics, maxIterations: 10})

    const results = icalExpander.all();

    const mappedEvents: NormalizedEvent[] = results.events.map(e => normalizeEvent(e, "hi")); // only contains one-off events
    const mappedOccurrences = results.occurrences.map(o => normalizeOccurrenceEvent(o, "hi"));
    const allEvents = [...mappedEvents, ...mappedOccurrences]; // contains recurring events

    return allEvents;
}

export function normalizeEvent(event: ICAL.Event, calendarId: string) {
    const allDay = (event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime()) == (24 * 60 * 60 * 1000);

    return { 
        id: event.uid,
        start: event.startDate,
        end: event.endDate,
        allDay,
        summary: event.summary,
        location: event.location,
        description: event.description,
        calendarId
    }
}

export function normalizeOccurrenceEvent(occurance: occurrenceDetails, calendarId: string) {
    const event = occurance.item;

    const allDay = (event.endDate.toJSDate().getTime() - event.startDate.toJSDate().getTime()) == (24 * 60 * 60 * 1000);

    return { 
        id: event.uid,
        start: occurance.startDate,
        end: occurance.endDate,
        allDay,
        summary: event.summary,
        location: event.location,
        description: event.description,
        calendarId
    }
}