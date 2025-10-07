import { writable } from "svelte/store";
import type { CalendarBlob, CalendarState } from "src/types";

export const calendarStore = writable<CalendarBlob>();

export const calendarState = writable<CalendarState>();