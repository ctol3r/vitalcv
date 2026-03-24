/**
 * clinicianEnrichmentGraph.ts — Clinician Identity Graph Enrichment Service
 *
 * Waves G1–G4: Maps canonical NormalizedClaim records into ClinicianEnrichmentEdge
 * objects using the graph enrichment contract from core/graph/enrichment.ts.
 *
 * This service reads from existing claim data — it does NOT make new external calls.
 * New external calls belong in the source ingestion pipeline (phase2/phase3/phase4Sources).
 *
 * Claim types mapped:
 *   INSTITUTION_AFFILIATION → G1 (CMS institutional / hospital / group)
 *   INDUSTRY_PAYMENT        → G1 (payer relationship context)
 *   CITATION_METRIC         → G3 (bibliometrics)
 *   PUBLICATION             → G3 (PubMed / OpenAlex authorship)
 *   CLINICAL_TRIAL          → G4 (ClinicalTrials.gov investigator)
 *
 * All edges are decisionGrade=false (enforced by buildEnrichmentEdge).
 * All edges carry evidenceSummary explaining the link.
 */

import {
  buildEnrichmentEdge,
  type ClinicianEnrichmentEdge,
  type ClinicianEnrichmentSummary,
  type GeographyEnrichmentContext,
  type InstitutionalEnrichmentContext,
  type ResearchEnrichmentContext,
} from '../../../../../../core/graph/enrichment';
import type { NormalizedClaim } from '../identity/evidenceModel';

// ── Parser version ─────────────────────────────────────────────────────────────

const PARSER_VERSION = 'clinician-enrichment-graph/v1';
const FRESHNESS_HOURS_DEFAULT = 720; // 30 days

// ── Type helpers ───────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const v = record[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const v = record[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ── Claim → edge mappers ────────────────────────────────────────────────────────

/**
 * G1: CMS institutional axis — maps INSTITUTION_AFFILIATION claims.
 */
function mapInstitutionAffilClaim(
  npi: string,
  claim: NormalizedClaim,
): ClinicianEnrichmentEdge[] {
  const val = asRecord(claim.value);
  const institutionName = stringField(val, 'institutionName') ?? stringField(val, 'organizationName');
  if (!institutionName) return [];

  const ccn = stringField(val, 'ccn') ?? stringField(val, 'providerId');
  const objectKey = ccn ?? institutionName.toLowerCase().replace(/\s+/g, '_').slice(0, 40);
  const institutionType = stringField(val, 'institutionType') ?? 'facility';
  const state = stringField(val, 'state');

  const isNpiKeyed = claim.sourceId === 'DOCTORS_CLINICIANS' || claim.sourceId === 'CMS_NDF';
  const confidence = isNpiKeyed ? 0.92 : 0.65;
  const status = isNpiKeyed ? 'linked_verified' : 'linked_high_confidence';
  const linkage = isNpiKeyed ? 'npi_exact' : 'name_institution';

  return [
    buildEnrichmentEdge({
      graphSourceId: claim.sourceId,
      graphSourceType: 'cms_institutional',
      subjectNodeType: 'clinician',
      subjectNodeKey: npi,
      objectNodeType: institutionType === 'hospital' ? 'hospital' : 'facility',
      objectNodeKey: objectKey,
      objectNodeLabel: institutionName,
      edgeType: institutionType === 'hospital' ? 'AFFILIATED_WITH_HOSPITAL' : 'AFFILIATED_WITH_FACILITY',
      edgeStrength: 0.8,
      edgeConfidence: confidence,
      linkageMethod: linkage as typeof linkage,
      observedAt: claim.observedAt ?? new Date().toISOString(),
      freshnessWindowHours: FRESHNESS_HOURS_DEFAULT,
      rawArtifactRef: claim.artifactId ?? null,
      checksum: claim.artifactChecksum ?? null,
      parserVersion: PARSER_VERSION,
      reviewRequired: !isNpiKeyed,
      graphStatus: status,
      evidenceSummary: `${isNpiKeyed ? 'CMS NPI-keyed' : 'Name-matched'} affiliation: ${institutionName}${state ? ` (${state})` : ''}. Source: ${claim.sourceId}.`,
      objectMeta: { ccn, state, institutionType },
    }),
  ];
}

/**
 * G1: CMS group practice axis — maps GROUP_AFFILIATION claims.
 */
