import { format } from "date-fns";
import IcalExpander from "ical-expander";
import ICAL from "ical.js";
import type { occurrenceDetails } from "ical.js/dist/types/event";
import { calendarStore } from "../state/calendarStore";
import type { ISODate, NormalizedEvent } from "src/types";
import { get } from "svelte/store";

/** Converts an ICS string into a list of events with details. */
export function parseICS(ics: string, calendarId: string): NormalizedEvent[] {
    const icalExpander = new IcalExpander({ics, maxIterations: 10})
    // TODO: Handle iterations

    const results = icalExpander.all();

    const mappedEvents: NormalizedEvent[] = results.events.map(e => normalizeEvent(e, calendarId)); // only contains one-off events
    const mappedOccurrences: NormalizedEvent[] = results.occurrences.map(o => normalizeOccurrenceEvent(o, calendarId));
    const allEvents = [...mappedEvents, ...mappedOccurrences]; // contains recurring events

    return allEvents;
}

/** Converts an ICS string into a list of events with details. */
export function parseICSBetween(ics: string, calendarId: string, after: Date, before: Date): NormalizedEvent[] {
    const icalExpander = new IcalExpander({ics})
    const results = icalExpander.between(after, before);

    const mappedEvents: NormalizedEvent[] = results.events.map(e => normalizeEvent(e, calendarId)); // only contains one-off events
    const mappedOccurrences: NormalizedEvent[] = results.occurrences.map(o => normalizeOccurrenceEvent(o, calendarId));
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

/** Builds a record of Date-EventIDs and EventId-NormalizedEvent for quick look-up. O(1) */
export function buildEventDictionaries(events: NormalizedEvent[]) {
    const index: Record<ISODate, string[]> = {};

    events.forEach(e => {
        const date = format(e.start, "yyyy-MM-dd");
        index[date] ??= []
        index[date].push(e.id);
    })

    const eventsById: Record<string, NormalizedEvent> = {};

    events.forEach(e => {
        eventsById[e.id] = e;
    })

    return { index, eventsById };

}

/** Reads from calendarStore and returns a list of events (with details) for a specific date. */
export function getEvents(date: ISODate): NormalizedEvent[] {
    const calendar = get(calendarStore);
    const IDs = calendar.index[date] ?? [];
    let events: NormalizedEvent[] = [];

    IDs.forEach(id => events.push(calendar.eventsById[id]));

    return events;
}