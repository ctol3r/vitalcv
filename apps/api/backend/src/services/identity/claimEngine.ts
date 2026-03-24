/**
 * claimEngine.ts — Source Parsers → Normalized Claims
 *
 * Each parser takes a raw API/bulk response and emits NormalizedClaim[].
 * Parser functions are pure: same input → same output → same claim IDs.
 *
 * Rules:
 *   - Never invent confidence. If a source doesn't say, use UNCERTAIN.
 *   - Never silently drop parse errors. Log and set reviewRequired = true.
 *   - Parser version is stamped on every claim — bump it when logic changes.
 *   - Bronze data must be explicitly marked. It may never override Gold/Silver.
 */

import { createHash } from 'node:crypto';
import {
  buildClaimArtifactTrace,
  computeClaimId,
  buildReceipt,
  type NormalizedClaim,
  type VerificationReceipt,
  type ClaimStatus,
  type ClaimConfidence,
  type NpiIdentityValue,
  type PersonalIdentityValue,
  type SpecialtyValue,
  type PracticeLocationValue,
  type EndpointValue,
  type EnrollmentValue,
  type ExclusionValue,
  type PublicationValue,
  type ClinicalTrialValue,
  type BoardCertValue,
} from './evidenceModel';
import { getSource, type ClaimType } from './sourceCatalog';
import {
  buildPecosStatusLabel,
  computePecosRevalidationDue,
  normalizePecosEnrollmentStatus,
  PECOS_DATA_FRESHNESS,
  PECOS_SOURCE_DISCLAIMER,
  PECOS_SOURCE_LATENCY,
  PECOS_SOURCE_NAME,
} from './pecosContract';

function computeClaimExpiry(sourceId: string, timestamp: string): string | null {
  const source = getSource(sourceId);
  if (!source) return null;
  const base = Date.parse(timestamp);
  if (!Number.isFinite(base)) return null;
  return new Date(base + source.refreshSlaHours * 60 * 60 * 1000).toISOString();
}
import { log } from '../../obs/logger';

// Re-export for use in pipeline
export type { NormalizedClaim, VerificationReceipt };

// ── Claim builder helper ──────────────────────────────────────────────────────

function makeClaim(
  params: {
    claimType:    ClaimType;
    subjectNpi:   string;
    value:        NormalizedClaim['value'];
    sourceId:     string;
    sourceUrl?:   string;
    artifactId:   string;
    artifactChecksum: string;
    parserVersion: string;
    tier:         NormalizedClaim['tier'];
    confidence:   ClaimConfidence;
    matchConfidence?: ClaimConfidence;
    confidenceScore: number;
    observedAt:   string;
    retrievedAt?: string;
    derivedAt?:   string;
    validFrom?:   string | null;
    validUntil?:  string | null;
    expiresAt?:   string | null;
    status?:      ClaimStatus;
    reviewRequired?: boolean;
    reviewReason?: string | null;
    freshnessWindowHours?: number | null;
  }
): NormalizedClaim {
  const claimId = computeClaimId(params.claimType, params.sourceId, params.subjectNpi, params.value);
  const trace = buildClaimArtifactTrace({
    sourceId: params.sourceId,
    sourceUrl: params.sourceUrl,
    retrievedAt: params.retrievedAt ?? params.derivedAt ?? params.observedAt,
    artifactId: params.artifactId,
    checksum: params.artifactChecksum,
    claimType: params.claimType,
    matchConfidence: params.matchConfidence ?? params.confidence,
  });
  return {
    claimId,
    claimType:        params.claimType,
    subjectNpi:       params.subjectNpi,
    value:            params.value,
    tier:             params.tier,
    confidence:       params.confidence,
    confidenceScore:  params.confidenceScore,
    sourceId:         params.sourceId,
    artifactId:       params.artifactId,
    artifactChecksum: params.artifactChecksum,
    parserVersion:    params.parserVersion,
    derivedAt:        params.derivedAt ?? params.observedAt,
    source_id:        trace.source_id,
    source_url:       trace.source_url,
    retrieved_at:     trace.retrieved_at,
    raw_artifact_ref: trace.raw_artifact_ref,
    checksum:         trace.checksum,
    claim_type:       trace.claim_type,
    match_confidence: trace.match_confidence,
    observedAt:       params.observedAt,
    validFrom:        params.validFrom ?? null,
    validUntil:       params.validUntil ?? null,
    expiresAt:        params.expiresAt ?? null,
    status:           params.status ?? 'ACTIVE',
    supersededBy:     null,
    supersedes:       null,
    reviewRequired:   params.reviewRequired ?? false,
    reviewReason:     params.reviewReason ?? null,
    humanReviewAt:    null,
    freshnessWindowHours: params.freshnessWindowHours ?? null,
  };
}

