/** @deprecated Use identityIngestionPipeline.handlers.NURSYS for production ingestion. */
import { sha256ForPayload } from '../utils/deterministic';
import {
  buildNursysContractSnapshot,
  defaultAuthorityTruthFields,
  type AuthorityConnectorState,
  type AuthorityParticipationStatus,
} from './authority/contracts';

/**
 * nursysAdapter.ts — Nursys E-Notify integration layer
 *
 * Nursys is the authoritative source for RN/LPN/LVPN license verification
 * across participating states.
 *
 * Authorization model:
 *   - Public QuickConfirm UI: do NOT scrape (WAF-blocked, ToS violation)
 *   - Authorized access: institutional E-Notify subscription
 *     → batch XML or REST feed per state or national
 *   - REAL_NURSYS_ENABLED=true only when institutional agreement is active
 *
 * State participation:
 *   As of 2026, 52 jurisdictions participate in Nursys E-Notify for RN/LPN/LVPN.
 *   Non-participating states require direct state board verification.
 */

// ── Participating states (E-Notify as of 2026) ──────────────────────────────

/**
 * States that actively participate in Nursys E-Notify.
 * Source: nursys.com/nursecompact/participating.aspx (verified 2026-Q1)
 * Note: This list is static and should be reviewed quarterly.
 */
export const NURSYS_PARTICIPATING_STATES: ReadonlySet<string> = new Set([
  'AK', 'AL', 'AR', 'AZ', 'CO', 'DE', 'FL', 'GA', 'HI', 'IA',
  'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'ME', 'MD', 'MI', 'MN',
  'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV',
  'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
  'DC', 'GU', 'MP', 'PR', 'VI', // territories
]);

/**
 * States where Nursys E-Notify is NOT available.
 * These require direct state board verification.
 */
export const NURSYS_NON_PARTICIPATING_STATES: ReadonlySet<string> = new Set([
  'CA', // California Board of Registered Nursing — separate system
  'CT', // Connecticut DPH — separate system
  'MA', // Massachusetts Board of Registration — separate system
]);

export type NursysParticipationStatus = AuthorityParticipationStatus;

export function getNursysParticipation(state: string): NursysParticipationStatus {
  const upper = state.toUpperCase();
  if (NURSYS_PARTICIPATING_STATES.has(upper)) return 'participating_state';
  if (NURSYS_NON_PARTICIPATING_STATES.has(upper)) return 'non_participating_state';
  return 'unresolved';
}

// ── Result types ─────────────────────────────────────────────────────────────

export type NursysLicenseStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'LICENSE_NOT_AVAILABLE_FOR_STATE';  // state not in E-Notify

export interface NursysLicenseResult {
  readonly licenseStatus:          NursysLicenseStatus;
  readonly jurisdiction:           string;
  readonly lastUpdated:            string;
  readonly expirationDate:         string | null;
  readonly sourceUrl:              string;
  readonly sourceQueriedAt:        string;
  readonly participationStatus:    NursysParticipationStatus;
  readonly disciplineFlag:         boolean;
  readonly connectorState:         AuthorityConnectorState;
  readonly issuerEntityId:         string | null;
  readonly sourceScope:            'NURSYS_AUTHORIZED_PATH';
  readonly effectiveAt:            string | null;
  readonly verifiedAt:             string | null;
  readonly confidenceLabel:        string;
  readonly dataFreshness:          string;
  /** If licenseStatus === 'LICENSE_NOT_AVAILABLE_FOR_STATE', explains why */
  readonly unavailableReason?:     string;
}

export type NursysFetcher = (npi: string, state?: string) => Promise<NursysLicenseResult>;

// ── Stub (returns unavailable — do not fabricate a license) ─────────────────

/**
 * Stub implementation: returns NOT_AVAILABLE — never fabricates a license status.
 *
 * In production (REAL_NURSYS_ENABLED=true), this must be replaced with
 * a real E-Notify feed client under institutional agreement.
 *
 * IMPORTANT: Do not replace this with fake-but-realistic data.
 * Fake license states (ACTIVE, EXPIRED) would be materially misleading.
 */
function unavailableStub(npi: string, state?: string): NursysLicenseResult {
  const jurisdiction = state?.toUpperCase() ?? 'UNKNOWN';
  const participation = state ? getNursysParticipation(jurisdiction) : 'institution_access_unavailable';
  const contract = buildNursysContractSnapshot(jurisdiction);
  const authorityFields = defaultAuthorityTruthFields({
    authorityClaimCode: 'AUTHORITY_UNAVAILABLE',
    issuerEntityId: contract.issuerEntityId,
    sourceScope: contract.sourceScope,
    effectiveAt: null,
    expiresAt: null,
    verifiedAt: new Date().toISOString(),
    dataFreshness: 'Freshness unavailable',
    participationStatus:
      participation === 'non_participating_state'
        ? 'non_participating_state'
        : 'institution_access_unavailable',
    connectorState:
      participation === 'non_participating_state'
        ? 'connected'
        : contract.state,
    targetDomain: 'LICENSURE',
  });

  return {
    licenseStatus:       'LICENSE_NOT_AVAILABLE_FOR_STATE',
    jurisdiction,
    lastUpdated:         new Date().toISOString(),
    expirationDate:      null,
    sourceUrl:           'https://www.nursys.com/',
    sourceQueriedAt:     new Date().toISOString(),
    participationStatus: participation,
    disciplineFlag:      false,
    connectorState:      authorityFields.connectorState,
    issuerEntityId:      authorityFields.issuerEntityId,
    sourceScope:         'NURSYS_AUTHORIZED_PATH',
    effectiveAt:         authorityFields.effectiveAt,
    verifiedAt:          authorityFields.verifiedAt,
    confidenceLabel:     authorityFields.confidenceLabel,
    dataFreshness:       authorityFields.dataFreshness,
    unavailableReason:
      participation === 'non_participating_state'
        ? `${jurisdiction} does not participate in Nursys E-Notify. Verify via state board directly.`
        : `Nursys institutional access not configured. Set REAL_NURSYS_ENABLED=true with active E-Notify subscription.`,
  };
}

/**
 * Query Nursys for a given NPI.
 *
 * When REAL_NURSYS_ENABLED=false (default): returns unavailable stub.
 * When REAL_NURSYS_ENABLED=true: uses provided fetcher (real E-Notify client).
 * When fetcher is not provided and enabled: throws — must not silently fail.
 */
export async function queryNursysLicense(
  npi: string,
  fetcher?: NursysFetcher,
  state?: string,
): Promise<NursysLicenseResult> {
  if (fetcher) {
    return fetcher(npi, state);
  }
  // No fetcher provided — return honest unavailable state
  return unavailableStub(npi, state);
}

/**
 * Compute a SHA-256 checksum for a serialized payload.
 * Uses deterministic JSON key ordering for reproducibility.
 */
export function computeArtifactChecksum(payload: unknown): string {
  return sha256ForPayload(payload);
}
