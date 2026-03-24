/**
 * core/graph/enrichment.ts — Canonical Clinician Enrichment Graph Contract
 *
 * Wave G0: Defines the one enrichment edge shape that every graph connector
 * must produce. Enrichment edges are ALWAYS non-decision-grade by design.
 *
 * SEPARATION RULE:
 *   Trust-core claim  → produced by canonical NormalizedClaim/VerificationReceipt pipeline
 *   Graph enrichment  → produced here; subordinate to trust-core; never overrides readiness
 *   Aggregate context → produced by market/workforce overlays; no individual linkage implied
 *
 * Every edge must carry:
 *   - Explicit graphStatus (not silently "active")
 *   - decisionGrade: false (enforced — enrichment cannot gate readiness)
 *   - reviewRequired flag if identity link is ambiguous
 *   - evidenceSummary explaining why the link exists
 */

// ── Graph source taxonomy ──────────────────────────────────────────────────────

export const GRAPH_SOURCE_TYPES = [
  'cms_institutional',     // CMS D&C affiliations, group/hospital links
  'nih_funding',           // NIH RePORTER/ExPORTER grants and projects
  'publication',           // PubMed / OpenAlex authorship
  'bibliometric',          // iCite / OpenAlex citation metrics
  'clinical_trial',        // ClinicalTrials.gov investigator roles
  'orcid_academic',        // ORCID employment/education/works bridge
  'geography_workforce',   // HRSA AHRF/HPSA geographic/workforce context
  'training_provenance',   // ACGME program shell (staged)
  'aggregate_market',      // NRMP/AAMC specialty aggregate overlays
] as const;

export type GraphSourceType = (typeof GRAPH_SOURCE_TYPES)[number];

// ── Graph status ───────────────────────────────────────────────────────────────

/**
 * graphStatus describes the reliability and provenance quality of an edge.
 *
 * Only linked_verified and linked_high_confidence are suitable for display in
 * employer-facing surfaces without a "unverified / inferred" label.
 */
export const GRAPH_ENRICHMENT_STATUSES = [
  /** Source explicitly confirmed the link (e.g., CMS NPI→affiliation exact match). */
  'linked_verified',
  /** Strong corroboration from multiple keys (name + institution + specialty + time). */
  'linked_high_confidence',
  /** Single-key or name-only match — shown as "inferred" in UI. */
  'linked_inferred',
  /** Multiple possible matches — shown as "unresolved" — requires human review. */
  'review_required',
  /** Previously linked but data is past freshness window. */
  'stale',
  /** Source is registered but not enabled/configured. */
  'unavailable',
  /** Source requires contract/credential to access. */
  'access_required',
  /** This edge is explicitly non-decision-grade (all enrichment edges). */
  'not_decision_grade',
] as const;

export type GraphEnrichmentStatus = (typeof GRAPH_ENRICHMENT_STATUSES)[number];

// ── Edge types ─────────────────────────────────────────────────────────────────

export const ENRICHMENT_EDGE_TYPES = [
  // Institutional
  'AFFILIATED_WITH_FACILITY',
  'MEMBER_OF_GROUP_PRACTICE',
  'AFFILIATED_WITH_HOSPITAL',
  // Funding
  'FUNDED_AS_PI',
  'FUNDED_AS_CO_PI',
  'AFFILIATED_WITH_FUNDED_INSTITUTION',
  // Publication
  'AUTHORED_PUBLICATION',
  'CITED_BY',
  'EXPERTISE_TOPIC',
  // Clinical trial
  'PI_OF_TRIAL',
  'INVESTIGATOR_ON_TRIAL',
  'STUDY_SITE_AFFILIATED',
  // Academic identity
  'ORCID_IDENTITY_BRIDGE',
  'EMPLOYED_AT_INSTITUTION',
  // Geographic
  'PRACTICES_IN_SHORTAGE_AREA',
  'PRACTICES_IN_COUNTY',
  'PRACTICES_IN_RURAL_AREA',
  // Training
  'TRAINED_AT_PROGRAM',
  'COMPLETED_RESIDENCY',
  // Aggregate context (never links to individual — attaches to specialty/geography)
  'SPECIALTY_MARKET_CONTEXT',
  'WORKFORCE_PRESSURE_CONTEXT',
] as const;

export type EnrichmentEdgeType = (typeof ENRICHMENT_EDGE_TYPES)[number];

