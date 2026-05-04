import 'server-only';
import { prisma } from '@/lib/db';

// ReceiptCandidate reviewState values that map to worklist status.
// Rows with a NULL reviewState are included as 'pending'.
const REVIEW_STATE_MAP: Record<string, WorklistReviewState> = {
  pending_policy_review: 'pending',
  in_review: 'in_review',
  info_requested: 'info_requested',
  accepted: 'acceptable_for_start',
  unable_to_verify: 'unable_to_verify',
};

export type WorklistReviewState =
  | 'pending'
  | 'in_review'
  | 'info_requested'
  | 'acceptable_for_start'
  | 'unable_to_verify';

// Shape returned by the repo. Does NOT include clinician NPI
// (not stored on ReceiptCandidate; a future NPI-lookup wave adds it).
// decisionGrade is the literal false — preserved from the DB CHECK
// constraint through the query round-trip.
export interface WorklistDbRow {
  candidateId: string;
  sourceOrganizationName: string;
  reviewState: WorklistReviewState;
  /** Literal false — the DB CHECK constraint enforces this. */
  decisionGrade: false;
  /** Literal 'receipt_candidate' when set; null otherwise. */
  proofTier: 'receipt_candidate' | null;
  createdAt: Date;
}

export interface WorklistRepoFilter {
  reviewState?: WorklistReviewState | 'all';
  limit?: number;
}

/**
 * Query ReceiptCandidate rows filtered by reviewState.
 *
 * Truth contract:
 *   - Returns ONLY ReceiptCandidate rows. PSVReceipt is a distinct
 *     table and is never queried or returned here.
 *   - decisionGrade is always the literal false (enforced by DB CHECK;
 *     mapped to the narrowed `false` type in the return shape).
 *   - When the table is empty, returns []. No fake-fill.
 *   - org scope and RBAC are deferred; this reads all rows in the
 *     table (scoped to org = a later wave).
 */
export async function getWorklist(
  filter: WorklistRepoFilter = {},
): Promise<WorklistDbRow[]> {
  const { reviewState, limit = 100 } = filter;

  const where =
    reviewState && reviewState !== 'all'
      ? { reviewState: dbStateForFilter(reviewState) }
      : {};

  const rows = await prisma.receiptCandidate.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      candidateId: true,
      sourceOrganizationName: true,
      reviewState: true,
      decisionGrade: true,
      proofTier: true,
      createdAt: true,
    },
  });

  return rows.map(mapRow);
}

function dbStateForFilter(state: WorklistReviewState): string {
  const inverse = Object.entries(REVIEW_STATE_MAP).find(([, v]) => v === state);
  return inverse ? inverse[0] : state;
}

function mapRow(row: {
  candidateId: string;
  sourceOrganizationName: string;
  reviewState: string | null;
  decisionGrade: boolean;
  proofTier: string | null;
  createdAt: Date;
}): WorklistDbRow {
  return {
    candidateId: row.candidateId,
    sourceOrganizationName: row.sourceOrganizationName,
    reviewState: toWorklistState(row.reviewState),
    decisionGrade: false, // DB CHECK enforces this; we narrow the type
    proofTier: row.proofTier === 'receipt_candidate' ? 'receipt_candidate' : null,
    createdAt: row.createdAt,
  };
}

function toWorklistState(raw: string | null): WorklistReviewState {
  if (!raw) return 'pending';
  return REVIEW_STATE_MAP[raw] ?? 'pending';
}