function mapGroupAffilClaim(
  npi: string,
  claim: NormalizedClaim,
): ClinicianEnrichmentEdge[] {
  const val = asRecord(claim.value);
  const groupName = stringField(val, 'groupName') ?? stringField(val, 'organizationName');
  if (!groupName) return [];

  const pacId = stringField(val, 'pacId') ?? stringField(val, 'groupPacId');
  const objectKey = pacId ?? groupName.toLowerCase().replace(/\s+/g, '_').slice(0, 40);

  return [
    buildEnrichmentEdge({
      graphSourceId: claim.sourceId,
      graphSourceType: 'cms_institutional',
      subjectNodeType: 'clinician',
      subjectNodeKey: npi,
      objectNodeType: 'group_practice',
      objectNodeKey: objectKey,
      objectNodeLabel: groupName,
      edgeType: 'MEMBER_OF_GROUP_PRACTICE',
      edgeStrength: 0.75,
      edgeConfidence: 0.88,
      linkageMethod: 'npi_exact',
      observedAt: claim.observedAt ?? new Date().toISOString(),
      freshnessWindowHours: FRESHNESS_HOURS_DEFAULT,
      rawArtifactRef: claim.artifactId ?? null,
      checksum: claim.artifactChecksum ?? null,
      parserVersion: PARSER_VERSION,
      reviewRequired: false,
      graphStatus: 'linked_verified',
      evidenceSummary: `NPI-matched group practice: ${groupName}${pacId ? ` (PAC ID: ${pacId})` : ''}. Source: ${claim.sourceId}.`,
      objectMeta: { pacId },
    }),
  ];
}

/**
 * G3: Publication axis — maps PUBLICATION claims.
 */
function mapPublicationClaim(
  npi: string,
  claim: NormalizedClaim,
): ClinicianEnrichmentEdge[] {
  const val = asRecord(claim.value);
  const pmid = stringField(val, 'pmid') ?? stringField(val, 'externalId');
  const title = stringField(val, 'title') ?? 'Publication';
  const year = numberField(val, 'year');

  if (!pmid) {
    // No stable key — skip (don't create edges without object identity)
    return [];
  }

  const isOrcidConfirmed = Boolean(val.orcidConfirmed);
  const confidence = isOrcidConfirmed ? 0.95 : 0.72;
  const status = isOrcidConfirmed ? 'linked_high_confidence' : 'linked_inferred';
  const reviewRequired = !isOrcidConfirmed && claim.reviewRequired;

  return [
    buildEnrichmentEdge({
      graphSourceId: claim.sourceId,
      graphSourceType: 'publication',
      subjectNodeType: 'clinician',
      subjectNodeKey: npi,
      objectNodeType: 'publication',
      objectNodeKey: pmid,
      objectNodeLabel: title.slice(0, 120),
      edgeType: 'AUTHORED_PUBLICATION',
      edgeStrength: 0.7,
      edgeConfidence: confidence,
      linkageMethod: isOrcidConfirmed ? 'orcid_bridge' : 'name_institution',
      observedAt: claim.observedAt ?? new Date().toISOString(),
      freshnessWindowHours: 8760, // 1 year (publications are stable)
      rawArtifactRef: claim.artifactId ?? null,
      checksum: claim.artifactChecksum ?? null,
      parserVersion: PARSER_VERSION,
      reviewRequired: reviewRequired ?? false,
      graphStatus: status,
      evidenceSummary: `${isOrcidConfirmed ? 'ORCID-confirmed' : 'Name-matched'} authorship: "${title.slice(0, 80)}"${year ? ` (${year})` : ''}. PMID: ${pmid}. Source: ${claim.sourceId}.`,
      objectMeta: { pmid, year, title },
    }),
  ];
}

/**
 * G3: Bibliometrics — maps CITATION_METRIC claims.
 */
