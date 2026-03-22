import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import type {
  IntelligenceFinding,
  IntelligenceGraphResponse,
  IntelligenceProvider,
  IntelligenceStoryline,
} from '@/lib/intelligence/contracts';
import {
  buildIntelligenceWorkspacePayload,
  resolveGraphFocusNodeId,
  resolveWorkspaceSelectionFromGraphNode,
} from '@/lib/intelligence/workspace-model';

function makeNode(input: Partial<GraphNode> & Pick<GraphNode, 'id' | 'type' | 'label' | 'title'>): GraphNode {
  return {
    color: '#0ea5e9',
    createdAt: '2026-03-20T12:00:00.000Z',
    degree: 1,
    group: 'default',
    inDegree: 0,
    layer: 'blended',
    metadata: {},
    outDegree: 1,
    sourceRefs: [],
    tags: [],
    updatedAt: '2026-03-20T12:00:00.000Z',
    ...input,
  };
}

function makeEdge(input: Partial<GraphEdge> & Pick<GraphEdge, 'id' | 'source' | 'target' | 'type'>): GraphEdge {
  return {
    confidence: 0.9,
    createdBy: 'test',
    directed: true,
    explanation: 'linked in test',
    layer: 'blended',
    metadata: {},
    reciprocal: false,
    status: 'active',
    weight: 1,
    ...input,
  };
}

