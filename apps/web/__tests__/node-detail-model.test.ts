import { describe, expect, it } from 'vitest';
import { buildNodeDetailModel } from '@/components/graph-system/nodeDetailModel';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import type { NodeNeighborSummary } from '@/components/graph-system/nodeDetailModel';

describe('buildNodeDetailModel', () => {
  it('derives claims, receipts, artifacts, relationships, timeline, and pending suggestions from a node slice', () => {
    const node: GraphNode = {
      id: 'clinician:123',
      type: 'clinician',
      label: 'Dr. Ada Lovelace',
      title: 'Ada Lovelace',
      color: '#ffffff',
      group: 'clinician',
      degree: 4,
      inDegree: 2,
      outDegree: 2,
      layer: 'trust',
      metadata: {
        status: 'active',
        issuerName: 'NURSYS',
        specialty: 'Cardiology',
        verifiedAt: '2026-03-10T12:30:00.000Z',
        documentHash: 'sha256:abc123',
        filePath: '/evidence/license.pdf',
      },
      tags: ['license', 'verified'],
      sourceRefs: ['artifact:license-1'],
      trustTier: 'GOLD',
      trustBand: 'L3',
      confidence: 0.94,
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-03-12T09:15:00.000Z',
    };

    const edges: GraphEdge[] = [
      {
        id: 'edge-verified-by',
        source: 'clinician:123',
        target: 'org:nursys',
        type: 'verified_by',
        directed: true,
        reciprocal: false,
        confidence: 0.92,
        createdBy: 'system',
        explanation: 'Registry attestation matched board data.',
        status: 'active',
        weight: 0.92,
        metadata: { lane: 'registry' },
        layer: 'trust',
        createdAt: '2026-03-10T12:30:00.000Z',
        updatedAt: '2026-03-10T12:30:00.000Z',
      },
      {
        id: 'edge-derived-from',
        source: 'artifact:license-1',
        target: 'clinician:123',
        type: 'derived_from',
        directed: true,
        reciprocal: false,
        confidence: 0.87,
        createdBy: 'ingest',
        explanation: 'License artifact parsed into the clinician node.',
        status: 'active',
        weight: 0.87,
        metadata: { parser: 'vitalcv-doc-intel' },
        layer: 'trust',
        createdAt: '2026-03-09T08:45:00.000Z',
        updatedAt: '2026-03-09T08:45:00.000Z',
      },
      {
        id: 'edge-ai-suggested',
        source: 'clinician:123',
        target: 'source:cms',
        type: 'ai_suggested_link',
        directed: false,
        reciprocal: true,
        confidence: 0.66,
        createdBy: 'ai',
        explanation: 'Shared identifiers suggest a CMS source relationship.',
        status: 'pending',
        weight: 0.66,
        metadata: { semanticEdgeType: 'sourced_from' },
        layer: 'trust',
        createdAt: '2026-03-12T09:14:00.000Z',
        updatedAt: '2026-03-12T09:14:00.000Z',
      },
    ];

    const neighbors: NodeNeighborSummary[] = [
      { id: 'org:nursys', label: 'NURSYS', type: 'organization', degree: 12 },
      { id: 'artifact:license-1', label: 'California license PDF', type: 'artifact', degree: 3 },
      { id: 'source:cms', label: 'CMS registry source', type: 'source', degree: 5 },
    ];

    const model = buildNodeDetailModel(node, edges, neighbors);

    expect(model.claims[0]?.label).toBe('Node type');
    expect(model.claims.some((claim) => claim.label === 'Trust band' && claim.value === 'L3')).toBe(true);
    expect(model.receipts).toHaveLength(2);
    expect(model.artifacts.some((artifact) => artifact.title === 'California license PDF')).toBe(true);
    expect(model.relationships[0]?.label).toBe('NURSYS');
    expect(model.timeline[0]?.title).toBe('Node updated');
    expect(model.pendingSuggestions).toHaveLength(1);
    expect(model.evidenceStack[0]?.kind).toBe('claim');
    expect(model.defaultEvidenceId).toBe(model.evidenceStack[0]?.id);
  });
});
