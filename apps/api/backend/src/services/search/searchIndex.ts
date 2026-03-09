/**
 * Search Index Service — Wave 184: Unified Search Index & Content Graph
 *
 * Hybrid retrieval: keyword search over indexed SearchObjects plus dynamic
 * employer, opportunity, trust-state, and connected-source resolvers.
 *
 * ACL enforcement:
 *   - SearchAclLevel gates coarse visibility
 *   - SearchObjectACL.orgId and roleRequired gate fine-grained visibility
 *   - VERIFIER does not inherit HOLDER-only content
 *
 * No raw query logging.
 */

import { Prisma, SearchAclLevel, SearchObjectType } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { getAllConnectorModes } from '../providers/connectors/connectorFactory';
import {
  getEmployerBySlug,
  searchEmployers,
} from '../employers/employerService';
import { listOpportunities } from '../matcha/opportunityRegistry';
import { sha256Hex } from '../../utils/deterministic';

export type SearchFreshnessStatus = 'FRESH' | 'STALE' | 'EXPIRED' | 'UNKNOWN';

export interface SearchQuery {
  q: string;
  types?: SearchObjectType[];
  aclLevel?: SearchAclLevel;
  orgId?: string;
  roles?: string[];
  limit?: number;
  offset?: number;
  filters?: Record<string, string | number | boolean | undefined>;
}

export interface SearchResult {
  id: string;
  type: SearchObjectType;
  title: string;
  snippet: string;
  sourceUrl?: string;
  referenceId?: string;
  metadata: Record<string, unknown>;
  score: number;
  freshAt?: string;
  freshnessStatus: SearchFreshnessStatus;
  provenance: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  sources: string[];
  durationMs: number;
}

export interface SuggestResponse {
  suggestions: string[];
}

export interface IndexStatusResponse {
  totalObjects: number;
  byType: Record<string, number>;
  lastIndexedAt: string | null;
  activeRuns: number;
}

type IndexedSearchObject = Prisma.SearchObjectGetPayload<{
  include: {
    acl: true;
  };
}>;

const ACL_COMPATIBILITY: Record<SearchAclLevel, SearchAclLevel[]> = {
  PUBLIC: ['PUBLIC'],
  AUTHENTICATED: ['PUBLIC', 'AUTHENTICATED'],
  HOLDER: ['PUBLIC', 'AUTHENTICATED', 'HOLDER'],
  VERIFIER: ['PUBLIC', 'AUTHENTICATED', 'VERIFIER'],
  ADMIN: ['PUBLIC', 'AUTHENTICATED', 'HOLDER', 'VERIFIER', 'ADMIN'],
};

const TRUST_QUERY_PATTERN = /\b(trust|ready|readiness|clear to start|credential|threshold|requirement|verified)\b/i;
const SOURCE_QUERY_PATTERN = /\b(source|sources|connected|verify|verification|state board|oig|abms|caqh|npdb|nursys)\b/i;

function resolveAclLevels(level: SearchAclLevel): SearchAclLevel[] {
  return ACL_COMPATIBILITY[level];
}

function buildSnippet(body: string, q: string, maxLen = 220): string {
  const lower = body.toLowerCase();
  const qLower = q.toLowerCase().split(/\s+/)[0] ?? '';
  const pos = qLower ? lower.indexOf(qLower) : 0;
  const start = Math.max(0, pos - 60);
  const snippet = body.slice(start, start + maxLen).trim();
  return start > 0 ? `...${snippet}` : snippet;
}

function naiveScore(body: string, title: string, q: string): number {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const term of terms) {
    if (title.toLowerCase().includes(term)) {
      score += 4;
    }
    if (body.toLowerCase().includes(term)) {
      score += 1;
    }
  }
  return score;
}

function normalizeRole(value: string): string {
  return value.trim().toUpperCase();
}