// ── NPPES V2 parser ───────────────────────────────────────────────────────────

interface NppesResult {
  basic?: {
    first_name?: string; last_name?: string; middle_name?: string;
    name_prefix?: string; credential?: string; sex?: string;
    status?: string; enumeration_date?: string; last_updated?: string;
    sole_proprietor?: string;
  };
  taxonomies?: Array<{
    code?: string; desc?: string; primary?: boolean;
    state?: string; license?: string;
  }>;
  addresses?: Array<{
    address_1?: string; address_2?: string; city?: string; state?: string;
    postal_code?: string; country_code?: string; telephone_number?: string;
    fax_number?: string; address_purpose?: string; address_type?: string;
  }>;
  endpoints?: Array<{
    endpoint?: string; endpointType?: string; endpointTypeDescription?: string;
    affiliation?: string; city?: string; state?: string;
  }>;
  enumeration_type?: string;
  number?: string;
  created_epoch?: string;
  last_updated_epoch?: string;
}

const NPPES_PARSER_VERSION = 'v1.2.0';
const NPPES_IDENTITY_ONLY_EXPLANATION =
  'NPI confirms identity only — not licensure, enrollment, or credential status';
const NPPES_USAGE_RESTRICTIONS = Object.freeze([
  'cannot be used for licensure',
  'cannot imply credentialing',
  'cannot imply enrollment',
]);

