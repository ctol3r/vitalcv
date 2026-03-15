import { Prisma, type PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { sha256Hex } from '../../utils/deterministic';
import {
  predictQuerySuggestions,
  type QueryPredictionResult,
} from '../../../../../../core/intelligence/queryPrediction';
import { parseQueryIntent } from '../../../../../../core/intelligence/queryIntentParser';
import {
  recordLearningSignal,
  recordSuggestionOutcome,
} from './intelligenceEngineService';

export interface QueryPredictionContext {
  aclLevel?: string;
  organizationId?: string;
  clerkUserId?: string;
  clerkUserEmail?: string;
}

export interface PredictiveSuggestResponse {
  suggestions: string[];
  intent: QueryPredictionResult['intent'];
  popularPatterns: QueryPredictionResult['popularPatterns'];
  rankedSuggestions: QueryPredictionResult['rankedSuggestions'];
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function containsSensitiveTokens(query: string): boolean {
  return (
    /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(query)
    || /\b\d{9,}\b/.test(query)
    || /\bdid:[a-z0-9:.-]+\b/i.test(query)
    || /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(query)
    || /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/.test(query)
    || /\bhttps?:\/\/\S+\b/i.test(query)
  );
}

function actorIdHash(context: QueryPredictionContext): string | null {
  const actor = context.clerkUserId?.trim() || context.clerkUserEmail?.trim();
  return actor ? sha256Hex(actor) : null;
}

function toPrefixKey(normalizedQuery: string | null): string | null {
  if (!normalizedQuery || normalizedQuery.length === 0) {
    return null;
  }

  return normalizedQuery.slice(0, Math.min(4, normalizedQuery.length));
}

function baseMetadata(intent: ReturnType<typeof parseQueryIntent>): Record<string, unknown> {
  return {
    intentType: intent.intentType,
    entityTerm: intent.entityTerm,
    regionTerm: intent.regionTerm,
    organizationTerm: intent.organizationTerm,
    requiresHighTrust: intent.requiresHighTrust,
  };
}

export async function recordQueryHistory(
  input: {
    query: string;
    resultCount?: number | null;
    context?: QueryPredictionContext;
  },
  prismaClient: PrismaClient = prisma,
): Promise<void> {
  const normalizedQuery = normalizeQuery(input.query);
  const sensitive = containsSensitiveTokens(normalizedQuery);
  const intent = parseQueryIntent(normalizedQuery);
  const safeQuery = sensitive ? null : normalizedQuery;
  const queryHash = sha256Hex(normalizedQuery);
  const queryTemplate = sensitive ? 'SENSITIVE_QUERY' : intent.template;

  await prismaClient.queryHistory.create({
    data: {
      queryHash,
      normalizedQuery: safeQuery,
      queryTemplate,
      prefixKey: toPrefixKey(safeQuery),
      intentType: intent.intentType,
      entityType: intent.entityTerm ? 'ENTITY' : null,
      organizationId: input.context?.organizationId,
      aclLevel: input.context?.aclLevel,
      actorIdHash: actorIdHash(input.context ?? {}),
      containsSensitiveTokens: sensitive,
      resultCount: input.resultCount ?? null,
      metadata: toJsonValue(sensitive ? { intentType: intent.intentType } : baseMetadata(intent)),
    },
  });

  await recordLearningSignal({
    eventType: 'QUERY_EXECUTED',
    loopType: 'QUERY_LEARNING',
    subjectType: 'QUERY',
    subjectId: queryHash,
    confidence: sensitive ? 0.25 : 0.75,
    metadata: {
      aclLevel: input.context?.aclLevel ?? null,
      organizationId: input.context?.organizationId ?? null,
      containsSensitiveTokens: sensitive,
      resultCount: input.resultCount ?? null,
    },
  }, prismaClient);
}

export async function predictSearchSuggestions(
  input: {
    query: string;
    limit?: number;
    baseSuggestions?: string[];
    context?: QueryPredictionContext;
  },
  prismaClient: PrismaClient = prisma,
): Promise<PredictiveSuggestResponse> {
  const normalizedQuery = normalizeQuery(input.query);
  const prefixKey = toPrefixKey(normalizedQuery);
  const [historyRows, feedbackRows] = await Promise.all([
    prismaClient.queryHistory.findMany({
      where: {
        containsSensitiveTokens: false,
        ...(prefixKey ? { prefixKey } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
    prismaClient.suggestionOutcome.findMany({
      where: {
        suggestionType: 'QUERY_SUGGESTION',
      },
      orderBy: { createdAt: 'desc' },
      take: 250,
    }),
  ]);

  const result = predictQuerySuggestions({
    query: normalizedQuery,
    history: historyRows.map((row) => ({
      normalizedQuery: row.normalizedQuery,
      queryTemplate: row.queryTemplate,
      createdAt: row.createdAt.toISOString(),
      resultCount: row.resultCount,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    })),
    feedback: feedbackRows.map((row) => ({
      suggestionKey: row.suggestionKey,
      accepted: row.accepted,
      createdAt: row.createdAt.toISOString(),
    })),
    baseSuggestions: input.baseSuggestions ?? [],
    limit: input.limit ?? 5,
  });

  return {
    suggestions: result.suggestions,
    intent: result.intent,
    popularPatterns: result.popularPatterns,
    rankedSuggestions: result.rankedSuggestions,
  };
}

export async function recordQuerySuggestionFeedback(
  input: {
    query: string;
    suggestion: string;
    accepted: boolean;
    context?: QueryPredictionContext;
    metadata?: Record<string, unknown>;
  },
  prismaClient: PrismaClient = prisma,
): Promise<void> {
  const queryHash = sha256Hex(normalizeQuery(input.query));
  await recordSuggestionOutcome({
    suggestionType: 'QUERY_SUGGESTION',
    suggestionKey: normalizeQuery(input.suggestion),
    subjectType: 'QUERY',
    subjectId: queryHash,
    accepted: input.accepted,
    confidence: input.accepted ? 0.9 : 0.6,
    feedbackSource: 'QUERY_PREDICTION',
    metadata: {
      queryHash,
      aclLevel: input.context?.aclLevel ?? null,
      organizationId: input.context?.organizationId ?? null,
      actorIdHash: actorIdHash(input.context ?? {}),
      ...(input.metadata ?? {}),
    },
  }, prismaClient);
}
