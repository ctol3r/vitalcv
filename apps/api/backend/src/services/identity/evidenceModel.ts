/**
 * evidenceModel.ts — Canonical Claim + Verification Receipt Schema
 *
 * Four layers kept strictly separate:
 *
 *   Layer 1: Raw artifact   — VerificationArtifact.rawPayload (the untouched source response)
 *   Layer 2: NormalizedClaim — structured claim derived from artifact(s), with provenance
 *   Layer 3: VerificationReceipt — the auditable paper trail for one claim verdict
 *   Layer 4: CanonicalIdentity — the resolved person after entity resolution
 *
 * Storage:
 *   NormalizedClaim[]      → ClaimRecord + VerificationArtifact.rawPayload._claims[] bridge
 *   VerificationReceipt[]  → VerificationReceiptRecord + VerificationArtifact.rawPayload._receipts[] bridge
 *   IdentitySummary        → VerificationArtifact where source='IDENTITY_INDEX'
 *
 * Claim IDs are deterministic (hash of claimType+sourceId+value content),
 * so re-ingesting the same source produces the same claim ID — enabling
 * idempotent pipelines and reproducible verdicts.
 */

import { createHash } from 'node:crypto';
import { getSource, type EvidenceTier, type ClaimType } from './sourceCatalog';
import type {
  AuthorityClaimCode,
  AuthorityConnectorState,
  AuthorityParticipationStatus,
  AuthoritySourceScope,
  AuthorityTargetDomain,
  BoardOrderSeverity,
} from '../authority/contracts';

export type { EvidenceTier, ClaimType };

export type ClaimConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNCERTAIN';
export type ClaimStatus     = 'ACTIVE' | 'EXPIRED' | 'SUPERSEDED' | 'UNVERIFIED' | 'BLOCKED';

export interface ClaimArtifactTrace {
  source_id: string;
  source_url: string;
  retrieved_at: string;
  raw_artifact_ref: string;
  checksum: string;
  claim_type: ClaimType;
  match_confidence: ClaimConfidence;
}

export interface ClaimArtifactTraceInput {
  sourceId: string;
  sourceUrl?: string | null;
  retrievedAt: string;
  artifactId: string;
  checksum: string;
  claimType: ClaimType;
  matchConfidence: ClaimConfidence;
}

