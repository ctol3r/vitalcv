import { describe, expect, it } from 'vitest';
import { normalizeInvestigationGraphPayload } from '@/lib/intelligence/contracts';

describe('normalizeInvestigationGraphPayload', () => {
  it('projects investigation node and edge kinds and preserves evidence metadata', () => {
    const payload = normalizeInvestigationGraphPayload({
      generatedAt: '2026-03-16T12:00:00.000Z',
      focusNodeId: 'provider:123',
      nodes: [
        {
          id: 'provider:123',
          type: 'clinician',
          label: 'Dr. Rivera',
          title: 'Dr. Rivera',
          color: '#000',
          group: 'Stanford',
          degree: 3,
          inDegree: 1,
          outDegree: 2,
          layer: 'blended',
          metadata: { npi: '1234567890' },
          tags: [],
          sourceRefs: [],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-16T00:00:00.000Z',
          findingIds: ['finding-1'],
        },
        {
          id: 'company:abc',
          type: 'organization',
          label: 'Acme Pharma',
          title: 'Acme Pharma',
          color: '#000',
          group: 'Industry',
          degree: 1,
          inDegree: 1,
          outDegree: 0,
          layer: 'blended',
          metadata: { companyName: 'Acme Pharma', sponsor: true },
          tags: [],
          sourceRefs: [],
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-16T00:00:00.000Z',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'provider:123',
          target: 'company:abc',
          type: 'financial',
          directed: true,
          reciprocal: false,
          confidence: 0.9,
          createdBy: 'system',
          explanation: 'Open payments relationship',
          status: 'ACTIVE',
          weight: 1,
          metadata: {
            paymentType: 'Consulting',
          },
          layer: 'blended',
          createdAt: '2026-03-02T00:00:00.000Z',
          updatedAt: '2026-03-15T00:00:00.000Z',
          evidenceRefs: [
            {
              evidenceId: 'evidence-1',
              source: 'OpenPayments',
              summary: 'Consulting payment',
              observedAt: '2026-03-14T00:00:00.000Z',
            },
          ],
        },
      ],
      highlights: {
        nodeIds: ['provider:123'],
        edgeIds: ['edge-1'],
      },
      paths: {
        shortestPath: null,
        rankedPaths: [],
      },
      semanticZoom: {
        overviewClusters: [],
        detailNodeCount: 2,
        detailEdgeCount: 1,
      },
    });

    expect(payload.nodes[0]?.type).toBe('provider');
    expect(payload.nodes[1]?.type).toBe('company');
    expect(payload.edges[0]?.type).toBe('financial');
    expect(payload.edges[0]?.metadataSummary).toContain('paymentType');
    expect(payload.edges[0]?.evidenceCount).toBe(1);
    expect(payload.stats.flaggedNodes).toBe(1);
  });
});
