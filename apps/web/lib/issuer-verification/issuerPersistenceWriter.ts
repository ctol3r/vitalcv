import 'server-only';

import { prisma } from '@/lib/db';
import type { ReceiptCandidate } from '@/lib/issuer-verification/types';

/**
 * TRUST-PERSIST-1 Phase 2 — feature-flagged ReceiptCandidate writer.
 *
 * Design contract:
 *   - Off by default. Off => writer is a no-op and the caller continues
 *     with `recordedBy: 'demo'`. Existing demo render paths are not
 *     disturbed.
 *   - On => writes a ReceiptCandidate row to the same Postgres table
 *     that `apps/api/backend/prisma/migrations/20260504000000_issuer_persistence_scaffold/migration.sql`
 *     (PR #221) created. The DB-level CHECK constraints enforce the
 *     truth contract:
 *       * decisionGrade = FALSE
 *       * proofTier IS NULL OR = 'receipt_candidate'
 *       * recordedBy IN ('demo','review_surface','system')
 *   - The writer never widens those literals at the TS level. It
 *     accepts a `ReceiptCandidate` and only persists fields whose
 *     types already encode the contract.
 *   - Database-level violations (Postgres SQLSTATE 23514) surface as a
 *     `tamper_detected` outcome via the helper landed in #235; this
 *     writer treats them as a fatal write error and returns an error
 *     status rather than swallowing.
 *   - Connection or other transient errors degrade to a no-op so the
 *     review surface never crashes; the caller falls back to
 *     `recordedBy: 'demo'`.
 *
 * No callsite is changed by this PR. A subsequent PR wires the four
 * issuer/policy-review pages to call this writer.
 */

/** Whether the writer is enabled in the current environment. */
export function isIssuerPersistenceEnabled(): boolean {
  return process.env.ISSUER_PERSISTENCE_ENABLED === 'true';
}

export type WriteReceiptCandidateOutcome =
  | { status: 'persisted'; recordedBy: 'system' }
  | { status: 'disabled'; recordedBy: 'demo' }
  | { status: 'tamper_detected'; recordedBy: 'demo' }
  | { status: 'transient_error'; recordedBy: 'demo' };

interface WriteReceiptCandidateInput {
  candidate: ReceiptCandidate;
  /**
   * The actor surface that triggered the write. Maps directly to the
   * DB CHECK enum on `recordedBy`. The writer always persists
   * `recordedBy: 'system'` — passing `surface` is metadata for the
   * caller, not something the DB column carries.
   */
  surface: 'review_surface' | 'system';
}

/**
 * Persist a ReceiptCandidate row when the persistence flag is on.
 *
 * Returns one of four outcomes, all of which include the
 * `recordedBy` literal the caller should use in its render. The DB
 * row itself is always written with `recordedBy: 'system'` when
 * persisted; the demo fallback uses `recordedBy: 'demo'`.
 */
export async function writeReceiptCandidateRow(
  input: WriteReceiptCandidateInput,
): Promise<WriteReceiptCandidateOutcome> {
  if (!isIssuerPersistenceEnabled()) {
    return { status: 'disabled', recordedBy: 'demo' };
  }

  const { candidate } = input;

  try {
    await prisma.receiptCandidate.create({
      data: {
        candidateId: candidate.candidateId,
        requestId: candidate.requestId ?? null,
        basis: candidate.basis,
        agentName: candidate.agentName ?? null,
        sourceOrganizationName: candidate.sourceOrganizationName,
        attributionStatus: candidate.attributionStatus,
        decisionGrade: false,
        proofTier: candidate.proofTier ?? null,
        notes: candidate.notes ?? null,
        limitationNote: candidate.limitationNote ?? null,
        responseStatus: candidate.responseStatus ?? null,
        responseSummary: candidate.responseSummary ?? null,
        responseReceivedAt: candidate.responseReceivedAt
          ? new Date(candidate.responseReceivedAt)
          : null,
        reviewState: candidate.reviewState ?? null,
        recordedBy: 'system',
        signedReceiptJwt: candidate.signedReceiptJwt ?? null,
      },
    });
    return { status: 'persisted', recordedBy: 'system' };
  } catch (err) {
    if (isCheckConstraintViolation(err)) {
      return { status: 'tamper_detected', recordedBy: 'demo' };
    }
    return { status: 'transient_error', recordedBy: 'demo' };
  }
}

/**
 * Postgres SQLSTATE 23514 = check_violation. Prisma surfaces this as
 * a PrismaClientKnownRequestError with `code === 'P2010'` and the
 * underlying meta.code set to '23514' (or similar). We accept both
 * the Prisma envelope and a raw pg error in case the writer is
 * exercised via a different driver in tests.
 */
function isCheckConstraintViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; meta?: { code?: unknown } };
  if (e.code === '23514') return true;
  if (typeof e.meta?.code === 'string' && e.meta.code === '23514') return true;
  return false;
}
