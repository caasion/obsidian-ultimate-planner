import { Notice, requestUrl, type RequestUrlResponse } from "obsidian";
import { calendarStore } from "src/state/calendarStore";
import { get } from "svelte/store";

export function shouldFetch(fetchInterval: number, lastFetched?: number, ): boolean {
    if (!lastFetched) return true;

    if (Date.now() - lastFetched > fetchInterval) return true;

    return false;
}

export async function fetchFromUrl(url: string): Promise<RequestUrlResponse> {
    if (!url) {
        throw new Error("No URL to fetch");
    }

    try {
        const calendar = get(calendarStore)

        const response = await requestUrl({
            url,
            headers: {
                ...(calendar.etag ? { 'If-None-Match': calendar.etag } : {}),
                ...(calendar.lastModified ? { 'If-Modified-Since': calendar.lastModified} : {})
            }
        });

        calendarStore.update(cache => {
            return {...cache, lastFetched: Date.now()}
        })

        return response;
        
    } catch (error) {
        throw error;
    }
}

export function detectFetchChange(response: RequestUrlResponse, contentHash: string): boolean {
    const calendar = get(calendarStore)
    const contentChanged: boolean = contentHash != calendar.contentHash;

    if (response.status == 200 && contentChanged) {
        // console.log("The calendar contents changed!");

        return true;
        
    } else if (response.status == 304 || !contentChanged) {
        // console.log("Nothing changed!")

        return false;
    } 

    return false;
}

export function stripICSVariance(text: string): string {
    // Remove "DTSTAMP:..." line because it breaks the hashing
    return text.replace(/DTSTAMP:.*\r\n/gm, ""); 
}

export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}