/**
 * divergenceInvestigator.ts — Cross-Source Divergence Investigator
 *
 * Detects when authoritative sources disagree about a provider's identity,
 * licensure, or status. Unlike the DivergenceEngine (which detects conflicts),
 * this investigator explains the IMPLICATIONS and recommends resolution.
 *
 * Triggers: DIVERGENCE_DETECTED
 * Scan: batch divergence detection across recently-modified NPIs
 */

import type { Investigator, InvestigatorResult, FindingEvidence, FindingAction } from './framework';
import type { IntelligenceEvent } from '../intelligence/intelligenceEngine';
import { detectDivergence } from '../identity/divergenceEngine';
import { computeTrustScoreV1 } from '../trust/trustScoreV1';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export const divergenceInvestigator: Investigator = {
  config: {
    id: 'divergence',
    name: 'Divergence Investigator',
    description: 'Explains cross-source conflicts and their impact on trust scoring',
    category: 'DIVERGENCE',
    triggers: ['DIVERGENCE_DETECTED'],
    scanIntervalMs: 4 * 60 * 60 * 1000, // 4 hours
    maxFindingsPerScan: 15,
    enabled: true,
  },

  async evaluate(event: IntelligenceEvent): Promise<InvestigatorResult> {
    const startMs = Date.now();
    const npi = event.npi;
    if (!npi) return { findings: [], scannedNpis: 0, durationMs: Date.now() - startMs };

    const divergence = await detectDivergence(npi);
    if (divergence.conflicts.length === 0) {
      return { findings: [], scannedNpis: 1, durationMs: Date.now() - startMs };
    }

    const score = await computeTrustScoreV1(npi);
    const evidence: FindingEvidence[] = divergence.conflicts.map(c => ({
      source: `DivergenceEngine:${c.id}`,
      claim: `[${c.severity}] ${c.description}`,
      confidence: c.severity === 'CRITICAL' ? 0.95 : c.severity === 'MODERATE' ? 0.8 : 0.7,
      timestamp: c.detectedAt,
    }));

    const hasCritical = divergence.conflicts.some(c => c.severity === 'CRITICAL');
    const severity = hasCritical ? 'CRITICAL' as const
      : divergence.totalPenalty >= 10 ? 'HIGH' as const
      : 'MEDIUM' as const;

    const actions: FindingAction[] = [
      { id: 'investigate', label: 'Open investigation', type: 'investigate', payload: { npi } },
      { id: 'verify', label: 'Re-verify conflicting sources', type: 'verify', payload: { npi, sources: divergence.conflicts.map(c => c.sources).flat() } },
    ];

    if (hasCritical) {
      actions.push({ id: 'escalate', label: 'Escalate to compliance', type: 'escalate', payload: { npi, reason: 'CRITICAL divergence' } });
    }

    const conflictSummary = divergence.conflicts
      .slice(0, 3)
      .map(c => `${c.description}`)
      .join('; ');

    return {
      findings: [{
        investigator: 'divergence',
        category: 'DIVERGENCE',
        severity,
        title: `${divergence.conflicts.length} cross-source conflict(s) for NPI ${npi}`,
        summary: `Sources disagree about NPI ${npi}: ${conflictSummary}. Total penalty: −${divergence.totalPenalty} pts (score now ${score.score}/100).`,
        explanation: `Cross-source divergence detected across ${new Set(divergence.conflicts.flatMap(c => c.sources)).size} authoritative sources. ` +
          `${divergence.conflicts.length} conflict(s) found. ` +
          `${hasCritical ? 'CRITICAL conflict present — trust band capped at L1 maximum. ' : ''}` +
          `Current trust score: ${score.score}/100 (${score.bandLabel}). ` +
          `Penalty applied: −${divergence.totalPenalty} points. ` +
          `Resolution priority: ${hasCritical ? 'IMMEDIATE' : 'within next verification cycle'}.`,
        npis: [npi],
        evidence,
        actions,
        relatedFindings: [],
        metadata: {
          conflictCount: divergence.conflicts.length,
          totalPenalty: divergence.totalPenalty,
          hasCritical,
          currentScore: score.score,
          band: score.band,
        },
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }],
      scannedNpis: 1,
      durationMs: Date.now() - startMs,
    };
  },

  async scan(): Promise<InvestigatorResult> {
    const startMs = Date.now();

    const recentNpis = await prisma.verificationArtifact.groupBy({
      by: ['npi'],
      where: {
        createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      },
      orderBy: { _count: { npi: 'desc' } },
      take: 30,
    });

    const allFindings: InvestigatorResult['findings'] = [];

    for (const { npi } of recentNpis) {
      try {
        const divergence = await detectDivergence(npi);
        if (divergence.conflicts.length > 0) {
          const result = await divergenceInvestigator.evaluate({
            id: `scan-${npi}`,
            type: 'DIVERGENCE_DETECTED',
            npi,
            timestamp: new Date().toISOString(),
            payload: { conflicts: divergence.conflicts.length },
            loop: 2,
          });
          allFindings.push(...result.findings);
        }
      } catch (err) {
        log('warn', `[Divergence] Scan failed for NPI ${npi}: ${(err as Error)?.message}`);
      }

      if (allFindings.length >= divergenceInvestigator.config.maxFindingsPerScan) break;
    }

    return {
      findings: allFindings,
      scannedNpis: recentNpis.length,
      durationMs: Date.now() - startMs,
    };
  },
};