export function parseNppesResult(
  npi: string,
  raw: NppesResult,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const base = {
    sourceId: 'NPPES_API',
    sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt,
    artifactId,
    artifactChecksum,
    parserVersion: NPPES_PARSER_VERSION,
    tier: 'GOLD' as const,
    observedAt,
    expiresAt: computeClaimExpiry('NPPES_API', observedAt),
  };

  try {
    // NPI Identity claim
    const identityValue: NpiIdentityValue = {
      _type: 'NPI_IDENTITY',
      npi,
      enumerationType: (raw.enumeration_type === 'NPI-2' ? 'NPI-2' : 'NPI-1'),
      enumerationDate: raw.basic?.enumeration_date ?? '',
      lastUpdated:     raw.basic?.last_updated ?? '',
      status:          raw.basic?.status === 'A' ? 'A' : 'D',
      credential:      raw.basic?.credential ?? null,
      claimType:       'IDENTITY',
      label:           'Registered with CMS NPPES',
      identityOnly:    true,
      sourceDisclaimer: NPPES_IDENTITY_ONLY_EXPLANATION,
      usageRestrictions: [...NPPES_USAGE_RESTRICTIONS],
    };
    const idClaim = makeClaim({ ...base, claimType: 'NPI_IDENTITY', subjectNpi: npi, value: identityValue, confidence: 'HIGH', confidenceScore: 0.99 });
    claims.push(idClaim);
    receipts.push(buildReceipt(
      idClaim,
      'npi',
      `${NPPES_IDENTITY_ONLY_EXPLANATION}. NPI ${npi}, status ${identityValue.status}, enumerated ${identityValue.enumerationDate || 'unknown'}.`,
    ));

    // Personal identity claim (NPI-1 only)
    if (raw.enumeration_type !== 'NPI-2' && raw.basic?.last_name) {
      const personalValue: PersonalIdentityValue = {
        _type: 'PERSONAL_IDENTITY',
        firstName:  raw.basic.first_name ?? '',
        lastName:   raw.basic.last_name ?? '',
        middleName: raw.basic.middle_name ?? null,
        prefix:     raw.basic.name_prefix ?? null,
        credential: raw.basic.credential ?? null,
        sex:        raw.basic.sex ?? null,
        identityOnly: true,
        sourceDisclaimer: NPPES_IDENTITY_ONLY_EXPLANATION,
        usageRestrictions: [...NPPES_USAGE_RESTRICTIONS],
      };
      const pClaim = makeClaim({ ...base, claimType: 'PERSONAL_IDENTITY', subjectNpi: npi, value: personalValue, confidence: 'HIGH', confidenceScore: 0.97 });
      claims.push(pClaim);
      receipts.push(buildReceipt(pClaim, 'fullName', `Name ${personalValue.firstName} ${personalValue.lastName} from NPPES official record`));
    }

    // Specialty / taxonomy claims
    for (const tax of raw.taxonomies ?? []) {
      if (!tax.code) continue;
      const specialtyValue: SpecialtyValue = {
        _type: 'SPECIALTY',
        taxonomyCode: tax.code,
        taxonomyDescription: tax.desc ?? '',
        isPrimary: tax.primary ?? false,
        state: tax.state ?? null,
        licenseNumber: tax.license ?? null,
        identityOnly: true,
        sourceDisclaimer: NPPES_IDENTITY_ONLY_EXPLANATION,
        usageRestrictions: [...NPPES_USAGE_RESTRICTIONS],
      };
      const sClaim = makeClaim({ ...base, claimType: 'SPECIALTY', subjectNpi: npi, value: specialtyValue, confidence: 'HIGH', confidenceScore: 0.95 });
      claims.push(sClaim);
    }

    // Practice location + mailing address claims
    for (const addr of raw.addresses ?? []) {
      if (!addr.city || !addr.state) continue;
      const locValue: PracticeLocationValue = {
        _type: 'PRACTICE_LOCATION',
        addressType: addr.address_purpose === 'MAILING' ? 'MAILING' : 'LOCATION',
        address1: addr.address_1 ?? '',
        address2: addr.address_2 ?? null,
        city: addr.city,
        state: addr.state,
        zip: addr.postal_code ?? '',
        country: addr.country_code ?? 'US',
        phone: addr.telephone_number ?? null,
        fax: addr.fax_number ?? null,
        identityOnly: true,
        sourceDisclaimer: NPPES_IDENTITY_ONLY_EXPLANATION,
        usageRestrictions: [...NPPES_USAGE_RESTRICTIONS],
      };
      const claimType: ClaimType = addr.address_purpose === 'MAILING' ? 'MAILING_ADDRESS' : 'PRACTICE_LOCATION';
      const lClaim = makeClaim({ ...base, claimType, subjectNpi: npi, value: locValue, confidence: 'HIGH', confidenceScore: 0.90 });
      claims.push(lClaim);
    }

    // Endpoint claims
    for (const ep of raw.endpoints ?? []) {
      if (!ep.endpoint) continue;
      const epValue: EndpointValue = {
        _type: 'ENDPOINT',
        endpointType: ep.endpointType ?? ep.endpointTypeDescription ?? 'UNKNOWN',
        endpoint: ep.endpoint,
        affiliation: ep.affiliation ?? null,
        identityOnly: true,
        sourceDisclaimer: NPPES_IDENTITY_ONLY_EXPLANATION,
        usageRestrictions: [...NPPES_USAGE_RESTRICTIONS],
      };
      const epClaim = makeClaim({ ...base, claimType: 'ENDPOINT', subjectNpi: npi, value: epValue, confidence: 'MEDIUM', confidenceScore: 0.80 });
      claims.push(epClaim);
    }

  } catch (err) {
    log('error', 'claimEngine: NPPES parse error', { npi, error: String(err) });
  }

  return { claims, receipts };
}

// ── OIG LEIE parser ───────────────────────────────────────────────────────────

interface OigSearchResult {
  verdict?: 'CLEAR' | 'EXCLUDED' | 'POSSIBLE_MATCH' | 'UNCHECKED';
  matchType?: ExclusionValue['matchType'] | string;
  matchConfidence?: ClaimConfidence;
  matchScore?: number | null;
  matchedFields?: string[];
  excluded?: boolean;
  exclusionType?: string;
  exclusionDate?: string;
  reinstatementDate?: string | null;
  waiverState?: string | null;
  sourceLatency?: string | null;
  dataFreshness?: string | null;
  dataVersion?: string | null;
  leieVersionDate?: string | null;
  rawResponse?: unknown;
}

const OIG_PARSER_VERSION = 'v1.2.0';

