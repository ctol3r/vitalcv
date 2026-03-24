/**
 * nihFundingGraph.ts — Wave G2: NIH Funding Axis
 *
 * Connects clinicians to NIH funding records via the NIH RePORTER public API.
 * All outputs are NON-DECISION-GRADE enrichment — funding history does not
 * imply active practice, licensure, or board certification.
 *
 * Sources:
 *   NIH RePORTER API v2: https://api.reporter.nih.gov/v2/projects/search
 *   Free, no API key, rate-limited at 3 req/sec.
 *   Identity anchor: PI name search — NOT NPI-keyed (NIH has no NPI field).
 *
 * Confidence rules:
 *   - Name + institution match from NPPES claim → linked_high_confidence
 *   - Name match only → linked_inferred + reviewRequired
 *   - Name match + ORCID corroboration → linked_verified
 *
 * env flag: NIH_REPORTER_ENABLED=true
 */

import { buildEnrichmentEdge, type ClinicianEnrichmentEdge } from '../../../../../../core/graph/enrichment';
import type { NormalizedClaim } from '../identity/evidenceModel';
import { log } from '../../obs/logger';

const NIH_REPORTER_URL = 'https://api.reporter.nih.gov/v2/projects/search';
const PARSER_VERSION = 'nih-funding-graph/v1';
const FRESHNESS_HOURS = 8760; // 1 year — grant records are stable

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NihProject {
  projectNumber: string;
  title: string;
  fiscalYear: number | null;
  startDate: string | null;
  endDate: string | null;
  totalCost: number | null;
  organizationName: string | null;
  piFirstName: string | null;
  piLastName: string | null;
  abstractText: string | null;
  activityCode: string | null; // R01, K99, T32, etc.
  orcidId: string | null;
  appId: number;
}

interface RawNihProject {
  project_num?: string;
  project_title?: string;
  fiscal_year?: number;
  project_start_date?: string;
  project_end_date?: string;
  award_amount?: number;
  organization?: { org_name?: string };
  principal_investigators?: Array<{
    first_name?: string;
    last_name?: string;
    is_contact_pi?: boolean;
    orcid_id?: string | null;
  }>;
  abstract_text?: string;
  activity_code?: string;
  appl_id?: number;
}

// ── Fetch + parse ─────────────────────────────────────────────────────────────