function roleMatches(requiredRole: string, query: SearchQuery): boolean {
  const normalizedRole = normalizeRole(requiredRole);
  const roleHints = new Set((query.roles ?? []).map(normalizeRole));
  const aclLevel = query.aclLevel ?? 'PUBLIC';

  if (aclLevel === 'ADMIN') {
    return true;
  }

  if (roleHints.has(normalizedRole)) {
    return true;
  }

  if (normalizedRole === 'PUBLIC') {
    return true;
  }

  if (normalizedRole === 'AUTHENTICATED') {
    return aclLevel !== 'PUBLIC';
  }

  if (normalizedRole === 'HOLDER') {
    return aclLevel === 'HOLDER';
  }

  if (normalizedRole === 'VERIFIER') {
    return aclLevel === 'VERIFIER';
  }

  if (normalizedRole === 'ADMIN') {
    return false;
  }

  return false;
}

function canAccessIndexedObject(object: IndexedSearchObject, query: SearchQuery): boolean {
  const allowedLevels = resolveAclLevels(query.aclLevel ?? 'PUBLIC');
  if (!allowedLevels.includes(object.aclLevel)) {
    return false;
  }

  if (object.acl.length === 0) {
    return true;
  }

  return object.acl.some((aclEntry) => {
    if (aclEntry.orgId && aclEntry.orgId !== query.orgId) {
      return false;
    }

    if (aclEntry.roleRequired) {
      return roleMatches(aclEntry.roleRequired, query);
    }

    return true;
  });
}

function deriveFreshnessStatus(
  freshAt: string | undefined,
  type: SearchObjectType,
): SearchFreshnessStatus {
  if (!freshAt) {
    return 'UNKNOWN';
  }

  const targetTime = new Date(freshAt).getTime();
  if (Number.isNaN(targetTime)) {
    return 'UNKNOWN';
  }

  const ageDays = Math.floor((Date.now() - targetTime) / (1000 * 60 * 60 * 24));
  const freshThreshold = type === 'CONNECTED_RECORD' ? 30 : type === 'TRUST_STATE_SUMMARY' ? 14 : 45;
  const staleThreshold = freshThreshold * 2;

  if (ageDays <= freshThreshold) {
    return 'FRESH';
  }

  if (ageDays <= staleThreshold) {
    return 'STALE';
  }

  return 'EXPIRED';
}

function coerceMetadata(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function matchesSearchFilters(
  result: SearchResult,
  filters: SearchQuery['filters'],
): boolean {
  if (!filters) {
    return true;
  }

  const employerFilter = typeof filters.employer === 'string' ? filters.employer : undefined;
  if (employerFilter) {
    const employerSlug = typeof result.metadata.employerSlug === 'string'
      ? result.metadata.employerSlug
      : typeof result.metadata.slug === 'string'
        ? result.metadata.slug
        : undefined;
    if (employerSlug !== employerFilter && result.referenceId !== employerFilter) {
      return false;
    }
  }

  const stateFilter = typeof filters.state === 'string' ? filters.state.toUpperCase() : undefined;
  if (stateFilter) {
    const state = typeof result.metadata.state === 'string' ? result.metadata.state.toUpperCase() : undefined;
    const states = Array.isArray(result.metadata.states)
      ? result.metadata.states.filter((item): item is string => typeof item === 'string').map((item) => item.toUpperCase())
      : [];
    if (state !== stateFilter && !states.includes(stateFilter)) {
      return false;
    }
  }

  const hiringType = typeof filters.hiringType === 'string' ? filters.hiringType.toLowerCase() : undefined;
  if (hiringType) {
    const resultHiringType = typeof result.metadata.hiringType === 'string'
      ? result.metadata.hiringType.toLowerCase()
      : undefined;
    const resultHiringTypes = Array.isArray(result.metadata.hiringTypes)
      ? result.metadata.hiringTypes.filter((item): item is string => typeof item === 'string').map((item) => item.toLowerCase())
      : [];
    if (resultHiringType !== hiringType && !resultHiringTypes.includes(hiringType)) {
      return false;
    }
  }

  return true;
}

function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.type}:${result.referenceId ?? result.id}:${result.title}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function fetchIndexedResults(query: SearchQuery): Promise<SearchResult[]> {
  const rawResults = await prisma.searchObject.findMany({
    where: {
      active: true,
      aclLevel: { in: resolveAclLevels(query.aclLevel ?? 'PUBLIC') },
      ...(query.types?.length ? { type: { in: query.types } } : {}),
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { body: { contains: query.q, mode: 'insensitive' } },
      ],
    },
    orderBy: { indexedAt: 'desc' },
    take: Math.max((query.limit ?? 10) + (query.offset ?? 0), 20),
    include: { acl: true },
  });

  return rawResults
    .filter((object) => canAccessIndexedObject(object, query))
    .map((object) => {
      const metadata = coerceMetadata(object.metadata);
      const freshAt = object.freshAt?.toISOString();
      return {
        id: object.id,
        type: object.type,
        title: object.title,
        snippet: buildSnippet(object.body, query.q),
        sourceUrl: object.sourceUrl ?? undefined,
        referenceId: object.referenceId ?? undefined,
        metadata,
        score: naiveScore(object.body, object.title, query.q),
        freshAt,
        freshnessStatus: deriveFreshnessStatus(freshAt, object.type),
        provenance: typeof metadata.provenance === 'string' ? metadata.provenance : 'search_index',
      } satisfies SearchResult;
    });
}

