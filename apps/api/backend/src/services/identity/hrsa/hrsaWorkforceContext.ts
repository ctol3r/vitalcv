/**
 * hrsaWorkforceContext.ts — HRSA Geographic/Workforce Context Connector
 *
 * Wave G6: Adds geographic and workforce shortage context for a clinician
 * based on their CMS-verified practice address (ZIP/county from NPPES claims).
 *
 * Sources:
 *   - HRSA HPSA Geographic Designations (quarterly bulk file)
 *     https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_PC.ZIP
 *   - HRSA HPSA API (geographic lookup by FIPS/ZIP)
 *     https://data.hrsa.gov/api/shortage/hpsa-find
 *
 * IMPORTANT DESIGN RULES:
 *   - All outputs are NON-DECISION-GRADE (enrichment only)
 *   - Practice address MUST come from NPPES trust-core claim, not self-attested
 *   - If NPPES address is stale or missing, return null context (honest gap)
 *   - Never imply the clinician is still practicing at that address
 *
 * Outputs:
 *   - HPSA designation (yes/no + score severity)
 *   - Primary care / dental / mental health shortage type
 *   - Rural/urban classification (RUCA code if available)
 *   - Contextual workforce pressure label
 */

import { createHash } from 'node:crypto';
import type { GeographyEnrichmentContext } from '../../../../../../../core/graph/enrichment';
import type { NormalizedClaim } from '../evidenceModel';
import { log } from '../../../obs/logger';

// ── Config ────────────────────────────────────────────────────────────────────

const HRSA_API_BASE = 'https://data.hrsa.gov/api/shortage/hpsa-find';
const HRSA_PARSER_VERSION = 'hrsa-workforce-context/v1';
const HRSA_FRESHNESS_HOURS = 2160; // 90 days (quarterly HRSA file)

// ── HPSA result types ─────────────────────────────────────────────────────────

export type HpsaDesignationType =
  | 'primary_care'
  | 'dental'
  | 'mental_health'
  | 'all'
  | null;

export interface HpsaAreaResult {
  hpsaId: string | null;
  hpsaName: string | null;
  designationType: HpsaDesignationType;
  hpsaScore: number | null;       // 1-25; higher = more severe shortage
  status: 'designated' | 'proposed' | 'withdrawn' | 'not_designated';
  ruralUrbanCode: string | null;
  countyFips: string | null;
  state: string | null;
}

// ── Raw HRSA API response shape ───────────────────────────────────────────────

interface RawHrsaApiResult {
  HPSA_ID?: string;
  HPSA_NAME?: string;
  HPSA_DESIGNATION_STATUS?: string;
  HPSA_SCORE?: string | number;
  HPSA_DISCIPLINE_CLASS?: string;
  RURAL_STATUS_CODE?: string;
  COUNTY_FIPS_CODE?: string;
  STATE_ABBR?: string;
  [key: string]: unknown;
}

// ── Extract practice address from NPPES claims ────────────────────────────────

export interface PracticeAddress {
  zip: string | null;
  city: string | null;
  state: string | null;
  countyFips: string | null;
}

export function extractPracticeAddress(claims: NormalizedClaim[]): PracticeAddress | null {
  // Trust only NPPES-sourced practice location (the authoritative source)
  const locationClaim = claims
    .filter(c =>
      c.claimType === 'PRACTICE_LOCATION'
      && (c.sourceId === 'NPPES_API' || c.sourceId === 'NPPES_BULK')
      && c.status !== 'SUPERSEDED',
    )
    .sort((a, b) => {
      const aTs = a.observedAt ? Date.parse(a.observedAt) : 0;
      const bTs = b.observedAt ? Date.parse(b.observedAt) : 0;
      return bTs - aTs;
    })[0];

  if (!locationClaim) return null;

  const val = locationClaim.value as Record<string, unknown>;
  const zip = typeof val.zip === 'string' ? val.zip.replace(/[^0-9-]/g, '').slice(0, 10) : null;
  const city = typeof val.city === 'string' ? val.city.trim() : null;
  const state = typeof val.state === 'string' ? val.state.trim().toUpperCase().slice(0, 2) : null;
  const countyFips = typeof val.countyFips === 'string' ? val.countyFips.replace(/[^0-9]/g, '').slice(0, 5) : null;

  if (!zip && !state) return null;
  return { zip, city, state, countyFips };
}

// ── HRSA HPSA API call ────────────────────────────────────────────────────────

/**
 * Look up HPSA status for a ZIP code via the HRSA data API.
 * Returns null on network failure or unexpected response — caller renders
 * "workforce context unavailable" rather than crashing.
 */
