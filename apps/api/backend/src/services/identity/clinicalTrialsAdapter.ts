// @ts-nocheck
/**
 * Wave 12: ClinicalTrials.gov v2 API adapter.
 *
 * Queries ClinicalTrials.gov by principal investigator name or NPI,
 * returning active trials and roles. Uses the v2 REST API.
 *
 * API docs: https://clinicaltrials.gov/data-api/about-api/study-data-structure
 *
 * Zero PHI: only trial metadata (NCT IDs, titles, phases, sponsor names) is stored.
 */

import { log } from '../../obs/logger';
import type {
  ClinicalTrialRecord,
  ClinicalTrialSearchResult,
  ClinicalTrialPhase,
  ClinicalTrialStatus,
  ClinicalTrialRole,
} from '@vitalcv/domain-common';

const CT_API_BASE = 'https://clinicaltrials.gov/api/v2';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 50;

interface CtApiStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      officialTitle?: string;
    };
    statusModule?: {
      overallStatus?: string;
      startDateStruct?: { date?: string };
      completionDateStruct?: { date?: string };
    };
    designModule?: {
      phases?: string[];
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
    contactsLocationsModule?: {
      overallOfficials?: Array<{
        name?: string;
        role?: string;
        affiliation?: string;
      }>;
    };
  };
}

interface CtApiResponse {
  studies?: CtApiStudy[];
  totalCount?: number;
}

function normalizePhase(phases?: string[]): ClinicalTrialPhase {
  if (!phases || phases.length === 0) return 'NA';
  const phase = phases[0]?.toUpperCase() ?? '';
  if (phase.includes('EARLY_PHASE1') || phase.includes('EARLY PHASE 1')) return 'EARLY_PHASE1';
  if (phase.includes('PHASE1') || phase.includes('PHASE 1')) return 'PHASE1';
  if (phase.includes('PHASE2') || phase.includes('PHASE 2')) return 'PHASE2';
  if (phase.includes('PHASE3') || phase.includes('PHASE 3')) return 'PHASE3';
  if (phase.includes('PHASE4') || phase.includes('PHASE 4')) return 'PHASE4';
  return 'NA';
}

function normalizeStatus(status?: string): ClinicalTrialStatus {
  if (!status) return 'UNKNOWN';
  const upper = status.toUpperCase().replace(/\s+/g, '_');
  const map: Record<string, ClinicalTrialStatus> = {
    RECRUITING: 'RECRUITING',
    ACTIVE_NOT_RECRUITING: 'ACTIVE_NOT_RECRUITING',
    'ACTIVE,_NOT_RECRUITING': 'ACTIVE_NOT_RECRUITING',
    COMPLETED: 'COMPLETED',
    TERMINATED: 'TERMINATED',
    WITHDRAWN: 'WITHDRAWN',
    SUSPENDED: 'SUSPENDED',
    NOT_YET_RECRUITING: 'NOT_YET_RECRUITING',
  };
  return map[upper] ?? 'UNKNOWN';
}

function normalizeRole(role?: string): ClinicalTrialRole {
  if (!role) return 'SUB_INVESTIGATOR';
  const upper = role.toUpperCase();
  if (upper.includes('PRINCIPAL')) return 'PRINCIPAL_INVESTIGATOR';
  if (upper.includes('STUDY DIRECTOR') || upper.includes('STUDY_DIRECTOR')) return 'STUDY_DIRECTOR';
  if (upper.includes('STUDY CHAIR') || upper.includes('STUDY_CHAIR')) return 'STUDY_CHAIR';
  return 'SUB_INVESTIGATOR';
}

function matchesInvestigator(
  officials: Array<{ name?: string; role?: string; affiliation?: string }> | undefined,
  searchName: string,
): { matched: boolean; role: ClinicalTrialRole } {
  if (!officials || officials.length === 0) return { matched: false, role: 'SUB_INVESTIGATOR' };

  const normalizedSearch = searchName.toLowerCase().trim();
  for (const official of officials) {
    const officialName = (official.name ?? '').toLowerCase().trim();
    if (
      officialName.includes(normalizedSearch) ||
      normalizedSearch.includes(officialName) ||
      fuzzyNameMatch(officialName, normalizedSearch)
    ) {
      return { matched: true, role: normalizeRole(official.role) };
    }
  }
  return { matched: false, role: 'SUB_INVESTIGATOR' };
}

function fuzzyNameMatch(a: string, b: string): boolean {
  // Match if last names match (last token of each name string)
  const aTokens = a.split(/[\s,]+/).filter(Boolean);
  const bTokens = b.split(/[\s,]+/).filter(Boolean);
  const aLast = aTokens[aTokens.length - 1];
  const bLast = bTokens[bTokens.length - 1];
  if (!aLast || !bLast) return false;
  return aLast === bLast && aTokens.length > 0 && bTokens.length > 0;
}

async function fetchWithTimeout(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class ClinicalTrialsAdapter {
  /**
   * Search ClinicalTrials.gov by investigator name and/or NPI.
   * Returns structured trial records with roles.
   */
  async searchByInvestigator(
    npi: string,
    name: string,
    clinicianId: string,
  ): Promise<ClinicalTrialSearchResult> {
    const fetchedAt = new Date().toISOString();

    // ClinicalTrials.gov v2 API supports AREA[OverallOfficialName] for PI search
    const queryParts: string[] = [];
    if (name) {
      queryParts.push(`AREA[OverallOfficialName]${name}`);
    }
    const query = queryParts.join(' AND ') || name;

    try {
      const url = new URL(`${CT_API_BASE}/studies`);
      url.searchParams.set('query.term', query);
      url.searchParams.set('pageSize', String(MAX_RESULTS));
      url.searchParams.set('format', 'json');

      const res = await fetchWithTimeout(url.toString());

      if (!res.ok) {
        log('warn', 'clinical_trials_search_failed', { status: res.status, query });
        return Object.freeze({ clinicianId, npi, query, trials: [], totalCount: 0, fetchedAt });
      }

      const data = (await res.json()) as CtApiResponse;
      const totalCount = data.totalCount ?? 0;

      const trials: ClinicalTrialRecord[] = (data.studies ?? [])
        .map((study) => {
          const proto = study.protocolSection;
          if (!proto?.identificationModule?.nctId) return null;

          const officials = proto.contactsLocationsModule?.overallOfficials;
          const { matched, role } = matchesInvestigator(officials, name);

          // Only include trials where the clinician is actually listed
          if (!matched && name) return null;

          return Object.freeze({
            nctId: proto.identificationModule.nctId,
            title: proto.identificationModule.briefTitle ?? proto.identificationModule.officialTitle ?? 'Untitled',
            phase: normalizePhase(proto.designModule?.phases),
            status: normalizeStatus(proto.statusModule?.overallStatus),
            role,
            sponsor: proto.sponsorCollaboratorsModule?.leadSponsor?.name ?? 'Unknown',
            startDate: proto.statusModule?.startDateStruct?.date,
            completionDate: proto.statusModule?.completionDateStruct?.date,
          });
        })
        .filter((t): t is ClinicalTrialRecord => t !== null);

      return Object.freeze({ clinicianId, npi, query, trials, totalCount, fetchedAt });
    } catch (error) {
      log('error', 'clinical_trials_adapter_error', {
        clinicianId,
        error: error instanceof Error ? error.message : String(error),
      });

      return Object.freeze({ clinicianId, npi, query, trials: [], totalCount: 0, fetchedAt });
    }
  }
}
