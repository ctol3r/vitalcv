/**
 * Clinician-facing read of the employer acceptance chain (the product form of
 * Recognition → Acceptance → Start). Wraps the existing public
 * acceptance-history endpoint — no new trust model, no new storage; the same
 * anonymized entries the employer review surface renders.
 */

import {
  normalizeEmployerAcceptanceHistoryResponse,
  type EmployerAcceptanceHistoryEntry,
  type EmployerAcceptanceHistoryResponse,
} from '@/lib/employer-review-actions';

export type AcceptanceRecognitionResult =
  /** At least one employer acceptance is recorded. */
  | { state: 'recognized'; recognition: EmployerAcceptanceHistoryResponse }
  /** The record exists (or the NPI is unknown to the backend) with no acceptances. */
  | { state: 'none_recorded' }
  /** System state — the lookup failed; never presented as a finding. */
  | { state: 'unavailable' };

/**
 * Fetch acceptance recognition for a clinician NPI via the public
 * acceptance-history read. A 404 means the backend has no entity for the NPI
 * yet — indistinguishable, for the holder, from "nothing recorded".
 */
export async function fetchAcceptanceRecognition(
  npi: string,
  init?: RequestInit,
): Promise<AcceptanceRecognitionResult> {
  try {
    const res = await fetch(
      `/api/employer-review/${encodeURIComponent(npi)}/acceptance-history`,
      { cache: 'no-store', ...init },
    );

    if (res.status === 404) return { state: 'none_recorded' };
    if (!res.ok) return { state: 'unavailable' };

    const recognition = normalizeEmployerAcceptanceHistoryResponse(await res.json());
    if (!recognition) return { state: 'unavailable' };
    if (!recognition.summary.hasPriorAcceptances) return { state: 'none_recorded' };

    return { state: 'recognized', recognition };
  } catch {
    return { state: 'unavailable' };
  }
}

const SCOPE_LABELS: Record<EmployerAcceptanceHistoryEntry['acceptanceScope'], string> = {
  pilot: 'Pilot scope',
  full: 'Full scope',
  partial: 'Partial scope',
};

export function acceptanceScopeLabel(
  scope: EmployerAcceptanceHistoryEntry['acceptanceScope'],
): string {
  return SCOPE_LABELS[scope];
}

export function formatAcceptedAt(acceptedAt: string): string | null {
  const parsed = Date.parse(acceptedAt);
  if (Number.isNaN(parsed)) return null;

  return new Date(parsed).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
