import {
    differenceInCalendarDays,
    differenceInCalendarMonths,
    differenceInCalendarWeeks,
    getDate,
    getISODay,
    isValid,
    parseISO,
    startOfDay,
} from "date-fns";
import type { ISODate } from "src/plugin/types";

type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface ParsedRRule {
    freq: RRuleFrequency;
    interval: number;
    byDay?: Set<number>;
    byMonthDay?: Set<number>;
    until?: string;
}

const DAY_CODE_TO_ISO: Record<string, number> = {
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
    SU: 7,
};

const ISO_TO_DAY_CODE: Record<number, string> = {
    1: 'MO',
    2: 'TU',
    3: 'WE',
    4: 'TH',
    5: 'FR',
    6: 'SA',
    7: 'SU',
};

const ISO_TO_DAY_LABEL: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
};

export class RRuleService {
    static parseRRuleString(rrule: string): ParsedRRule {
        const parsed: ParsedRRule = {
            freq: 'DAILY',
            interval: 1,
        };

        if (!rrule || !rrule.trim()) return parsed;

        const parts = rrule
            .split(';')
            .map((part) => part.trim())
            .filter(Boolean);

        for (const part of parts) {
            const [rawKey, ...rawValueParts] = part.split('=');
            const key = rawKey?.trim().toUpperCase();
            const value = rawValueParts.join('=').trim();

            if (!key || !value) continue;

            if (key === 'FREQ') {
                const normalized = value.toUpperCase();
                if (normalized === 'DAILY' || normalized === 'WEEKLY' || normalized === 'MONTHLY') {
                    parsed.freq = normalized;
                }
                continue;
            }

            if (key === 'INTERVAL') {
                const interval = Number.parseInt(value, 10);
                if (Number.isFinite(interval) && interval > 0) {
                    parsed.interval = interval;
                }
                continue;
            }

            if (key === 'BYDAY') {
                const daySet = new Set<number>();

                for (const token of value.split(',')) {
                    const code = token.trim().toUpperCase();
                    const day = DAY_CODE_TO_ISO[code];
                    if (day) daySet.add(day);
                }

                if (daySet.size > 0) parsed.byDay = daySet;
                continue;
            }

            if (key === 'BYMONTHDAY') {
                const days = new Set<number>();

                for (const token of value.split(',')) {
                    const day = Number.parseInt(token.trim(), 10);
                    if (Number.isFinite(day) && day >= 1 && day <= 31) {
                        days.add(day);
                    }
                }

                if (days.size > 0) parsed.byMonthDay = days;
                continue;
            }

            if (key === 'UNTIL') {
                const normalizedUntil = RRuleService.normalizeUntil(value);
                if (normalizedUntil) parsed.until = normalizedUntil;
            }
        }

        return parsed;
    }

    static occursOn(rrule: string, date: ISODate, dtstart?: ISODate): boolean {
        if (!rrule || !rrule.trim()) return false;

        const parsed = RRuleService.parseRRuleString(rrule);
        const targetDate = RRuleService.parseDate(date);
        if (!targetDate) return false;

        const startDate = dtstart ? RRuleService.parseDate(dtstart) : targetDate;
        if (!startDate) return false;

        if (targetDate < startDate) return false;

        if (parsed.until) {
            const untilDate = RRuleService.parseDate(parsed.until);
            if (untilDate && targetDate > untilDate) return false;
        }

        const interval = Math.max(1, parsed.interval || 1);

        if (parsed.freq === 'DAILY') {
            if (parsed.byDay && parsed.byDay.size > 0 && !parsed.byDay.has(getISODay(targetDate))) {
                return false;
            }

            const dayDiff = differenceInCalendarDays(targetDate, startDate);
            return dayDiff >= 0 && dayDiff % interval === 0;
        }

        if (parsed.freq === 'WEEKLY') {
            const isoWeekday = getISODay(targetDate);
            if (parsed.byDay && parsed.byDay.size > 0) {
                if (!parsed.byDay.has(isoWeekday)) return false;
            } else if (getISODay(startDate) !== isoWeekday) {
                return false;
            }

            const weekDiff = differenceInCalendarWeeks(targetDate, startDate, { weekStartsOn: 1 });
            return weekDiff >= 0 && weekDiff % interval === 0;
        }

        const dayOfMonth = getDate(targetDate);
        if (parsed.byMonthDay && parsed.byMonthDay.size > 0) {
            if (!parsed.byMonthDay.has(dayOfMonth)) return false;
        } else if (getDate(startDate) !== dayOfMonth) {
            return false;
        }

        const monthDiff = differenceInCalendarMonths(targetDate, startDate);
        return monthDiff >= 0 && monthDiff % interval === 0;
    }