async function buildEmployerResults(query: SearchQuery): Promise<SearchResult[]> {
  if (query.types?.length && !query.types.includes('EMPLOYER_PROFILE')) {
    return [];
  }

  const employerFilter = typeof query.filters?.employer === 'string' ? query.filters.employer : undefined;
  const employerDetails = employerFilter
    ? [await getEmployerBySlug(employerFilter)].filter((item): item is NonNullable<typeof item> => Boolean(item))
    : (await Promise.all((await searchEmployers(query.q)).map((employer) => getEmployerBySlug(employer.slug))))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return employerDetails.map((employer) => {
    const body = [
      employer.description,
      employer.tagline,
      employer.requirementsSummary,
      employer.specialties.join(', '),
      employer.trustIndicators.join(', '),
    ].filter(Boolean).join(' ');
    const freshAt = employer.verifiedSince ?? undefined;

    return {
      id: `employer:${employer.slug}`,
      type: 'EMPLOYER_PROFILE',
      title: employer.name,
      snippet: buildSnippet(body, query.q),
      sourceUrl: `/employers/${employer.slug}`,
      referenceId: employer.slug,
      metadata: {
        slug: employer.slug,
        employerSlug: employer.slug,
        specialties: employer.specialties,
        states: employer.states,
        hiringStatus: employer.hiringStatus,
        hiringTypes: employer.hiringTypes,
        trustScore: employer.trustScore,
      },
      score: naiveScore(body, employer.name, query.q) + 6,
      freshAt,
      freshnessStatus: deriveFreshnessStatus(freshAt, 'EMPLOYER_PROFILE'),
      provenance: 'employer_profile',
    };
  });
}

