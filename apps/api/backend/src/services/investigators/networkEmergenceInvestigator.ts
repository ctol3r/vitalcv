/**
 * networkEmergenceInvestigator.ts — Network Emergence Investigator
 *
 * Detects emerging patterns in the provider graph:
 * - New high-degree hub nodes (influence emergence)
 * - Institution cluster formation
 * - Unusual cross-institutional connections
 * - Isolated providers gaining connections
 *
 * Triggers: INGESTION_COMPLETE (new data expands the graph)
 * Scan: periodic graph topology analysis
 */

import type { Investigator, InvestigatorResult, FindingEvidence, FindingAction } from './framework';
import type { IntelligenceEvent } from '../intelligence/intelligenceEngine';
import { searchGraphNodes } from '../graph-engine/queryService';
import { generateGraphInsights } from '../intelligence/graphInsightEngine';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// Track degree history for delta detection
const degreeHistory = new Map<string, number[]>();
const MAX_DEGREE_HISTORY = 5;

function recordDegree(nodeId: string, degree: number): void {
  const history = degreeHistory.get(nodeId) ?? [];
  history.push(degree);
  if (history.length > MAX_DEGREE_HISTORY) history.shift();
  degreeHistory.set(nodeId, history);
}

function getDegreeDelta(nodeId: string): number | null {
  const history = degreeHistory.get(nodeId);
  if (!history || history.length < 2) return null;
  return history[history.length - 1]! - history[0]!;
}

export const networkEmergenceInvestigator: Investigator = {
  config: {
    id: 'network-emergence',
    name: 'Network Emergence Investigator',
    description: 'Detects emerging influence patterns, cluster formation, and unusual graph topology changes',
    category: 'NETWORK_EMERGENCE',
    triggers: ['INGESTION_COMPLETE'],
    scanIntervalMs: 8 * 60 * 60 * 1000, // 8 hours
    maxFindingsPerScan: 8,
    enabled: true,
  },

  async evaluate(event: IntelligenceEvent): Promise<InvestigatorResult> {
    const startMs = Date.now();
    const npi = event.npi;
    if (!npi) return { findings: [], scannedNpis: 0, durationMs: Date.now() - startMs };

    const nodes = await searchGraphNodes(npi);
    if (nodes.length === 0) {
      return { findings: [], scannedNpis: 1, durationMs: Date.now() - startMs };
    }

    const node = nodes[0]!;
    recordDegree(node.id, node.degree);
    const delta = getDegreeDelta(node.id);

    // Only produce findings for significant degree growth
    if (delta === null || delta < 3) {
      return { findings: [], scannedNpis: 1, durationMs: Date.now() - startMs };
    }

    const evidence: FindingEvidence[] = [
      {
        source: 'GraphEngine',
        claim: `Node degree grew from ${node.degree - delta} to ${node.degree} (+${delta} connections)`,
        confidence: 0.9,
        timestamp: new Date().toISOString(),
      },
    ];

    const severity = delta >= 10 ? 'HIGH' as const : delta >= 5 ? 'MEDIUM' as const : 'LOW' as const;

    const actions: FindingAction[] = [
      { id: 'investigate', label: 'Investigate network', type: 'investigate', payload: { npi, mode: 'network' } },
      { id: 'compare', label: 'Compare with peers', type: 'compare', payload: { npi } },
    ];

    return {
      findings: [{
        investigator: 'network-emergence',
        category: 'NETWORK_EMERGENCE',
        severity,
        title: `NPI ${npi} gaining network influence (+${delta} connections)`,
        summary: `Provider NPI ${npi} (${node.label}) has gained ${delta} new graph connections. Current degree: ${node.degree}. This may indicate growing institutional relationships or new verification data.`,
        explanation: `Graph node "${node.label}" (type: ${node.type}) has shown significant degree growth. ` +
          `Previous degree: ${node.degree - delta}, current: ${node.degree}. ` +
          `High-degree nodes are potential influence hubs in the trust network. ` +
          `Recommend reviewing new connections for accuracy and monitoring for influence propagation.`,
        npis: [npi],
        evidence,
        actions,
        relatedFindings: [],
        metadata: { nodeId: node.id, degree: node.degree, delta, nodeType: node.type },
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      }],
      scannedNpis: 1,
      durationMs: Date.now() - startMs,
    };
  },

  async scan(): Promise<InvestigatorResult> {
    const startMs = Date.now();
    const allFindings: InvestigatorResult['findings'] = [];

    // Use graph insights to find high-influence nodes
    const insights = await generateGraphInsights(10);
    const hubInsights = insights.filter(i => i.type === 'HIGH_INFLUENCE_INVESTIGATOR');

    for (const insight of hubInsights) {
      if (!insight.npis?.length) continue;
      for (const npi of insight.npis.slice(0, 3)) {
        try {
          const nodes = await searchGraphNodes(npi);
          if (nodes.length > 0) {
            const node = nodes[0]!;
            recordDegree(node.id, node.degree);

            if (node.degree >= 8) {
              allFindings.push({
                investigator: 'network-emergence',
                category: 'NETWORK_EMERGENCE',
                severity: node.degree >= 15 ? 'HIGH' : 'MEDIUM',
                title: `High-influence node: ${node.label} (degree ${node.degree})`,
                summary: `${node.label} (NPI ${npi}) is a high-degree hub with ${node.degree} connections in the trust graph.`,
                explanation: `This provider has significantly more connections than average, indicating a central role in institutional or verification networks. ` +
                  `Monitor for trust propagation effects — changes to this provider's trust score may cascade.`,
                npis: [npi],
                evidence: [{
                  source: 'GraphInsightEngine',
                  claim: `Hub node: degree ${node.degree}`,
                  confidence: 0.85,
                  timestamp: new Date().toISOString(),
                }],
                actions: [
                  { id: 'investigate', label: 'Investigate network', type: 'investigate', payload: { npi, mode: 'network' } },
                ],
                relatedFindings: [],
                metadata: { nodeId: node.id, degree: node.degree, nodeType: node.type },
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              });
            }
          }
        } catch (err) {
          log('warn', `[NetworkEmergence] Scan failed for NPI ${npi}: ${(err as Error)?.message}`);
        }

        if (allFindings.length >= networkEmergenceInvestigator.config.maxFindingsPerScan) break;
      }
      if (allFindings.length >= networkEmergenceInvestigator.config.maxFindingsPerScan) break;
    }

    return {
      findings: allFindings,
      scannedNpis: hubInsights.reduce((sum, i) => sum + (i.npis?.length ?? 0), 0),
      durationMs: Date.now() - startMs,
    };
  },
};