function normalizeLeieMatchType(
  matchType: string | undefined,
  matchScore: number | null | undefined,
  verdict: OigSearchResult['verdict'] | undefined,
  excluded: boolean,
): ExclusionValue['matchType'] {
  const normalized = (matchType ?? '').trim().toUpperCase();

  if (normalized === 'EXACT' || normalized === 'NPI_MATCH' || normalized === 'EXACT_MATCH') {
    return 'EXACT';
  }
  if (normalized === 'STRONG_FUZZY') {
    return 'STRONG_FUZZY';
  }
  if (normalized === 'WEAK') {
    return 'WEAK';
  }
  if (normalized === 'NONE' || normalized === 'NO_MATCH') {
    return 'NONE';
  }
  if (normalized === 'UNCHECKED' || normalized === 'UNCLEAR') {
    return 'UNCHECKED';
  }
  if (normalized === 'NAME_MATCH') {
    if (typeof matchScore === 'number') {
      return matchScore >= 0.75 ? 'STRONG_FUZZY' : 'WEAK';
    }
    return excluded ? 'STRONG_FUZZY' : 'WEAK';
  }

  if (verdict === 'UNCHECKED') {
    return 'UNCHECKED';
  }
  if (verdict === 'EXCLUDED' || excluded) {
    return 'EXACT';
  }
  if (verdict === 'POSSIBLE_MATCH') {
    return typeof matchScore === 'number' && matchScore >= 0.75 ? 'STRONG_FUZZY' : 'WEAK';
  }

  return 'NONE';
}

export function parseOigResult(
  npi: string,
  raw: OigSearchResult,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const verdict = raw.verdict
    ?? (raw.excluded === true
      ? 'EXCLUDED'
      : raw.matchType === 'NAME_MATCH'
        || raw.matchType === 'STRONG_FUZZY'
        || raw.matchType === 'WEAK'
        || raw.matchType === 'UNCLEAR'
        || raw.matchType === 'UNCHECKED'
        ? 'POSSIBLE_MATCH'
        : raw.matchType === undefined
          ? 'UNCHECKED'
          : 'CLEAR');
  const excluded = verdict === 'EXCLUDED';
  const matchType = normalizeLeieMatchType(raw.matchType, raw.matchScore, verdict, excluded);

  const confidence: ClaimConfidence = raw.matchConfidence
    ?? (matchType === 'EXACT'
      ? 'HIGH'
      : matchType === 'STRONG_FUZZY'
        ? 'MEDIUM'
        : matchType === 'WEAK'
          ? 'LOW'
          : matchType === 'UNCHECKED' || verdict === 'UNCHECKED'
            ? 'UNCERTAIN'
            : 'HIGH');
  const confidenceScore = typeof raw.matchScore === 'number'
    ? raw.matchScore
    : confidence === 'HIGH'
      ? 0.99
      : confidence === 'MEDIUM'
        ? 0.78
        : confidence === 'LOW'
          ? 0.55
          : 0.25;
  const reviewRequired =
    verdict === 'POSSIBLE_MATCH'
    || verdict === 'UNCHECKED'
    || matchType === 'STRONG_FUZZY'
    || matchType === 'WEAK'
    || matchType === 'UNCHECKED';

  const value: ExclusionValue = {
    _type: 'EXCLUSION_STATUS',
    excluded,
    verdict,
    exclusionType: raw.exclusionType ?? null,
    exclusionDate: raw.exclusionDate ?? null,
    reinstatementDate: raw.reinstatementDate ?? null,
    matchType,
    matchConfidence: confidence,
    matchScore: typeof raw.matchScore === 'number' ? raw.matchScore : null,
    matchedFields: raw.matchedFields ?? [],
    waiverState: raw.waiverState ?? null,
    source: 'OIG_LEIE',
    sourceLatency: raw.sourceLatency ?? null,
    dataFreshness: raw.dataFreshness ?? null,
    dataVersion: raw.dataVersion ?? null,
    leieVersionDate: raw.leieVersionDate ?? null,
  };

  const claim = makeClaim({
    sourceId: 'OIG_LEIE',
    sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt,
    artifactId,
    artifactChecksum,
    parserVersion: OIG_PARSER_VERSION, tier: 'GOLD',
    claimType: 'EXCLUSION_STATUS', subjectNpi: npi, value,
    confidence,
    matchConfidence: confidence,
    confidenceScore,
    observedAt,
    expiresAt: computeClaimExpiry('OIG_LEIE', observedAt),
    status: verdict === 'EXCLUDED' ? 'BLOCKED' : reviewRequired ? 'UNVERIFIED' : 'ACTIVE',
    reviewRequired,
    reviewReason: reviewRequired
      ? (verdict === 'UNCHECKED'
        ? 'OIG LEIE monthly CSV check is unavailable or incomplete — manual verification required'
        : 'Potential LEIE fuzzy match requires manual review before treating as excluded')
      : null,
  });

  const explanation = verdict === 'EXCLUDED'
    ? `OIG/LEIE exclusion confirmed for NPI ${npi} via ${matchType}. LEIE version date: ${raw.leieVersionDate ?? 'unknown'}.`
    : verdict === 'POSSIBLE_MATCH'
      ? `OIG/LEIE returned a ${matchType.toLowerCase()} possible match for NPI ${npi}. Manual review required before treating this provider as excluded.`
      : verdict === 'UNCHECKED'
        ? `OIG/LEIE monthly CSV could not be checked for NPI ${npi}. Treat as unverified until manually reviewed.`
        : `OIG/LEIE check clear for NPI ${npi} — no exclusion found (${matchType}).`;

  return {
    claims: [claim],
    receipts: [buildReceipt(claim, 'excluded', explanation)],
  };
}

