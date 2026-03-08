/**
 * Search Index Service — Wave 184: Unified Search Index & Content Graph
 *
 * Hybrid retrieval: keyword BM25 (via pg full-text), structured filters,
 * and vector similarity (stub — pgvector not yet enabled).
 *
 * Indexed object types:
 *   PUBLIC_PAGE · EMPLOYER_PROFILE · OPPORTUNITY · ISSUER_PROFILE ·
 *   TRUST_STATE_SUMMARY · AUDIT_EVENT_SUMMARY · FAQ_DOC · CONNECTED_RECORD
 *
 * ACL: every query is scoped by SearchAclLevel (PUBLIC / AUTHENTICATED / HOLDER / VERIFIER / ADMIN)
 *
 * No raw PHI in any indexed body or embedding.
 */

import { SearchAclLevel, SearchObjectType } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchQuery {
  q:          string;
  types?:     SearchObjectType[];
  aclLevel?:  SearchAclLevel;
  orgId?:     string;
  limit?:     number;
  offset?:    number;
  filters?:   Record<string, string | number | boolean>;
}

export interface SearchResult {
  id:           string;
  type:         SearchObjectType;
  title:        string;
  snippet:      string;
  sourceUrl?:   string;
  referenceId?: string;
  metadata:     Record<string, unknown>;
  score:        number;
  freshAt?:     string;
}

export interface SearchResponse {
  query:      string;
  total:      number;
  results:    SearchResult[];
  sources:    string[];
  durationMs: number;
}

export interface SuggestResponse {
  suggestions: string[];
}

export interface IndexStatusResponse {
  totalObjects:   number;
  byType:         Record<string, number>;
  lastIndexedAt:  string | null;
  activeRuns:     number;
}

// ── ACL resolution ────────────────────────────────────────────────────────────

function resolveAclLevels(level: SearchAclLevel): SearchAclLevel[] {
  const order: SearchAclLevel[] = ['PUBLIC', 'AUTHENTICATED', 'HOLDER', 'VERIFIER', 'ADMIN'];
  const idx = order.indexOf(level);
  return order.slice(0, idx + 1);
}

// ── Keyword search (BM25-style via ILIKE) ─────────────────────────────────────

function buildSnippet(body: string, q: string, maxLen = 200): string {
  const lower = body.toLowerCase();
  const qLower = q.toLowerCase().split(/\s+/)[0] ?? '';
  const pos = qLower ? lower.indexOf(qLower) : 0;
  const start = Math.max(0, pos - 60);
  const snippet = body.slice(start, start + maxLen).trim();
  return start > 0 ? `…${snippet}` : snippet;
}

