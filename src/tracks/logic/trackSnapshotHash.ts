import { TFile, TFolder } from "obsidian";

export interface TrackFileCacheEntry {
    track: TFile | null;
    projects: Record<string, TFile>;
}

function hashFast(input: string): string {
    let hash = 0x811c9dc5;

    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }

    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function hashTrackFiles(files: Iterable<TFile>): string | undefined {
    const parts: string[] = [];

    for (const file of files) {
        if (!(file instanceof TFile) || file.extension !== "md") continue;
        parts.push(`${file.path}:${file.stat.mtime}:${file.stat.size}`);
    }

    if (parts.length === 0) return undefined;

    parts.sort();
    return hashFast(parts.join('|'));
}

export function collectMarkdownFiles(folder: TFolder): TFile[] {
    const files: TFile[] = [];

    const collect = (current: TFolder) => {
        for (const child of current.children) {
            if (child instanceof TFolder) {
                collect(child);
                continue;
            }

            if (child instanceof TFile && child.extension === "md") {
                files.push(child);
            }
        }
    };

    collect(folder);
    return files;
}

export function hashTrackFolder(folder: TFolder): string | undefined {
    return hashTrackFiles(collectMarkdownFiles(folder));
}

export function hashTrackFileCacheEntries(entries: Iterable<TrackFileCacheEntry>): string | undefined {
    const files: TFile[] = [];

    for (const entry of entries) {
        if (entry.track) files.push(entry.track);
        for (const projectFile of Object.values(entry.projects)) {
            files.push(projectFile);
        }
    }

    return hashTrackFiles(files);
}
