import type { ISODate, Element, Time, Phase, Project, Track } from './types';
import { addDays, eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek, type Day } from 'date-fns';

/** Formats a Date into an ISODate. */
export function getISODate(date: Date): ISODate {
    return format(date, "yyyy-MM-dd")
}

/** Adds days to an ISODate (which cannot be done directly in date-fns). */
export function addDaysISO(iso: ISODate, n: number): ISODate {
    return getISODate(addDays(parseISO(iso), n));
}

/** Get the ISODates from and including today until the specified number. */
export function getISODates(anchor: ISODate, days: number): ISODate[];
/** Get the ISODates of the weeks from and including this week given the anchor, week number, and the day the week starts on. */
export function getISODates(anchor: ISODate, weeks: number, weekStartsOn: Day): ISODate[];
export function getISODates(anchor: ISODate, amount: number, weekStartsOn?: Day) {
    if (weekStartsOn != undefined) { // If we are looking for the dates of a week
        let dates: ISODate[] = [];

        const anchorDate: Date = parseISO(anchor);
        
        for (let i = 0; i < amount; i++) {
            const start = startOfWeek(addDays( anchorDate, i * 7 ), { weekStartsOn });
            const end = endOfWeek(addDays( anchorDate, i * 7 ), { weekStartsOn });

            const days = eachDayOfInterval({ start, end });

            days.forEach(day => dates.push(getISODate(day)))
        }

        return dates;
    } else { // IF we just want to get the dates of a block
        const dates = eachDayOfInterval({ start: anchor, end: addDays(anchor, amount)})

        return dates.map(d => getISODate(d));
    }
}

/** [PURE HELPER] Gets a well-formmated label given a date range. */
export function getLabelFromDateRange(first: ISODate, last: ISODate): string {
    const firstDate: Date = parseISO(first);
    const lastDate: Date = parseISO(last);

    if (firstDate.getFullYear() === lastDate.getFullYear()) {
        if (firstDate.getMonth() === lastDate.getMonth()) {
            return `${format(firstDate, "MMM dd")} – ${format(lastDate, "dd, yyyy")}`
        } else {
            return `${format(firstDate, "MMM dd")} – ${format(lastDate, "MMM dd, yyyy")}`
        }
    } else {
        return `${format(firstDate, "MMM dd, yyyy")} – ${format(lastDate, "MMM dd, yyyy")}`
    }
}

/** Returns a randomUUID() with a given prefix. */
export function generateID(prefix: string) {
    return prefix + crypto.randomUUID();
}

/** [PURE HELPER] Hash a string using SHA-1. */
export async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** [PURE HELPER] Takes in an array, swaps two items, and returns a new array. Returns the same array if swapping causes an item to go beyond the array. */
export function swapArrayItems<T>(array: T[], a: number, b: number): T[] {
    if (a < 0 || b < 0) return array;
    if (a >= array.length || b >= array.length) return array;

    const newArray = array.slice();
    [newArray[a], newArray[b]] = [newArray[b], newArray[a]];
    return newArray;
}

/** [PURE HELPER] Takes in an array of Elements, then calculates the sum of the time spent in minutes. */
export function calculateTotalTimeSpent(items: Element[]): number {
    return items.reduce((total, element) => {
        if (element.progress !== undefined && element.timeUnit) {
            // Convert everything to minutes for consistent calculation
            const progressInMinutes = element.timeUnit === 'hr' 
                ? element.progress * 60 
                : element.progress;
            return total + progressInMinutes;
        } else if (element.duration) {
            const durationInMinutes = element.timeUnit === 'hr' 
                ? element.duration * 60 
                : element.duration;
            return total + durationInMinutes;
        }
        return total;
    }, 0);
}

/** [PURE HELPER] Formats minutes into hours and minutes. */
export function formatTotalTime(totalMinutes: number): string {
    if (totalMinutes === 0) return "0 min";
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
}

type TimeUnit = 'min' | 'hr';

/** [PURE HELPER] Takes in two time amounts of minutes (divident and divsor).
 * Returns the appropriate amounts and units for each quantity, with the divisor taking priority.
 */
