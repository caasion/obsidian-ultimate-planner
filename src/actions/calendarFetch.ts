import { Notice, requestUrl } from "obsidian";

export async function fetchFromUrl(url: string) {
    if (!url) {
        new Notice("No URL to fetch");
        return;
    }

    try {
        const response = await requestUrl(url);

        console.log(response.status, response.headers, response.text)
        
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}