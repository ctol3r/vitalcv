/**
 * npiHandoff — the carriers for an NPI moving between anonymous surfaces
 * and /onboarding.
 *
 * Same-origin surfaces use storage: the homepage resolved state ("Keep this
 * record") writes here before navigating; /onboarding's anonymous preview
 * reads it to resolve the record without re-typing; the signed-in binding
 * form prefills from it after sign-in. `ONBOARDING_NPI_KEY` is the same key
 * `components/onboarding/OnboardingFlowSteps.tsx` has always used, so the
 * older flow-step surfaces stay interoperable.
 *
 * Cross-origin arrivals — the marketing site's NPI form — cannot write this
 * origin's storage, so they carry the NPI as a `?npi=` query param instead
 * (readNpiQueryHandoff).
 *
 * Either carrier only ever holds the 10-digit NPI string — public registry
 * keys, never a resolved record, never account data. Both storages are
 * written (session for the common tab-continuation, local for the sign-in
 * round trip that may land in a new tab); reads prefer session.
 */

export const ONBOARDING_NPI_KEY = 'onboarding_npi';

export function writeNpiHandoff(npi: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ONBOARDING_NPI_KEY, npi);
    window.localStorage.setItem(ONBOARDING_NPI_KEY, npi);
  } catch {
    // Storage can be unavailable (private mode, quota) — the handoff is an
    // enhancement; the flow still works by re-entering the NPI.
  }
}

export function readNpiHandoff(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      window.sessionStorage.getItem(ONBOARDING_NPI_KEY) ??
      window.localStorage.getItem(ONBOARDING_NPI_KEY)
    );
  } catch {
    return null;
  }
}

/**
 * Read an NPI carried in the page URL (`?npi=`) — the cross-origin carrier.
 * Shape-guarded to exactly 10 digits here; consumers still run full
 * validation (checksum) before resolving anything from it.
 */
export function readNpiQueryHandoff(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('npi');
    if (!raw) return null;
    const npi = raw.trim();
    return /^\d{10}$/.test(npi) ? npi : null;
  } catch {
    return null;
  }
}