export function formatTimeArguments(dividend: number, divisor: number): { dividend: number; divisor: number; unit: TimeUnit } {
    if (divisor != 0) { // If the divisor exists
        const divisorUnit: TimeUnit = getTimeUnit(divisor);

        if (divisorUnit == 'min') {
            return { dividend, divisor, unit: divisorUnit };
        } else { // divisorUnit == 'hr'
            const dividendInHours = round(dividend / 60);
            const divisorInHours = round(divisor / 60);
            
            return { dividend: dividendInHours, divisor: divisorInHours, unit: divisorUnit };
        }
    } else {
        const dividendUnit: TimeUnit = getTimeUnit(dividend);
        const dividendResult = dividendUnit == 'min' ? dividend : round(dividend / 60);

        return { dividend: dividendResult, divisor: 0, unit: dividendUnit };
    }
}

function round(number: number, decimalPlaces: number = 2) {
    return Math.round((number + Number.EPSILON) * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
}

/** [PURE HELPER] Takes an amount of minutes and returns the appropriate unit
 * 'hr' if divisble by 60. Otherwise, 'min'.
 */
export function getTimeUnit(totalMinutes: number): TimeUnit {
    return totalMinutes % 60 == 0 ? 'hr' : 'min';
}
/** [PURE HELPER] Takes in a Time object and returns a well-formatted time string. */
export function formatTime(time: Time): string {
    const { hours, minutes } = time;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/** [PURE HELPER] Takes progress, duration, and a time unit and returns a well-formatted time string. */
export function formatProgressDuration(progress: number | undefined, duration: number, unit: 'min' | 'hr'): string {
    if (progress !== undefined) {
        return `[${progress}/${duration} ${unit}]`;
    } else {
        return `[${duration} ${unit}]`
    }
}

/** [PURE HELPER] Reconstructs the raw text representation from Element properties. */
export function reconstructRawText(
    text: string,
    isTask: boolean,
    taskStatus: ' ' | 'x' | '-' | undefined,
    startTime: Time | undefined,
    progress: number | undefined,
    duration: number | undefined,
    timeUnit: 'min' | 'hr' | undefined,
    prefix: string = '\t- ',
    sourceRef?: string,
    scheduledDate?: ISODate,
    blockId?: string,
): string {
    let raw = prefix;

    if (isTask && taskStatus) {
        raw += `[${taskStatus}] `;
    }

    raw += text.trim();

    if (startTime) {
        raw += ' @ ' + formatTime(startTime);
    }

    if (duration && timeUnit) {
        raw += ' ' + formatProgressDuration(progress, duration, timeUnit);
    }

    if (sourceRef) {
        raw += ' ' + sourceRef;
    }

    if (scheduledDate) {
        raw += ` 📅 ${scheduledDate}`;
    }

    // Block ID must be absolute last (Obsidian requirement)
    if (blockId) {
        raw += ` ^${blockId}`;
    }

    return raw;
}

/** Generates a random Obsidian-compatible block ID. */
export function generateBlockId(): string {
    return Math.random().toString(36).substring(2, 7);
}

/** Returns true if a phase is currently active (its date range includes today). */
export function isPhaseActive(phase: Phase): boolean {
    if (!phase.startDate) return false;
    const today = getISODate(new Date());
    return phase.startDate <= today && (!phase.endDate || phase.endDate >= today);
}

/** Returns true if a project is currently active (any phase is active). */
export function isProjectActive(project: Project): boolean {
    return project.phases.some(isPhaseActive);
}

/** Returns true if a track is currently active (any project is active). */
export function isTrackActiveByProjects(track: Track): boolean {
    return Object.values(track.projects).some(isProjectActive);
}

/** Returns the earliest phase start date across all phases, or undefined if none have dates. */
export function getProjectStartDate(project: Project): ISODate | undefined {
    const dates = project.phases
        .map(p => p.startDate)
        .filter((d): d is ISODate => d !== undefined);
    if (dates.length === 0) return undefined;
    return dates.sort()[0];
}

/** Returns the latest phase end date, or undefined if any phase is open-ended. */
export function getProjectEndDate(project: Project): ISODate | undefined {
    const phasesWithStart = project.phases.filter(p => p.startDate);
    if (phasesWithStart.length === 0) return undefined;
    if (phasesWithStart.some(p => !p.endDate)) return undefined;
    const dates = phasesWithStart
        .map(p => p.endDate)
        .filter((d): d is ISODate => d !== undefined);
    if (dates.length === 0) return undefined;
    return dates.sort().reverse()[0];
}