function buildOpportunityResults(query: SearchQuery): SearchResult[] {
  if (query.types?.length && !query.types.includes('OPPORTUNITY')) {
    return [];
  }

  const employerSlug = typeof query.filters?.employer === 'string' ? query.filters.employer : undefined;
  const opportunityId = typeof query.filters?.opportunityId === 'string' ? query.filters.opportunityId : undefined;
  const state = typeof query.filters?.state === 'string' ? query.filters.state : undefined;
  const hiringType = typeof query.filters?.hiringType === 'string' ? query.filters.hiringType : undefined;

  return listOpportunities({
    employerSlug,
    state,
    hiringType,
  })
    .filter((opportunity) => {
      if (opportunityId && opportunity.id !== opportunityId) {
        return false;
      }
      const haystack = [
        opportunity.title,
        opportunity.facility,
        opportunity.location,
        opportunity.specialty,
        opportunity.department ?? '',
        opportunity.tags?.join(' ') ?? '',
      ].join(' ');
      return employerSlug ? true : haystack.toLowerCase().includes(query.q.toLowerCase());
    })
    .map((opportunity) => {
      const body = [
        opportunity.facility,
        opportunity.location,
        opportunity.specialty,
        opportunity.department ?? '',
        opportunity.payRange ?? '',
        `Start: ${opportunity.startUrgency}`,
      ].join(' ');

      return {
        id: `opportunity:${opportunity.id}`,
        type: 'OPPORTUNITY',
        title: opportunity.title,
        snippet: buildSnippet(body, query.q),
        sourceUrl: opportunity.employerSlug ? `/employers/${opportunity.employerSlug}` : '/explore',
        referenceId: opportunity.id,
        metadata: {
          employerSlug: opportunity.employerSlug,
          employerName: opportunity.facility,
          specialty: opportunity.specialty,
          state: opportunity.state,
          hiringType: opportunity.hiringType,
          remote: opportunity.remote,
          startUrgency: opportunity.startUrgency,
        },
        score: naiveScore(body, opportunity.title, query.q) + 5,
        freshAt: opportunity.postedAt,
        freshnessStatus: deriveFreshnessStatus(opportunity.postedAt, 'OPPORTUNITY'),
        provenance: 'opportunity_registry',
      };
    });
}

function buildTrustStateResults(
  query: SearchQuery,
  opportunities: SearchResult[],
): SearchResult[] {
  if (
    query.types?.length &&
    !query.types.includes('TRUST_STATE_SUMMARY')
  ) {
    return [];
  }

  if (!TRUST_QUERY_PATTERN.test(query.q) && typeof query.filters?.employer !== 'string') {
    return [];
  }

  return opportunities.slice(0, 3).map((opportunity) => {
    const opportunityTitle = opportunity.title;
    const facility = typeof opportunity.metadata.employerName === 'string'
      ? opportunity.metadata.employerName
      : opportunityTitle;
    const snippet = `Trust-state readiness for ${facility}: clear-to-start depends on active state licensure, source-backed specialty credentials, sanctions clearance, and employer-specific threshold checks.`;

    return {
      id: `trust:${opportunity.referenceId ?? opportunity.id}`,
      type: 'TRUST_STATE_SUMMARY',
      title: `Trust readiness for ${facility}`,
      snippet,
      sourceUrl: opportunity.sourceUrl,
      referenceId: `trust:${opportunity.referenceId ?? opportunity.id}`,
      metadata: {
        employerSlug: opportunity.metadata.employerSlug,
        opportunityId: opportunity.referenceId,
        sourceOpportunityId: opportunity.referenceId,
        employerName: facility,
      },
      score: opportunity.score + 3,
      freshAt: opportunity.freshAt,
      freshnessStatus: deriveFreshnessStatus(opportunity.freshAt, 'TRUST_STATE_SUMMARY'),
      provenance: 'trust_state_derived',
    };
  });
}

function buildConnectedSourceResults(query: SearchQuery): SearchResult[] {
  if (
    query.types?.length &&
    !query.types.includes('CONNECTED_RECORD')
  ) {
    return [];
  }

  if (!SOURCE_QUERY_PATTERN.test(query.q) && !TRUST_QUERY_PATTERN.test(query.q)) {
    return [];
  }

  const connectorModes = getAllConnectorModes();
  const freshAt = new Date().toISOString();

  return Object.entries(connectorModes).map(([connector, mode]) => {
    const body = `${connector} is an allowed connected verification source. Current connector mode: ${mode}. Freshness and provenance are attached to source-backed answers before they are returned.`;
    return {
      id: `connected:${connector}`,
      type: 'CONNECTED_RECORD',
      title: `${connector} connected source`,
      snippet: buildSnippet(body, query.q),
      sourceUrl: '/network',
      referenceId: `connected:${connector}`,
      metadata: {
        connector,
        mode,
        allowed: true,
      },
      score: naiveScore(body, connector, query.q) + 2,
      freshAt,
      freshnessStatus: deriveFreshnessStatus(freshAt, 'CONNECTED_RECORD'),
      provenance: 'connected_source_registry',
    };
  });
}

