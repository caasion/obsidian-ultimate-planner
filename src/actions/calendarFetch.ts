import { Notice, requestUrl, type RequestUrlResponse } from "obsidian";

/** Checks whether if we should fetch based on a time-guard (fetchInterval). */
export function shouldFetch(fetchInterval: number, lastFetched?: number): boolean {
    if (!lastFetched) return true;

    if (Date.now() - lastFetched > fetchInterval) return true;

    return false;
}

/** Using Obsidian's requestUrl(), attempt to fetch with headers.
 * Throws errors, must be handled.
 */
export async function fetchFromUrl(url: string, etag?: string, lastModified?: string): Promise<RequestUrlResponse> {
    if (!url) {
        throw new Error("No URL to fetch");
    }

    try {
        const response = await requestUrl({
            url,
            headers: {
                ...(etag ? { 'If-None-Match': etag } : {}),
                ...(lastModified ? { 'If-Modified-Since': lastModified} : {})
            }
        });

        return response;
        
    } catch (error) {
        throw error;
    }
}

/** Based on headers (response.status) and contentHash (fallback), 
 * determines if response has changed from calendarStore. */
export function detectFetchChange(response: RequestUrlResponse, contentHash: string, oldContentHash?: string): boolean {
    const contentChanged: boolean = contentHash != oldContentHash;

    if (response.status == 200 && contentChanged) {
        return true;
    } else if (response.status == 304 || !contentChanged) {
        return false;
    } 

    return false;
}

/** Hash a string using SHA-1. */
export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}