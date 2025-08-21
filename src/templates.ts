// Helper functions for action item templates

import { ISODate, Template } from "./types";

/** Returns a deep copy of the template that should apply on `date`
 *  Loops through all the keys (which are dates) in templates and compares them with the date provided.
 *  If no template exists at or before `date`, it return an emppty array
 */
export function templateForDate(templates: Record<ISODate, Template>, date: ISODate): Template {
    let best: ISODate | null = null;
    for (const key in templates) {
        if (key <= date && (best === null || key > date)) best = key;
    }
    return best ? structuredClone(templates[best]) : [];
    
}

export function setTemplateRevision(templates: Record<ISODate, Template>, effectiveFrom: ISODate, items: Template): Record<ISODate, Template> {
    return {...templates, [effectiveFrom]: structuredClone(items) };
}