function mapCitationMetricClaim(
  npi: string,
  claim: NormalizedClaim,
): ClinicianEnrichmentEdge[] {
  const val = asRecord(claim.value);
  const hIndex = numberField(val, 'hIndex');
  const citationCount = numberField(val, 'citationCount');
  if (hIndex === null && citationCount === null) return [];

  const sourceId = stringField(val, 'openalexId') ?? stringField(val, 'authorId') ?? npi;

  return [
    buildEnrichmentEdge({
      graphSourceId: claim.sourceId,
      graphSourceType: 'bibliometric',
      subjectNodeType: 'clinician',
      subjectNodeKey: npi,
      objectNodeType: 'orcid_profile',
      objectNodeKey: `bibliometric:${sourceId}`,
      objectNodeLabel: `Publication metrics (h-index: ${hIndex ?? '?'}, citations: ${citationCount ?? '?'})`,
      edgeType: 'EXPERTISE_TOPIC',
      edgeStrength: 0.5,
      edgeConfidence: 0.65,
      linkageMethod: 'name_institution',
      observedAt: claim.observedAt ?? new Date().toISOString(),
      freshnessWindowHours: 2160,
      rawArtifactRef: claim.artifactId ?? null,
      checksum: claim.artifactChecksum ?? null,
      parserVersion: PARSER_VERSION,
      reviewRequired: claim.reviewRequired ?? false,
      graphStatus: 'linked_inferred',
      evidenceSummary: `Publication metrics from ${claim.sourceId}: h-index ${hIndex ?? 'unknown'}, ${citationCount ?? 'unknown'} total citations. Author identity inferred from name match.`,
      objectMeta: { hIndex, citationCount },
    }),
  ];
}

/**
 * G4: Clinical trials axis — maps CLINICAL_TRIAL claims.
 */
function mapClinicalTrialClaim(
  npi: string,
  claim: NormalizedClaim,
): ClinicianEnrichmentEdge[] {
  const val = asRecord(claim.value);
  const nctId = stringField(val, 'nctId') ?? stringField(val, 'externalId');
  const title = stringField(val, 'title') ?? 'Clinical Trial';
  const role = stringField(val, 'role') ?? 'investigator';
  const status = stringField(val, 'status');

  if (!nctId) return [];

  const isPI = role.toLowerCase().includes('pi') || role.toLowerCase().includes('principal');
  const edgeType = isPI ? 'PI_OF_TRIAL' as const : 'INVESTIGATOR_ON_TRIAL' as const;
  const edgeStrength = isPI ? 0.85 : 0.6;

  return [
    buildEnrichmentEdge({
      graphSourceId: claim.sourceId,
      graphSourceType: 'clinical_trial',
      subjectNodeType: 'clinician',
      subjectNodeKey: npi,
      objectNodeType: 'clinical_trial',
      objectNodeKey: nctId,
      objectNodeLabel: `${nctId}: ${title.slice(0, 80)}`,
      edgeType,
      edgeStrength,
      edgeConfidence: claim.reviewRequired ? 0.6 : 0.78,
      linkageMethod: 'nct_bridge',
      observedAt: claim.observedAt ?? new Date().toISOString(),
      freshnessWindowHours: 720,
      rawArtifactRef: claim.artifactId ?? null,
      checksum: claim.artifactChecksum ?? null,
      parserVersion: PARSER_VERSION,
      reviewRequired: claim.reviewRequired ?? false,
      graphStatus: claim.reviewRequired ? 'linked_inferred' : 'linked_high_confidence',
      evidenceSummary: `Investigator role on ${nctId} (${title.slice(0, 60)}) — role: ${role}${status ? `, status: ${status}` : ''}. Source: ${claim.sourceId}. Identity match: ${claim.reviewRequired ? 'name-based (review recommended)' : 'corroborated'}.`,
      objectMeta: { nctId, role, status, title },
    }),
  ];
}

// ── Main builder ────────────────────────────────────────────────────────────────

/**
 * Build all enrichment edges for a clinician from their claim records.
 * Pure function — no external calls, no side effects.
 *
 * @param npi     Clinician NPI
 * @param claims  All NormalizedClaims for this clinician (any type)
 */
export function buildClinicianEnrichmentEdges(
  npi: string,
  claims: NormalizedClaim[],
): ClinicianEnrichmentEdge[] {
  const edges: ClinicianEnrichmentEdge[] = [];

  for (const claim of claims) {
    if (claim.status === 'SUPERSEDED') continue;

    switch (claim.claimType) {
      case 'INSTITUTION_AFFILIATION':
        edges.push(...mapInstitutionAffilClaim(npi, claim));
        break;
      case 'GROUP_AFFILIATION':
        edges.push(...mapGroupAffilClaim(npi, claim));
        break;
      case 'PUBLICATION':
        edges.push(...mapPublicationClaim(npi, claim));
        break;
      case 'CITATION_METRIC':
        edges.push(...mapCitationMetricClaim(npi, claim));
        break;
      case 'CLINICAL_TRIAL':
        edges.push(...mapClinicalTrialClaim(npi, claim));
        break;
      default:
        // Trust-core claim types (ENROLLMENT_STATUS, LICENSE, EXCLUSION_STATUS, etc.)
        // are NOT mapped to enrichment edges. They belong in the trust-core pipeline.
        break;
    }
  }

  // De-duplicate by edgeId (same NPI + objectNodeKey + edgeType → same edge)
  const seen = new Set<string>();
  return edges.filter(e => {
    if (seen.has(e.edgeId)) return false;
    seen.add(e.edgeId);
    return true;
  });
}

