/**
 * phase4Sources.ts — Phase 4 Source Adapters (Research & Influence)
 *
 * Silver-tier academic/research sources:
 *   - OpenAlex — scholarly works, citation metrics, institutional affiliations
 *   - ClinicalTrials.gov — clinical trial investigator roles
 *   - PubMed — biomedical publication records
 *
 * All Phase 4 sources use name-based matching (not NPI), so every claim
 * is flagged reviewRequired=true until identity linkage is confirmed.
 *
 * These sources enhance the clinician profile but NEVER override Gold-tier
 * data. Silver-tier claims are strictly additive.
 */

import { createHash } from 'node:crypto';
import {
  computeClaimId,
  buildReceipt,
  type NormalizedClaim,
  type VerificationReceipt,
  type PublicationValue,
  type ClinicalTrialValue,
  type ClaimConfidence,
} from './evidenceModel';
import type { ClaimType } from './sourceCatalog';
import { log } from '../../obs/logger';

// ── Shared ────────────────────────────────────────────────────────────────────

interface FetchResult {
  raw: unknown;
  checksum: string;
  fetchedAt: string;
  sourceUrl: string;
  fetchHeaders: Record<string, string>;
}

function checksumOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function headersToObject(h: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  h.forEach((v, k) => { obj[k] = v; });
  return obj;
}

function makeClaim(params: {
  claimType: ClaimType; subjectNpi: string; value: NormalizedClaim['value'];
  sourceId: string; artifactId: string; artifactChecksum: string;
  parserVersion: string; tier: NormalizedClaim['tier'];
  confidence: ClaimConfidence; confidenceScore: number; observedAt: string;
  validFrom?: string | null; validUntil?: string | null; expiresAt?: string | null;
  status?: NormalizedClaim['status']; reviewRequired?: boolean; reviewReason?: string | null;
}): NormalizedClaim {
  const claimId = computeClaimId(params.claimType, params.sourceId, params.subjectNpi, params.value);
  return {
    claimId, claimType: params.claimType, subjectNpi: params.subjectNpi,
    value: params.value, tier: params.tier, confidence: params.confidence,
    confidenceScore: params.confidenceScore, sourceId: params.sourceId,
    artifactId: params.artifactId, artifactChecksum: params.artifactChecksum,
    parserVersion: params.parserVersion, derivedAt: new Date().toISOString(),
    observedAt: params.observedAt, validFrom: params.validFrom ?? null,
    validUntil: params.validUntil ?? null, expiresAt: params.expiresAt ?? null,
    status: params.status ?? 'ACTIVE', supersededBy: null, supersedes: null,
    reviewRequired: params.reviewRequired ?? false,
    reviewReason: params.reviewReason ?? null, humanReviewAt: null,
  };
}

// ── OpenAlex Fetcher ──────────────────────────────────────────────────────────

/**
 * OpenAlex — open catalog of scholarly works.
 * Free API, no key needed. Rate limit: 10 req/s (polite pool with mailto).
 * Author search by name → works count, citation count, h-index.
 */
