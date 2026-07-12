import type { VerificationSource, VerificationResult } from '../../interfaces/verificationSource';

/**
 * Honest placeholder served when REAL_NURSYS_ENABLED=true but no live
 * Nursys adapter has been registered yet (institutional e-Notify access
 * is an agreement + credentials, not a flag).
 *
 * Returns licenseStatus UNKNOWN — downstream computeTrustState maps that
 * to needs_review, never to a positive band. This keeps callers alive
 * (the registry used to throw, crashing monitoring sweeps and artifact
 * issuance at runtime) without letting the deterministic stub's
 * fabricated statuses masquerade as live verification.
 */
export class NursysAccessPendingAdapter implements VerificationSource {
  readonly name = 'NURSYS_ACCESS_PENDING';

  async verify(npi: string): Promise<VerificationResult> {
    const now = new Date();
    return {
      licenseStatus: 'UNKNOWN',
      jurisdiction: 'UNKNOWN',
      lastUpdated: now,
      sourceUrl: 'https://www.nursys.com/',
      rawPayload: {
        npi,
        adapterName: this.name,
        unavailable: true,
        reason:
          'REAL_NURSYS_ENABLED is set but no live Nursys adapter is registered. '
          + 'Nursys verification requires institutional e-Notify access; this result is a placeholder, not a verification.',
        sourceQueriedAt: now.toISOString(),
      },
    };
  }
}
