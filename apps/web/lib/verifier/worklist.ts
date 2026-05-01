/**
 * FOUNDATION-SWEEP-7 — verifier worklist foundation.
 *
 * Pure data types and filtering helpers only. No persistence, polling, or live
 * workflow integration is enabled by this module.
 */

export type WorklistItemStatus =
  | 'pending'
  | 'in_review'
  | 'info_requested'
  | 'acceptable_for_start'
  | 'unable_to_verify';

export type WorklistProofTier =
  | 'receipt_candidate'
  | 'psv_sourced'
  | 'self_attested';

export interface WorklistFilter {
  status?: WorklistItemStatus | 'all';
  proofTier?: WorklistProofTier | 'all';
  clinicianNpi?: string;
  submittedFrom?: string;
  submittedTo?: string;
}

export interface WorklistItem {
  clinicianNpi: string;
  submittedAt: string;
  status: WorklistItemStatus;
  proofTier: WorklistProofTier;
}

export interface WorklistFoundation {
  provisionLive: false;
  dbBackedWorklist: false;
  realTimeUpdates: false;
  statuses: WorklistItemStatus[];
  proofTiers: WorklistProofTier[];
  disclaimers: string[];
}

export function buildWorklistFoundation(): WorklistFoundation {
  return {
    provisionLive: false,
    dbBackedWorklist: false,
    realTimeUpdates: false,
    statuses: [
      'pending',
      'in_review',
      'info_requested',
      'acceptable_for_start',
      'unable_to_verify',
    ],
    proofTiers: ['receipt_candidate', 'psv_sourced', 'self_attested'],
    disclaimers: [
      'The worklist foundation organizes submitted applications only; it is not backed by production storage.',
      'Live updates are planned and are not enabled by this module.',
    ],
  };
}

export function filterWorklist(
  items: WorklistItem[],
  filter: WorklistFilter,
): WorklistItem[] {
  const npiQuery = filter.clinicianNpi?.trim().toLowerCase();
  const submittedFrom = parseFilterDate(filter.submittedFrom);
  const submittedTo = parseFilterDate(filter.submittedTo);

  return items.filter((item) => {
    if (filter.status && filter.status !== 'all' && item.status !== filter.status) {
      return false;
    }

    if (filter.proofTier && filter.proofTier !== 'all' && item.proofTier !== filter.proofTier) {
      return false;
    }

    if (npiQuery && !item.clinicianNpi.toLowerCase().includes(npiQuery)) {
      return false;
    }

    const submittedAt = parseFilterDate(item.submittedAt);
    if (submittedFrom !== null && submittedAt !== null && submittedAt < submittedFrom) {
      return false;
    }

    if (submittedTo !== null && submittedAt !== null && submittedAt > submittedTo) {
      return false;
    }

    return true;
  });
}

export function explainWorklistStatus(status: WorklistItemStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending review; the submitted application has not been assessed yet.';
    case 'in_review':
      return 'In review; an internal assessment is underway.';
    case 'info_requested':
      return 'Additional information has been requested before assessment can continue.';
    case 'acceptable_for_start':
      return 'Acceptable for start based on the current internal assessment record.';
    case 'unable_to_verify':
      return 'Unable to assess from the available source material.';
  }
}

function parseFilterDate(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}