function nonEmptyString(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function buildClaimArtifactTrace(input: ClaimArtifactTraceInput): ClaimArtifactTrace {
  const sourceUrl = nonEmptyString(input.sourceUrl) ?? nonEmptyString(getSource(input.sourceId)?.baseUrl);

  if (!nonEmptyString(input.sourceId)) {
    throw new Error('Traceable claim requires source_id');
  }
  if (!nonEmptyString(input.artifactId)) {
    throw new Error(`Traceable claim ${input.claimType} requires raw_artifact_ref`);
  }
  if (!nonEmptyString(input.checksum)) {
    throw new Error(`Traceable claim ${input.claimType} requires checksum`);
  }
  if (!sourceUrl) {
    throw new Error(`Traceable claim ${input.claimType} requires source_url`);
  }
  if (!nonEmptyString(input.retrievedAt)) {
    throw new Error(`Traceable claim ${input.claimType} requires retrieved_at`);
  }

  return {
    source_id: input.sourceId,
    source_url: sourceUrl,
    retrieved_at: input.retrievedAt,
    raw_artifact_ref: input.artifactId,
    checksum: input.checksum,
    claim_type: input.claimType,
    match_confidence: input.matchConfidence,
  };
}

export function resolveClaimArtifactTrace(
  claim: Pick<
    NormalizedClaim,
    | 'claimType'
    | 'sourceId'
    | 'artifactId'
    | 'artifactChecksum'
    | 'confidence'
    | 'derivedAt'
    | 'observedAt'
    | 'source_id'
    | 'source_url'
    | 'retrieved_at'
    | 'raw_artifact_ref'
    | 'checksum'
    | 'claim_type'
    | 'match_confidence'
  >,
): ClaimArtifactTrace {
  return buildClaimArtifactTrace({
    sourceId: claim.source_id ?? claim.sourceId,
    sourceUrl: claim.source_url,
    retrievedAt: claim.retrieved_at ?? claim.derivedAt ?? claim.observedAt,
    artifactId: claim.raw_artifact_ref ?? claim.artifactId,
    checksum: claim.checksum ?? claim.artifactChecksum,
    claimType: claim.claim_type ?? claim.claimType,
    matchConfidence: claim.match_confidence ?? claim.confidence,
  });
}

// ── Core schema ───────────────────────────────────────────────────────────────

/**
 * A single structured claim derived from one source artifact.
 * Every field traces back to the source artifact and parser version.
 */
export interface NormalizedClaim {
  // Identity
  claimId:      string;       // deterministic — sha256(claimType+sourceId+subjectId+valueHash)
  claimType:    ClaimType;
  subjectNpi:   string;       // canonical subject identifier

  // The claim content
  value:        ClaimValue;

  // Trust provenance
  tier:         EvidenceTier;
  confidence:   ClaimConfidence;
  confidenceScore: number;    // 0.0–1.0

  // Source trace — MUST be present on every claim
  sourceId:         string;   // from SOURCE_CATALOG
  artifactId:       string;   // VerificationArtifact.id
  artifactChecksum: string;   // VerificationArtifact.checksum
  parserVersion:    string;   // bump when parsing logic changes
  derivedAt:        string;   // ISO timestamp when this claim was derived
  source_id?:       string;
  source_url?:      string;
  retrieved_at?:    string;
  raw_artifact_ref?: string;
  checksum?:        string;
  claim_type?:      ClaimType;
  match_confidence?: ClaimConfidence;

  // Temporal bounds
  observedAt:   string;       // when the source reported this fact
  validFrom:    string | null;
  validUntil:   string | null;
  expiresAt:    string | null;
  status:       ClaimStatus;

  // Lineage
  supersededBy: string | null;  // claimId of newer claim if this one is outdated
  supersedes:   string | null;  // claimId this claim replaced

  // Review flags
  reviewRequired: boolean;
  reviewReason:   string | null;
  humanReviewAt:  string | null;
}

/**
 * The verification receipt — the official verdict on a claim.
 * Matches the blueprint schema exactly.
 */
export interface VerificationReceipt {
  receipt_id:          string;         // uuid
  claim_id:            string;
  entity_id:           string;         // 'npi:' + npi
  field:               string;         // human-readable field name
  value:               unknown;        // the verified value
  tier:                EvidenceTier;
  confidence:          number;         // 0.0–1.0
  source_artifact_id:  string;
  source_system:       string;
  observed_at:         string;         // ISO
  parser_version:      string;
  expires_at:          string | null;
  explanation:         string;         // human-readable provenance sentence
  source_url?:         string;
  retrieved_at?:       string;
  raw_artifact_ref?:   string;
  checksum?:           string;
  claim_type?:         ClaimType;
  match_confidence?:   ClaimConfidence;
}

// ── Claim value union ─────────────────────────────────────────────────────────

export type ClaimValue =
  | NpiIdentityValue
  | PersonalIdentityValue
  | SpecialtyValue
  | PracticeLocationValue
  | EndpointValue
  | EnrollmentValue
  | LicenseValue
  | BoardCertValue
  | TrainingCompletionValue
  | AuthorityUnavailableValue
  | ExclusionValue
  | IndustryPaymentValue
  | PublicationValue
  | ClinicalTrialValue
  | InstitutionValue
  | GenericValue;

export interface NpiIdentityValue {
  _type: 'NPI_IDENTITY';
  npi: string;
  enumerationType: 'NPI-1' | 'NPI-2';
  enumerationDate: string;
  lastUpdated: string;
  status: 'A' | 'D';  // Active / Deactivated
  credential: string | null;  // MD, DO, NP, PA, etc.
  claimType?: 'IDENTITY';
  label?: string | null;
  identityOnly?: boolean;
  sourceDisclaimer?: string | null;
  usageRestrictions?: string[];
}

export interface PersonalIdentityValue {
  _type: 'PERSONAL_IDENTITY';
  firstName: string;
  lastName: string;
  middleName: string | null;
  prefix: string | null;
  credential: string | null;
  sex: string | null;
  identityOnly?: boolean;
  sourceDisclaimer?: string | null;
  usageRestrictions?: string[];
}

export interface SpecialtyValue {
  _type: 'SPECIALTY';
  taxonomyCode: string;
  taxonomyDescription: string;
  isPrimary: boolean;
  state: string | null;
  licenseNumber: string | null;
  identityOnly?: boolean;
  sourceDisclaimer?: string | null;
  usageRestrictions?: string[];
}

export interface PracticeLocationValue {
  _type: 'PRACTICE_LOCATION';
  addressType: 'LOCATION' | 'MAILING';
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string | null;
  fax: string | null;
  identityOnly?: boolean;
  sourceDisclaimer?: string | null;
  usageRestrictions?: string[];
}

export interface EndpointValue {
  _type: 'ENDPOINT';
  endpointType: string;       // DIRECT, FHIR, etc.
  endpoint: string;
  affiliation: string | null;
  identityOnly?: boolean;
  sourceDisclaimer?: string | null;
  usageRestrictions?: string[];
}

export interface EnrollmentValue {
  _type: 'ENROLLMENT_STATUS';
  enrolled: boolean;
  enrollmentType: string | null;
  eligibleToOrderRefer: boolean | null;
  source: 'PECOS' | 'DOCTORS_CLINICIANS';
  observedAt?: string | null;
  dataVersion?: string | null;
  label?: string | null;
  statusLabel?: string | null;
  sourceLatency?: string | null;
  dataFreshness?: string | null;
  sourceDisclaimer?: string | null;
}

export interface LicenseValue {
  _type: 'LICENSE';
  state: string;
  licenseNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  licenseStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN';
  disciplinaryActions: string[];
  source: string;
  authorityClaimCode?: AuthorityClaimCode;
  sourceScope?: AuthoritySourceScope | null;
  issuerEntityId?: string | null;
  effectiveAt?: string | null;
  verifiedAt?: string | null;
  confidenceLabel?: string | null;
  dataFreshness?: string | null;
  participationStatus?: AuthorityParticipationStatus | null;
  boardOrderSeverity?: BoardOrderSeverity | null;
  connectorState?: AuthorityConnectorState | null;
  sourceDisclaimer?: string | null;
}

export interface BoardCertValue {
  _type: 'BOARD_CERTIFICATION';
  certifyingBoard: string;
  specialty: string;
  certificationDate: string | null;
  expiryDate: string | null;
  certificationStatus: 'CERTIFIED' | 'NOT_CERTIFIED' | 'LAPSED' | 'UNKNOWN';
  flagSource: 'CMS_DOCTORS_CLINICIANS' | 'ABMS' | 'OTHER';
  authorityClaimCode?: AuthorityClaimCode;
  sourceScope?: AuthoritySourceScope | null;
  issuerEntityId?: string | null;
  effectiveAt?: string | null;
  verifiedAt?: string | null;
  confidenceLabel?: string | null;
  dataFreshness?: string | null;
  participationStatus?: AuthorityParticipationStatus | null;
  boardOrderSeverity?: BoardOrderSeverity | null;
  connectorState?: AuthorityConnectorState | null;
}

export interface TrainingCompletionValue {
  _type: 'TRAINING_COMPLETION';
  programName: string;
  institution: string;
  specialty: string | null;
  trainingType: 'RESIDENCY' | 'FELLOWSHIP' | 'INTERNSHIP' | 'CME' | 'OTHER';
  completionDate: string | null;
  source: string;
  authorityClaimCode?: AuthorityClaimCode;
  sourceScope?: AuthoritySourceScope | null;
  issuerEntityId?: string | null;
  effectiveAt?: string | null;
  verifiedAt?: string | null;
  confidenceLabel?: string | null;
  dataFreshness?: string | null;
  participationStatus?: AuthorityParticipationStatus | null;
  boardOrderSeverity?: BoardOrderSeverity | null;
  connectorState?: AuthorityConnectorState | null;
}

export interface AuthorityUnavailableValue {
  _type: 'AUTHORITY_UNAVAILABLE';
  reason: string;
  source: string;
  targetDomain: AuthorityTargetDomain;
  jurisdiction: string | null;
  authorityClaimCode: 'AUTHORITY_UNAVAILABLE';
  sourceScope: AuthoritySourceScope;
  issuerEntityId?: string | null;
  effectiveAt?: string | null;
  verifiedAt?: string | null;
  confidenceLabel?: string | null;
  dataFreshness?: string | null;
  participationStatus?: AuthorityParticipationStatus | null;
  boardOrderSeverity?: BoardOrderSeverity | null;
  connectorState?: AuthorityConnectorState | null;
}

export interface ExclusionValue {
  _type: 'EXCLUSION_STATUS';
  excluded: boolean;
  verdict?: 'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED';
  exclusionType: string | null;
  exclusionDate: string | null;
  reinstatementDate: string | null;
  matchType:
    | 'EXACT'
    | 'STRONG_FUZZY'
    | 'WEAK'
    | 'NONE'
    | 'UNCHECKED'
    | 'NPI_MATCH'
    | 'NAME_MATCH'
    | 'NO_MATCH'
    | 'UNCLEAR';
  matchConfidence?: ClaimConfidence;
  matchScore?: number | null;
  matchedFields?: string[];
  waiverState: string | null;
  source: 'OIG_LEIE' | 'SAM_GOV';
  sourceLatency?: string | null;
  dataFreshness?: string | null;
  dataVersion?: string | null;
  leieVersionDate?: string | null;
}

export interface IndustryPaymentValue {
  _type: 'INDUSTRY_PAYMENT';
  paymentYear: number;
  totalAmount: number;
  recordCount: number;
  paymentTypes: string[];
  topPayers: string[];
}

export interface PublicationValue {
  _type: 'PUBLICATION';
  openAlexId: string | null;
  pubmedId: string | null;
  title: string;
  journal: string | null;
  publishedDate: string | null;
  citationCount: number;
  coAuthors: string[];
}

export interface ClinicalTrialValue {
  _type: 'CLINICAL_TRIAL';
  nctId: string;
  title: string;
  role: 'PRINCIPAL_INVESTIGATOR' | 'SUB_INVESTIGATOR' | 'STUDY_CHAIR' | 'OTHER';
  status: string;
  phase: string | null;
  conditions: string[];
  startDate: string | null;
}

export interface InstitutionValue {
  _type: 'INSTITUTION_AFFILIATION';
  institution: string;
  title: string | null;
  department: string | null;
  affiliationType: 'EMPLOYER' | 'TRAINING' | 'FACULTY' | 'NETWORK';
  startDate: string | null;
  endDate: string | null;
  source: string;
}

export interface GenericValue {
  _type: 'GENERIC';
  [key: string]: unknown;
}

// ── Claim ID generation ───────────────────────────────────────────────────────

/**
 * Deterministic claim ID — same source + same content = same ID.
 * Enables idempotent re-ingestion and reproducible audit.
 */
export function computeClaimId(
  claimType: ClaimType,
  sourceId: string,
  subjectNpi: string,
  value: ClaimValue,
): string {
  const content = JSON.stringify({ claimType, sourceId, subjectNpi, valueHash: stableHash(value) });
  return 'claim_' + createHash('sha256').update(content).digest('hex').slice(0, 32);
}

function stableHash(obj: unknown): string {
  const sorted = sortedJson(obj);
  return createHash('sha256').update(sorted).digest('hex').slice(0, 16);
}

function sortedJson(val: unknown): string {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return '[' + val.map(sortedJson).join(',') + ']';
  const o = val as Record<string, unknown>;
  return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + sortedJson(o[k])).join(',') + '}';
}

