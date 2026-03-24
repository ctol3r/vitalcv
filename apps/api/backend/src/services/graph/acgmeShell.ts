/**
 * acgmeShell.ts — Wave G7: ACGME Training Provenance Shell
 *
 * Staged shell for ACGME-accredited residency/fellowship training provenance.
 * ACGME does NOT provide a bulk API or direct NPI-keyed lookup. Public data is
 * available through the ACGME Program Search and Sponsor Reports, but scraping
 * is fragile and programmatic access is constrained.
 *
 * DESIGN CHOICES:
 *   1. This shell is feature-flagged (ACGME_ENABLED=true required)
 *   2. All outputs are review_required by default — no production-ready NPI link
 *   3. Training data comes from: time + specialty + institution alignment inference
 *   4. This is structural staging — no real scraping in this version
 *   5. Actual training provenance lives in NPPES graduation_year / medical_school
 *      fields from CMS NDF bulk (when enabled) — this shell extends that
 *
 * To make this real: ACGME would need to provide institutional access or a
 * proper data agreement. Until then, this shell:
 *   - Defines the entity types (program, sponsor, accreditation)
 *   - Provides a safe way to store ACGME data when externally provided
 *   - Renders "training context" in the enrichment section as staged/review-only
 *
 * env flag: ACGME_ENABLED=true (disabled by default — shell only)
 */

import { buildEnrichmentEdge, type ClinicianEnrichmentEdge } from '../../../../../../core/graph/enrichment';

const PARSER_VERSION = 'acgme-shell/v1';
const FRESHNESS_HOURS = 8760; // 1 year — program status changes infrequently

// ── Types ─────────────────────────────────────────────────────────────────────

export type AcgmeProgramStatus =
  | 'continued_accreditation'
  | 'continued_accreditation_with_warning'
  | 'probationary_accreditation'
  | 'withdrawal_of_accreditation'
  | 'inactive'
  | 'unknown';

export interface AcgmeProgram {
  /** ACGME program ID (if known; null when inferred) */
  programId: string | null;
  programName: string;
  specialty: string;
  sponsorInstitution: string;
  sponsorCity: string | null;
  sponsorState: string | null;
  programStatus: AcgmeProgramStatus;
  /** Whether this program was directly observed from ACGME reports or inferred */
  sourceMethod: 'acgme_direct' | 'inferred_from_claims';
}

export interface TrainingProvenance {
  npi: string;
  /** Training records — may come from CMS NDF (medical school) + ACGME shell */
  records: AcgmeTrainingRecord[];
  /** Whether ACGME shell has any production-enabled data */
  hasProductionData: boolean;
}

export interface AcgmeTrainingRecord {
  program: AcgmeProgram;
  /** Approximate completion year — from CMS NDF graduation year or ACGME inference */
  completionYear: number | null;
  /** Whether the NPI owner was definitively linked to this program */
  npiLinked: boolean;
  confidenceScore: number;
}

// ── Inference from existing claims ────────────────────────────────────────────

/**
 * Build training provenance edges from existing CMS NDF / training claims.
 * This is what runs when ACGME_ENABLED is false — uses data we already have.
 *
 * Source: CMS NDF has graduation_year and medical_school fields.
 * Source: PRACTICE_PROFILE claims from D&C may have residency info.
 */
