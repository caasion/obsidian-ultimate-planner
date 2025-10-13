import { App, Menu } from "obsidian";
import { addDaysISO, idUsedInTemplates } from "src/actions/helpers";
import { getDatesWithTemplatesAfterDate, templateForDate, swapArrayItems } from "src/actions/itemActions";
import { actionItems, updateActionItem, addToTemplate, removeFromTemplate, templates, removeItemFromPlanner, setTemplate, updateCalendar, calendars } from "src/state/plannerStore";
import type { ISODate, ActionItemID, ActionItemMeta, CalendarMeta } from "src/types";
import { GenericEditModal } from "./GenericEditModal";
import { get } from "svelte/store";

type RowType = "actionItem" | "calendar";

export function openRowContextMenu(app: App, evt: MouseEvent, type: RowType, date: ISODate, id: ActionItemID) {
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
        .addItem((i) =>
            i.setTitle("Extend until next template")
            .setIcon("calendar-plus-2")
            .onClick(() => {
                addToTemplate(addDaysISO(date, 1), id);
            })
        )
        .addItem((i) =>
            i.setTitle("Extend until latest template")
            .setIcon("calendar-plus")
            .onClick(() => {
                const dates = getDatesWithTemplatesAfterDate(date);

                dates.forEach((date) => {        
                    addToTemplate(addDaysISO(date, 1), id);
                })
            })
        )
        .addItem((i) =>
            i.setTitle("Extend to previous template")
            .setIcon("calendar-minus")
            .onClick(() => {
                addToTemplate(addDaysISO(date, -1), id);
            })
        )
        .addItem((i) =>
            i.setTitle("Remove from this date (until next template)")
            .setIcon("calendar-x")
            .onClick(() => {
                removeFromTemplate(date, id)
                if (!idUsedInTemplates(get(templates), id)) {
                    removeItemFromPlanner(id);
                }
            })
        ).addItem((i) =>
            i.setTitle("Remove from this date (until latest templates)")
            .setIcon("calendar-off")
            .onClick(() => {
                const dates = getDatesWithTemplatesAfterDate(date);

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