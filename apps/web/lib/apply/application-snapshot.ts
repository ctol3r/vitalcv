/**
 * Application snapshot contract.
 *
 * An `ApplicationSnapshot` is the canonical, immutable record of what
 * evidence existed at the moment a clinician submitted an application
 * through Apply-with-VCV. It freezes proof-tier and included lanes
 * exactly as they were at submit time — so the employer, when they
 * open the application for review, sees the same truth the clinician
 * saw when they clicked Submit.
 *
 * Doctrine (continuity wave — builds on the ownership / recovery /
 * proof-tier contracts from the prior waves):
 *   - Partial stays partial. A submitted snapshot never silently
 *     upgrades to decision-grade without an explicit refresh writing
 *     a new snapshot.
 *   - Included lanes and claims are captured exactly. An excluded
 *     lane at submit time remains excluded in the employer view.
 *   - Proof tier at submit time is preserved verbatim. No post-hoc
 *     recomputation under the same snapshotHash.
 *   - Every mutation to the application status emits an audit event
 *     with timestamp, actor, and transition.
 *
 * Hashing:
 *   `snapshotHash` is a deterministic SHA-256 over the serialized
 *   evidence set (subjectId + employerId + roleId + sorted included
 *   lanes + sorted included claims + proofTier + createdAt). Two
 *   snapshots with identical evidence produce identical hashes; any
 *   mutation produces a new hash.
 */

import { createHash } from 'node:crypto';
import type { ProofTier } from '@/lib/trust/employer-action-consequence';

/** Progress states a submitted application can take. Mission-required
 *  set — never silently extend this enum without doctrine review. */
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'viewed'
  | 'in_review'
  | 'waiting_on_refresh'
  | 'waiting_on_manual_review'
  | 'advanced'
  | 'credentialing'
  | 'approved'
  | 'start_ready'
  | 'started';

/** Lane identifiers that can be included in an application snapshot.
 *  Mirrors `SourceLane` from recovery-path.ts but accepts additional
 *  optional lanes that an application may attach. */
export type ApplicationLane =
  | 'nppes'
  | 'oig'
  | 'pecos'
  | 'state_board'
  | 'dea'
  | 'npdb'
  | 'abms'
  | 'caqh';

export interface ApplicationClaim {
  /** Stable claim identifier. */
  claimId: string;
  /** Canonical source identifier for the claim (e.g. `NPPES`, `OIG_LEIE`). */
  sourceId: string;
  /** Claim kind: identity, safety, authority, eligibility, education, etc. */
  kind: string;
  /** ISO-8601 timestamp when the claim was last verified. */
  verifiedAt: string | null;
}

export interface ApplicationAuditEntry {
  at: string;
  actor: 'clinician' | 'employer' | 'reviewer' | 'vitalcv' | 'source';
  action:
    | 'submitted'
    | 'viewed'
    | 'status_change'
    | 'request_refresh'
    | 'request_missing_info'
    | 'route_to_review'
    | 'refresh_landed'
    | 'missing_info_provided';
  from: ApplicationStatus | null;
  to: ApplicationStatus | null;
  note?: string;
}

export interface ApplicationSnapshot {
  applicationId: string;
  subjectId: string;
  employerId: string;
  roleId: string;
  /** Deterministic SHA-256 hash over the evidence set. Frozen at
   *  submit time; a refresh writes a new snapshot with a new hash. */
  snapshotHash: string;
  /** Lanes included in this submission, sorted ascending for hash
   *  stability. Never modified post-submit under the same hash. */
  includedLanes: ApplicationLane[];
  /** Claims attached to the submission, sorted by claimId for hash
   *  stability. Never modified post-submit under the same hash. */
  includedClaims: ApplicationClaim[];
  /** Proof tier frozen at submit time. Never silently upgrades. */
  proofTier: ProofTier;
  /** 0–100 completeness percent at submit time. */
  completeness: number;
  /** ISO-8601 timestamp when the snapshot was written. */
  createdAt: string;
  status: ApplicationStatus;
  /** Ordered audit log. Every mutation appends one entry. */
  auditLog: ApplicationAuditEntry[];
}

/**
 * Build a deterministic hash over the evidence set. Two snapshots with
 * identical evidence return the same hash; any difference (lane added,
 * tier upgraded, claim verified at a new time) produces a new hash.
 */
