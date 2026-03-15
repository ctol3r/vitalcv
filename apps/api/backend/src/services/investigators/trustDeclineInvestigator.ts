/**
 * trustDeclineInvestigator.ts — Trust Decline Investigator
 *
 * Watches for providers whose trust score has dropped and explains WHY.
 * Unlike a simple "score went down" alert, this investigator traces the
 * decline to specific dimensional changes and provides an evidence chain.
 *
 * Triggers: TRUST_SCORE_UPDATED, FRESHNESS_DECAY
 * Scan: queries VerificationArtifacts for NPIs with recent changes
 */

import type { Investigator, InvestigatorResult, FindingEvidence, FindingAction } from './framework';
import type { IntelligenceEvent } from '../intelligence/intelligenceEngine';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import { computeTrustFreshness } from '../identity/freshnessModel';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// In-memory score history for delta detection
const scoreHistory = new Map<string, { score: number; band: string; timestamp: number }[]>();
const MAX_HISTORY = 10;

function recordScore(npi: string, score: number, band: string): void {
  const history = scoreHistory.get(npi) ?? [];
  history.push({ score, band, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.shift();
  scoreHistory.set(npi, history);
}

function getScoreDelta(npi: string, windowMs = 7 * 24 * 60 * 60 * 1000): number | null {
  const history = scoreHistory.get(npi);
  if (!history || history.length < 2) return null;
  const cutoff = Date.now() - windowMs;
  const older = history.find(h => h.timestamp <= cutoff) ?? history[0]!;
  const latest = history[history.length - 1]!;
  return latest.score - older.score;
}

export const trustDeclineInvestigator: Investigator = {
  config: {
    id: 'trust-decline',
    name: 'Trust Decline Investigator',
    description: 'Detects and explains provider trust score declines with evidence chains',
    category: 'TRUST_DECLINE',
    triggers: ['TRUST_SCORE_UPDATED', 'FRESHNESS_DECAY'],
    scanIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
    maxFindingsPerScan: 10,
    enabled: true,
  },

  async evaluate(event: IntelligenceEvent): Promise<InvestigatorResult> {
    const startMs = Date.now();
    const npi = event.npi;
    if (!npi) return { findings: [], scannedNpis: 0, durationMs: Date.now() - startMs };

    const score = await computeTrustScoreV1(npi);
    recordScore(npi, score.score, score.band);

    const delta = getScoreDelta(npi);
    if (delta === null || delta >= -5) {
      // No significant decline
      return { findings: [], scannedNpis: 1, durationMs: Date.now() - startMs };
    }

    // Significant decline detected — build evidence chain
    const freshness = await computeTrustFreshness(npi);
    const evidence: FindingEvidence[] = [];

    // Which dimensions are weak?
    for (const [key, dim] of Object.entries(score.dimensions)) {
      if (dim.status === 'UNKNOWN' || dim.status === 'STALE' || dim.score < dim.max * 0.5) {
        evidence.push({
          source: 'TrustScoreV1',
          claim: `${key}: ${dim.score}/${dim.max} (${dim.status})`,
          confidence: 0.9,
          timestamp: score.computedAt,
        });
      }
    }

    // Freshness issues?
    for (const stale of freshness.staleDimensions) {
      evidence.push({
        source: 'FreshnessModel',
        claim: `${stale.label} is stale (freshness: ${Math.round(stale.freshnessScore * 100)}%)`,
        confidence: 0.85,
        timestamp: new Date().toISOString(),
      });
    }

    // Contradiction penalties?
    if (score.penaltyApplied) {
      for (const c of score.contradictions) {
        evidence.push({
          source: 'DivergenceEngine',
          claim: `[${c.severity}] ${c.description} (−${c.penalty} pts)`,
          confidence: 0.95,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const severity = delta <= -20 ? 'CRITICAL' as const
      : delta <= -10 ? 'HIGH' as const
      : 'MEDIUM' as const;

    const actions: FindingAction[] = [
      { id: 'investigate', label: 'Open investigation', type: 'investigate', payload: { npi } },
      { id: 'verify', label: 'Re-verify provider', type: 'verify', payload: { npi } },
      { id: 'monitor', label: 'Add to watchlist', type: 'monitor', payload: { npi } },
    ];

    return {
      findings: [{
        investigator: 'trust-decline',
        category: 'TRUST_DECLINE',
        severity,
        title: `Trust score declined ${Math.abs(delta)} pts for NPI ${npi}`,
        summary: `Provider NPI ${npi} dropped from ${score.score - Math.abs(delta)} to ${score.score}/100 (${score.bandLabel}). ${evidence.length} contributing factor(s) identified.`,
        explanation: `Trust decline of ${Math.abs(delta)} points detected over the past 7 days. ` +
          `Current band: ${score.bandLabel} (${score.band}). ` +
          `Key drivers: ${evidence.slice(0, 3).map(e => e.claim).join('; ')}. ` +
          `${score.recommendations.length > 0 ? `Recommended: ${score.recommendations[0]}` : ''}`,
        npis: [npi],
        evidence,
        actions,
        relatedFindings: [],
        metadata: { delta, currentScore: score.score, band: score.band, confidence: score.confidence },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }],
      scannedNpis: 1,
      durationMs: Date.now() - startMs,
    };
  },

  async scan(): Promise<InvestigatorResult> {
    const startMs = Date.now();

    // Find NPIs with recent verification activity
    const recentNpis = await prisma.verificationArtifact.groupBy({
      by: ['npi'],
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { _count: { npi: 'desc' } },
      take: 25,
    });

    const allFindings: InvestigatorResult['findings'] = [];

    for (const { npi } of recentNpis) {
      try {
        const score = await computeTrustScoreV1(npi);
        recordScore(npi, score.score, score.band);
        const delta = getScoreDelta(npi);
        if (delta !== null && delta <= -5) {
          const result = await trustDeclineInvestigator.evaluate({
            id: `scan-${npi}`,
            type: 'TRUST_SCORE_UPDATED',
            npi,
            timestamp: new Date().toISOString(),
            payload: { score: score.score },
            loop: 1,
          });
          allFindings.push(...result.findings);
        }
      } catch (err) {
        log('warn', `[TrustDecline] Scan failed for NPI ${npi}: ${(err as Error)?.message}`);
      }

      if (allFindings.length >= trustDeclineInvestigator.config.maxFindingsPerScan) break;
    }

    return {
      findings: allFindings,
      scannedNpis: recentNpis.length,
      durationMs: Date.now() - startMs,
    };
  },
};
