export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

export interface ActionItem {
    id: string;       // stable key, e.g. "ai-fitness"
    index: number;    // visual order (0..N-1), fixed
    label: string;    // e.g. "FITNESS ★"
    color: string;   // cosmetic only (optional)
}

export interface PlannerState {
    cells: Record<ISODate, Record<string /* rowID */, string /* contents */>>; // Records are much more efficient objects for look-ups
}