export async function fetchOpenAlex(firstName: string, lastName: string): Promise<FetchResult> {
  const query = encodeURIComponent(`${firstName} ${lastName}`);
  const sourceUrl = `https://api.openalex.org/authors?search=${query}&per_page=3&mailto=hello@vitalcv.com`;

  try {
    const resp = await fetch(sourceUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'VitalCV/1.0 (mailto:hello@vitalcv.com)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`OpenAlex API ${resp.status}`);
    const data = await resp.json();
    return { raw: { ...data as object, _searchName: `${firstName} ${lastName}` }, checksum: checksumOf(data), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: headersToObject(resp.headers) };
  } catch (err) {
    log('warn', 'phase4: OpenAlex fetch failed', { firstName, lastName, error: String(err) });
    return { raw: { _apiUnavailable: true, _searchName: `${firstName} ${lastName}` }, checksum: checksumOf({ firstName, lastName, ts: Date.now() }), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {} };
  }
}

const OPENALEX_PARSER = 'v1.0.0';

export function parseOpenAlexResult(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const data = raw as Record<string, unknown>;
  if (data._apiUnavailable) return { claims, receipts };

  const results = (data.results ?? []) as Array<Record<string, unknown>>;
  if (results.length === 0) return { claims, receipts };

  const base = { sourceId: 'OPENALEX', artifactId, artifactChecksum, parserVersion: OPENALEX_PARSER, tier: 'SILVER' as const, observedAt };

  // Take top match (highest relevance score)
  const author = results[0]!;
  const authorId = String(author.id ?? '');
  const worksCount = typeof author.works_count === 'number' ? author.works_count : 0;
  const citedBy = typeof author.cited_by_count === 'number' ? author.cited_by_count : 0;
  const hIndex = typeof (author as Record<string, unknown>).summary_stats === 'object'
    ? ((author as Record<string, unknown>).summary_stats as Record<string, unknown>)?.h_index as number ?? 0
    : 0;

  // Citation metric claim
  const citationValue: PublicationValue = {
    _type: 'PUBLICATION',
    openAlexId: authorId,
    pubmedId: null,
    title: `${worksCount} scholarly works`,
    journal: null,
    publishedDate: null,
    citationCount: citedBy,
    coAuthors: [],
  };
  const citClaim = makeClaim({
    ...base, claimType: 'CITATION_METRIC', subjectNpi: npi, value: citationValue,
    confidence: 'MEDIUM', confidenceScore: worksCount > 0 ? 0.65 : 0.3,
    reviewRequired: true,
    reviewReason: 'OpenAlex author matched by name search — verify NPI-to-author identity linkage before using in trust computation',
  });
  claims.push(citClaim);
  receipts.push(buildReceipt(citClaim, 'citationCount',
    `OpenAlex author ${authorId}: ${worksCount} works, ${citedBy} citations${hIndex > 0 ? `, h-index ${hIndex}` : ''}. Silver-tier — name match needs identity verification.`));

  // Institutional affiliations from OpenAlex
  const institutions = (author.last_known_institutions ?? author.affiliations ?? []) as Array<Record<string, unknown>>;
  for (const inst of institutions.slice(0, 3)) {
    const instObj = inst.institution as Record<string, unknown> | undefined;
    const instName = String(inst.display_name ?? instObj?.display_name ?? '');
    if (!instName) continue;

    const instValue = {
      _type: 'INSTITUTION_AFFILIATION' as const,
      institution: instName,
      title: null, department: null,
      affiliationType: 'FACULTY' as const,
      startDate: null, endDate: null,
      source: 'OPENALEX',
    };
    const instClaim = makeClaim({
      ...base, claimType: 'INSTITUTION_AFFILIATION', subjectNpi: npi, value: instValue,
      confidence: 'LOW', confidenceScore: 0.45,
      reviewRequired: true,
      reviewReason: `OpenAlex institution affiliation — derived from author profile, not verified`,
    });
    claims.push(instClaim);
    receipts.push(buildReceipt(instClaim, 'institution',
      `OpenAlex: affiliated with ${instName} (Silver-tier, review required).`));
  }

  return { claims, receipts };
}

// ── ClinicalTrials.gov Fetcher ────────────────────────────────────────────────

/**
 * ClinicalTrials.gov v2 API — investigator role search.
 * Free API, no key needed. Daily weekday updates.
 */
export async function fetchClinicalTrials(firstName: string, lastName: string): Promise<FetchResult> {
  const query = encodeURIComponent(`${lastName}, ${firstName}`);
  const sourceUrl = `https://clinicaltrials.gov/api/v2/studies?query.term=SEARCH[Location](AREA[LocationContactName]${query})&pageSize=10&format=json`;

  try {
    const resp = await fetch(sourceUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`ClinicalTrials.gov API ${resp.status}`);
    const data = await resp.json();
    return { raw: { ...data as object, _searchName: `${lastName}, ${firstName}` }, checksum: checksumOf(data), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: headersToObject(resp.headers) };
  } catch (err) {
    log('warn', 'phase4: ClinicalTrials.gov fetch failed', { firstName, lastName, error: String(err) });
    return { raw: { _apiUnavailable: true, _searchName: `${lastName}, ${firstName}` }, checksum: checksumOf({ firstName, lastName, ts: Date.now() }), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {} };
  }
}

const CT_PARSER = 'v1.0.0';

export function parseClinicalTrialsResult(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const data = raw as Record<string, unknown>;
  if (data._apiUnavailable) return { claims, receipts };

  const studies = (data.studies ?? []) as Array<Record<string, unknown>>;
  if (studies.length === 0) return { claims, receipts };

  const base = { sourceId: 'CLINICAL_TRIALS', artifactId, artifactChecksum, parserVersion: CT_PARSER, tier: 'SILVER' as const, observedAt };

  for (const study of studies.slice(0, 5)) {  // Cap at 5 trials
    const proto = study.protocolSection as Record<string, unknown> | undefined;
    if (!proto) continue;

    const idModule = proto.identificationModule as Record<string, unknown> | undefined;
    const statusModule = proto.statusModule as Record<string, unknown> | undefined;
    const designModule = proto.designModule as Record<string, unknown> | undefined;
    const conditionsModule = proto.conditionsModule as Record<string, unknown> | undefined;

    const nctId = String(idModule?.nctId ?? '');
    if (!nctId) continue;

    const value: ClinicalTrialValue = {
      _type: 'CLINICAL_TRIAL',
      nctId,
      title: String(idModule?.briefTitle ?? ''),
      role: 'PRINCIPAL_INVESTIGATOR',
      status: String(statusModule?.overallStatus ?? 'UNKNOWN'),
      phase: Array.isArray(designModule?.phases) ? (designModule.phases as string[])[0] ?? null : null,
      conditions: Array.isArray((conditionsModule as Record<string, unknown>)?.conditions)
        ? ((conditionsModule as Record<string, unknown>).conditions as string[]).slice(0, 5)
        : [],
      startDate: (statusModule?.startDateStruct as Record<string, unknown>)?.date
        ? String((statusModule!.startDateStruct as Record<string, unknown>).date)
        : null,
    };

    const claim = makeClaim({
      ...base, claimType: 'CLINICAL_TRIAL', subjectNpi: npi, value,
      confidence: 'MEDIUM', confidenceScore: 0.55,
      reviewRequired: true,
      reviewReason: `ClinicalTrials.gov investigator matched by name — verify NPI-to-investigator identity before using`,
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'nctId',
      `Trial ${nctId}: "${value.title}" — ${value.status}${value.phase ? ` (${value.phase})` : ''}. Silver-tier name match.`));
  }

  return { claims, receipts };
}

// ── PubMed Fetcher ────────────────────────────────────────────────────────────

/**
 * PubMed / NCBI E-utilities — biomedical publication search.
 * Free, rate-limited to 3 req/s without API key.
 */
export async function fetchPubMed(firstName: string, lastName: string): Promise<FetchResult> {
  const query = encodeURIComponent(`${lastName} ${firstName[0]}[Author]`);
  const sourceUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${query}&retmax=20&retmode=json`;

  try {
    const resp = await fetch(sourceUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`PubMed API ${resp.status}`);
    const searchResult = await resp.json() as Record<string, unknown>;
    const esearchResult = searchResult.esearchresult as Record<string, unknown> | undefined;
    const idList = (esearchResult?.idlist ?? []) as string[];
    const totalCount = parseInt(String(esearchResult?.count ?? '0'), 10);

    // Fetch summaries for first 5 IDs
    let summaries: unknown[] = [];
    if (idList.length > 0) {
      const ids = idList.slice(0, 5).join(',');
      const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`;
      try {
        const sumResp = await fetch(sumUrl, { signal: AbortSignal.timeout(10000) });
        if (sumResp.ok) {
          const sumData = await sumResp.json() as Record<string, unknown>;
          const result = sumData.result as Record<string, unknown> | undefined;
          if (result) {
            summaries = idList.slice(0, 5).map(id => result[id]).filter(Boolean);
          }
        }
      } catch {
        // Summary fetch failed — still have count
      }
    }

    const combined = { totalCount, idList: idList.slice(0, 20), summaries, _searchName: `${lastName} ${firstName}` };
    return { raw: combined, checksum: checksumOf(combined), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: headersToObject(resp.headers) };
  } catch (err) {
    log('warn', 'phase4: PubMed fetch failed', { firstName, lastName, error: String(err) });
    return { raw: { _apiUnavailable: true, _searchName: `${lastName} ${firstName}` }, checksum: checksumOf({ firstName, lastName, ts: Date.now() }), fetchedAt: new Date().toISOString(), sourceUrl, fetchHeaders: {} };
  }
}