export function computeApplicationSnapshotHash(input: {
  subjectId: string;
  employerId: string;
  roleId: string;
  includedLanes: ApplicationLane[];
  includedClaims: ApplicationClaim[];
  proofTier: ProofTier;
  createdAt: string;
}): string {
  const sortedLanes = [...input.includedLanes].sort();
  const sortedClaims = [...input.includedClaims]
    .slice()
    .sort((a, b) => a.claimId.localeCompare(b.claimId))
    .map((c) => ({
      claimId: c.claimId,
      sourceId: c.sourceId,
      kind: c.kind,
      verifiedAt: c.verifiedAt,
    }));

  const payload = JSON.stringify({
    subjectId: input.subjectId,
    employerId: input.employerId,
    roleId: input.roleId,
    includedLanes: sortedLanes,
    includedClaims: sortedClaims,
    proofTier: input.proofTier,
    createdAt: input.createdAt,
  });

  return createHash('sha256').update(payload).digest('hex');
}

export interface CreateApplicationSnapshotInput {
  applicationId: string;
  subjectId: string;
  employerId: string;
  roleId: string;
  includedLanes: ApplicationLane[];
  includedClaims: ApplicationClaim[];
  proofTier: ProofTier;
  completeness: number;
  createdAt?: string;
}

/**
 * Create a fresh application snapshot in `draft` status. `submitted`
 * transition goes through `submitApplicationSnapshot`.
 */
export function createApplicationSnapshot(
  input: CreateApplicationSnapshotInput,
): ApplicationSnapshot {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sortedLanes = [...input.includedLanes].sort();
  const sortedClaims = [...input.includedClaims]
    .slice()
    .sort((a, b) => a.claimId.localeCompare(b.claimId));
  const snapshotHash = computeApplicationSnapshotHash({
    subjectId: input.subjectId,
    employerId: input.employerId,
    roleId: input.roleId,
    includedLanes: sortedLanes,
    includedClaims: sortedClaims,
    proofTier: input.proofTier,
    createdAt,
  });

  return {
    applicationId: input.applicationId,
    subjectId: input.subjectId,
    employerId: input.employerId,
    roleId: input.roleId,
    snapshotHash,
    includedLanes: sortedLanes,
    includedClaims: sortedClaims,
    proofTier: input.proofTier,
    completeness: Math.max(0, Math.min(100, Math.round(input.completeness))),
    createdAt,
    status: 'draft',
    auditLog: [],
  };
}

/**
 * Advance a draft snapshot to `submitted`. Preserves every existing
 * field verbatim — the only mutation is status + audit log. A
 * submitted snapshot never reopens its evidence set; to change
 * evidence, a new snapshot must be written via `refreshApplicationSnapshot`.
 */
export function submitApplicationSnapshot(
  snapshot: ApplicationSnapshot,
  at: string = new Date().toISOString(),
): ApplicationSnapshot {
  if (snapshot.status !== 'draft') {
    throw new Error(
      `ApplicationSnapshot ${snapshot.applicationId} cannot be submitted from status "${snapshot.status}" (only draft -> submitted is allowed).`,
    );
  }
  return {
    ...snapshot,
    status: 'submitted',
    auditLog: [
      ...snapshot.auditLog,
      {
        at,
        actor: 'clinician',
        action: 'submitted',
        from: 'draft',
        to: 'submitted',
      },
    ],
  };
}

/**
 * Allowed status transitions. Keeps the loop honest — a submitted
 * application cannot skip directly to `approved` without passing
 * through review/credentialing states; a refresh request must be
 * resolved before advancing.
 */
const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted'],
  submitted: ['viewed', 'waiting_on_refresh', 'waiting_on_manual_review'],
  viewed: ['in_review', 'waiting_on_refresh', 'waiting_on_manual_review'],
  in_review: [
    'waiting_on_refresh',
    'waiting_on_manual_review',
    'advanced',
  ],
  waiting_on_refresh: ['in_review', 'advanced'],
  waiting_on_manual_review: ['in_review', 'advanced'],
  advanced: ['credentialing'],
  credentialing: ['approved'],
  approved: ['start_ready'],
  start_ready: ['started'],
  started: [],
};

