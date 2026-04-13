import {
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { getISODate } from "src/plugin/helpers";
import type { ISODate, Project } from "src/plugin/types";

export type Zoom = "month" | "year";

export const PX_PER_DAY: Record<Zoom, number> = {
  month: 38,
  year: 3.2,
};

export const ROW_HEIGHT = 36;
export const PROJECT_BAR_HEIGHT = 28;
export const TRACK_HEADER_HEIGHT = 44;
export const TRACK_PADDING_BOTTOM = 16;

export function getViewportBounds(
  anchor: ISODate,
  zoom: Zoom
): { start: ISODate; end: ISODate } {
  const date = parseISO(anchor);
  if (zoom === "month") {
    return {
      start: getISODate(startOfMonth(date)),
      end: getISODate(endOfMonth(date)),
    };
  }
  return {
    start: getISODate(startOfYear(date)),
    end: getISODate(endOfYear(date)),
  };
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
  /** Pixel offset from the left edge of the viewport (centered over the unit). */
  x: number;
  /** Pixel offset for the grid line (left edge of the unit). */
  gridX: number;
}

export function getHeaderTicks(
  viewportStart: ISODate,
  viewportEnd: ISODate,
  pxPerDay: number,
  zoom: Zoom
): HeaderTick[] {
  const start = parseISO(viewportStart);
  const end = parseISO(viewportEnd);

  if (zoom === "month") {
    return eachDayOfInterval({ start, end }).map((day) => {
      const offset = differenceInDays(day, start);
      return {
        label: format(day, "d"),
        x: offset * pxPerDay + pxPerDay / 2,
        gridX: offset * pxPerDay,
      };
    });
  }

  const ticks: HeaderTick[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(start.getFullYear(), m, 1);
    const startOffset = differenceInDays(monthStart, start);
    const days = getDaysInMonth(monthStart);
    ticks.push({
      label: format(monthStart, "MMM"),
      x: startOffset * pxPerDay + (days * pxPerDay) / 2,
      gridX: startOffset * pxPerDay,
    });
  }
  return ticks;
}

export function getViewportTitle(viewportStart: ISODate, zoom: Zoom): string {
  const date = parseISO(viewportStart);
  return zoom === "month" ? format(date, "MMMM yyyy") : format(date, "yyyy");
}

export function navigateViewport(
  anchor: ISODate,
  zoom: Zoom,
  direction: 1 | -1
): ISODate {
  const date = parseISO(anchor);
  if (zoom === "month") {
    return getISODate(
      new Date(date.getFullYear(), date.getMonth() + direction, 1)
    );
  }
  return getISODate(new Date(date.getFullYear() + direction, 0, 1));
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