async function buildDynamicResults(query: SearchQuery): Promise<SearchResult[]> {
  const opportunityResults = buildOpportunityResults(query);
  const [employerResults] = await Promise.all([
    buildEmployerResults(query),
  ]);
  const trustResults = buildTrustStateResults(query, opportunityResults);
  const connectedResults = buildConnectedSourceResults(query);

  return [
    ...employerResults,
    ...opportunityResults,
    ...trustResults,
    ...connectedResults,
  ];
}

export async function querySearch(query: SearchQuery): Promise<SearchResponse> {
  const start = Date.now();
  const normalizedQuery = query.q.trim();
  if (!normalizedQuery) {
    return { query: '', total: 0, results: [], sources: [], durationMs: 0 };
  }

  const effectiveQuery: SearchQuery = {
    ...query,
    q: normalizedQuery,
    aclLevel: query.aclLevel ?? 'PUBLIC',
    limit: Math.min(query.limit ?? 10, 50),
    offset: Math.max(query.offset ?? 0, 0),
  };
  const limit = effectiveQuery.limit ?? 10;
  const offset = effectiveQuery.offset ?? 0;

  const [indexedResults, dynamicResults] = await Promise.all([
    fetchIndexedResults(effectiveQuery),
    buildDynamicResults(effectiveQuery),
  ]);

  const mergedResults = dedupeResults([...indexedResults, ...dynamicResults])
    .filter((result) => matchesSearchFilters(result, effectiveQuery.filters))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return (right.freshAt ?? '').localeCompare(left.freshAt ?? '');
    });

  const pagedResults = mergedResults.slice(
    offset,
    offset + limit,
  );
  const sources = [...new Set(pagedResults.map((result) => result.type as string))];
  const queryHash = sha256Hex(normalizedQuery.toLowerCase());

  log('info', 'search.query', {
    queryHash,
    aclLevel: effectiveQuery.aclLevel,
    total: pagedResults.length,
    durationMs: Date.now() - start,
  });

  return {
    query: normalizedQuery,
    total: mergedResults.length,
    results: pagedResults,
    sources,
    durationMs: Date.now() - start,
  };
}

export async function suggestSearch(
  q: string,
  limit = 5,
  options: Pick<SearchQuery, 'aclLevel' | 'orgId' | 'roles'> = {},
): Promise<SuggestResponse> {
  const normalizedQuery = q.trim();
  if (normalizedQuery.length < 2) {
    return { suggestions: [] };
  }

  const indexedHits = await prisma.searchObject.findMany({
    where: {
      active: true,
      aclLevel: { in: resolveAclLevels(options.aclLevel ?? 'PUBLIC') },
      title: { contains: normalizedQuery, mode: 'insensitive' },
    },
    include: { acl: true },
    take: Math.max(limit * 2, 10),
  });

  const indexedSuggestions = indexedHits
    .filter((object) => canAccessIndexedObject(object, { q: normalizedQuery, ...options }))
    .map((object) => object.title);

  const employerSuggestions = (await searchEmployers(normalizedQuery)).map((employer) => employer.name);
  const opportunitySuggestions = listOpportunities()
    .filter((opportunity) => (
      opportunity.title.toLowerCase().includes(normalizedQuery.toLowerCase()) ||
      opportunity.facility.toLowerCase().includes(normalizedQuery.toLowerCase())
    ))
    .map((opportunity) => opportunity.title);

  return {
    suggestions: [...new Set([
      ...indexedSuggestions,
      ...employerSuggestions,
      ...opportunitySuggestions,
    ])].slice(0, limit),
  };
}

