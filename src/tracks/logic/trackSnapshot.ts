import type { TrackSnapshot } from "src/plugin/types";

export function normalizeTrackSnapshot(value: unknown): TrackSnapshot | undefined {
    if (!value || typeof value !== "object") return undefined;

    const snapshot = value as Partial<TrackSnapshot>;
    if (!snapshot.tracks || typeof snapshot.tracks !== "object") return undefined;
    if (typeof snapshot.generatedAt !== "number" || !Number.isFinite(snapshot.generatedAt)) return undefined;

    return {
        generatedAt: snapshot.generatedAt,
        tracksHash: typeof snapshot.tracksHash === "string" ? snapshot.tracksHash : undefined,
        tracks: snapshot.tracks,
    };
}

export function resolveBootstrapTrackSnapshot(
    snapshot: TrackSnapshot | undefined,
    currentTracksHash?: string
): TrackSnapshot | undefined {
    if (!snapshot) return undefined;
    if (!snapshot.tracksHash) return snapshot;
    if (!currentTracksHash) return snapshot;

    return snapshot.tracksHash === currentTracksHash ? snapshot : undefined;
}
