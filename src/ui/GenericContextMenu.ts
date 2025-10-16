import { App, Menu, Notice } from "obsidian";
import { getISODate, idUsedInTemplates } from "src/actions/helpers";
import type { ISODate, ActionItemMeta, CalendarMeta } from "src/types";
import { GenericEditModal } from "./GenericEditModal";
import { get } from "svelte/store";
import { fetchAllandFreeze, fetchPipelineInGracePeriod } from "src/actions/calendarPipelines";
import { addDays, parseISO, startOfDay } from "date-fns";

type RowType = "actionItem" | "calendar";

export function openRowContextMenu(app: App, evt: MouseEvent, type: RowType, date: ISODate, id: RowID) {
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
                if (type === "actionItem") {
                    new GenericEditModal(
                        app, 
                        get(actionItems)[id], 
                        'actionItem',
                        (meta: ActionItemMeta) => updateActionItem(id, meta)
                    ).open();
                } else if (type === "calendar") {
                    new GenericEditModal(
                        app, 
                        get(calendars)[id], 
                        'calendar',
                        (meta: CalendarMeta) => updateCalendar(id, meta)
                    ).open();
                }
                
            })
        )
    if (type === "calendar") {
        menu.addItem((i) => {
            i.setTitle("Fetch from Remote Calendar")
            .setIcon("calendar")
            .onClick(() => {
                const today = getISODate(new Date());
                
                fetchPipelineInGracePeriod(get(calendars)[id], addDays(today, -7), addDays(today, 60))
            })
        })
        .addItem((i) => {
            i.setTitle("Fetch All from Remote Calendar")
            .setIcon("calendar")
            .onClick(() => {
                const today = getISODate(new Date());
                
                fetchAllandFreeze(get(calendars)[id], parseISO(date), addDays(startOfDay(Date.now()), 60))
                //TODO: Turn "parseISo(date" into first occurance of the actionItem in the template...
            })
        })
    }
    
    menu
        .addItem((i) =>
            i.setTitle("Extend to next template")
            .setIcon("calendar-plus-2")
            .onClick(() => {
                const nextDate = getNextTemplateDate(date);
                if (nextDate) {
                    const success = addToTemplate(nextDate, id);
                    if (!success) new Notice("Item already exists in template.")
                }
                else new Notice("No next template found.");
            })
        )
        .addItem((i) =>
            i.setTitle("Extend to latest template")
            .setIcon("calendar-plus")
            .onClick(() => {
                const dates = getTemplateDatesAfter(date);

                dates.forEach((date) => { 
                    addToTemplate(date, id);
                })
            })
        )
        .addItem((i) =>
            i.setTitle("Extend to previous template")
            .setIcon("calendar-minus")
            .onClick(() => {
                const prevDate = getPreviousTemplateDate(date);
                if (prevDate) {
                    const success = addToTemplate(prevDate, id);
                    if (!success) new Notice("Item already exists in template.")
                }
                else new Notice("No previous template found.")
            })
        )
        .addItem((i) =>
            i.setTitle("Remove from this date (until next template)")
            .setIcon("calendar-x")
            .onClick(() => {
                removeFromTemplate(date, id);

                if (!idUsedInTemplates(get(templates), id)) {
                    removeItemFromPlanner(id);
                }
            })
        ).addItem((i) =>
            i.setTitle("Remove from this date (until latest templates)")
            .setIcon("calendar-off")
            .onClick(() => {
                removeFromTemplate(date, id);

                const dates = getTemplateDatesAfter(date);

                dates.forEach((date) => {        
                    removeFromTemplate(date, id)

                    if (!idUsedInTemplates(get(templates), id)) {
                        removeItemFromPlanner(id);
                    }
                })
            })
        ).addItem((i) =>
            i.setTitle("Move up")
            .setIcon("chevron-up")
            .onClick(() => {
                const template = templateForDate(date);
                const a = template.findIndex((value) => value == id);

                setTemplate(date, swapArrayItems(template, a, a-1))
            })
        ).addItem((i) =>
            i.setTitle("Move down")
            .setIcon("chevron-down")
            .onClick(() => {
                const template = templateForDate(date);
                const a = template.findIndex((value) => value == id);

                setTemplate(date, swapArrayItems(template, a, a+1))
            })
        );
        
    menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
}