const PUBMED_PARSER = 'v1.0.0';

export function parsePubMedResult(
  npi: string, raw: unknown, artifactId: string, artifactChecksum: string, observedAt: string,
): { claims: NormalizedClaim[]; receipts: VerificationReceipt[] } {
  const claims: NormalizedClaim[] = [];
  const receipts: VerificationReceipt[] = [];
  const data = raw as Record<string, unknown>;
  if (data._apiUnavailable) return { claims, receipts };

  const totalCount = typeof data.totalCount === 'number' ? data.totalCount : 0;
  const summaries = (data.summaries ?? []) as Array<Record<string, unknown>>;

  const base = { sourceId: 'PUBMED', artifactId, artifactChecksum, parserVersion: PUBMED_PARSER, tier: 'SILVER' as const, observedAt };

  // Overall publication count claim
  if (totalCount > 0) {
    const overviewValue: PublicationValue = {
      _type: 'PUBLICATION',
      openAlexId: null,
      pubmedId: null,
      title: `${totalCount} PubMed publications`,
      journal: null,
      publishedDate: null,
      citationCount: 0,
      coAuthors: [],
    };
    const overviewClaim = makeClaim({
      ...base, claimType: 'PUBLICATION', subjectNpi: npi, value: overviewValue,
      confidence: 'LOW', confidenceScore: 0.50,
      reviewRequired: true,
      reviewReason: 'PubMed author search by last name + first initial — may include unrelated authors. Verify identity linkage.',
    });
    claims.push(overviewClaim);
    receipts.push(buildReceipt(overviewClaim, 'citationCount',
      `PubMed: ${totalCount} publications found for author search. Silver-tier — broad name match, review required.`));
  }

  // Individual publication claims (top 5)
  for (const pub of summaries) {
    const pmid = String(pub.uid ?? pub.pmid ?? '');
    const title = String(pub.title ?? '');
    const journal = String(pub.fulljournalname ?? pub.source ?? '');
    const pubDate = String(pub.pubdate ?? pub.sortpubdate ?? '');
    const authors = Array.isArray(pub.authors)
      ? (pub.authors as Array<Record<string, unknown>>).map(a => String(a.name ?? '')).filter(Boolean).slice(0, 5)
      : [];

    if (!pmid || !title) continue;

    const value: PublicationValue = {
      _type: 'PUBLICATION',
      openAlexId: null,
      pubmedId: pmid,
      title,
      journal: journal || null,
      publishedDate: pubDate || null,
      citationCount: 0,
      coAuthors: authors,
    };

    const claim = makeClaim({
      ...base, claimType: 'PUBLICATION', subjectNpi: npi, value,
      confidence: 'LOW', confidenceScore: 0.40,
      reviewRequired: true,
      reviewReason: 'PubMed publication — name match only, not NPI-verified',
    });
    claims.push(claim);
    receipts.push(buildReceipt(claim, 'title',
      `PubMed ${pmid}: "${title}"${journal ? ` in ${journal}` : ''}${pubDate ? ` (${pubDate})` : ''}. Review required.`));
  }

  return { claims, receipts };
}
