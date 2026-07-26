/**
 * Decision-grade classification for persisted VerificationArtifact rows.
 *
 * The real Nursys adapter has never existed, so every NURSYS-family artifact
 * written through the adapter registry so far was fabricated by the
 * deterministic stub (rawPayload.adapterName = 'NURSYS_STUB'; older stub
 * versions stamped nothing). Fail closed: a NURSYS-family row only counts as
 * decision-grade when a real adapter has explicitly stamped its own name.
 *
 * Consumers use this to keep fabricated rows from ever rendering as a
 * verified state — regardless of how the row got into the database.
 */

const NURSYS_FAMILY_SOURCES = new Set(['NURSYS', 'NURSYS_STUB']);

const FABRICATING_ADAPTER_NAMES = new Set(['NURSYS_STUB']);

type ArtifactLike = {
  source: string;
  rawPayload: unknown;
};

export function isDecisionGradeArtifact(artifact: ArtifactLike): boolean {
  if (!NURSYS_FAMILY_SOURCES.has(artifact.source)) {
    return true;
  }

  const rawPayload = artifact.rawPayload;
  if (rawPayload === null || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return false;
  }

  const adapterName = (rawPayload as Record<string, unknown>).adapterName;
  if (typeof adapterName !== 'string' || adapterName.trim().length === 0) {
    return false;
  }

  return !FABRICATING_ADAPTER_NAMES.has(adapterName);
}