export function buildTrainingProvenanceEdgesFromClaims(
  npi: string,
  claims: Array<{ claimType: string; value: Record<string, unknown>; sourceId: string; observedAt?: string | null }>,
): ClinicianEnrichmentEdge[] {
  const edges: ClinicianEnrichmentEdge[] = [];
  const now = new Date().toISOString();

  for (const claim of claims) {
    if (claim.claimType !== 'TRAINING_COMPLETION') continue;

    const { programName, institution, specialty, trainingType, completionDate } = claim.value as {
      programName?: string;
      institution?: string;
      specialty?: string;
      trainingType?: string;
      completionDate?: string;
    };

    if (!institution && !programName) continue;

    const label = programName ?? `${trainingType ?? 'Training'} at ${institution}`;
    const objectKey = `training:${(institution ?? programName ?? '').toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`;

    edges.push(
      buildEnrichmentEdge({
        graphSourceId: claim.sourceId,
        graphSourceType: 'training_provenance',
        subjectNodeType: 'clinician',
        subjectNodeKey: npi,
        objectNodeType: 'training_program',
        objectNodeKey: objectKey,
        objectNodeLabel: label,
        edgeType: trainingType === 'RESIDENCY' || trainingType === 'FELLOWSHIP'
          ? 'COMPLETED_RESIDENCY'
          : 'TRAINED_AT_PROGRAM',
        edgeStrength: 0.7,
        edgeConfidence: 0.75,
        linkageMethod: 'npi_exact',
        observedAt: claim.observedAt ?? now,
        freshnessWindowHours: FRESHNESS_HOURS,
        rawArtifactRef: null,
        checksum: null,
        parserVersion: PARSER_VERSION,
        reviewRequired: false,
        graphStatus: 'linked_high_confidence',
        evidenceSummary: `Training from ${claim.sourceId}: ${label}${specialty ? ` (${specialty})` : ''}${completionDate ? `, completed ${completionDate}` : ''}. Source is CMS-verified, not ACGME direct.`,
        objectMeta: { programName, institution, specialty, trainingType, completionDate },
      }),
    );
  }

  return edges;
}

/**
 * Build ACGME edges from explicitly provided program data.
 * Only called when ACGME_ENABLED=true AND external data is provided.
 * Returns review_required edges by default — no NPI→program link is production-grade.
 */
export function buildAcgmeProgramEdges(
  npi: string,
  records: AcgmeTrainingRecord[],
): ClinicianEnrichmentEdge[] {
  if (process.env.ACGME_ENABLED !== 'true') return [];

  const edges: ClinicianEnrichmentEdge[] = [];
  const now = new Date().toISOString();

  for (const record of records) {
    const programKey = record.program.programId
      ? `acgme:${record.program.programId}`
      : `acgme-inferred:${record.program.specialty.toLowerCase().replace(/\s+/g, '-')}:${record.program.sponsorInstitution.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`;

    edges.push(
      buildEnrichmentEdge({
        graphSourceId: 'ACGME',
        graphSourceType: 'training_provenance',
        subjectNodeType: 'clinician',
        subjectNodeKey: npi,
        objectNodeType: 'training_program',
        objectNodeKey: programKey,
        objectNodeLabel: `${record.program.specialty} residency at ${record.program.sponsorInstitution}`,
        edgeType: 'TRAINED_AT_PROGRAM',
        edgeStrength: record.npiLinked ? 0.75 : 0.4,
        edgeConfidence: record.confidenceScore,
        linkageMethod: record.program.sourceMethod === 'acgme_direct' ? 'inferred_co_location' : 'name_specialty_time',
        observedAt: now,
        freshnessWindowHours: FRESHNESS_HOURS,
        rawArtifactRef: null,
        checksum: null,
        parserVersion: PARSER_VERSION,
        reviewRequired: true, // Always review_required for ACGME — no clean NPI link available
        graphStatus: record.npiLinked ? 'linked_inferred' : 'review_required',
        evidenceSummary: `ACGME ${record.program.specialty} program at ${record.program.sponsorInstitution}${record.program.sponsorState ? `, ${record.program.sponsorState}` : ''}. Program status: ${record.program.programStatus}. NPI link: ${record.npiLinked ? 'inferred' : 'not confirmed'}. ACGME data is always review_required — not decision-grade.`,
        objectMeta: {
          programId: record.program.programId,
          specialty: record.program.specialty,
          sponsorInstitution: record.program.sponsorInstitution,
          programStatus: record.program.programStatus,
          completionYear: record.completionYear,
        },
      }),
    );
  }

  return edges;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

export function isAcgmeEnabled(): boolean {
  return process.env.ACGME_ENABLED === 'true';
}

export function acgmeShellStatus(): {
  enabled: boolean;
  mode: 'production' | 'shell_only';
  note: string;
} {
  return {
    enabled: isAcgmeEnabled(),
    mode: 'shell_only',
    note: isAcgmeEnabled()
      ? 'ACGME shell active — all outputs are review_required, not decision-grade. No clean NPI→program API available.'
      : 'ACGME shell disabled (ACGME_ENABLED != true). Training provenance sourced from CMS NDF claims only.',
  };
}
