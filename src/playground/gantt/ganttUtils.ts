import {
  addMonths,
  differenceInDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import { getISODate } from "src/plugin/helpers";
import type { ISODate, Project } from "src/plugin/types";

export const ROW_HEIGHT = 36;
export const PROJECT_BAR_HEIGHT = 28;
export const TRACK_HEADER_HEIGHT = 44;
export const TRACK_PADDING_BOTTOM = 16;

/** Standard window size presets (days). */
export const WINDOW_PRESETS = [14, 30, 60, 90, 180, 365] as const;
export type WindowPreset = (typeof WINDOW_PRESETS)[number];

/**
 * Returns a viewport centered on `center` (defaults to today) spanning
 * exactly `windowDays` days.
 */
export function getRollingViewport(
  windowDays: number,
  center?: ISODate
): { start: ISODate; end: ISODate } {
  const centerDate = center ? parseISO(center) : new Date();
  const half = Math.floor(windowDays / 2);
  const start = new Date(centerDate);
  start.setDate(start.getDate() - half);
  const end = new Date(centerDate);
  end.setDate(end.getDate() + (windowDays - half - 1));
  return { start: getISODate(start), end: getISODate(end) };
}

export function dateToX(
  date: ISODate,
  viewportStart: ISODate,
  pxPerDay: number
): number {
  return differenceInDays(parseISO(date), parseISO(viewportStart)) * pxPerDay;
}

export function getViewportWidth(
  viewportStart: ISODate,
  viewportEnd: ISODate,
  pxPerDay: number
): number {
  return (
    (differenceInDays(parseISO(viewportEnd), parseISO(viewportStart)) + 1) *
    pxPerDay
  );
}

export interface HeaderTick {
  label: string;
  /** Pixel offset for the centered label. */
  x: number;
  /** Pixel offset for the left-edge grid line. */
  gridX: number;
}

/**
 * Generates header ticks whose granularity is inferred from `pxPerDay`:
 *  - pxPerDay >= 20  → one tick per day
 *  - pxPerDay >= 5   → one tick per week (Monday-aligned)
 *  - else            → one tick per month
 */
export function getHeaderTicks(
  viewportStart: ISODate,
  viewportEnd: ISODate,
  pxPerDay: number
): HeaderTick[] {
  if (pxPerDay <= 0) return [];

  const start = parseISO(viewportStart);
  const end = parseISO(viewportEnd);

  // ── Daily ──────────────────────────────────────────────────────────────
  if (pxPerDay >= 20) {
    return eachDayOfInterval({ start, end }).map((day) => {
      const offset = differenceInDays(day, start);
      return {
        label: format(day, "d"),
        x: offset * pxPerDay + pxPerDay / 2,
        gridX: offset * pxPerDay,
      };
    });
  }

  // ── Weekly (Monday-aligned) ────────────────────────────────────────────
  if (pxPerDay >= 5) {
    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(
      (monday) => {
        const offset = differenceInDays(monday, start);
        return {
          label: format(monday, "d MMM"),
          x: offset * pxPerDay + (7 * pxPerDay) / 2,
          gridX: Math.max(0, offset) * pxPerDay,
        };
      }
    );
  }

  // ── Monthly ────────────────────────────────────────────────────────────
  const ticks: HeaderTick[] = [];
  let current = startOfMonth(start);
  const spansMultipleYears = start.getFullYear() !== end.getFullYear();
  while (current <= end) {
    const offset = differenceInDays(current, start);
    const days = getDaysInMonth(current);
    ticks.push({
      label: format(current, spansMultipleYears ? "MMM yy" : "MMM"),
      x: offset * pxPerDay + (days * pxPerDay) / 2,
      gridX: Math.max(0, offset) * pxPerDay,
    });
    current = addMonths(current, 1);
  }
  return ticks;
}

export interface PackedProject {
  project: Project;
  row: number;
}

export function packProjectsIntoRows(
  projects: Record<string, Project>,
  viewportStart: ISODate,
  viewportEnd: ISODate
): PackedProject[] {
  const today = getISODate(new Date());

  const visible = Object.values(projects).filter((p) => {
    const end = p.endDate ?? today;
    return p.startDate <= viewportEnd && end >= viewportStart;
  });

  visible.sort((a, b) => a.startDate.localeCompare(b.startDate));

  const rowEnds: ISODate[] = [];
  const result: PackedProject[] = [];

  for (const project of visible) {
    const end = project.endDate ?? today;
    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (project.startDate > rowEnds[r]) {
        rowEnds[r] = end;
        result.push({ project, row: r });
        placed = true;
        break;
      }
    }
    if (!placed) {
      rowEnds.push(end);
      result.push({ project, row: rowEnds.length - 1 });
    }
  }

  return result;
}

export function calcTrackHeight(numRows: number): number {
  return (
    TRACK_HEADER_HEIGHT +
    Math.max(1, numRows) * ROW_HEIGHT +
    TRACK_PADDING_BOTTOM
  );
}