describe('intelligence workspace model', () => {
  it('builds canonical provider and storyline summaries from shared entities', () => {
    const providers: IntelligenceProvider[] = [{
      id: '1234567890',
      npi: '1234567890',
      name: 'Ada Lovelace',
      specialties: ['Cardiology'],
      credentialHealth: 'VERIFIED',
      trustScore: 82,
      readinessScore: 89,
      activeCredentials: 3,
      credentialCount: 4,
      primaryIssuer: 'ABMS',
      lastVerifiedAt: '2026-03-20T12:00:00.000Z',
      summary: '1 finding · 1 storyline',
      tags: ['cardiology'],
      risk: 'healthy',
      riskLevel: 'healthy',
    }];
    const findings: IntelligenceFinding[] = [{
      id: 'finding-1',
      investigatorId: 'inv-1',
      findingType: 'credential_drift',
      severity: 'high',
      status: 'new',
      title: 'Credential drift',
      summary: 'A live credential changed.',
      explanation: 'The issuer payload diverged from the stored record.',
      providerNpi: '1234567890',
      providerLabel: 'Ada Lovelace',
      priorityScore: 91,
      confidence: 0.86,
      storylineKey: 'storyline-1',
      storylineId: 'storyline-1',
      storylineTitle: 'Credential drift cluster',
      evidence: [],
      firstSeenAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T12:00:00.000Z',
    }];
    const storylines: IntelligenceStoryline[] = [{
      id: 'storyline-1',
      storylineType: 'credential_risk',
      perspective: 'provider',
      title: 'Credential drift cluster',
      summary: 'Recent credential changes need review.',
      whyItMatters: 'Readiness could drop if the drift is real.',
      severity: 'high',
      status: 'active',
      confidence: 0.84,
      providerNpi: '1234567890',
      recommendedActions: ['Verify the changed credential'],
      evidence: [{
        id: 'evidence-1',
        label: 'Issuer payload',
        snippet: 'ABMS payload no longer matches the stored specialty.',
        source: 'ABMS',
        observedAt: '2026-03-20T12:00:00.000Z',
        url: 'https://example.test/evidence',
      }],
      findingIds: ['finding-1'],
      progressionScore: 0.72,
      lastActivityAt: '2026-03-20T12:00:00.000Z',
    }];

    const payload = buildIntelligenceWorkspacePayload({
      providers,
      findings,
      storylines,
      actions: [],
    });

    expect(payload.counts.credentials).toBe(4);
    expect(payload.providerStatsByNpi.get('1234567890')).toMatchObject({
      findingCount: 1,
      storylineCount: 1,
      trustScore: 82,
      readinessScore: 89,
    });
    expect(payload.storylineSummaryById.get('storyline-1')).toMatchObject({
      providerRelationships: ['1234567890'],
      recommendedNextStep: 'Verify the changed credential',
    });
  });

  it('resolves graph focus and workspace selection from the same graph slice', () => {
    const providers: IntelligenceProvider[] = [{
      id: '1234567890',
      npi: '1234567890',
      name: 'Ada Lovelace',
      specialties: ['Cardiology'],
      credentialHealth: 'VERIFIED',
      trustScore: 82,
      readinessScore: 89,
      activeCredentials: 3,
      credentialCount: 4,
      primaryIssuer: 'ABMS',
      lastVerifiedAt: '2026-03-20T12:00:00.000Z',
      summary: '1 finding · 1 storyline',
      tags: ['cardiology'],
      risk: 'healthy',
      riskLevel: 'healthy',
    }];
    const findings: IntelligenceFinding[] = [{
      id: 'finding-1',
      investigatorId: 'inv-1',
      findingType: 'credential_drift',
      severity: 'high',
      status: 'new',
      title: 'Credential drift',
      summary: 'A live credential changed.',
      explanation: 'The issuer payload diverged from the stored record.',
      providerNpi: '1234567890',
      providerLabel: 'Ada Lovelace',
      priorityScore: 91,
      confidence: 0.86,
      storylineKey: 'storyline-1',
      storylineId: 'storyline-1',
      storylineTitle: 'Credential drift cluster',
      evidence: [],
      firstSeenAt: '2026-03-20T10:00:00.000Z',
      updatedAt: '2026-03-20T12:00:00.000Z',
    }];
    const storylines: IntelligenceStoryline[] = [{
      id: 'storyline-1',
      storylineType: 'credential_risk',
      perspective: 'provider',
      title: 'Credential drift cluster',
      summary: 'Recent credential changes need review.',
      whyItMatters: 'Readiness could drop if the drift is real.',
      severity: 'high',
      status: 'active',
      confidence: 0.84,
      providerNpi: '1234567890',
      recommendedActions: ['Verify the changed credential'],
      evidence: [],
      findingIds: ['finding-1'],
      progressionScore: 0.72,
      lastActivityAt: '2026-03-20T12:00:00.000Z',
    }];
    const graph: IntelligenceGraphResponse = {
      nodes: [
        makeNode({
          id: 'provider:1234567890',
          type: 'provider',
          label: 'Ada Lovelace',
          title: 'Provider node',
          metadata: { npi: '1234567890' },
        }),
        makeNode({
          id: 'finding-node',
          type: 'evidence',
          label: 'Credential drift',
          title: 'Finding-linked evidence node',
          metadata: {},
          findingIds: ['finding-1'],
          storylineIds: ['storyline-1'],
        }),
      ],
      edges: [
        makeEdge({
          id: 'edge-1',
          source: 'provider:1234567890',
          target: 'finding-node',
          type: 'related_to',
          findingIds: ['finding-1'],
          storylineIds: ['storyline-1'],
        }),
      ],
      stats: {
        totalNodes: 2,
        totalEdges: 1,
        orphanCount: 0,
        aiSuggestedLinks: 0,
      },
      focusNodeId: 'provider:1234567890',
      generatedAt: '2026-03-20T12:00:00.000Z',
    };

    expect(resolveGraphFocusNodeId({
      graph,
      finding: findings[0],
    })).toBe('finding-node');

    expect(resolveWorkspaceSelectionFromGraphNode({
      graph,
      nodeId: 'finding-node',
      providers,
      findings,
      storylines,
    })).toMatchObject({
      provider: { npi: '1234567890' },
      finding: { id: 'finding-1' },
      storyline: { id: 'storyline-1' },
    });
  });
});