// ── PECOS / Doctors & Clinicians parser ───────────────────────────────────────

interface PecosRecord {
  npi?: string;
  enrolled?: boolean | null;
  claimState?: EnrollmentValue['claimState'];
  enrollmentType?: string | null;
  eligibleToOrderRefer?: boolean | null;
  source?: string;
  observedAt?: string | null;
  dataVersion?: string | null;
  revalidationDue?: string | null;
  sourceLatency?: string | null;
  dataFreshness?: string | null;
}

const PECOS_PARSER_VERSION = 'v1.2.0';

export function parsePecosRecord(
  npi: string,
  raw: PecosRecord,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
  sourceMeta?: { sourceUrl?: string; retrievedAt?: string },
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claimState = normalizePecosEnrollmentStatus({
    claimState: raw.claimState,
    enrolled: typeof raw.enrolled === 'boolean' ? raw.enrolled : null,
    source: raw.source,
  });
  const enrolled =
    claimState === 'ENROLLED'
      ? true
      : claimState === 'NOT_FOUND'
        ? false
        : null;
  const confidence: ClaimConfidence =
    claimState === 'ENROLLED' || claimState === 'NOT_FOUND' ? 'HIGH' : 'UNCERTAIN';
  const confidenceScore =
    claimState === 'ENROLLED' || claimState === 'NOT_FOUND' ? 0.95 : 0.25;
  const label = buildPecosStatusLabel(claimState, raw.dataVersion ?? null);
  const enrollmentObservedAt = raw.observedAt ?? observedAt;
  const revalidationDue =
    raw.revalidationDue
    ?? computePecosRevalidationDue({
      status: claimState,
      observedAt: enrollmentObservedAt,
    });
  const reviewRequired =
    claimState === 'UNKNOWN'
    || claimState === 'UNCHECKED'
    || (claimState === 'ENROLLED' && !raw.dataVersion);
  const reviewReason =
    claimState === 'UNKNOWN'
      ? 'Quarterly PECOS release could not be resolved for this NPI'
      : claimState === 'UNCHECKED'
        ? 'Quarterly PECOS release has not been checked for this NPI'
        : claimState === 'ENROLLED' && !raw.dataVersion
          ? 'PECOS enrollment result is missing a normalized quarterly data version'
          : null;
  const freshnessWindowHours = getSource('PECOS_PUBLIC')?.refreshSlaHours ?? null;
  const value: EnrollmentValue = {
    _type: 'ENROLLMENT_STATUS',
    enrolled,
    claimState,
    enrollmentType: raw.enrollmentType ?? null,
    eligibleToOrderRefer: raw.eligibleToOrderRefer ?? null,
    source: PECOS_SOURCE_NAME,
    observedAt: enrollmentObservedAt,
    dataVersion: raw.dataVersion ?? null,
    revalidationDue,
    label,
    statusLabel: label,
    sourceLatency: PECOS_SOURCE_LATENCY,
    dataFreshness: PECOS_DATA_FRESHNESS,
    sourceDisclaimer: PECOS_SOURCE_DISCLAIMER,
  };

  const claim = makeClaim({
    sourceId: 'PECOS_PUBLIC',
    sourceUrl: sourceMeta?.sourceUrl,
    retrievedAt: sourceMeta?.retrievedAt ?? observedAt,
    artifactId,
    artifactChecksum,
    parserVersion: PECOS_PARSER_VERSION, tier: 'GOLD',
    claimType: 'ENROLLMENT_STATUS', subjectNpi: npi, value,
    confidence,
    confidenceScore,
    observedAt,
    expiresAt: computeClaimExpiry('PECOS_PUBLIC', observedAt),
    status: claimState === 'ENROLLED' ? 'ACTIVE' : 'UNVERIFIED',
    reviewRequired,
    reviewReason,
    freshnessWindowHours,
  });

  const explanation =
    claimState === 'ENROLLED'
      ? `${value.label}.${raw.enrollmentType ? ` Enrollment type: ${raw.enrollmentType}.` : ''}${raw.eligibleToOrderRefer ? ' Eligible to order/refer.' : ''}`
      : claimState === 'NOT_FOUND'
        ? `${value.label}. This is a quarterly not-found result and must not be treated as real-time disenrollment.`
        : claimState === 'UNCHECKED'
          ? `${value.label}. PECOS has not been checked yet.`
          : `${value.label}. Treat this as unresolved until a fresh quarterly PECOS snapshot is available.`;

  return {
    claims: [claim],
    receipts: [buildReceipt(claim, 'enrolled', explanation)],
  };
}

