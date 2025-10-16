import { type Day, parseISO, startOfWeek, eachDayOfInterval, addDays } from "date-fns";
import type { ISODate } from "src/types";
import { getISODate } from "./helpers";

export function getDatesOfWeek(anchor: ISODate, weekStartsOn: Day): ISODate[] {
    const date = parseISO(anchor);

    const start = startOfWeek(date, { weekStartsOn });
    const end = startOfWeek(date, { weekStartsOn });

    const dates = eachDayOfInterval({ start, end });

    return dates.map(d => getISODate(d));
}

export function getDatesOfBlock(anchor: ISODate, days: number): ISODate[] {
    const date = parseISO(anchor);

    const dates = eachDayOfInterval({ start: date, end: addDays(date, days)})

    return dates.map(d => getISODate(d));
}