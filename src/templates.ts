// Helper functions for action item templates

import { ActionItem, ISODate, TemplatesByDate } from "./types";

/** Returns a deep copy of the template that should apply on `date`
 *  Loops through all the keys (which are dates) in templates and compares them with the date provided.
 *  If no template exists at or before `date`, it return an emppty array
 */
export function templateForDate(templates: TemplatesByDate, date: ISODate): ActionItem[] {
    let best: ISODate | null = null;
    for (const key in templates) {
        if (key <= date && (best === null || key > best)) best = key;
    }
    return best ? JSON.parse(JSON.stringify(templates[best])) : [];
    
}

// Returns a new object with a different `Template` for the date in question
export function setTemplateRevision(templates: TemplatesByDate, effectiveFrom: ISODate, items: ActionItem[]): TemplatesByDate {
    return {...templates, [effectiveFrom]: structuredClone(items) };
}