// ── Summary builder ────────────────────────────────────────────────────────────

/**
 * Build a ClinicianEnrichmentSummary from edges + optional geography context.
 */
export function buildEnrichmentSummary(
  npi: string,
  edges: ClinicianEnrichmentEdge[],
  geographyContext: GeographyEnrichmentContext | null = null,
): ClinicianEnrichmentSummary {
  const counts: ClinicianEnrichmentSummary['counts'] = {};
  for (const edge of edges) {
    counts[edge.graphSourceType] = (counts[edge.graphSourceType] ?? 0) + 1;
  }

  const hasVerifiedLinks = edges.some(
    e => e.graphStatus === 'linked_verified' || e.graphStatus === 'linked_high_confidence',
  );

  // Build institutional context
  const facilityEdges = edges.filter(
    e => e.edgeType === 'AFFILIATED_WITH_FACILITY' || e.edgeType === 'AFFILIATED_WITH_HOSPITAL',
  );
  const groupEdges = edges.filter(e => e.edgeType === 'MEMBER_OF_GROUP_PRACTICE');
  const institutionalContext: InstitutionalEnrichmentContext | null =
    facilityEdges.length > 0 || groupEdges.length > 0
      ? {
          facilityAffiliations: facilityEdges.map(e => ({
            facilityName: e.objectNodeLabel,
            facilityType: (e.objectMeta?.institutionType as string) ?? null,
            ccn: (e.objectMeta?.ccn as string) ?? null,
            state: (e.objectMeta?.state as string) ?? null,
            verifiedFromCms: e.graphStatus === 'linked_verified',
          })),
          groupPracticeAffiliations: groupEdges.map(e => ({
            groupName: e.objectNodeLabel,
            pacId: (e.objectMeta?.pacId as string) ?? null,
          })),
          decisionGrade: false,
        }
      : null;

  // Build research context
  const pubEdges = edges.filter(e => e.edgeType === 'AUTHORED_PUBLICATION');
  const trialEdges = edges.filter(
    e => e.edgeType === 'PI_OF_TRIAL' || e.edgeType === 'INVESTIGATOR_ON_TRIAL',
  );
  const metricEdge = edges.find(e => e.edgeType === 'EXPERTISE_TOPIC' && e.graphSourceType === 'bibliometric');
  const now = new Date();
  const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()).toISOString();
  const recentPubs = pubEdges.filter(e => e.observedAt >= threeYearsAgo).length;

  const researchContext: ResearchEnrichmentContext | null =
    pubEdges.length > 0 || trialEdges.length > 0 || metricEdge
      ? {
          publicationCount: pubEdges.length,
          recentPublicationCount: recentPubs,
          topTopics: [],
          nihFundingActive: null,
          nihProjectCount: 0,
          clinicalTrialCount: trialEdges.length,
          clinicalTrialRoles: [...new Set(
            trialEdges.map(e => (e.objectMeta?.role as string) ?? 'investigator'),
          )],
          orcidLinked: edges.some(e => e.linkageMethod === 'orcid_bridge'),
          orcidId: null,
          decisionGrade: false,
        }
      : null;

  return {
    generatedAt: new Date().toISOString(),
    edges,
    counts,
    hasVerifiedLinks,
    geographyContext,
    researchContext,
    institutionalContext,
  };
}

// ── NPI helper ─────────────────────────────────────────────────────────────────

/**
 * Extract NPI from an array of claims (looks for NPI_IDENTITY claim type).
 */
export function extractNpiFromClaims(claims: NormalizedClaim[]): string | null {
  const npiClaim = claims.find(c => c.claimType === 'NPI_IDENTITY');
  if (!npiClaim) return null;
  const val = asRecord(npiClaim.value);
  return typeof val.npi === 'string' ? val.npi : npiClaim.subjectNpi ?? null;
}
