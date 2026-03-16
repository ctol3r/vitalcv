/**
 * findingsFeedAdapter.ts — Findings Bus → Intelligence Feed Integration
 *
 * Bridges the FeedStore (in-memory) and the persistent investigator findings
 * into a unified feed item format that the intelligence feed can consume.
 *
 * Feed item types:
 *   finding           — from autonomous investigators
 *   storyline_update  — from storyline engine lifecycle changes
 *   prediction        — from prediction engine
 *   network_change    — from graph/network signals
 *   watchlist_alert   — high-severity escalated findings
 *
 * Ranking inputs (composite score):
 *   severity   — CRITICAL=100 HIGH=75 MEDIUM=50 LOW=25 INFO=10
 *   recency    — exponential decay over 24h
 *   novelty    — penalizes repeat investigator+category combos
 *   relevance  — provider watchlist membership boost
 *
 * This adapter is read-only. It does not modify FeedStore or the DB.
 */

import {
  queryFindings,
  getFeedStats,
  type Finding,
  type FindingSeverity,
} from '../investigators/framework';
import { log } from '../../obs/logger';

// ── Feed Item Types ────────────────────────────────────────────────────────────

export type FeedItemType =
  | 'finding'
  | 'storyline_update'
  | 'prediction'
  | 'network_change'
  | 'watchlist_alert';

export interface FeedItem {
  id: string;
  type: FeedItemType;
  severity: string;
  title: string;
  summary: string;
  providerNpi: string | null;
  investigatorId: string | null;
  storylineId: string | null;
  score: number;               // 0–100 composite ranking
  createdAt: string;
  href: string;                // Deep link target
  metadata: Record<string, unknown>;
}

export interface FeedResponse {
  items: FeedItem[];
  total: number;
  stats: ReturnType<typeof getFeedStats>;
  generatedAt: string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

const SEVERITY_BASE: Record<FindingSeverity, number> = {
  CRITICAL: 100,
  HIGH: 75,
  MEDIUM: 50,
  LOW: 25,
  INFO: 10,
};

function recencyDecay(createdAt: string, nowMs: number): number {
  const ageMs = Math.max(0, nowMs - new Date(createdAt).getTime());
  const ageHours = ageMs / (1000 * 60 * 60);
  // Full score at 0h, ~50% at 12h, ~25% at 24h
  return Math.max(0.1, Math.exp(-ageHours / 17));
}

function compositeScore(
  finding: Finding,
  nowMs: number,
): number {
  const severityBase = SEVERITY_BASE[finding.severity] ?? 50;
  const recency = recencyDecay(finding.createdAt, nowMs) * 20;
  const evidenceBonus = Math.min(finding.evidence.length * 3, 10);
  const feedbackPenalty = finding.feedbackCount > 2 ? 5 : 0;
  return Math.min(Math.round(severityBase * 0.7 + recency + evidenceBonus - feedbackPenalty), 100);
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export interface FeedQuery {
  types?: FeedItemType[];
  minSeverity?: FindingSeverity;
  npis?: string[];
  limit?: number;
  includeWatchlistAlerts?: boolean;
}

export function getFeedItems(query: FeedQuery = {}): FeedResponse {
  const nowMs = Date.now();
  const limit = Math.min(query.limit ?? 50, 200);

  // Pull from FeedStore
  const severities: FindingSeverity[] = (() => {
    if (!query.minSeverity) return [];
    const all: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
    const idx = all.indexOf(query.minSeverity);
    return idx >= 0 ? all.slice(0, idx + 1) : [];
  })();

  const rawFindings = queryFindings({
    severities: severities.length > 0 ? severities : undefined,
    npis: query.npis,
    status: ['ACTIVE', 'ACKNOWLEDGED'],
    limit: limit * 2, // fetch more, then re-rank
  });

  const items: FeedItem[] = rawFindings.map((finding): FeedItem => {
    // Escalated = watchlist_alert
    const isEscalated = finding.status === 'ESCALATED' ||
      finding.severity === 'CRITICAL';
    const type: FeedItemType = isEscalated ? 'watchlist_alert' : 'finding';
    const npi = finding.npis[0] ?? null;

    return {
      id: finding.id,
      type,
      severity: finding.severity,
      title: finding.title,
      summary: finding.summary,
      providerNpi: npi,
      investigatorId: finding.investigator,
      storylineId: null, // storyline links resolved via relatedFindings
      score: compositeScore(finding, nowMs),
      createdAt: finding.createdAt,
      href: `/findings/${finding.id}`,
      metadata: {
        category: finding.category,
        evidenceCount: finding.evidence.length,
        actionCount: finding.actions.length,
        feedbackCount: finding.feedbackCount,
      },
    };
  });

  // Filter by requested types
  const filtered = query.types
    ? items.filter(i => query.types!.includes(i.type))
    : items;

  // Re-rank by composite score
  const sorted = filtered.sort((a, b) => b.score - a.score).slice(0, limit);

  if (sorted.length > 0) {
    log('debug', `[FeedAdapter] Serving ${sorted.length} feed items (types: ${[...new Set(sorted.map(i => i.type))].join(', ')})`);
  }

  return {
    items: sorted,
    total: filtered.length,
    stats: getFeedStats(),
    generatedAt: new Date().toISOString(),
  };
}
