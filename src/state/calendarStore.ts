import { writable } from "svelte/store";
import type { CalendarBlob } from "src/types";

export const calendarStore = writable<CalendarBlob>();