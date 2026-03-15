/**
 * freshnessInvestigator.ts — Verification Freshness Investigator
 *
 * Detects providers with stale verifications before they become
 * trust-impacting. This is the early warning system — it fires
 * before the trust score actually declines.
 *
 * Triggers: FRESHNESS_DECAY
 * Scan: proactive sweep of NPIs approaching staleness windows
 */

import type { Investigator, InvestigatorResult, FindingEvidence, FindingAction } from './framework';
import type { IntelligenceEvent } from '../intelligence/intelligenceEngine';
import { computeTrustFreshness } from '../identity/freshnessModel';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export const freshnessInvestigator: Investigator = {
  config: {
    id: 'freshness',
    name: 'Verification Freshness Investigator',
    description: 'Early warning for providers approaching stale verification windows',
    category: 'FRESHNESS',
    triggers: ['FRESHNESS_DECAY'],
    scanIntervalMs: 12 * 60 * 60 * 1000, // 12 hours
    maxFindingsPerScan: 15,
    enabled: true,
  },

  async evaluate(event: IntelligenceEvent): Promise<InvestigatorResult> {
    const startMs = Date.now();
    const npi = event.npi;
    if (!npi) return { findings: [], scannedNpis: 0, durationMs: Date.now() - startMs };

    const freshness = await computeTrustFreshness(npi);

    // Only fire if there are stale dimensions or overall freshness is low
    if (freshness.staleDimensions.length === 0 && freshness.overallFreshness >= 0.7) {
      return { findings: [], scannedNpis: 1, durationMs: Date.now() - startMs };
    }

    const evidence: FindingEvidence[] = [];

    for (const stale of freshness.staleDimensions) {
      evidence.push({
        source: 'FreshnessModel',
        claim: `${stale.label}: freshness ${Math.round(stale.freshnessScore * 100)}% (${stale.scoreImpact} impact)`,
        confidence: 0.9,
        timestamp: new Date().toISOString(),
      });
    }

    for (const aging of freshness.agingDimensions) {
      evidence.push({
        source: 'FreshnessModel',
        claim: `${aging.label}: aging — freshness ${Math.round(aging.freshnessScore * 100)}% (approaching stale)`,
        confidence: 0.75,
        timestamp: new Date().toISOString(),
      });
    }

    const hasCriticalStale = freshness.staleDimensions.some(d => d.scoreImpact === 'SEVERE');
    const severity = hasCriticalStale ? 'HIGH' as const
      : freshness.staleDimensions.length >= 3 ? 'HIGH' as const
      : freshness.staleDimensions.length >= 1 ? 'MEDIUM' as const
      : 'LOW' as const;

    const staleLabels = freshness.staleDimensions.map(d => d.label).join(', ');
    const agingLabels = freshness.agingDimensions.map(d => d.label).join(', ');

    const actions: FindingAction[] = [
      { id: 'verify', label: 'Re-verify stale sources', type: 'verify', payload: { npi, dimensions: freshness.staleDimensions.map(d => d.claimClass) } },
      { id: 'monitor', label: 'Add to watchlist', type: 'monitor', payload: { npi } },
    ];

    return {
      findings: [{
        investigator: 'freshness',
        category: 'FRESHNESS',
        severity,
        title: `${freshness.staleDimensions.length} stale verification(s) for NPI ${npi}`,
        summary: `Provider NPI ${npi} has ${freshness.staleDimensions.length} stale and ${freshness.agingDimensions.length} aging verification(s). Overall freshness: ${Math.round(freshness.overallFreshness * 100)}%.${staleLabels ? ` Stale: ${staleLabels}.` : ''}`,
        explanation: `Verification freshness for NPI ${npi} is degrading. ` +
          `${freshness.staleDimensions.length > 0 ? `Stale dimensions: ${staleLabels}. ` : ''}` +
          `${freshness.agingDimensions.length > 0 ? `Aging dimensions: ${agingLabels}. ` : ''}` +
          `Overall freshness: ${Math.round(freshness.overallFreshness * 100)}%. ` +
          `${hasCriticalStale ? 'CRITICAL staleness detected — exclusion/sanctions check overdue. Immediate re-verification required.' : 'Re-verification recommended before trust score degrades further.'}`,
        npis: [npi],
        evidence,
        actions,
        relatedFindings: [],
        metadata: {
          overallFreshness: freshness.overallFreshness,
          staleCount: freshness.staleDimensions.length,
          agingCount: freshness.agingDimensions.length,
          hasCriticalStale,
        },
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      }],
      scannedNpis: 1,
      durationMs: Date.now() - startMs,
    };
  },

  async scan(): Promise<InvestigatorResult> {
    const startMs = Date.now();

    // Find NPIs whose latest verification is aging
    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    const candidates = await prisma.verificationArtifact.groupBy({
      by: ['npi'],
      _max: { createdAt: true },
      having: {
        createdAt: { _max: { lt: staleThreshold } },
      },
      orderBy: { _max: { createdAt: 'asc' } },
      take: 30,
    });

    const allFindings: InvestigatorResult['findings'] = [];

    for (const { npi } of candidates) {
      try {
        const freshness = await computeTrustFreshness(npi);
        if (freshness.staleDimensions.length > 0 || freshness.overallFreshness < 0.5) {
          const result = await freshnessInvestigator.evaluate({
            id: `scan-${npi}`,
            type: 'FRESHNESS_DECAY',
            npi,
            timestamp: new Date().toISOString(),
            payload: { overallFreshness: freshness.overallFreshness },
            loop: 2,
          });
          allFindings.push(...result.findings);
        }
      } catch (err) {
        log('warn', `[Freshness] Scan failed for NPI ${npi}: ${(err as Error)?.message}`);
      }

      if (allFindings.length >= freshnessInvestigator.config.maxFindingsPerScan) break;
    }

    return {
      findings: allFindings,
      scannedNpis: candidates.length,
      durationMs: Date.now() - startMs,
    };
  },
};
