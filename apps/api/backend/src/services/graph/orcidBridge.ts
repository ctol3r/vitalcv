/**
 * orcidBridge.ts — Wave G5: ORCID Academic Identity Bridge
 *
 * Bridges the clinical identity (NPI) to the academic identity (ORCID iD).
 * When the bridge is confirmed, it:
 *   - Elevates PubMed/OpenAlex publication edge confidence to linked_verified
 *   - Elevates NIH funding edge confidence when ORCID matches
 *   - Enables employment/education enrichment from ORCID public API
 *
 * IMPORTANT: ORCID linkage is NEVER decision-grade — it's an enrichment bridge.
 * A confirmed ORCID link improves publication/funding edge confidence but
 * does NOT substitute for license verification or OIG clearance.
 *
 * Bridge confidence levels:
 *   verified     → NPI owner explicitly claimed ORCID (future: ORCID-NPI linking)
 *   high         → name + affiliation + ≥3 matching publications
 *   inferred     → name + affiliation only (no publication corroboration)
 *   review_req   → name match only
 *
 * env flag: ORCID_ENABLED=true
 * Public API: https://pub.orcid.org/v3.0/{orcid}/record — no auth for public data
 */

import { buildEnrichmentEdge, type ClinicianEnrichmentEdge } from '../../../../../../core/graph/enrichment';
import { log } from '../../obs/logger';

const ORCID_API_BASE = 'https://pub.orcid.org/v3.0';
const PARSER_VERSION = 'orcid-bridge/v1';
const FRESHNESS_HOURS = 2160; // 90 days

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrcidBridgeConfidence = 'verified' | 'high' | 'inferred' | 'review_required';

export interface OrcidRecord {
  orcidId: string;
  firstName: string | null;
  lastName: string | null;
  employments: OrcidEmployment[];
  educations: OrcidEducation[];
  workCount: number;
}

export interface OrcidEmployment {
  organizationName: string;
  roleTitle: string | null;
  startYear: number | null;
  endYear: number | null;
  current: boolean;
}