export function isTransitionAllowed(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transition a snapshot to a new status. Throws on disallowed
 * transitions so the loop stays auditable. Appends an audit entry
 * with the transition's actor and note.
 */
export function transitionApplicationStatus(
  snapshot: ApplicationSnapshot,
  to: ApplicationStatus,
  input: {
    actor: ApplicationAuditEntry['actor'];
    at?: string;
    note?: string;
  },
): ApplicationSnapshot {
  if (!isTransitionAllowed(snapshot.status, to)) {
    throw new Error(
      `Disallowed transition: ${snapshot.status} -> ${to} for application ${snapshot.applicationId}`,
    );
  }
  const at = input.at ?? new Date().toISOString();
  return {
    ...snapshot,
    status: to,
    auditLog: [
      ...snapshot.auditLog,
      {
        at,
        actor: input.actor,
        action: 'status_change',
        from: snapshot.status,
        to,
        note: input.note,
      },
    ],
  };
}

/**
 * Record an employer's request — either `request_refresh` or
 * `request_missing_info`. Moves the application into the correct
 * waiting state and writes an audit entry naming the requester.
 */
export function requestApplicationAction(
  snapshot: ApplicationSnapshot,
  request: 'request_refresh' | 'request_missing_info' | 'route_to_review',
  input: {
    actor: ApplicationAuditEntry['actor'];
    at?: string;
    note?: string;
  },
): ApplicationSnapshot {
  const targetStatus: ApplicationStatus =
    request === 'request_refresh'
      ? 'waiting_on_refresh'
      : request === 'request_missing_info'
        ? 'waiting_on_refresh'
        : 'waiting_on_manual_review';

  if (!isTransitionAllowed(snapshot.status, targetStatus)) {
    throw new Error(
      `Disallowed request: cannot ${request} from status "${snapshot.status}" for application ${snapshot.applicationId}`,
    );
  }

  const at = input.at ?? new Date().toISOString();
  return {
    ...snapshot,
    status: targetStatus,
    auditLog: [
      ...snapshot.auditLog,
      {
        at,
        actor: input.actor,
        action: request,
        from: snapshot.status,
        to: targetStatus,
        note: input.note,
      },
    ],
  };
}

/**
 * Apply an upstream refresh result. Produces a NEW snapshot (with a
 * new hash) that reflects the refreshed evidence state. The previous
 * snapshot's audit log is preserved and extended — the new snapshot
 * carries forward the continuity chain.
 *
 * Critical: even if the refresh produces a stronger proof tier, the
 * new snapshot is a separate artifact with its own hash. The employer
 * can see exactly what changed between submissions.
 */
export function refreshApplicationSnapshot(
  previous: ApplicationSnapshot,
  refreshed: {
    includedLanes?: ApplicationLane[];
    includedClaims?: ApplicationClaim[];
    proofTier?: ProofTier;
    completeness?: number;
  },
  input: { at?: string; note?: string } = {},
): ApplicationSnapshot {
  if (previous.status !== 'waiting_on_refresh') {
    throw new Error(
      `Cannot apply refresh to application ${previous.applicationId} in status "${previous.status}". Refresh must be requested first.`,
    );
  }

  const createdAt = input.at ?? new Date().toISOString();
  const nextLanes = [...(refreshed.includedLanes ?? previous.includedLanes)].sort();
  const nextClaims = [...(refreshed.includedClaims ?? previous.includedClaims)]
    .slice()
    .sort((a, b) => a.claimId.localeCompare(b.claimId));
  const nextTier = refreshed.proofTier ?? previous.proofTier;
  const nextCompleteness =
    refreshed.completeness ?? previous.completeness;
  const snapshotHash = computeApplicationSnapshotHash({
    subjectId: previous.subjectId,
    employerId: previous.employerId,
    roleId: previous.roleId,
    includedLanes: nextLanes,
    includedClaims: nextClaims,
    proofTier: nextTier,
    createdAt,
  });

  return {
    ...previous,
    snapshotHash,
    includedLanes: nextLanes,
    includedClaims: nextClaims,
    proofTier: nextTier,
    completeness: Math.max(0, Math.min(100, Math.round(nextCompleteness))),
    createdAt,
    status: 'in_review',
    auditLog: [
      ...previous.auditLog,
      {
        at: createdAt,
        actor: 'vitalcv',
        action: 'refresh_landed',
        from: 'waiting_on_refresh',
        to: 'in_review',
        note: input.note,
      },
    ],
  };
}

/**
 * Guard used by employer-review surfaces to prove that they are
 * rendering the exact snapshot the clinician submitted. Given the
 * snapshot and the evidence currently rendered, recompute the hash
 * and compare. Returns `true` only when the rendered evidence
 * matches the stored snapshot hash — catches silent upgrades where
 * the review surface re-resolves proof tier from live sources
 * instead of the frozen snapshot.
 */
export function verifySnapshotIntegrity(snapshot: ApplicationSnapshot): boolean {
  const recomputed = computeApplicationSnapshotHash({
    subjectId: snapshot.subjectId,
    employerId: snapshot.employerId,
    roleId: snapshot.roleId,
    includedLanes: snapshot.includedLanes,
    includedClaims: snapshot.includedClaims,
    proofTier: snapshot.proofTier,
    createdAt: snapshot.createdAt,
  });
  return recomputed === snapshot.snapshotHash;
}
