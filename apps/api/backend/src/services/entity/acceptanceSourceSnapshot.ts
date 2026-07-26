/**
 * ACT-1.2 follow-up — the accept-time source-coverage snapshot.
 *
 * An EmployerAcceptance row used to store only an opaque packetHash, so the
 * "what changed since you accepted" surface (diffAcceptanceSnapshot, W6) had
 * nothing to diff against. This module freezes the source coverage the
 * reviewer actually saw at the moment of acceptance into
 * `EmployerAcceptance.metadata` (previously unused).
 *
 * The check shape ({ sourceId, label, state, checkedAt }) deliberately matches
 * `AcceptanceSourceCheck` in apps/web/lib/acceptance/acceptanceDiff.ts — the
 * web diff consumes these rows as its `accepted` side, keyed by sourceId.
 *
 * Pure: no I/O, no clock reads — the caller supplies the coverage checks it
 * already built (the passport gate runs before every accept) and the accept
 * timestamp it is persisting.
 */

import type { CanonicalSourceCoverage, CanonicalSourceCoverageState } from '@vitalcv/trust-state';
import { getSource } from '../identity/sourceCatalog';

export const EMPLOYER_ACCEPTANCE_METADATA_SCHEMA = 'vitalcv.employer-acceptance.metadata.v1';

/** Matches AcceptanceSourceCheck (apps/web/lib/acceptance/acceptanceDiff.ts). */
export interface AcceptanceSourceSnapshotCheck {
  sourceId: string;
  /** Human label for display — catalog name, falling back to the raw sourceId. */
  label: string;
  state: CanonicalSourceCoverageState;
  /** ISO instant of the last check; null when never checked. */
  checkedAt: string | null;
}

export interface EmployerAcceptanceMetadata {
  schema: typeof EMPLOYER_ACCEPTANCE_METADATA_SCHEMA;
  acceptedSourceSnapshot: {
    /** The acceptance instant this coverage was frozen at (ISO). */
    capturedAt: string;
    checks: AcceptanceSourceSnapshotCheck[];
  };
}

/**
 * Project passport source coverage onto the persistable snapshot shape.
 * Deduped by sourceId (last wins, matching the diff's Map semantics) and
 * sorted by sourceId so the stored snapshot is deterministic.
 */
export function buildAcceptanceSourceSnapshot(
  checks: readonly Pick<CanonicalSourceCoverage, 'sourceId' | 'state' | 'checkedAt'>[] | null | undefined,
): AcceptanceSourceSnapshotCheck[] {
  const bySourceId = new Map<string, AcceptanceSourceSnapshotCheck>();
  for (const check of checks ?? []) {
    if (!check.sourceId) continue;
    bySourceId.set(check.sourceId, {
      sourceId: check.sourceId,
      label: getSource(check.sourceId)?.name ?? check.sourceId,
      state: check.state,
      checkedAt: check.checkedAt ?? null,
    });
  }
  return Array.from(bySourceId.values())
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

/**
 * Wrap the snapshot in the versioned metadata envelope stored on
 * EmployerAcceptance.metadata. Returns null when there is nothing to freeze
 * (no coverage in hand) so callers keep writing NULL instead of an empty husk.
 */
export function buildEmployerAcceptanceMetadata(input: {
  capturedAt: string;
  checks: readonly AcceptanceSourceSnapshotCheck[];
}): EmployerAcceptanceMetadata | null {
  if (input.checks.length === 0) return null;
  return {
    schema: EMPLOYER_ACCEPTANCE_METADATA_SCHEMA,
    acceptedSourceSnapshot: {
      capturedAt: input.capturedAt,
      checks: [...input.checks],
    },
  };
}
