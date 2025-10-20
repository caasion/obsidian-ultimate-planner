import type { ISODate, DataService, HelperService, ItemMeta } from '../types';
import { get } from 'svelte/store';
import { CalendarPipeline } from './calendarPipelines';
import { addDays, parseISO, startOfDay } from 'date-fns';

export interface PlannerServiceDeps {
    data: DataService;
    helpers: HelperService;
    calendarPipelines: CalendarPipeline;
}

export class PlannerActions {
    private data: DataService;
    private helpers: HelperService;
    private calendarPipelines: CalendarPipeline;

    constructor(deps: PlannerServiceDeps) {
        this.data = deps.data;
        this.helpers = deps.helpers;
        this.calendarPipelines = deps.calendarPipelines;
    }

    /** Uses binary search to get the template date for a given date. */
    private getTemplateDate(date: ISODate): ISODate {
    const sortedTemplateDates: ISODate[] = Object.keys(get(this.data.templates)).sort();

        // Implement binary search to find the template date that is the greatest date less than or equal to the date provided
        let left = 0;
        let right = sortedTemplateDates.length - 1;
        let mid = 0;

        while (left <= right) {
            mid = Math.floor((left + right) / 2);
            if (sortedTemplateDates[mid] === date) {
                return sortedTemplateDates[mid];
            }
            if (sortedTemplateDates[mid] <= date) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return "";
    }

    /** Creates a new item given a date and item details. */
    public newItem(date: ISODate, meta: ItemMeta) {
        this.data.updateItemMeta(date, meta.id, meta);

        const templateDate = this.getTemplateDate(date); 
        this.data.templates.update(templates => {
            const currentMetaRecord = templates[templateDate] || {};
            const newMetaRecord = { ...currentMetaRecord, [meta.id]: meta };
            return { ...templates, [templateDate]: newMetaRecord };
        });

        if ('url' in meta) { // An indicator of a calendar item
            this.calendarPipelines.fetchInGracePeriod(
                meta, 
                parseISO(date), 
                addDays(startOfDay(Date.now()), 60)
            );
        }
    }

}