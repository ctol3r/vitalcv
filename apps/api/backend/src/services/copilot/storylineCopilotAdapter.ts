/**
 * storylineCopilotAdapter.ts — Storyline Intelligence Copilot Adapter
 *
 * Intercepts Copilot queries that reference a specific storyline ID and
 * returns a structured narrative response using the storyline as the
 * unit of intelligence.
 *
 * Pattern matches:
 *   "storyline sl_abc123"
 *   "summarize storyline sl_abc123"
 *   "what is happening with sl_abc123"
 *
 * This makes storylines first-class Copilot citizens without modifying
 * the core Copilot engine types. Mirrors intelligenceContextAdapter.ts.
 */

import type {
  CopilotExplanation,
  CopilotGraphInsight,
  CopilotQueryResponse,
  CopilotResult,
  CopilotResultScores,
  PreparedCopilotQuery,
} from '../../../../../../core/copilot/copilotEngine';
import { getStorylineDetail } from '../storylines/storylineService';
import { log } from '../../obs/logger';

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function detectStorylineId(query: string): string | null {
  const patterns = [
    /\b(sl_[a-z0-9_-]{4,})/i,
    /\b(stry_[a-z0-9_-]{4,})/i,
    /storyline[:\s]+([a-z0-9_-]{4,})/i,
  ];
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function isStorylineQuery(preparedQuery: PreparedCopilotQuery): boolean {
  const raw = normalizeText(preparedQuery.parsedQuery.rawQuery);
  return (
    /\b(storyline|story line)\b/.test(raw) &&
    detectStorylineId(preparedQuery.parsedQuery.rawQuery) !== null
  );
}

function severityEmoji(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return '🔴';
    case 'high':     return '🟠';
    case 'medium':   return '🟡';
    case 'low':      return '🟢';
    default:         return '⚪';
  }
}

function statusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':    return 'Active and evolving';
    case 'escalated': return 'Escalated — requires immediate attention';
    case 'quiet':     return 'Quiet period — monitoring';
    case 'resolved':  return 'Resolved';
    case 'archived':  return 'Archived';
    default:          return status;
  }
}

const ZERO_SCORES: CopilotResultScores = {
  relevance: 0,
  trustScore: 0,
  freshness: 0,
  sourceCoverage: 0,
  total: 0,
};

export async function maybeExecuteStorylineCopilotQuery(
  preparedQuery: PreparedCopilotQuery,
  _limit: number,
): Promise<CopilotQueryResponse | null> {
  if (!isStorylineQuery(preparedQuery)) return null;

  const storylineId = detectStorylineId(preparedQuery.parsedQuery.rawQuery);
  if (!storylineId) return null;

  log('info', `[StorylineCopilot] Handling storyline query for: ${storylineId}`);

  try {
    const detail = await getStorylineDetail(storylineId, { sync: false });
    if (!detail) return null;

    const s = detail.storyline;
    const confidence = s.confidence;

    // Build narrative text
    const narrativeParts: string[] = [
      `${severityEmoji(s.severity)} **${s.title}**`,
      '',
      `**Status:** ${statusLabel(s.status)}`,
      `**Type:** ${s.storylineType}`,
      `**Severity:** ${s.severity}`,
      `**Confidence:** ${Math.round(confidence * 100)}%`,
      '',
      s.summary,
      '',
      `**Why it matters:** ${s.whyItMatters}`,
    ];

    if (s.recommendedActions.length > 0) {
      narrativeParts.push('', '**Recommended Actions:**');
      for (const action of s.recommendedActions.slice(0, 3)) {
        narrativeParts.push(`→ ${action}`);
      }
    }

    if (detail.findingLinks.length > 0) {
      narrativeParts.push('', `**Linked Findings:** ${detail.findingLinks.length}`);
      for (const link of detail.findingLinks.slice(0, 3)) {
        narrativeParts.push(`• [${link.findingSeverity.toUpperCase()}] finding ${link.findingId}`);
      }
    }

    const narrative = narrativeParts.join('\n');
    const scores: CopilotResultScores = {
      relevance: confidence,
      trustScore: confidence,
      freshness: 0.8,
      sourceCoverage: 0.6,
      total: confidence,
    };

    // CopilotResult — use DOCUMENT as closest entity type for storyline
    const result: CopilotResult = {
      id: s.storylineId,
      rank: 1,
      type: 'DOCUMENT',
      title: s.title,
      subtitle: `${s.storylineType} · ${s.severity} · ${s.status}`,
      summary: narrative,
      scores,
      sourceCoverage: ['storyline_engine'],
    };

    // CopilotExplanation — must have resultId, title, matchedFilters, verifiedSources, scoring
    const explanation: CopilotExplanation = {
      resultId: s.storylineId,
      title: `Storyline: ${s.title}`,
      summary: `${s.severity} storyline (${statusLabel(s.status)}) with ${detail.findingLinks.length} linked findings.`,
      because: [
        `This storyline has ${detail.findingLinks.length} linked finding${detail.findingLinks.length === 1 ? '' : 's'}.`,
        `Confidence: ${Math.round(confidence * 100)}%. Status: ${statusLabel(s.status)}.`,
        s.whyItMatters,
      ].filter(Boolean),
      matchedFilters: [],
      verifiedSources: ['storyline_engine'],
      scoring: scores,
    };

    // CopilotGraphInsight — typed per spec
    const graphInsights: CopilotGraphInsight[] = detail.entityLinks
      .filter(e => e.entityType === 'provider' && /^\d{10}$/.test(e.entityKey))
      .slice(0, 3)
      .map(e => ({
        resultId: e.entityKey,
        type: 'NEIGHBOR' as const,
        summary: `Provider ${e.entityLabel ?? e.entityKey} is an entity in this storyline (weight: ${e.weight.toFixed(2)})`,
        path: [s.storylineId, e.entityKey],
        depth: 1,
      }));

    const response: CopilotQueryResponse = {
      parsedQuery: preparedQuery.parsedQuery,
      results: [result],
      explanations: [explanation],
      graphInsights,
    };

    log('info', `[StorylineCopilot] Narrative returned for ${storylineId} (${s.title})`);
    return response;
  } catch (err) {
    log('warn', `[StorylineCopilot] Failed for ${storylineId}: ${(err as Error)?.message}`);
    return null;
  }
}
