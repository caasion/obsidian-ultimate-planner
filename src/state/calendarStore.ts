import { writable } from "svelte/store";
import type { CalendarState } from "src/types";

export const calendarState = writable<CalendarState>({ status: "idle" });
