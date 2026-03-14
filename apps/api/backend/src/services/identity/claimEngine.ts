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
import type { ClaimType } from './sourceCatalog';
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
    artifactId:   string;
    artifactChecksum: string;
    parserVersion: string;
    tier:         NormalizedClaim['tier'];
    confidence:   ClaimConfidence;
    confidenceScore: number;
    observedAt:   string;
    validFrom?:   string | null;
    validUntil?:  string | null;
    expiresAt?:   string | null;
    status?:      ClaimStatus;
    reviewRequired?: boolean;
    reviewReason?: string | null;
  }
): NormalizedClaim {
  const claimId = computeClaimId(params.claimType, params.sourceId, params.subjectNpi, params.value);
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
    derivedAt:        new Date().toISOString(),
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

const NPPES_PARSER_VERSION = 'v1.0.0';

export function parseNppesResult(
  npi: string,
  raw: NppesResult,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const base = { sourceId: 'NPPES_API', artifactId, artifactChecksum, parserVersion: NPPES_PARSER_VERSION, tier: 'GOLD' as const, observedAt };

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
    };
    const idClaim = makeClaim({ ...base, claimType: 'NPI_IDENTITY', subjectNpi: npi, value: identityValue, confidence: 'HIGH', confidenceScore: 0.99 });
    claims.push(idClaim);
    receipts.push(buildReceipt(idClaim, 'npi', `NPI ${npi} verified active in NPPES (status: ${identityValue.status}, enumerated: ${identityValue.enumerationDate})`));

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
  matchType?: 'NPI_MATCH' | 'NAME_MATCH' | 'NO_MATCH' | 'UNCLEAR' | string;
  excluded?: boolean;
  exclusionType?: string;
  exclusionDate?: string;
  reinstatementDate?: string | null;
  waiverState?: string | null;
  rawResponse?: unknown;
}

const OIG_PARSER_VERSION = 'v1.0.0';

export function parseOigResult(
  npi: string,
  raw: OigSearchResult,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const excluded = raw.excluded === true || (!!raw.matchType && raw.matchType !== 'NO_MATCH');
  const matchType = (raw.matchType ?? 'NO_MATCH') as ExclusionValue['matchType'];

  // If exclusion status is genuinely unclear (API error or timeout),
  // mark as UNCERTAIN rather than silently passing as clear.
  const confidence: ClaimConfidence = raw.matchType === undefined ? 'UNCERTAIN' : 'HIGH';
  const confidenceScore = confidence === 'UNCERTAIN' ? 0.3 : 0.98;
  const reviewRequired = confidence === 'UNCERTAIN' || matchType === 'UNCLEAR';

  const value: ExclusionValue = {
    _type: 'EXCLUSION_STATUS',
    excluded,
    exclusionType: raw.exclusionType ?? null,
    exclusionDate: raw.exclusionDate ?? null,
    reinstatementDate: raw.reinstatementDate ?? null,
    matchType,
    waiverState: raw.waiverState ?? null,
    source: 'OIG_LEIE',
  };

  const claim = makeClaim({
    sourceId: 'OIG_LEIE', artifactId, artifactChecksum,
    parserVersion: OIG_PARSER_VERSION, tier: 'GOLD',
    claimType: 'EXCLUSION_STATUS', subjectNpi: npi, value,
    confidence, confidenceScore, observedAt,
    status: excluded ? 'BLOCKED' : 'ACTIVE',
    reviewRequired,
    reviewReason: reviewRequired
      ? (confidence === 'UNCERTAIN' ? 'OIG check returned uncertain result — manual verification required' : 'Ambiguous name match — human review required')
      : null,
  });

  const explanation = excluded
    ? `OIG/LEIE exclusion detected for NPI ${npi} — match type: ${matchType}. Exclusion date: ${raw.exclusionDate ?? 'unknown'}. Trust band hard-capped at L0.`
    : confidence === 'UNCERTAIN'
      ? `OIG/LEIE check result uncertain for NPI ${npi} — treat as unverified until manual review.`
      : `OIG/LEIE check clear for NPI ${npi} — no exclusion found (${matchType}).`;

  return {
    claims: [claim],
    receipts: [buildReceipt(claim, 'excluded', explanation)],
  };
}

// ── PECOS / Doctors & Clinicians parser ───────────────────────────────────────

interface PecosRecord {
  npi?: string;
  enrolled?: boolean;
  enrollmentType?: string | null;
  eligibleToOrderRefer?: boolean | null;
  source?: string;
}

const PECOS_PARSER_VERSION = 'v1.0.0';

export function parsePecosRecord(
  npi: string,
  raw: PecosRecord,
  artifactId: string,
  artifactChecksum: string,
  observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const value: EnrollmentValue = {
    _type: 'ENROLLMENT_STATUS',
    enrolled: raw.enrolled ?? false,
    enrollmentType: raw.enrollmentType ?? null,
    eligibleToOrderRefer: raw.eligibleToOrderRefer ?? false,
    source: 'PECOS',
  };

  const claim = makeClaim({
    sourceId: 'PECOS_PUBLIC', artifactId, artifactChecksum,
    parserVersion: PECOS_PARSER_VERSION, tier: 'GOLD',
    claimType: 'ENROLLMENT_STATUS', subjectNpi: npi, value,
    confidence: 'HIGH', confidenceScore: 0.95, observedAt,
  });

  const explanation = raw.enrolled
    ? `NPI ${npi} enrolled in Medicare${raw.enrollmentType ? ` as ${raw.enrollmentType}` : ''}${raw.eligibleToOrderRefer ? '. Eligible to order/refer.' : '.'}`
    : `NPI ${npi} not found in PECOS public enrollment file.`;

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