// ── OpenAlex author parser ────────────────────────────────────────────────────

interface OpenAlexAuthor {
  id?: string;
  display_name?: string;
  works_count?: number;
  cited_by_count?: number;
  last_known_institutions?: Array<{ display_name?: string; country_code?: string }>;
  works_api_url?: string;
}

const OPENALEX_PARSER_VERSION = 'v1.0.0';

export function parseOpenAlexAuthor(
  npi: string,
  raw: OpenAlexAuthor,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];

  if (!raw.id) return { claims, receipts };

  // Citation metric claim
  const pubValue: PublicationValue = {
    _type: 'PUBLICATION',
    openAlexId: raw.id,
    pubmedId: null,
    title: `${raw.works_count ?? 0} publications`,
    journal: null,
    publishedDate: null,
    citationCount: raw.cited_by_count ?? 0,
    coAuthors: [],
  };

  const claim = makeClaim({
    sourceId: 'OPENALEX', artifactId, artifactChecksum,
    parserVersion: OPENALEX_PARSER_VERSION, tier: 'SILVER',
    claimType: 'CITATION_METRIC', subjectNpi: npi, value: pubValue,
    confidence: 'MEDIUM', confidenceScore: 0.70, observedAt,
    // Silver-tier author disambiguation — flag for review if confidence is low
    reviewRequired: (raw.works_count ?? 0) === 0,
    reviewReason: (raw.works_count ?? 0) === 0 ? 'OpenAlex author match has 0 works — verify identity match' : null,
  });
  claims.push(claim);
  receipts.push(buildReceipt(claim, 'citationCount',
    `OpenAlex author ID ${raw.id}: ${raw.works_count ?? 0} works, ${raw.cited_by_count ?? 0} citations. Silver-tier — verify NPI-to-author identity match.`));

  return { claims, receipts };
}

// ── ClinicalTrials.gov parser ─────────────────────────────────────────────────

interface ClinicalTrialStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    descriptionModule?: { briefSummary?: string };
    designModule?: { phases?: string[] };
    conditionsModule?: { conditions?: string[] };
    contactsLocationsModule?: {
      overallOfficials?: Array<{ name?: string; role?: string; affiliation?: string }>;
    };
  };
}

const CT_PARSER_VERSION = 'v1.0.0';

export function parseClinicalTrial(
  npi: string,
  study: ClinicalTrialStudy,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const proto = study.protocolSection;
  const nctId = proto?.identificationModule?.nctId;
  if (!nctId) return { claims: [], receipts: [] };

  const value: ClinicalTrialValue = {
    _type: 'CLINICAL_TRIAL',
    nctId,
    title: proto?.identificationModule?.briefTitle ?? '',
    role: 'PRINCIPAL_INVESTIGATOR',
    status: proto?.statusModule?.overallStatus ?? 'UNKNOWN',
    phase: proto?.designModule?.phases?.[0] ?? null,
    conditions: proto?.conditionsModule?.conditions ?? [],
    startDate: proto?.statusModule?.startDateStruct?.date ?? null,
  };

  const claim = makeClaim({
    sourceId: 'CLINICAL_TRIALS', artifactId, artifactChecksum,
    parserVersion: CT_PARSER_VERSION, tier: 'SILVER',
    claimType: 'CLINICAL_TRIAL', subjectNpi: npi, value,
    confidence: 'MEDIUM', confidenceScore: 0.65, observedAt,
    reviewRequired: true,
    reviewReason: 'ClinicalTrials.gov name match — verify NPI-to-investigator identity before confirming',
  });

  return {
    claims: [claim],
    receipts: [buildReceipt(claim, 'nctId',
      `Trial ${nctId} matched by investigator name. Silver-tier — identity confirmation required.`)],
  };
}

// ── Checksum ──────────────────────────────────────────────────────────────────

export function checksumOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