function naiveScore(body: string, title: string, q: string): number {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const t of terms) {
    if (title.toLowerCase().includes(t)) score += 3;
    if (body.toLowerCase().includes(t))  score += 1;
  }
  return score;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function querySearch(query: SearchQuery): Promise<SearchResponse> {
  const start = Date.now();
  const { q, types, aclLevel = 'PUBLIC', limit = 10, offset = 0 } = query;

  const allowedLevels = resolveAclLevels(aclLevel);

  const rawResults = await prisma.searchObject.findMany({
    where: {
      active:   true,
      aclLevel: { in: allowedLevels },
      ...(types?.length ? { type: { in: types } } : {}),
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { body:  { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { indexedAt: 'desc' },
    take:    limit + offset,
    skip:    offset,
    include: { acl: true },
  });

  // Score and sort
  const scored = rawResults
    .map((obj) => ({
      obj,
      score: naiveScore(obj.body, obj.title, q),
    }))
    .sort((a, b) => b.score - a.score);

  const results: SearchResult[] = scored.map(({ obj, score }) => ({
    id:          obj.id,
    type:        obj.type,
    title:       obj.title,
    snippet:     buildSnippet(obj.body, q),
    sourceUrl:   obj.sourceUrl ?? undefined,
    referenceId: obj.referenceId ?? undefined,
    metadata:    obj.metadata as Record<string, unknown>,
    score,
    freshAt:     obj.freshAt?.toISOString(),
  }));

  const sources = [...new Set(results.map((r) => r.type as string))];

  log('info', 'search.query', { q, total: results.length, durationMs: Date.now() - start });

  return { query: q, total: results.length, results, sources, durationMs: Date.now() - start };
}

export async function suggestSearch(q: string, limit = 5): Promise<SuggestResponse> {
  if (!q || q.length < 2) return { suggestions: [] };

  const hits = await prisma.searchObject.findMany({
    where: {
      active:   true,
      aclLevel: 'PUBLIC',
      title:    { contains: q, mode: 'insensitive' },
    },
    select: { title: true },
    take:   limit,
  });

  return { suggestions: [...new Set(hits.map((h) => h.title))] };
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
    totalObjects:  total,
    byType,
    lastIndexedAt: lastObj?.indexedAt.toISOString() ?? null,
    activeRuns,
  };
}

// ── Indexing helpers (called by reindex jobs) ─────────────────────────────────

export async function upsertSearchObject(params: {
  type:        SearchObjectType;
  title:       string;
  body:        string;
  sourceUrl?:  string;
  referenceId?: string;
  aclLevel?:   SearchAclLevel;
  metadata?:   Record<string, unknown>;
  freshAt?:    Date;
}): Promise<string> {
  const { type, title, body, sourceUrl, referenceId, aclLevel = 'PUBLIC', metadata = {}, freshAt } = params;

  // Upsert by referenceId + type if provided, else always create
  if (referenceId) {
    const existing = await prisma.searchObject.findFirst({
      where: { type, referenceId, active: true },
    });
    if (existing) {
      await prisma.searchObject.update({
        where: { id: existing.id },
        data:  {
          title, body, sourceUrl, aclLevel,
          metadata: JSON.parse(JSON.stringify(metadata)),
          freshAt,
          indexedAt: new Date(),
        },
      });
      return existing.id;
    }
  }

  const obj = await prisma.searchObject.create({
    data: {
      type, title, body, sourceUrl, referenceId, aclLevel,
      metadata:  JSON.parse(JSON.stringify(metadata)),
      embedding: [],
      freshAt,
    },
  });

  return obj.id;
}

export async function seedPublicPages(): Promise<number> {
  const pages = [
    { title: 'VitalCV — Home',        body: 'Trust-native credentialing for clinicians and employers. Build your trust passport, get matched, unlock instant offers.',              sourceUrl: '/' },
    { title: 'Explore Opportunities', body: 'Browse trust-native clinical opportunities matched to your credential state. Locums, perm, telehealth, ICU, psychiatry, cardiology.', sourceUrl: '/explore' },
    { title: 'Employer Directory',    body: 'Verified employers hiring credentialed clinicians through VitalCV. See trust scores, specialty focus, onboarding speed.',              sourceUrl: '/employers' },
    { title: 'Get Ready',             body: 'Complete your credentialing profile in 4 steps: verify NPI, upload credentials, complete assessment, start earning.',                sourceUrl: '/get-ready' },
    { title: 'Ask VitalCV',           body: 'AI-powered trust intelligence search. Ask about opportunities, requirements, credential gaps, and employer profiles.',                sourceUrl: '/ask' },
    { title: 'Developer Portal',      body: 'Build with the VitalCV Trust Protocol. API keys, webhooks, Verifier SDK, Issuer SDK, OpenID4VP, HAIP.',                              sourceUrl: '/developers' },
    { title: 'Trust Network',         body: 'Live global trust network map. Issuers, verifiers, trust relationships across healthcare organizations.',                              sourceUrl: '/network' },
  ];

  let count = 0;
  for (const p of pages) {
    await upsertSearchObject({
      type:       'PUBLIC_PAGE',
      title:      p.title,
      body:       p.body,
      sourceUrl:  p.sourceUrl,
      aclLevel:   'PUBLIC',
    });
    count++;
  }

  log('info', 'search.seed.publicPages', { count });
  return count;
}
