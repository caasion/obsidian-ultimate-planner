import { writable } from "svelte/store";
import type { PlannerState } from "src/types";

export const plannerStore = writable<PlannerState>();