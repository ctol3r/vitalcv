/**
 * roleInferenceService.ts — Infer VCV role from NPI
 *
 * Role inference rules:
 *   NPI Type 1 (individual provider) → CLINICIAN
 *   NPI Type 2 (organization)        → VERIFIER
 *   Unknown / NPPES unavailable      → CLINICIAN (safe default)
 *
 * Role is inferred ONCE during the first /api/me/role call after
 * account creation. It is NOT re-inferred on subsequent calls.
 *
 * Wave A6 — Auth Architecture
 */

import { log } from '../../obs/logger';

const NPPES_URL = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const TIMEOUT_MS = 5_000;

export type InferrableRole = 'CLINICIAN' | 'VERIFIER';

interface NppesResult {
  result_count?: number;
  results?: Array<{ enumeration_type?: string }>;
}

/**
 * Infer the most appropriate VCV role for a given NPI.
 *
 * Always returns a role — never throws. Falls back to CLINICIAN on any error.
 */
export async function inferRoleFromNpi(npi: string): Promise<InferrableRole> {
  try {
    const res = await fetch(
      `${NPPES_URL}&number=${encodeURIComponent(npi)}`,
      {
        headers: { Accept: 'application/json' },
        signal:  AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!res.ok) {
      log('warn', 'role_inference_nppes_error', { npi, status: res.status });
      return 'CLINICIAN';
    }

    const data = await res.json() as NppesResult;

    if (!data.result_count || !data.results?.length) {
      log('info', 'role_inference_npi_not_found', { npi });
      return 'CLINICIAN';
    }

    const enumerationType = data.results[0].enumeration_type;
    const role: InferrableRole = enumerationType === 'NPI-2' ? 'VERIFIER' : 'CLINICIAN';

    log('info', 'role_inferred', { npi, enumerationType, role });
    return role;

  } catch (err) {
    const isTimeout = err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    log('warn', 'role_inference_failed', { npi, error: String(err), isTimeout });
    return 'CLINICIAN';
  }
}