    // Format rrule to human-readable format
    static formatRRule(rrule: string): string {
        try {
            const parsed = RRuleService.parseRRuleString(rrule);
            const interval = Math.max(1, parsed.interval || 1);

            let formatted = '';

            if (parsed.freq === 'DAILY') {
                if (parsed.byDay && parsed.byDay.size > 0) {
                    const dayText = RRuleService.formatDaySet(parsed.byDay);
                    if (interval === 1) {
                        formatted = dayText;
                    } else {
                        formatted = `Every ${interval} days on ${RRuleService.formatDayList(parsed.byDay)}`;
                    }
                } else {
                    formatted = interval === 1 ? 'Every day' : `Every ${interval} days`;
                }
            } else if (parsed.freq === 'WEEKLY') {
                const base = interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
                if (parsed.byDay && parsed.byDay.size > 0) {
                    formatted = `${base} on ${RRuleService.formatDayList(parsed.byDay)}`;
                } else {
                    formatted = base;
                }
            } else {
                const base = interval === 1 ? 'Monthly' : `Every ${interval} months`;
                if (parsed.byMonthDay && parsed.byMonthDay.size > 0) {
                    formatted = `${base} on the ${RRuleService.formatMonthDays(parsed.byMonthDay)}`;
                } else {
                    formatted = base;
                }
            }

            if (parsed.until) {
                return `${formatted} until ${parsed.until}`;
            }

            return formatted;
        } catch {
            return rrule;
        }
    }

    static formatDays(dayCode: string): string {
        const daySet = new Set<number>();

        for (const token of dayCode.split(',')) {
            const isoDay = DAY_CODE_TO_ISO[token.trim().toUpperCase()];
            if (isoDay) daySet.add(isoDay);
        }

        return RRuleService.formatDaySet(daySet);
    }

    static serializeRRule(rrule: ParsedRRule | Set<number>): string {
        const parsed: ParsedRRule = rrule instanceof Set
            ? {
                freq: 'DAILY',
                interval: 1,
                byDay: new Set(rrule),
            }
            : {
                freq: rrule.freq,
                interval: Math.max(1, rrule.interval || 1),
                byDay: rrule.byDay ? new Set(rrule.byDay) : undefined,
                byMonthDay: rrule.byMonthDay ? new Set(rrule.byMonthDay) : undefined,
                until: rrule.until,
            };

        const parts = [`FREQ=${parsed.freq}`];

        if (parsed.interval > 1) {
            parts.push(`INTERVAL=${parsed.interval}`);
        }

        if (parsed.byDay && parsed.byDay.size > 0) {
            const dayCodes = [...parsed.byDay]
                .filter((day) => day >= 1 && day <= 7)
                .sort((a, b) => a - b)
                .map((day) => ISO_TO_DAY_CODE[day]);

            if (dayCodes.length > 0) {
                parts.push(`BYDAY=${dayCodes.join(',')}`);
            }
        }

        if (parsed.byMonthDay && parsed.byMonthDay.size > 0) {
            const monthDays = [...parsed.byMonthDay]
                .filter((day) => day >= 1 && day <= 31)
                .sort((a, b) => a - b);

            if (monthDays.length > 0) {
                parts.push(`BYMONTHDAY=${monthDays.join(',')}`);
            }
        }

        if (parsed.until) {
            parts.push(`UNTIL=${parsed.until}`);
        }

        return parts.join(';');
    }

    static parseRRule(readableRRule: string): string {
        const trimmed = readableRRule.trim();
        if (!trimmed) return '';

        if (/\bFREQ\s*=\s*/i.test(trimmed)) {
            return RRuleService.serializeRRule(RRuleService.parseRRuleString(trimmed));
        }

        const normalized = trimmed.toLowerCase();

        if (normalized === 'weekday' || normalized === 'weekdays') {
            return 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR';
        }

        if (normalized === 'weekend' || normalized === 'weekends') {
            return 'FREQ=DAILY;BYDAY=SA,SU';
        }

        const everyDaysMatch = normalized.match(/^every\s+(\d+)\s+days?$/);
        if (everyDaysMatch) {
            const interval = Number.parseInt(everyDaysMatch[1], 10);
            return RRuleService.serializeRRule({ freq: 'DAILY', interval: Number.isFinite(interval) && interval > 0 ? interval : 1 });
        }

        const everyWeeksMatch = normalized.match(/^every\s+(\d+)\s+weeks?(?:\s+on\s+(.+))?$/);
        if (everyWeeksMatch) {
            const interval = Number.parseInt(everyWeeksMatch[1], 10);
            const byDay = everyWeeksMatch[2] ? RRuleService.parseDayListText(everyWeeksMatch[2]) : undefined;

            return RRuleService.serializeRRule({
                freq: 'WEEKLY',
                interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
                byDay,
            });
        }

        const weeklyMatch = normalized.match(/^weekly(?:\s+on\s+(.+))?$/);
        if (weeklyMatch) {
            return RRuleService.serializeRRule({
                freq: 'WEEKLY',
                interval: 1,
                byDay: weeklyMatch[1] ? RRuleService.parseDayListText(weeklyMatch[1]) : undefined,
            });
        }

        const everyMonthsMatch = normalized.match(/^every\s+(\d+)\s+months?(?:\s+on(?:\s+the)?\s+(.+))?$/);
        if (everyMonthsMatch) {
            const interval = Number.parseInt(everyMonthsMatch[1], 10);
            const byMonthDay = everyMonthsMatch[2] ? RRuleService.parseMonthDayList(everyMonthsMatch[2]) : undefined;

            return RRuleService.serializeRRule({
                freq: 'MONTHLY',
                interval: Number.isFinite(interval) && interval > 0 ? interval : 1,
                byMonthDay,
            });
        }

        const monthlyMatch = normalized.match(/^monthly(?:\s+on(?:\s+the)?\s+(.+))?$/);
        if (monthlyMatch) {
            return RRuleService.serializeRRule({
                freq: 'MONTHLY',
                interval: 1,
                byMonthDay: monthlyMatch[1] ? RRuleService.parseMonthDayList(monthlyMatch[1]) : undefined,
            });
        }

        const daySet = RRuleService.parseDayListText(normalized);
        if (daySet && daySet.size > 0) {
            return RRuleService.serializeRRule({
                freq: 'DAILY',
                interval: 1,
                byDay: daySet,
            });
        }

        return 'FREQ=DAILY';
    }