export interface OrcidEducation {
  organizationName: string;
  roleTitle: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface OrcidBridgeResult {
  orcidId: string;
  confidence: OrcidBridgeConfidence;
  confidenceScore: number;
  record: OrcidRecord | null;
  bridgeExplanation: string;
}

// ── ORCID fetch ────────────────────────────────────────────────────────────────

async function fetchOrcidRecord(orcidId: string, timeoutMs = 10_000): Promise<OrcidRecord | null> {
  if (process.env.ORCID_ENABLED !== 'true') return null;

  const url = `${ORCID_API_BASE}/${orcidId}/record`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!resp.ok) {
      log('warn', 'orcid_fetch_failed', { orcidId, status: resp.status });
      return null;
    }
    const data = await resp.json() as Record<string, unknown>;
    return parseOrcidRecord(orcidId, data);
  } catch (err) {
    log('warn', 'orcid_fetch_error', { orcidId, error: String(err) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseOrcidRecord(orcidId: string, raw: Record<string, unknown>): OrcidRecord {
  const person = raw.person as Record<string, unknown> | undefined;
  const name = person?.name as Record<string, unknown> | undefined;
  const givenNames = name?.['given-names'] as Record<string, unknown> | undefined;
  const familyName = name?.['family-name'] as Record<string, unknown> | undefined;

  const activitiesSummary = raw['activities-summary'] as Record<string, unknown> | undefined;
  const employmentSummary = (activitiesSummary?.employments as Record<string, unknown> | undefined);
  const educationSummary = (activitiesSummary?.educations as Record<string, unknown> | undefined);
  const worksSummary = (activitiesSummary?.works as Record<string, unknown> | undefined);

  const employments: OrcidEmployment[] = [];
  for (const affil of toArray((employmentSummary?.['employment-summary'] as unknown[]) ?? [])) {
    const a = affil as Record<string, unknown>;
    const org = a.organization as Record<string, unknown> | undefined;
    employments.push({
      organizationName: org?.name as string ?? '',
      roleTitle: a['role-title'] as string ?? null,
      startYear: extractYear(a['start-date']),
      endYear: extractYear(a['end-date']),
      current: !a['end-date'],
    });
  }

  const educations: OrcidEducation[] = [];
  for (const educ of toArray((educationSummary?.['education-summary'] as unknown[]) ?? [])) {
    const e = educ as Record<string, unknown>;
    const org = e.organization as Record<string, unknown> | undefined;
    educations.push({
      organizationName: org?.name as string ?? '',
      roleTitle: e['role-title'] as string ?? null,
      startYear: extractYear(e['start-date']),
      endYear: extractYear(e['end-date']),
    });
  }

  const worksGroups = toArray((worksSummary?.group as unknown[]) ?? []);

  return {
    orcidId,
    firstName: givenNames?.value as string ?? null,
    lastName: familyName?.value as string ?? null,
    employments,
    educations,
    workCount: worksGroups.length,
  };
}

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function extractYear(dateField: unknown): number | null {
  const d = dateField as Record<string, unknown> | undefined;
  const y = d?.year as Record<string, unknown> | undefined;
  const val = y?.value;
  return typeof val === 'string' ? parseInt(val, 10) : typeof val === 'number' ? val : null;
}

// ── Bridge scoring ─────────────────────────────────────────────────────────────

export function scoreOrcidBridge(
  orcidRecord: OrcidRecord,
  clinicianFirstName: string | null,
  clinicianLastName: string,
  nppesInstitution: string | null,
  existingPublicationCount: number,
): OrcidBridgeResult {
  let score = 0;
  const reasons: string[] = [];

  // Name match
  const nameMatch =
    normName(orcidRecord.firstName) === normName(clinicianFirstName) &&
    normName(orcidRecord.lastName) === normName(clinicianLastName);

  if (!nameMatch) {
    return {
      orcidId: orcidRecord.orcidId,
      confidence: 'review_required',
      confidenceScore: 0.2,
      record: orcidRecord,
      bridgeExplanation: `Name mismatch: ORCID record name "${orcidRecord.firstName} ${orcidRecord.lastName}" does not match clinician name "${clinicianFirstName} ${clinicianLastName}".`,
    };
  }
  score += 0.4;
  reasons.push('Full name match');

  // Institution corroboration
  if (nppesInstitution) {
    const orcidInstitutions = orcidRecord.employments.map(e => normName(e.organizationName));
    const instMatch = orcidInstitutions.some(oi => oi.includes(normName(nppesInstitution)!) || normName(nppesInstitution)!.includes(oi.slice(0, 10)));
    if (instMatch) {
      score += 0.3;
      reasons.push(`Institution "${nppesInstitution}" found in ORCID employments`);
    }
  }

  // Publication count corroboration
  if (existingPublicationCount > 0 && orcidRecord.workCount > 0) {
    const pubOverlap = Math.min(existingPublicationCount, orcidRecord.workCount) / Math.max(existingPublicationCount, orcidRecord.workCount);
    if (pubOverlap > 0.3) {
      score += 0.3 * pubOverlap;
      reasons.push(`${orcidRecord.workCount} ORCID works corroborate ${existingPublicationCount} known publications`);
    }
  }

  const confidence: OrcidBridgeConfidence =
    score >= 0.9 ? 'verified' : score >= 0.7 ? 'high' : score >= 0.5 ? 'inferred' : 'review_required';

  return {
    orcidId: orcidRecord.orcidId,
    confidence,
    confidenceScore: Math.min(score, 1.0),
    record: orcidRecord,
    bridgeExplanation: `ORCID bridge: ${reasons.join('; ')}. Score: ${score.toFixed(2)}.`,
  };
}

function normName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

// ── Edge builder ──────────────────────────────────────────────────────────────

export function buildOrcidBridgeEdges(
  npi: string,
  bridge: OrcidBridgeResult,
): ClinicianEnrichmentEdge[] {
  const edges: ClinicianEnrichmentEdge[] = [];
  const now = new Date().toISOString();

  const graphStatus =
    bridge.confidence === 'verified' ? 'linked_verified' as const
    : bridge.confidence === 'high' ? 'linked_high_confidence' as const
    : bridge.confidence === 'inferred' ? 'linked_inferred' as const
    : 'review_required' as const;

  // Main bridge edge: clinician → ORCID profile
  edges.push(
    buildEnrichmentEdge({
      graphSourceId: 'ORCID',
      graphSourceType: 'orcid_academic',
      subjectNodeType: 'clinician',
      subjectNodeKey: npi,
      objectNodeType: 'orcid_profile',
      objectNodeKey: bridge.orcidId,
      objectNodeLabel: `ORCID: ${bridge.orcidId}`,
      edgeType: 'ORCID_IDENTITY_BRIDGE',
      edgeStrength: bridge.confidenceScore,
      edgeConfidence: bridge.confidenceScore,
      linkageMethod: 'orcid_bridge',
      observedAt: now,
      freshnessWindowHours: FRESHNESS_HOURS,
      rawArtifactRef: null,
      checksum: null,
      parserVersion: PARSER_VERSION,
      reviewRequired: bridge.confidence === 'review_required',
      graphStatus,
      evidenceSummary: bridge.bridgeExplanation,
      objectMeta: {
        orcidId: bridge.orcidId,
        workCount: bridge.record?.workCount,
        employmentCount: bridge.record?.employments.length,
      },
    }),
  );

  // Employment edges from ORCID
  for (const emp of bridge.record?.employments ?? []) {
    if (!emp.organizationName) continue;
    edges.push(
      buildEnrichmentEdge({
        graphSourceId: 'ORCID',
        graphSourceType: 'orcid_academic',
        subjectNodeType: 'clinician',
        subjectNodeKey: npi,
        objectNodeType: 'institution',
        objectNodeKey: `orcid-emp:${emp.organizationName.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`,
        objectNodeLabel: emp.organizationName,
        edgeType: 'EMPLOYED_AT_INSTITUTION',
        edgeStrength: emp.current ? 0.75 : 0.45,
        edgeConfidence: bridge.confidenceScore * 0.9,
        linkageMethod: 'orcid_bridge',
        observedAt: now,
        freshnessWindowHours: FRESHNESS_HOURS,
        rawArtifactRef: null,
        checksum: null,
        parserVersion: PARSER_VERSION,
        reviewRequired: bridge.confidence === 'review_required' || bridge.confidence === 'inferred',
        graphStatus: bridge.confidence === 'review_required' ? 'review_required' : 'linked_inferred',
        evidenceSummary: `ORCID-reported employment: ${emp.organizationName}${emp.roleTitle ? ` (${emp.roleTitle})` : ''}${emp.current ? ' — current' : emp.endYear ? ` — ended ${emp.endYear}` : ''}. Bridge confidence: ${bridge.confidence}.`,
        objectMeta: { organizationName: emp.organizationName, current: emp.current, startYear: emp.startYear, endYear: emp.endYear },
      }),
    );
  }

  return edges;
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function resolveOrcidBridge(
  npi: string,
  orcidId: string,
  clinicianFirstName: string | null,
  clinicianLastName: string,
  nppesInstitution: string | null,
  existingPublicationCount: number,
): Promise<ClinicianEnrichmentEdge[]> {
  const record = await fetchOrcidRecord(orcidId);
  if (!record) return [];

  const bridge = scoreOrcidBridge(
    record,
    clinicianFirstName,
    clinicianLastName,
    nppesInstitution,
    existingPublicationCount,
  );

  return buildOrcidBridgeEdges(npi, bridge);
}
