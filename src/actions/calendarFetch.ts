import { Notice, requestUrl, type RequestUrlResponse, type RequestUrlResponsePromise } from "obsidian";
import { calendarStore } from "src/state/calendarStore";
import type { CalendarCache } from "src/types";
import { get } from "svelte/store";

export function shouldFetch(fetchInterval: number, lastFetched?: number, ): boolean {
    if (!lastFetched) return true;

    if (Date.now() - lastFetched > fetchInterval) return true;

    return false;
}

export async function fetchFromUrl(url: string, calendar: CalendarCache): Promise<RequestUrlResponse | null> {
    if (!url) {
        new Notice("No URL to fetch");
        return null;
    }

    try {
        const response = await requestUrl({
            url,
            headers: {
                ...(calendar.etag ? { 'If-None-Match': calendar.etag } : {}),
                ...(calendar.lastModified ? { 'If-Modified-Since': calendar.lastModified} : {})
            }
        });

        calendarStore.update(cache => {
            return {...cache, etag: response.headers.etag ?? "", lastModified: response.headers.lastModified ?? "", lastFetched: Date.now()}
        })

        return response;
        
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}