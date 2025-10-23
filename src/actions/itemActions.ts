import type { ISODate, DataService, HelperService, ItemMeta, CalendarMeta, ItemID } from '../types';
import { get } from 'svelte/store';
import { CalendarPipeline } from './calendarPipelines';
import { addDays, parseISO, startOfDay } from 'date-fns';
import { Menu, type App } from 'obsidian';
import { GenericNewModal } from 'src/ui/GenericNewModal';
import { GenericEditModal } from 'src/ui/GenericEditModal';
import { sortedTemplateDates } from 'src/state/plannerStore';

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
    public getTemplateDate(date: ISODate): ISODate {
        const dates: ISODate[] = get(sortedTemplateDates);

		// Implement binary search to find the template date that is the greatest date less than or equal to the date provided
		let left = 0;
		let right = dates.length - 1;
		let result: ISODate = "";

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const midDate = dates[mid];

			if (midDate === date) {
				return midDate;
			}
			if (midDate < date) {
				result = midDate;
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}

		return result;
	}

    /** Creates a new item given a date and item details. */
    public newItem(date: ISODate, meta: ItemMeta) {
        this.data.updateItemMeta(date, meta.id, meta);

        const templateDate = this.getTemplateDate(date); 
        this.data.templates.update(templates => {
            const currentMetaRecord = templates[templateDate] || {};
            const newMetaRecord = { ...currentMetaRecord, [meta.id]: {...meta, order: Object.keys(currentMetaRecord).length } };
            return { ...templates, [templateDate]: newMetaRecord };
        });

        if (meta.type === "calendar") {
            this.calendarPipelines.fetchInGracePeriod(
                meta, 
                parseISO(date), 
                addDays(startOfDay(Date.now()), 60)
            );
        }
    }

    public newRowContextMenu(app: App, evt: MouseEvent, tDate: ISODate): void {
        evt.preventDefault();
        evt.stopPropagation();
    
        const menu = new Menu();

        menu
        .addItem((i) =>
            i.setTitle("Create New Action Item")
            .setIcon("add")
            .onClick(() => {
                new GenericNewModal(app, "action", tDate, (date, meta) => this.newItem(date, meta)).open();
            })
        )
        .addItem((i) =>
            i.setTitle("Add New Remote Calendar")
            .setIcon("add")
            .onClick(() => {
                new GenericNewModal(app, "calendar", tDate, (date, meta) => this.newItem(date, meta as CalendarMeta)).open();
            })
        )
        
    
        menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
    }

    public openItemMenu(app: App, evt: MouseEvent, date: ISODate, id: ItemID, meta: ItemMeta) {
        evt.preventDefault();
        evt.stopPropagation();

        const menu = new Menu();

        menu
            .addItem((i) =>
                i.setTitle(`ID: ${id}`)
                .setIcon("info")
            )
            .addSeparator()
            .addItem((i) =>
                i.setTitle("Edit")
                .setIcon("pencil")
                .onClick(() => {
                    new GenericEditModal(app, meta, (newMeta) => this.data.updateItemMeta(this.getTemplateDate(date), id, newMeta)).open();
                })
            )

        menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
    }

    public swapItem(tDate: ISODate, id: ItemID, dist: number): boolean {
        const currOrder = this.data.getItemMeta(tDate, id).order;
        const newOrder = currOrder + dist;
        const swapTargetID = Object.values(this.data.getTemplate(tDate)).find(t => t.order == newOrder)?.id;

        if (!swapTargetID) return false;

        this.data.updateItemMeta(tDate, id, {order: newOrder});
        this.data.updateItemMeta(tDate, swapTargetID, {order: currOrder});

        return true;
    }
}