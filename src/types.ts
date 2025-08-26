export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

export type ActionItemID = string;

export interface ActionItemMeta {
    index: number;    // visual order (0..N-1), fixed
    label: string;    // e.g. "FITNESS ★"
    color: string;   // cosmetic only (optional)
}

export interface PlannerState {
    actionItems: Record<ActionItemID, ActionItemMeta>;
    templates: Record<ISODate, ActionItemID[]>;
    cells: Record<ISODate, Record<ActionItemID, string /* contents */>>; // Records are much more efficient objects for look-ups
}