// ── Receipt construction ──────────────────────────────────────────────────────

export function buildReceipt(
  claim: NormalizedClaim,
  fieldLabel: string,
  explanation: string,
): VerificationReceipt {
  const trace = resolveClaimArtifactTrace(claim);
  return {
    receipt_id:         createHash('sha256').update(claim.claimId + claim.derivedAt).digest('hex').slice(0, 32),
    claim_id:           claim.claimId,
    entity_id:          `npi:${claim.subjectNpi}`,
    field:              fieldLabel,
    value:              (claim.value as Record<string, unknown>)[fieldLabel] ?? claim.value,
    tier:               claim.tier,
    confidence:         claim.confidenceScore,
    source_artifact_id: claim.artifactId,
    source_system:      claim.sourceId,
    observed_at:        claim.observedAt,
    parser_version:     claim.parserVersion,
    expires_at:         claim.expiresAt,
    explanation,
    source_url:         trace.source_url,
    retrieved_at:       trace.retrieved_at,
    raw_artifact_ref:   trace.raw_artifact_ref,
    checksum:           trace.checksum,
    claim_type:         trace.claim_type,
    match_confidence:   trace.match_confidence,
  };
}

// ── Claim summary for canonical identity index ─────────────────────────────────

export interface IdentityClaimSummary {
  claimId:     string;
  claimType:   ClaimType;
  tier:        EvidenceTier;
  confidence:  ClaimConfidence;
  status:      ClaimStatus;
  sourceId:    string;
  derivedAt:   string;
  validUntil:  string | null;
}