    private static parseDate(isoDate: string): Date | null {
        const parsed = parseISO(isoDate);
        if (!isValid(parsed)) return null;

        return startOfDay(parsed);
    }

    private static normalizeUntil(value: string): string | undefined {
        const trimmed = value.trim();
        if (!trimmed) return undefined;

        const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/i);
        if (compactMatch) {
            const [, year, month, day] = compactMatch;
            return `${year}-${month}-${day}`;
        }

        const isoPrefix = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoPrefix) {
            return isoPrefix[1];
        }

        const parsed = RRuleService.parseDate(trimmed);
        if (!parsed) return undefined;

        const year = parsed.getFullYear();
        const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
        const day = `${parsed.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private static parseDayListText(text: string): Set<number> | undefined {
        const dayMap: Record<string, number> = {
            mo: 1,
            mon: 1,
            monday: 1,
            tu: 2,
            tue: 2,
            tues: 2,
            tuesday: 2,
            we: 3,
            wed: 3,
            wednesday: 3,
            th: 4,
            thu: 4,
            thur: 4,
            thurs: 4,
            thursday: 4,
            fr: 5,
            fri: 5,
            friday: 5,
            sa: 6,
            sat: 6,
            saturday: 6,
            su: 7,
            sun: 7,
            sunday: 7,
        };

        const daySet = new Set<number>();

        for (const match of text.matchAll(/[a-z]+/gi)) {
            const token = match[0].toLowerCase();

            if (token.startsWith('weekday')) {
                daySet.add(1);
                daySet.add(2);
                daySet.add(3);
                daySet.add(4);
                daySet.add(5);
                continue;
            }

            if (token.startsWith('weekend')) {
                daySet.add(6);
                daySet.add(7);
                continue;
            }

            const day = dayMap[token];
            if (day) daySet.add(day);
        }

        return daySet.size > 0 ? daySet : undefined;
    }

    private static parseMonthDayList(text: string): Set<number> | undefined {
        const values = new Set<number>();
        const matches = text.match(/\d+/g) ?? [];

        for (const match of matches) {
            const day = Number.parseInt(match, 10);
            if (Number.isFinite(day) && day >= 1 && day <= 31) {
                values.add(day);
            }
        }

        return values.size > 0 ? values : undefined;
    }

    private static formatDayList(days: Set<number>): string {
        return [...days]
            .filter((day) => day >= 1 && day <= 7)
            .sort((a, b) => a - b)
            .map((day) => ISO_TO_DAY_LABEL[day])
            .join(', ');
    }

    private static formatDaySet(days: Set<number>): string {
        const normalized = [...days]
            .filter((day) => day >= 1 && day <= 7)
            .sort((a, b) => a - b);

        if (normalized.length === 7) {
            return 'Every day';
        }

        const isWeekdays = normalized.length === 5 && normalized.every((day, index) => day === index + 1);
        if (isWeekdays) {
            return 'Weekdays';
        }

        const isWeekends = normalized.length === 2 && normalized[0] === 6 && normalized[1] === 7;
        if (isWeekends) {
            return 'Weekends';
        }

        return normalized.map((day) => ISO_TO_DAY_LABEL[day]).join(', ');
    }

    private static formatMonthDays(days: Set<number>): string {
        return [...days]
            .filter((day) => day >= 1 && day <= 31)
            .sort((a, b) => a - b)
            .map((day) => `${day}${RRuleService.ordinalSuffix(day)}`)
            .join(', ');
    }

    private static ordinalSuffix(day: number): string {
        const mod100 = day % 100;
        if (mod100 >= 11 && mod100 <= 13) return 'th';

        switch (day % 10) {
            case 1:
                return 'st';
            case 2:
                return 'nd';
            case 3:
                return 'rd';
            default:
                return 'th';
        }
    }
}
