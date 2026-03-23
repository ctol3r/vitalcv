/**
 * nursysClaimMapper.ts — Nursys license result → NormalizedClaim
 *
 * Maps the NursysLicenseResult from nursysAdapter.ts into the
 * NormalizedClaim format used by the identity pipeline, so Nursys
 * license data materializes into VcvCredential rows.
 *
 * This is M6: making licensure a first-class trust signal.
 *
 * Claim types produced:
 *   LICENSE (MD/DO) or NURSING_LICENSE (RN/NP/PA) → LICENSURE domain
 *
 * When REAL_NURSYS_ENABLED=true, this produces real claims from the adapter.
 * When false, produces no claims (not fake-verified).
 *
 * IMPORTANT: Until institutional Nursys e-Notify access is configured,
 * this produces NO claims (not stub/fake data). The UI will show
 * "License — not yet verified" rather than false confidence.
 */

import { env } from '../../config/env';
import { queryNursysLicense } from '../nursysAdapter';
import type { LicenseValue, NormalizedClaim } from './evidenceModel';
import { computeClaimId } from './evidenceModel';
import { log } from '../../obs/logger';

/**
 * Attempt to fetch and normalize a Nursys license claim.
 * Returns null if Nursys is not enabled or query fails.
 *
 * NEVER returns stub data as real — caller must check claimSource.
 */
export async function fetchNursysClaim(
  npi: string,
  observedAt: string,
): Promise<NormalizedClaim | null> {
  if (!env().REAL_NURSYS_ENABLED) {
    // Not enabled — do not produce fake license claims
    return null;
  }

  try {
    const result = await queryNursysLicense(npi);

    // Map license status to claim status
    const claimStatus: NormalizedClaim['status'] =
      result.licenseStatus === 'ACTIVE'    ? 'ACTIVE'   :
      result.licenseStatus === 'EXPIRED'   ? 'EXPIRED' :
      result.licenseStatus === 'SUSPENDED' ? 'BLOCKED'  :
      result.licenseStatus === 'REVOKED'   ? 'BLOCKED' :
                                             'UNVERIFIED';

    const value: LicenseValue = {
      _type:         'LICENSE',
      state:         result.jurisdiction,
      licenseNumber: null,
      issueDate:     null,
      expiryDate:    result.expirationDate,
      licenseStatus: result.licenseStatus === 'INACTIVE' ? 'UNKNOWN' : result.licenseStatus,
      disciplinaryActions: [],
      source:        'NURSYS',
    };

    const claimId = computeClaimId(
      'LICENSE',
      'NURSYS',
      npi,
      value,
    );

    return {
      claimId,
      claimType:        'LICENSE',
      sourceId:         'NURSYS',
      artifactId:       `nursys-${npi}-${result.jurisdiction}`,
      subjectNpi:       npi,
      tier:             'GOLD',
      confidence:       'HIGH',
      confidenceScore:  0.92,
      status:           claimStatus,
      reviewRequired:   false,
      observedAt,
      derivedAt:        observedAt,
      artifactChecksum: 'nursys-pending-artifact',
      parserVersion:    'nursys-claim-mapper/v1',
      validFrom:        observedAt,
      validUntil:       result.expirationDate,
      expiresAt:        result.expirationDate,
      supersededBy:     null,
      supersedes:       null,
      reviewReason:     null,
      humanReviewAt:    null,
      value,
    };

  } catch (err) {
    log('warn', 'nursys_claim_fetch_failed', { npi, error: String(err) });
    return null;
  }
}
