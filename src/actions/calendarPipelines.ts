import { addDays } from "date-fns";
import { Notice } from "obsidian";
import { calendarState, fetchToken } from "../state/calendarStore";
import { updateCalendar } from "src/state/plannerStore";
import type { CalendarMeta, NormalizedEvent } from "../types";
import { fetchFromUrl, hashText, detectFetchChange } from "./calendarFetch";
import { setCalendarStatus, getEventLabels, populateCalendarCells } from "./calendarIndexFreeze";
import { parseICSBetween, buildEventDictionaries, parseICS } from "./calendarParse";
import { get } from "svelte/store";

export async function fetchPipelineInGracePeriod(calendar: CalendarMeta, after: Date, before: Date) {
    // Check if we should fetch. If we do fetch, set status.
    if (get(calendarState).status === "fetching") return; 
    setCalendarStatus("fetching");

    // [SETUP] fetchToken for GUARD later
    fetchToken.update(token => token + 1)
    const myToken = get(fetchToken);

    // [SETUP] startUrl for GUARD later
    const startUrl = calendar.url;

    console.log(calendar);

    try { // Wrap in try because fetchFromUrl throws Exception
        const response = await fetchFromUrl(calendar.url, calendar.etag, calendar.lastModified); 	

        // [STORE] Update lastFetched status in store
        updateCalendar(calendar.id, { lastFetched: Date.now() });

        // [GUARD] If a new refresh token is generated, that means our fetch is stale (old data). We want to drop that.
        if (myToken !== get(fetchToken)) {
            console.warn("Fetch request is stale. Aborted.");
            setCalendarStatus("unchanged");
            return;
        };

        // [GUARD] If the old URL is different from the current one, the URL changed and we should drop the fetch
        if (startUrl !== calendar.url) { // We can do this because calendar is a reference to the object
            new Notice("URL changed during fetch. Please fetch again.");
            console.warn("URL changed during fetch. Aborted.");
            setCalendarStatus("unchanged");
            return;
        };

        // [PARSE] Parse the ICS within the grace period
        const events = parseICSBetween(response.text, this._defaultCalendar, after, before);

        // [CONDITION] If the calendar contents didn't change, don't bother updating freeze and cache.
        const contentHash = await hashText(JSON.stringify(events));
        if (!detectFetchChange(response, contentHash, calendar.contentHash)) {
            setCalendarStatus("unchanged");
            return;
        }
        
        // [STORE] Update cache information 
        updateCalendar(calendar.id, { contentHash })
        
        // [STORE] Build efficient event dictionaries and use those to write into store
        const { index, eventsById } = buildEventDictionaries(events);
        populateCalendarCells(calendar.id, index, eventsById);


        setCalendarStatus("updated");
        
    } catch (error) {
        calendarState.update(() => { return { status: "error", lastError: error } });
        new Notice("An error occured while fetching. See console for details");
        console.error("An error occured while fetching:", error.message)
    }
}

export async function fetchAllandFreeze(calendar: CalendarMeta, after: Date, before: Date) {
    // Check if we should fetch. If we do fetch, set status.
    if (get(calendarState).status === "fetching") return; 
    setCalendarStatus("fetching");

    // [SETUP] fetchToken for GUARD later
    fetchToken.update(token => token + 1)
    const myToken = get(fetchToken);

    // [SETUP] startUrl for GUARD later
    const startUrl = calendar.url;

    try { // Wrap in try because fetchFromUrl throws Exception
        const response = await fetchFromUrl(calendar.url, calendar.etag, calendar.lastModified); 	

        // [STORE] Update lastFetched status in store
        updateCalendar(calendar.id, { lastFetched: Date.now() })

        // [GUARD] If a new refresh token is generated, that means our fetch is stale (old data). We want to drop that.
        if (myToken !== get(fetchToken)) {
            console.warn("Fetch request is stale. Aborted.");
            setCalendarStatus("unchanged");
            return;
        };

        // [GUARD] If the old URL is different from the current one, the URL changed and we should drop the fetch
        if (startUrl !== calendar.url) { // We can do this because calendar is a reference to the object
            new Notice("URL changed during fetch. Please fetch again.");
            console.warn("URL changed during fetch. Aborted.");
            setCalendarStatus("unchanged");
            return;
        };
        
        // [FREEZE] Parse ALL events, build dictionaries, and freeze
        const allEvents = parseICS(response.text, this._defaultCalendar);
        const { index, eventsById } = buildEventDictionaries(allEvents);
        populateCalendarCells(calendar.id, index, eventsById);
        
        // [HASH] Parse ICS within grace period and compute contentHash from it
        const eventsBetween = parseICSBetween(response.text, this._defaultCalendar, after, before);
        const contentHash = await hashText(JSON.stringify(eventsBetween));

        // [STORE] Update cache information 
        updateCalendar(calendar.id, { contentHash })

        setCalendarStatus("updated");
        
    } catch (error) {
        calendarState.update(() => { return { status: "error", lastError: error } });
        new Notice("An error occured while fetching. See console for details");
        console.error("An error occured while fetching:", error.message)
    }
}