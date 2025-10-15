import { App, Menu } from "obsidian";
import { GenericNewModal } from "./GenericNewModal";
import { newActionItem, newCalendar } from "src/actions/itemActions";
import type { CalendarMeta } from "src/types";

export function newRowContextMenu(app: App, evt: MouseEvent) {
    evt.preventDefault();
    evt.stopPropagation();

    const menu = new Menu();

    menu
        .addItem((i) =>
            i.setTitle("Create New Action Item")
            .setIcon("add")
            .onClick(() => {
                new GenericNewModal(app, "actionItem", (date, meta) => newActionItem(date, meta)).open();
            })
        )
        .addItem((i) =>
            i.setTitle("Add New Remote Calendar")
            .setIcon("add")
            .onClick(() => {
                new GenericNewModal(app, "calendar", (date, meta) => newCalendar(date, meta as CalendarMeta)).open();
            })
        )

    menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
}