import { log } from '../../obs/logger';
import { queryNursysLicense } from '../nursysAdapter';
import type {
  AuthorityUnavailableValue,
  LicenseValue,
  NormalizedClaim,
} from './evidenceModel';
import { computeClaimId } from './evidenceModel';

function baseClaim(
  claimType: NormalizedClaim['claimType'],
  npi: string,
  observedAt: string,
  value: NormalizedClaim['value'],
  overrides: Partial<NormalizedClaim> = {},
): NormalizedClaim {
  return {
    claimId: computeClaimId(claimType, 'NURSYS', npi, value),
    claimType,
    sourceId: 'NURSYS',
    artifactId: `nursys-${claimType.toLowerCase()}-${npi}`,
    artifactChecksum: `nursys-contract-${npi}`,
    parserVersion: 'nursys-claim-mapper/v2',
    subjectNpi: npi,
    tier: 'GOLD',
    confidence: 'HIGH',
    confidenceScore: 0.92,
    status: 'ACTIVE',
    reviewRequired: false,
    reviewReason: null,
    humanReviewAt: null,
    observedAt,
    derivedAt: observedAt,
    validFrom: observedAt,
    validUntil: null,
    expiresAt: null,
    supersededBy: null,
    supersedes: null,
    value,
    ...overrides,
  };
}

/**
 * Attempt to fetch and normalize a Nursys authority claim.
 * Returns an explicit AUTHORITY_UNAVAILABLE claim when the authorized path
 * is unavailable instead of fabricating a positive nursing license result.
 */
export async function fetchNursysClaim(
  npi: string,
  observedAt: string,
): Promise<NormalizedClaim | null> {
  try {
    const result = await queryNursysLicense(npi);

    if (result.licenseStatus === 'LICENSE_NOT_AVAILABLE_FOR_STATE') {
      const value: AuthorityUnavailableValue = {
        _type: 'AUTHORITY_UNAVAILABLE',
        reason:
          result.unavailableReason
          ?? 'Nursys authorized verification was not available for this clinician.',
        source: 'NURSYS',
        targetDomain: 'LICENSURE',
        jurisdiction:
          result.jurisdiction === 'UNKNOWN' ? null : result.jurisdiction,
        authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
        sourceScope: result.sourceScope,
        issuerEntityId: result.issuerEntityId,
        effectiveAt: result.effectiveAt,
        verifiedAt: result.verifiedAt ?? result.sourceQueriedAt,
        confidenceLabel: result.confidenceLabel,
        dataFreshness: result.dataFreshness,
        participationStatus: result.participationStatus,
        boardOrderSeverity: 'NONE',
        connectorState: result.connectorState,
      };

      return baseClaim('AUTHORITY_UNAVAILABLE', npi, observedAt, value, {
        artifactId: `nursys-authority-${npi}-${result.jurisdiction.toLowerCase()}`,
        confidence: 'LOW',
        confidenceScore: 0.4,
        status: 'UNVERIFIED',
        validUntil: result.expirationDate,
        expiresAt: result.expirationDate,
      });
    }

    const disciplinaryActions = result.disciplineFlag
      ? ['Nursys authorized path reported a disciplinary flag.']
      : [];
    const authorityClaimCode =
      result.disciplineFlag || result.licenseStatus === 'SUSPENDED' || result.licenseStatus === 'REVOKED'
        ? 'RN_LICENSE_DISCIPLINED'
        : result.licenseStatus === 'EXPIRED'
          ? 'RN_LICENSE_EXPIRED'
          : result.licenseStatus === 'ACTIVE'
            ? 'RN_LICENSE_ACTIVE'
            : undefined;

    const value: LicenseValue = {
      _type: 'LICENSE',
      state: result.jurisdiction,
      licenseNumber: null,
      issueDate: result.effectiveAt,
      expiryDate: result.expirationDate,
      licenseStatus: result.licenseStatus === 'INACTIVE' ? 'UNKNOWN' : result.licenseStatus,
      disciplinaryActions,
      source: 'NURSYS',
      authorityClaimCode,
      sourceScope: result.sourceScope,
      issuerEntityId: result.issuerEntityId,
      effectiveAt: result.effectiveAt,
      verifiedAt: result.verifiedAt ?? result.sourceQueriedAt,
      confidenceLabel: result.confidenceLabel,
      dataFreshness: result.dataFreshness,
      participationStatus: result.participationStatus,
      boardOrderSeverity: 'NONE',
      connectorState: result.connectorState,
      sourceDisclaimer: 'Authorized Nursys path only. No QuickConfirm scraping.',
    };

    const claimType: NormalizedClaim['claimType'] =
      result.disciplineFlag || result.licenseStatus === 'SUSPENDED' || result.licenseStatus === 'REVOKED'
        ? 'NURSING_DISCIPLINE'
        : 'NURSING_LICENSE';
    const claimStatus: NormalizedClaim['status'] =
      result.licenseStatus === 'ACTIVE'
        ? 'ACTIVE'
        : result.licenseStatus === 'EXPIRED'
          ? 'EXPIRED'
          : result.licenseStatus === 'SUSPENDED' || result.licenseStatus === 'REVOKED'
            ? 'BLOCKED'
            : 'UNVERIFIED';

    return baseClaim(claimType, npi, observedAt, value, {
      artifactId: `nursys-${claimType.toLowerCase()}-${npi}-${result.jurisdiction.toLowerCase()}`,
      status: claimStatus,
      reviewRequired: claimType === 'NURSING_DISCIPLINE',
      reviewReason:
        claimType === 'NURSING_DISCIPLINE'
          ? disciplinaryActions[0] ?? 'Nursys disciplinary action requires review.'
          : null,
      validUntil: result.expirationDate,
      expiresAt: result.expirationDate,
    });
  } catch (err) {
    log('warn', 'nursys_claim_fetch_failed', { npi, error: String(err) });
    return null;
  }
}