export async function getIndexStatus(): Promise<IndexStatusResponse> {
  const [total, byTypeRaw, lastObj, activeRuns] = await Promise.all([
    prisma.searchObject.count({ where: { active: true } }),
    prisma.searchObject.groupBy({ by: ['type'], where: { active: true }, _count: true }),
    prisma.searchObject.findFirst({ orderBy: { indexedAt: 'desc' }, select: { indexedAt: true } }),
    prisma.searchIndexRun.count({ where: { status: { in: ['PENDING', 'RUNNING'] } } }),
  ]);

  const byType: Record<string, number> = {};
  for (const row of byTypeRaw) {
    byType[row.type] = row._count;
  }

  return {
    totalObjects: total,
    byType,
    lastIndexedAt: lastObj?.indexedAt.toISOString() ?? null,
    activeRuns,
  };
}

export async function upsertSearchObject(params: {
  type: SearchObjectType;
  title: string;
  body: string;
  sourceUrl?: string;
  referenceId?: string;
  aclLevel?: SearchAclLevel;
  metadata?: Record<string, unknown>;
  freshAt?: Date;
}): Promise<string> {
  const {
    type,
    title,
    body,
    sourceUrl,
    referenceId,
    aclLevel = 'PUBLIC',
    metadata = {},
    freshAt,
  } = params;

  if (referenceId) {
    const existing = await prisma.searchObject.findFirst({
      where: { type, referenceId, active: true },
    });
    if (existing) {
      await prisma.searchObject.update({
        where: { id: existing.id },
        data: {
          title,
          body,
          sourceUrl,
          aclLevel,
          metadata: JSON.parse(JSON.stringify(metadata)),
          freshAt,
          indexedAt: new Date(),
        },
      });
      return existing.id;
    }
  }

  const object = await prisma.searchObject.create({
    data: {
      type,
      title,
      body,
      sourceUrl,
      referenceId,
      aclLevel,
      metadata: JSON.parse(JSON.stringify(metadata)),
      embedding: [],
      freshAt,
    },
  });

  return object.id;
}

export async function seedPublicPages(): Promise<number> {
  const pages = [
    {
      title: 'VitalCV - Home',
      body: 'Trust-native credentialing for clinicians and employers. Build your trust passport, get matched, unlock instant offers.',
      sourceUrl: '/',
    },
    {
      title: 'Explore Opportunities',
      body: 'Browse trust-native clinical opportunities matched to your credential state. Locums, perm, telehealth, ICU, psychiatry, cardiology.',
      sourceUrl: '/explore',
    },
    {
      title: 'Employer Directory',
      body: 'Verified employers hiring credentialed clinicians through VitalCV. See trust scores, specialty focus, onboarding speed.',
      sourceUrl: '/employers',
    },
    {
      title: 'Get Ready',
      body: 'Complete your credentialing profile in 4 steps: verify NPI, upload credentials, complete assessment, start earning.',
      sourceUrl: '/get-ready',
    },
    {
      title: 'Ask VitalCV',
      body: 'AI-powered trust intelligence search. Ask about opportunities, requirements, credential gaps, and employer profiles.',
      sourceUrl: '/ask',
    },
    {
      title: 'Developer Portal',
      body: 'Build with the VitalCV Trust Protocol. API keys, webhooks, Verifier SDK, Issuer SDK, OpenID4VP, HAIP.',
      sourceUrl: '/developers',
    },
    {
      title: 'Trust Network',
      body: 'Live global trust network map. Issuers, verifiers, trust relationships across healthcare organizations.',
      sourceUrl: '/network',
    },
  ];

  let count = 0;
  for (const page of pages) {
    await upsertSearchObject({
      type: 'PUBLIC_PAGE',
      title: page.title,
      body: page.body,
      sourceUrl: page.sourceUrl,
      aclLevel: 'PUBLIC',
      metadata: { provenance: 'seed_public_page' },
    });
    count++;
  }

  log('info', 'search.seed.publicPages', { count });
  return count;
}