// ── Linkage method ─────────────────────────────────────────────────────────────

export const LINKAGE_METHODS = [
  'npi_exact',           // NPI matched directly in source
  'npi_plus_name',       // NPI + name corroboration
  'name_institution',    // name + institution match (no NPI in source)
  'name_specialty_time', // name + specialty + time window overlap
  'orcid_bridge',        // ORCID iD explicitly links two records
  'nih_id_bridge',       // NIH PI profile ID links two records
  'pmid_bridge',         // PMID authorship links person to publication
  'nct_bridge',          // NCT ID links person to trial
  'zip_county_lookup',   // address field → geographic zone lookup
  'inferred_co_location',// institution + specialty + time → probable link
  'aggregate_only',      // aggregate data — no individual linkage
] as const;

export type LinkageMethod = (typeof LINKAGE_METHODS)[number];

// ── Node types in the enrichment graph ────────────────────────────────────────

export const ENRICHMENT_NODE_TYPES = [
  'clinician',           // NPI-keyed clinician (subject)
  'facility',            // CCN or NPI-keyed facility
  'group_practice',      // PAC ID or NPI-keyed group
  'hospital',            // CCN-keyed hospital
  'nih_project',         // NIH project number
  'publication',         // PMID
  'clinical_trial',      // NCT ID
  'journal',             // ISSN or journal name
  'institution',         // ROR ID or name-keyed academic institution
  'orcid_profile',       // ORCID iD
  'geographic_zone',     // FIPS county, HPSA ID, zip, state
  'training_program',    // ACGME program ID
  'specialty_bucket',    // NPPES taxonomy code or CMS specialty
  'topic_cluster',       // MeSH term or inferred topic cluster
] as const;

export type EnrichmentNodeType = (typeof ENRICHMENT_NODE_TYPES)[number];

// ── Core edge contract ─────────────────────────────────────────────────────────

/**
 * ClinicianEnrichmentEdge — the canonical output of every graph enrichment connector.
 *
 * Non-negotiable invariants:
 *   - decisionGrade MUST be false (enrichment never gates readiness)
 *   - graphStatus must be set explicitly (no silent "active" default)
 *   - evidenceSummary must explain why the link was made
 *   - linkageMethod must describe HOW the link was established
 */
export interface ClinicianEnrichmentEdge {
  /** Stable deterministic edge ID (sha256 of source+subject+object+edgeType). */
  edgeId: string;

  /** Which graph source produced this edge. */
  graphSourceId: string;
  graphSourceType: GraphSourceType;

  /** Subject is always the clinician, keyed by NPI. */
  subjectNodeType: 'clinician';
  subjectNodeKey: string; // NPI

  /** Object is what the clinician is linked to. */
  objectNodeType: EnrichmentNodeType;
  /** Stable key for the object — PMID, NCT ID, CCN, FIPS, ORCID, etc. */
  objectNodeKey: string;
  /** Human-readable label for the object. */
  objectNodeLabel: string;

  edgeType: EnrichmentEdgeType;

  /**
   * Edge strength 0–1.
   * Used for ranking/display priority, not trust gating.
   * 1.0 = directly observed from NPI-keyed source
   * 0.5 = inferred from corroborating signals
   * 0.2 = speculative / aggregate
   */
  edgeStrength: number;

  /**
   * Confidence in the subject↔object identity link 0–1.
   * Distinct from edge strength:
   *   strength = how important is the relationship?
   *   confidence = how sure are we the clinician IS the object person?
   */
  edgeConfidence: number;

  linkageMethod: LinkageMethod;

  /** ISO 8601 timestamp when this edge was observed. */
  observedAt: string;

  /** Hours before this edge is considered stale (from source's refreshCadence). */
  freshnessWindowHours: number;

  /** Reference to the raw artifact that produced this edge. May be null for aggregate edges. */
  rawArtifactRef: string | null;

  /** SHA-256 checksum of the raw artifact payload. Null for aggregate edges. */
  checksum: string | null;

  parserVersion: string;

  /**
   * Whether this edge requires human review before being shown to employers.
   * reviewRequired=true → show "unverified link" label in UI.
   */
  reviewRequired: boolean;

  /**
   * ENFORCED FALSE. Enrichment edges never influence readiness decisions.
   * This field exists so rendering code can assert it explicitly.
   */
  readonly decisionGrade: false;

  graphStatus: GraphEnrichmentStatus;

