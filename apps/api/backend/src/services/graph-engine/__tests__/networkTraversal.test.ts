import { defaultGraphQueryFilters, type GraphQueryResult } from '../schema';
import {
  buildNetworkMap,
  type ProviderRelationshipSnapshot,
} from '../networkTraversal';

function graphFixture(): GraphQueryResult {
  return {
    snapshotId: 'snapshot-1',
    graphMode: 'trust',
    scope: 'local',
    focusNodeId: 'gn-seed',
    depth: 2,
    generatedAt: '2026-03-15T00:00:00.000Z',
    cacheStatus: 'miss',
    filters: defaultGraphQueryFilters(),
    chunk: {
      nodes: [
        {
          id: 'gn-seed',
          type: 'clinician',
          label: 'Dr. Seed',
          title: 'Dr. Seed',
          color: '#f59e0b',
          group: 'clinician',
          degree: 1,
          inDegree: 0,
          outDegree: 1,
          layer: 'trust',
          metadata: { npi: '1111111111', specialty: 'Cardiology' },
          tags: [],
          sourceRefs: [],
          createdAt: '2026-03-15T00:00:00.000Z',
          updatedAt: '2026-03-15T00:00:00.000Z',
        },
        {
          id: 'org-1',
          type: 'institution',
          label: 'Pacific General',
          title: 'Pacific General',
          color: '#6366f1',
          group: 'institution',
          degree: 1,
          inDegree: 1,
          outDegree: 0,
          layer: 'trust',
          metadata: {},
          tags: [],
          sourceRefs: [],
          createdAt: '2026-03-15T00:00:00.000Z',
          updatedAt: '2026-03-15T00:00:00.000Z',
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'gn-seed',
          target: 'org-1',
          type: 'accepted_by',
          directed: true,
          reciprocal: false,
          confidence: 0.9,
          createdBy: 'system',
          explanation: 'Clinician accepted by institution',
          status: 'active',
          weight: 0.9,
          metadata: {},
          layer: 'trust',
          createdAt: '2026-03-15T00:00:00.000Z',
          updatedAt: '2026-03-15T00:00:00.000Z',
        },
      ],
      nextCursor: null,
      truncated: false,
    },
    stats: {
      totalNodes: 2,
      totalEdges: 1,
      orphanCount: 0,
      avgDegree: 1,
      maxDegree: 1,
      clusterCount: 1,
      aiSuggestedLinks: 0,
      aiAcceptedLinks: 0,
      explicitLinks: 0,
      inferredLinks: 1,
      nodesByType: { clinician: 1, institution: 1 },
      edgesByType: { accepted_by: 1 },
      payloadBytes: 100,
      clusterMode: 'type',
      invalidated: false,
    },
  };
}

describe('networkTraversal', () => {
  it('builds weighted traversals across publication, trial, funding, and institution signals', () => {
    const providers: ProviderRelationshipSnapshot[] = [
      {
        npi: '1111111111',
        providerName: 'Dr. Seed',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: [],
        affiliations: ['Pacific General'],
        institutions: ['Pacific General'],
        publications: [{
          publicationId: 'pmid-1',
          title: 'Shared trial outcomes',
          citationCount: 10,
          coAuthors: ['Dr. Collaborator'],
          publishedDate: '2025-01-01',
        }],
        trials: [{
          trialId: 'NCT-1',
          title: 'Shared trial',
          role: 'PRINCIPAL_INVESTIGATOR',
          status: 'RECRUITING',
          startDate: '2025-01-01',
        }],
        payments: [{
          paymentYear: 2025,
          totalAmount: 5000,
          recordCount: 2,
          topPayers: ['Acme Pharma'],
        }],
        grants: ['grant-1'],
        metadata: {},
      },
      {
        npi: '2222222222',
        providerName: 'Dr. Collaborator',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: [],
        affiliations: ['Pacific General'],
        institutions: ['Pacific General'],
        publications: [{
          publicationId: 'pmid-1',
          title: 'Shared trial outcomes',
          citationCount: 12,
          coAuthors: ['Dr. Seed'],
          publishedDate: '2025-01-01',
        }],
        trials: [{
          trialId: 'NCT-1',
          title: 'Shared trial',
          role: 'SUB_INVESTIGATOR',
          status: 'ACTIVE',
          startDate: '2025-01-01',
        }],
        payments: [{
          paymentYear: 2025,
          totalAmount: 2500,
          recordCount: 1,
          topPayers: ['Acme Pharma'],
        }],
        grants: ['grant-1'],
        metadata: {},
      },
      {
        npi: '3333333333',
        providerName: 'Dr. Institution Only',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: [],
        affiliations: ['Pacific General'],
        institutions: ['Pacific General'],
        publications: [],
        trials: [],
        payments: [],
        grants: [],
        metadata: {},
      },
    ];

    const network = buildNetworkMap({
      npi: '1111111111',
      graph: graphFixture(),
      providers,
      generatedAt: '2026-03-15T00:00:00.000Z',
    });

    expect(network.traversals.coAuthorNetwork.edges).toHaveLength(1);
    expect(network.traversals.trialInvestigatorNetwork.edges).toHaveLength(1);
    expect(network.traversals.industryFundingNetwork.edges).toHaveLength(1);
    expect(network.traversals.institutionNetwork.edges).toHaveLength(3);

    const mergedProviderEdge = network.edges.find(
      (edge) =>
        edge.source === 'provider:1111111111' &&
        edge.target === 'provider:2222222222',
    );
    expect(mergedProviderEdge?.edgeWeight).toBe(4);
    expect(mergedProviderEdge?.relationshipTypes).toEqual(
      expect.arrayContaining(['CO_AUTHOR', 'TRIAL_INVESTIGATOR', 'INDUSTRY_FUNDING', 'INSTITUTION']),
    );

    const institutionOnlyEdge = network.edges.find(
      (edge) =>
        edge.source === 'provider:1111111111' &&
        edge.target === 'provider:3333333333',
    );
    expect(institutionOnlyEdge?.edgeWeight).toBe(1);

    expect(network.edges.some((edge) => edge.relationshipTypes.includes('GRAPH_RELATIONSHIP'))).toBe(true);
  });
});
