export type ISODate = string; // Create date type for dates in ISO 8601 for simplification (not as heavy as a Date object)

export type ActionItemID = string;

export interface ActionItem {
    id: ActionItemID;       // stable key, e.g. "ai-fitness"
    index: number;    // visual order (0..N-1), fixed
    label: string;    // e.g. "FITNESS ★"
    color: string;   // cosmetic only (optional)
}

export type Template = ActionItem[];

export interface DayData {
    items: Template;
    isDirty: boolean;
}

export type TemplatesByDate = Record<ISODate /* Date the templates are effective from */, Template>

export interface PlannerState {
    cells: Record<ISODate, Record<ActionItemID /* rowID */, string /* contents */>>; // Records are much more efficient objects for look-ups
    days: Record<ISODate, DayData>;
    templates: TemplatesByDate;
}