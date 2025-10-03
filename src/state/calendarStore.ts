import { writable } from "svelte/store";
import type { CalendarCache } from "src/types";

export const calendarStore = writable<CalendarCache>();