export async function fetchHpsaByZip(
  zip: string,
  timeoutMs = 10_000,
): Promise<HpsaAreaResult | null> {
  if (!process.env.HRSA_CONTEXT_ENABLED || process.env.HRSA_CONTEXT_ENABLED !== 'true') {
    return null;
  }

  const url = `${HRSA_API_BASE}?hpsaFuzzy=&hpsaType=&hpsaScore=&fullCountyStateAbbr=&countyFips=&stateName=&hpsaId=&zipCode=${encodeURIComponent(zip.slice(0, 5))}&pageSize=5&pageNumber=0`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'VitalCV/1.0 (+https://vitalcv.com)' },
      signal: controller.signal,
    });

    if (!resp.ok) {
      log('warn', 'hrsa_hpsa_fetch_failed', { zip, status: resp.status });
      return null;
    }

    const data = await resp.json() as unknown;
    return parseHrsaApiResult(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log('warn', 'hrsa_hpsa_fetch_error', { zip, error: msg });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseHrsaApiResult(raw: unknown): HpsaAreaResult | null {
  // HRSA API returns: { results: [...], count: N }
  const result = raw as { results?: RawHrsaApiResult[]; count?: number };
  const items = Array.isArray(result?.results) ? result.results : [];

  if (items.length === 0) {
    return {
      hpsaId: null,
      hpsaName: null,
      designationType: null,
      hpsaScore: null,
      status: 'not_designated',
      ruralUrbanCode: null,
      countyFips: null,
      state: null,
    };
  }

  const item = items[0];
  const statusRaw = (item.HPSA_DESIGNATION_STATUS ?? '').toLowerCase();
  const status: HpsaAreaResult['status'] =
    statusRaw.includes('designated') ? 'designated'
    : statusRaw.includes('proposed') ? 'proposed'
    : statusRaw.includes('withdrawn') ? 'withdrawn'
    : 'not_designated';

  const disciplineRaw = (item.HPSA_DISCIPLINE_CLASS ?? '').toLowerCase();
  const designationType: HpsaDesignationType =
    disciplineRaw.includes('primary') ? 'primary_care'
    : disciplineRaw.includes('dental') ? 'dental'
    : disciplineRaw.includes('mental') ? 'mental_health'
    : status === 'designated' ? 'all'
    : null;

  const scoreRaw = item.HPSA_SCORE;
  const hpsaScore = typeof scoreRaw === 'number'
    ? scoreRaw
    : typeof scoreRaw === 'string' && scoreRaw.trim().length > 0
      ? Number.parseFloat(scoreRaw)
      : null;

  return {
    hpsaId: typeof item.HPSA_ID === 'string' ? item.HPSA_ID : null,
    hpsaName: typeof item.HPSA_NAME === 'string' ? item.HPSA_NAME : null,
    designationType,
    hpsaScore: hpsaScore !== null && Number.isFinite(hpsaScore) ? hpsaScore : null,
    status,
    ruralUrbanCode: typeof item.RURAL_STATUS_CODE === 'string' ? item.RURAL_STATUS_CODE : null,
    countyFips: typeof item.COUNTY_FIPS_CODE === 'string' ? item.COUNTY_FIPS_CODE : null,
    state: typeof item.STATE_ABBR === 'string' ? item.STATE_ABBR : null,
  };
}

// ── Workforce pressure label ──────────────────────────────────────────────────

export function buildWorkforcePressureLabel(hpsa: HpsaAreaResult | null): string | null {
  if (!hpsa) return null;
  if (hpsa.status !== 'designated') return null;

  const score = hpsa.hpsaScore;
  const severity =
    score === null ? 'designated shortage area'
    : score >= 20 ? 'critical shortage area (HPSA score ≥20)'
    : score >= 14 ? 'severe shortage area (HPSA score ≥14)'
    : score >= 8 ? 'moderate shortage area (HPSA score ≥8)'
    : 'low shortage area';

  const type = hpsa.designationType
    ? `${hpsa.designationType.replace('_', ' ')} `
    : '';

  return `Practices in a ${type}${severity}`;
}

// ── Stable checksum for HRSA result ──────────────────────────────────────────

function hrsaChecksum(result: HpsaAreaResult | null, zip: string): string {
  return createHash('sha256')
    .update(JSON.stringify({ result, zip }))
    .digest('hex')
    .slice(0, 32);
}

// ── Build GeographyEnrichmentContext ─────────────────────────────────────────

/**
 * Build the full geography enrichment context for a clinician.
 * Returns null if no valid practice address is available from trust-core claims.
 *
 * This is the main entry point for Wave G6.
 */
export async function buildGeographyContext(
  claims: NormalizedClaim[],
): Promise<GeographyEnrichmentContext | null> {
  const address = extractPracticeAddress(claims);
  if (!address?.zip && !address?.state) {
    return null;
  }

  const zip = address.zip?.slice(0, 5) ?? null;
  const hpsa = zip ? await fetchHpsaByZip(zip) : null;
  const pressureLabel = buildWorkforcePressureLabel(hpsa);

  return {
    practiceCountyFips: hpsa?.countyFips ?? address.countyFips ?? null,
    practiceState: hpsa?.state ?? address.state ?? null,
    hpsaDesignated: hpsa ? hpsa.status === 'designated' : null,
    hpsaId: hpsa?.hpsaId ?? null,
    hpsaScore: hpsa?.hpsaScore ?? null,
    ruralUrbanCode: hpsa?.ruralUrbanCode ?? null,
    workforcePressureLabel: pressureLabel,
    dataAsOf: hpsa
      ? new Date().toISOString() // HRSA is queried live
      : null,
    decisionGrade: false,
  };
}

// ── Export PARSER_VERSION + FRESHNESS for external use ────────────────────────

export { HRSA_PARSER_VERSION, HRSA_FRESHNESS_HOURS };
