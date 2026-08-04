/**
 * LicensureConflictReview — what happens when authorities disagree.
 *
 * Conflicts are routed to human review, never auto-resolved toward the
 * friendlier answer. The rules that matter:
 *
 *   - Two boards reporting different statuses for the SAME jurisdiction is a
 *     conflict. Two boards reporting different statuses for DIFFERENT
 *     jurisdictions is not — a clinician can hold an active license in one
 *     state and a lapsed one in another.
 *   - A compact privilege disagreeing with a state license is not a conflict
 *     between two licenses; they are different objects.
 *   - A gap never conflicts with a record. Not reading something is not
 *     evidence against what was read.
 *   - Review never resolves to "ACTIVE". The best a review can produce is a
 *     non-decision-grade candidate plus a human note.
 */

import type { LicensureObservation } from './types';

export type ConflictKind =
  /** Same authority, same profession, two different statuses. */
  | 'STATUS_DISAGREEMENT'
  /** Same authority reporting two different license numbers. */
  | 'IDENTIFIER_DISAGREEMENT'
  /** Same authority reporting two different expiration dates. */
  | 'EXPIRATION_DISAGREEMENT';

export interface LicensureConflict {
  readonly kind: ConflictKind;
  readonly authorityId: string;
  readonly boardName: string;
  readonly values: readonly string[];
  readonly observations: readonly LicensureObservation[];
  readonly resolution: 'MANUAL_REVIEW_REQUIRED';
  readonly note: string;
}

function groupKey(observation: LicensureObservation): string {
  return [
    observation.originatingAuthorityId,
    observation.profession,
    observation.credentialObjectKind,
  ].join('::');
}

/**
 * Find conflicts across a set of readings.
 *
 * Grouping includes `credentialObjectKind`, which is what keeps a compact
 * privilege from being compared against a state license.
 */
export function detectConflicts(
  observations: readonly LicensureObservation[],
): readonly LicensureConflict[] {
  // A gap carries no assertion, so it cannot participate in a conflict.
  const records = observations.filter((o) => o.outcome === 'RECORD_RETURNED');

  const groups = new Map<string, LicensureObservation[]>();
  for (const observation of records) {
    const key = groupKey(observation);
    const existing = groups.get(key);
    if (existing) existing.push(observation);
    else groups.set(key, [observation]);
  }

  const conflicts: LicensureConflict[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const first = group[0];
    const base = {
      authorityId: first.originatingAuthorityId,
      boardName: first.originatingBoardName,
      observations: group,
      resolution: 'MANUAL_REVIEW_REQUIRED' as const,
    };

    const statuses = [
      ...new Set(group.flatMap((o) => (o.status === null ? [] : [o.status as string]))),
    ];
    if (statuses.length > 1) {
      conflicts.push({
        ...base,
        kind: 'STATUS_DISAGREEMENT',
        values: statuses,
        note: `${first.originatingBoardName} readings disagree on status (${statuses.join(' vs ')}). A human must reconcile before this is used in a decision.`,
      });
    }

    const numbers = [
      ...new Set(group.map((o) => o.licenseNumber).filter((n): n is string => n !== null)),
    ];
    if (numbers.length > 1) {
      conflicts.push({
        ...base,
        kind: 'IDENTIFIER_DISAGREEMENT',
        values: numbers,
        note: `${first.originatingBoardName} readings return different license numbers. This may indicate an identity match failure rather than two licenses.`,
      });
    }

    const expirations = [
      ...new Set(group.map((o) => o.expiresAt).filter((e): e is string => e !== null)),
    ];
    if (expirations.length > 1) {
      conflicts.push({
        ...base,
        kind: 'EXPIRATION_DISAGREEMENT',
        values: expirations,
        note: `${first.originatingBoardName} readings disagree on expiration date. The later date must not be assumed correct.`,
      });
    }
  }

  return conflicts;
}

/**
 * Whether a set of readings can be shown without a review banner.
 *
 * Note this returns false when there is nothing to show at all — an empty read
 * is a gap, and a surface must say so rather than render a clean empty state.
 */
export function requiresReview(observations: readonly LicensureObservation[]): boolean {
  if (observations.length === 0) return true;
  if (detectConflicts(observations).length > 0) return true;
  return observations.some((o) => o.outcome === 'AMBIGUOUS_IDENTITY');
}