export interface CanonicalIdentitySummary {
  npi:            string;
  lastIngestedAt: string;
  claimCount:     number;
  claimsByType:   Record<string, number>;
  highestTier:    EvidenceTier;
  goldClaimCount: number;
  hasExclusion:   boolean;
  hasActiveLicense: boolean;
  hasBoardCert:   boolean;
  claims:         IdentityClaimSummary[];
}

export interface IdentityIndexArtifactPayload {
  _identityIndex: true;
  generatedAt: string;
  previousArtifactId: string | null;
  claimRefs: string[];
  sourceRecordIds: string[];
  summary: CanonicalIdentitySummary;
}

export function buildIdentitySummary(npi: string, claims: NormalizedClaim[]): CanonicalIdentitySummary {
  const byType: Record<string, number> = {};
  for (const c of claims) byType[c.claimType] = (byType[c.claimType] ?? 0) + 1;

  const tiers = claims.map(c => c.tier);
  const highestTier: EvidenceTier = tiers.includes('GOLD') ? 'GOLD' : tiers.includes('SILVER') ? 'SILVER' : 'BRONZE';

  const active = claims.filter(c => c.status === 'ACTIVE');
  const lastIngestedAt = claims
    .map((claim) => Date.parse(claim.derivedAt || claim.observedAt))
    .filter((timestamp) => Number.isFinite(timestamp))
    .reduce<number | null>((latest, timestamp) => {
      if (latest === null || timestamp > latest) {
        return timestamp;
      }
      return latest;
    }, null);

  return {
    npi,
    lastIngestedAt: new Date(lastIngestedAt ?? Date.now()).toISOString(),
    claimCount:     claims.length,
    claimsByType:   byType,
    highestTier,
    goldClaimCount: claims.filter(c => c.tier === 'GOLD').length,
    hasExclusion:   active.some(c => c.claimType === 'EXCLUSION_STATUS' && (c.value as ExclusionValue).excluded),
    hasActiveLicense: active.some(c => (c.claimType === 'LICENSE' || c.claimType === 'NURSING_LICENSE') && (c.value as LicenseValue).licenseStatus === 'ACTIVE'),
    hasBoardCert:   active.some(c => (c.claimType === 'BOARD_CERTIFICATION' || c.claimType === 'BOARD_CERT_FLAG')),
    claims: claims.map(c => ({
      claimId:    c.claimId,
      claimType:  c.claimType,
      tier:       c.tier,
      confidence: c.confidence,
      status:     c.status,
      sourceId:   c.sourceId,
      derivedAt:  c.derivedAt,
      validUntil: c.validUntil,
    })),
  };
}