  /** Stable, human-readable explanation of why this edge exists. */
  evidenceSummary: string;

  /** Optional structured metadata for the object node (display use only). */
  objectMeta?: Record<string, unknown>;
}

// ── Edge builder helper ────────────────────────────────────────────────────────

import { createHash } from 'crypto';

function enrichmentEdgeId(
  graphSourceId: string,
  subjectNpi: string,
  objectNodeKey: string,
  edgeType: EnrichmentEdgeType,
): string {
  return createHash('sha256')
    .update(`${graphSourceId}:${subjectNpi}:${objectNodeKey}:${edgeType}`)
    .digest('hex')
    .slice(0, 32);
}

export function buildEnrichmentEdge(
  input: Omit<ClinicianEnrichmentEdge, 'edgeId' | 'decisionGrade'>,
): ClinicianEnrichmentEdge {
  return {
    ...input,
    edgeId: enrichmentEdgeId(
      input.graphSourceId,
      input.subjectNodeKey,
      input.objectNodeKey,
      input.edgeType,
    ),
    decisionGrade: false,
  };
}

// ── Enrichment summary ─────────────────────────────────────────────────────────

/**
 * ClinicianEnrichmentSummary — rolled-up enrichment for a single clinician.
 * Intended to be added as an optional field on TrustPassport.
 * Adding it does NOT change readiness semantics.
 */
export interface ClinicianEnrichmentSummary {
  generatedAt: string;
  /** All enrichment edges for this clinician, across all graph axes. */
  edges: ClinicianEnrichmentEdge[];
  /** Counts by graphSourceType for quick display. */
  counts: Partial<Record<GraphSourceType, number>>;
  /** Whether any enrichment axis has high-confidence verified links. */
  hasVerifiedLinks: boolean;
  /** Geographic/workforce context if available. */
  geographyContext: GeographyEnrichmentContext | null;
  /** Research/publication summary if available. */
  researchContext: ResearchEnrichmentContext | null;
  /** Institutional affiliation summary if available. */
  institutionalContext: InstitutionalEnrichmentContext | null;
}

export interface GeographyEnrichmentContext {
  practiceCountyFips: string | null;
  practiceState: string | null;
  hpsaDesignated: boolean | null;
  hpsaId: string | null;
  hpsaScore: number | null;
  ruralUrbanCode: string | null;
  workforcePressureLabel: string | null;
  dataAsOf: string | null;
  /** Always non-decision-grade. */
  readonly decisionGrade: false;
}

export interface ResearchEnrichmentContext {
  publicationCount: number;
  recentPublicationCount: number; // last 3 years
  topTopics: string[];
  nihFundingActive: boolean | null;
  nihProjectCount: number;
  clinicalTrialCount: number;
  clinicalTrialRoles: string[];
  orcidLinked: boolean;
  orcidId: string | null;
  /** Always non-decision-grade. */
  readonly decisionGrade: false;
}

export interface InstitutionalEnrichmentContext {
  facilityAffiliations: Array<{
    facilityName: string;
    facilityType: string | null;
    ccn: string | null;
    state: string | null;
    verifiedFromCms: boolean;
  }>;
  groupPracticeAffiliations: Array<{
    groupName: string;
    pacId: string | null;
  }>;
  /** Always non-decision-grade. */
  readonly decisionGrade: false;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

export function isDecisionGradeStatus(status: GraphEnrichmentStatus): false {
  // Enrichment edges are NEVER decision-grade — this function enforces that invariant.
  void status; // suppress unused warning
  return false;
}

export function enrichmentStatusLabel(status: GraphEnrichmentStatus): string {
  switch (status) {
    case 'linked_verified':         return 'Verified linkage';
    case 'linked_high_confidence':  return 'High-confidence linkage';
    case 'linked_inferred':         return 'Inferred linkage — not independently verified';
    case 'review_required':         return 'Unresolved — human review required';
    case 'stale':                   return 'Stale — data past freshness window';
    case 'unavailable':             return 'Source not available';
    case 'access_required':         return 'Source requires access credentials';
    case 'not_decision_grade':      return 'Contextual — not decision-grade';
  }
}

export function shouldShowToEmployer(edge: ClinicianEnrichmentEdge): boolean {
  return (
    edge.graphStatus === 'linked_verified'
    || edge.graphStatus === 'linked_high_confidence'
    || edge.graphStatus === 'linked_inferred'
  ) && !edge.reviewRequired;
}
