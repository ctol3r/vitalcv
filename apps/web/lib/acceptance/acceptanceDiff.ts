/**
 * Acceptance re-share diff (W6) — "what changed since you accepted".
 *
 * When a clinician re-shares a packet to an employer who already accepted it,
 * the reviewer should see the DELTA, not the whole packet again. This is the
 * acceptance-compounding primitive: it shrinks every re-review to a few honest
 * lines ("2 checks refreshed, 1 new license, nothing revoked since <date>").
 *
 * Pure + deterministic (compares ISO `checkedAt` strings; no Date.now()), so it
 * is fully testable and reusable by the employer-review backend (ACT-1.2) — it
 * diffs the accept-time source-coverage snapshot against the current one.
 */

import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';

/** The source-coverage states the diff reasons over (canonical + revoked). */
export type AcceptanceCheckState = CanonicalSourceCoverageState | 'revoked';

export interface AcceptanceSourceCheck {
  sourceId: string;
  /** Human label for display, e.g. "State medical license · TX". */
  label: string;
  state: AcceptanceCheckState;
  /** ISO instant of the last check; null when never checked. */
  checkedAt?: string | null;
}

export type AcceptanceChangeKind =
  | 'refreshed' // improved to checked, or re-verified more recently
  | 'added' //     new source not present at acceptance
  | 'revoked' //   withdrawn since acceptance — the one that stops everything
  | 'stale' //     was checked at acceptance, now aged out
  | 'removed'; //  present at acceptance, absent now

export interface AcceptanceChange {
  sourceId: string;
  label: string;
  kind: AcceptanceChangeKind;
  from?: AcceptanceCheckState;
  to?: AcceptanceCheckState;
  checkedAt?: string | null;
}

export interface AcceptanceDiffResult {
  changes: AcceptanceChange[];
  /** Sources whose state and check time are unchanged since acceptance. */
  unchanged: number;
  counts: Record<AcceptanceChangeKind, number>;
  /** True only when nothing was revoked since acceptance — the reassurance. */
  nothingRevoked: boolean;
  /** True when there is any delta at all. */
  hasChanges: boolean;
}

const DECISION_GRADE: AcceptanceCheckState = 'checked';

/**
 * Diff the accept-time snapshot against the current one. Both are lists of
 * per-source checks keyed by `sourceId`.
 */
export function diffAcceptanceSnapshot(
  accepted: ReadonlyArray<AcceptanceSourceCheck>,
  current: ReadonlyArray<AcceptanceSourceCheck>,
): AcceptanceDiffResult {
  const acceptedById = new Map(accepted.map((c) => [c.sourceId, c]));
  const currentById = new Map(current.map((c) => [c.sourceId, c]));

  const changes: AcceptanceChange[] = [];
  let unchanged = 0;

  for (const cur of current) {
    const prev = acceptedById.get(cur.sourceId);
    if (!prev) {
      changes.push({ sourceId: cur.sourceId, label: cur.label, kind: 'added', to: cur.state, checkedAt: cur.checkedAt });
      continue;
    }
    // Revoked outranks everything — a withdrawal since acceptance.
    if (cur.state === 'revoked' && prev.state !== 'revoked') {
      changes.push({ sourceId: cur.sourceId, label: cur.label, kind: 'revoked', from: prev.state, to: cur.state, checkedAt: cur.checkedAt });
      continue;
    }
    const improved = prev.state !== DECISION_GRADE && cur.state === DECISION_GRADE;
    const reverified =
      prev.state === DECISION_GRADE &&
      cur.state === DECISION_GRADE &&
      !!cur.checkedAt &&
      !!prev.checkedAt &&
      cur.checkedAt > prev.checkedAt;
    if (improved || reverified) {
      changes.push({ sourceId: cur.sourceId, label: cur.label, kind: 'refreshed', from: prev.state, to: cur.state, checkedAt: cur.checkedAt });
      continue;
    }
    if (prev.state === DECISION_GRADE && cur.state === 'stale') {
      changes.push({ sourceId: cur.sourceId, label: cur.label, kind: 'stale', from: prev.state, to: cur.state, checkedAt: cur.checkedAt });
      continue;
    }
    unchanged += 1;
  }

  for (const prev of accepted) {
    if (!currentById.has(prev.sourceId)) {
      changes.push({ sourceId: prev.sourceId, label: prev.label, kind: 'removed', from: prev.state });
    }
  }

  const counts: Record<AcceptanceChangeKind, number> = {
    refreshed: 0,
    added: 0,
    revoked: 0,
    stale: 0,
    removed: 0,
  };
  for (const c of changes) counts[c.kind] += 1;

  return {
    changes,
    unchanged,
    counts,
    nothingRevoked: counts.revoked === 0,
    hasChanges: changes.length > 0,
  };
}

/** A short, honest headline for the diff, e.g.
 *  "2 refreshed · 1 new · nothing revoked" (or "1 revoked — review"). */
export function summarizeAcceptanceDiff(diff: AcceptanceDiffResult): string {
  const parts: string[] = [];
  if (diff.counts.refreshed) parts.push(`${diff.counts.refreshed} refreshed`);
  if (diff.counts.added) parts.push(`${diff.counts.added} new`);
  if (diff.counts.stale) parts.push(`${diff.counts.stale} now stale`);
  if (diff.counts.removed) parts.push(`${diff.counts.removed} withdrawn from packet`);
  if (diff.counts.revoked) {
    parts.push(`${diff.counts.revoked} revoked — review`);
  } else {
    parts.push('nothing revoked');
  }
  if (!diff.hasChanges) return 'No changes since your acceptance';
  return parts.join(' · ');
}
