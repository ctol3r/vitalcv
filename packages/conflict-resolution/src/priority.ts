import type { Source } from "./types";

/**
 * Source priority rank. Higher number wins.
 * This is the single source of truth for the resolution rule:
 *   STATE > NPPES > USER > RESUME
 *
 * Exhaustiveness is enforced by the Record<Source, number> type —
 * adding a new Source without updating this map is a compile error.
 */
export const RANK: Record<Source, number> = {
  STATE: 3,
  NPPES: 2,
  USER: 1,
  RESUME: 0,
};

/** Returns the rank for a given source. Higher is more authoritative. */
export function sourceRank(source: Source): number {
  return RANK[source];
}
