import { PlannerParser } from "src/planner/logic/parser";
import { getISODate } from "src/plugin/helpers";
import type { DateInterval, Project, Track } from "src/plugin/types";

/**
 * Pure conversion between markdown/frontmatter and Track/Project domain
 * objects. No state, no files, no Obsidian APIs — safe to unit-test in
 * isolation. The service reads/writes files; these functions only shape text.
 */

function normalizeISODate(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }

    if (typeof value === 'number') {
        return String(value);
    }

    return null;
}

/** Parse the `effective` frontmatter field into a DateInterval, tolerating the legacy array format. */
export function parseEffective(frontmatter?: Record<string, unknown>): DateInterval {
    const rawEffective: unknown = frontmatter?.effective;

    // Support legacy array format: take the first interval
    if (Array.isArray(rawEffective) && rawEffective.length > 0) {
        const first: unknown = rawEffective[0];
        if (first && typeof first === 'object') {
            const record = first as Record<string, unknown>;
            const start = normalizeISODate(record.start);
            const end = normalizeISODate(record.end);
            if (start) return end ? { start, end } : { start };
        }
    }

    // Single object format
    if (rawEffective && typeof rawEffective === 'object' && !Array.isArray(rawEffective)) {
        const record = rawEffective as Record<string, unknown>;
        const start = normalizeISODate(record.start);
        const end = normalizeISODate(record.end);
        if (start) return end ? { start, end } : { start };
    }

    return { start: getISODate(new Date()) };
}

/** Generate track file content from a Track object */
export function generateTrackContent(track: Track): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push('tags:');
    lines.push('  - holos/track');
    lines.push(`id: ${track.id}`);
    lines.push(`order: ${track.order}`);
    lines.push(`color: "${track.color}"`);
    lines.push('effective:');
    lines.push(`  start: ${track.effective.start}`);
    if (track.effective.end) {
        lines.push(`  end: ${track.effective.end}`);
    }
    lines.push(`timeCommitment: ${track.timeCommitment}`);
    lines.push(`journalHeader: ${track.journalHeader}`);
    lines.push('---');
    lines.push('');

    // Description
    if (track.description) {
        lines.push(track.description);
        lines.push('');
    }

    return lines.join('\n');
}

/** Generate project file content from a Project object */
export function generateProjectContent(project: Project): string {
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push('tags:');
    lines.push('  - holos/project');
    lines.push(`id: ${project.id}`);
    lines.push('---');
    lines.push('');

    // Habits section
    lines.push('## Habits');
    lines.push('');
    for (const habit of Object.values(project.habits)) {
        const rruleStr = habit.rrule ? ` (${habit.rrule})` : '';
        lines.push(`- ${habit.label}${rruleStr}`);
    }
    lines.push('');

    // Phases section
    lines.push('## Phases');
    lines.push('');
    lines.push(PlannerParser.serializePhasesSection(project.phases));

    return lines.join('\n');
}
