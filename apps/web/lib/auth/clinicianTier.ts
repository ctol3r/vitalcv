/**
 * clinicianTier — server-side check of the backend-derived identity tier.
 *
 * Used by routes that guard clinician-only powers (AI drafting/matching).
 * Fail-closed: if the identity state can't be read, the caller treats the
 * user as below-tier rather than assuming clinician standing.
 */

import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { getApiBase } from '@/lib/api';

// Mirrors the backend ladder in services/identity/identityTier.ts. `preview` is
// a no-NPI, self-attested trainee state — the same trust floor as `account`, so
// it never satisfies an npi_bound-or-above gate. Keep both in sync.
export type IdentityTier = 'account' | 'preview' | 'npi_bound' | 'work_email_confirmed';

export interface IdentityStatePayload {
  tier: IdentityTier;
  signals: {
    npiBound: boolean;
    emailConfirmed: boolean;
    emailDomain: string | null;
    emailDomainClass: 'institutional' | 'free' | 'disposable' | 'unknown' | null;
    /** A self-attested, no-NPI preview profile — never source-backed. */
    previewProfile: boolean;
    licenseSourceVerified: false;
  };
}

const TIER_ORDER: Record<IdentityTier, number> = {
  account: 0,
  preview: 0,
  npi_bound: 1,
  work_email_confirmed: 2,
};

export const CLINICIAN_TIER_MESSAGE =
  'Clinician features unlock after you confirm a work email at your organization in Get Ready. A personal or free email confirms contact only.';

export async function fetchIdentityState(userId: string): Promise<IdentityStatePayload | null> {
  try {
    const headers = await buildIdentityHeaders({ userId });
    const res = await fetch(`${getApiBase()}/api/profile/identity`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as IdentityStatePayload;
  } catch {
    return null;
  }
}

/** True only when the state is readable AND meets the minimum tier. */
export async function userMeetsTier(userId: string, min: IdentityTier): Promise<boolean> {
  const state = await fetchIdentityState(userId);
  if (!state) return false;
  return TIER_ORDER[state.tier] >= TIER_ORDER[min];
}