export async function fetchNihProjectsForPi(
  firstName: string,
  lastName: string,
  timeoutMs = 15_000,
): Promise<NihProject[]> {
  if (process.env.NIH_REPORTER_ENABLED !== 'true') return [];

  const body = JSON.stringify({
    criteria: {
      pi_names: [{ first_name: firstName, last_name: lastName }],
    },
    include_fields: [
      'ProjectNum', 'ProjectTitle', 'FiscalYear', 'ProjectStartDate',
      'ProjectEndDate', 'AwardAmount', 'Organization', 'PrincipalInvestigators',
      'AbstractText', 'ActivityCode', 'ApplId',
    ],
    limit: 50,
    offset: 0,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(NIH_REPORTER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body,
      signal: controller.signal,
    });

    if (!resp.ok) {
      log('warn', 'nih_reporter_fetch_failed', { status: resp.status, firstName, lastName });
      return [];
    }

    const data = await resp.json() as { results?: RawNihProject[] };
    return (data.results ?? []).map(parseNihProject).filter((p): p is NihProject => p !== null);
  } catch (err) {
    log('warn', 'nih_reporter_fetch_error', { error: String(err) });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function parseNihProject(raw: RawNihProject): NihProject | null {
  if (!raw.project_num) return null;
  const contactPi = (raw.principal_investigators ?? []).find(pi => pi.is_contact_pi) ?? raw.principal_investigators?.[0];
  return {
    projectNumber: raw.project_num,
    title: raw.project_title ?? '',
    fiscalYear: raw.fiscal_year ?? null,
    startDate: raw.project_start_date ?? null,
    endDate: raw.project_end_date ?? null,
    totalCost: raw.award_amount ?? null,
    organizationName: raw.organization?.org_name ?? null,
    piFirstName: contactPi?.first_name ?? null,
    piLastName: contactPi?.last_name ?? null,
    abstractText: raw.abstract_text ?? null,
    activityCode: raw.activity_code ?? null,
    orcidId: contactPi?.orcid_id ?? null,
    appId: raw.appl_id ?? 0,
  };
}

// ── Edge builder ──────────────────────────────────────────────────────────────

export function buildNihFundingEdges(
  npi: string,
  projects: NihProject[],
  nppesClaims: NormalizedClaim[],
  orcidId: string | null = null,
): ClinicianEnrichmentEdge[] {
  const edges: ClinicianEnrichmentEdge[] = [];

  // Get NPI-verified institution name for confidence boosting
  const nppesInstitution = extractNppesInstitutionName(nppesClaims);
  const now = new Date().toISOString();

  for (const project of projects) {
    // Determine confidence based on available corroborating signals
    const orcidMatch = orcidId && project.orcidId && orcidId === project.orcidId;
    const institutionMatch =
      nppesInstitution &&
      project.organizationName &&
      normalizeOrgName(project.organizationName).includes(normalizeOrgName(nppesInstitution));

    const confidence = orcidMatch ? 0.97 : institutionMatch ? 0.82 : 0.58;
    const graphStatus = orcidMatch
      ? 'linked_verified'
      : institutionMatch
        ? 'linked_high_confidence'
        : 'linked_inferred';
    const reviewRequired = confidence < 0.7;

    const isActive = project.endDate ? new Date(project.endDate) > new Date() : project.fiscalYear === new Date().getFullYear();
    const edgeStrength = isActive ? 0.85 : 0.55;

    edges.push(
      buildEnrichmentEdge({
        graphSourceId: 'NIH_REPORTER',
        graphSourceType: 'nih_funding',
        subjectNodeType: 'clinician',
        subjectNodeKey: npi,
        objectNodeType: 'nih_project',
        objectNodeKey: project.projectNumber,
        objectNodeLabel: `${project.activityCode ?? 'GRANT'} ${project.projectNumber}: ${project.title.slice(0, 80)}`,
        edgeType: 'FUNDED_AS_PI',
        edgeStrength,
        edgeConfidence: confidence,
        linkageMethod: orcidMatch ? 'orcid_bridge' : institutionMatch ? 'name_institution' : 'name_institution',
        observedAt: now,
        freshnessWindowHours: FRESHNESS_HOURS,
        rawArtifactRef: null,
        checksum: null,
        parserVersion: PARSER_VERSION,
        reviewRequired,
        graphStatus,
        evidenceSummary: `NIH ${project.activityCode ?? 'grant'} ${project.projectNumber} (${project.fiscalYear ?? 'FY?'}): "${project.title.slice(0, 60)}". ${institutionMatch ? `Institution "${project.organizationName}" corroborates NPI address.` : 'Institution not corroborated with NPPES data.'} ${orcidMatch ? 'ORCID confirmed.' : ''} ${isActive ? 'Active funding.' : 'Historical funding.'}`,
        objectMeta: {
          projectNumber: project.projectNumber,
          activityCode: project.activityCode,
          fiscalYear: project.fiscalYear,
          totalCost: project.totalCost,
          isActive,
          organizationName: project.organizationName,
        },
      }),
    );
  }

  return edges;
}

function extractNppesInstitutionName(claims: NormalizedClaim[]): string | null {
  const affil = claims.find(c => c.claimType === 'INSTITUTION_AFFILIATION' && c.sourceId.startsWith('NPPES'));
  if (!affil) return null;
  const val = affil.value as Record<string, unknown>;
  return typeof val.institutionName === 'string' ? val.institutionName : null;
}

function normalizeOrgName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
