import { Prisma } from '@prisma/client';
import prisma from '../../../graphql/prisma_client';
import { generateGraphLinkSuggestions, applySuggestionDecisions } from '../aiLinker';
import { invalidateGraphSnapshots } from '../invalidation';
import { queryGraph } from '../queryService';
import { runGraphRebuild } from '../rebuildEngine';
import { createGraphNodeId } from '../ids';

async function safeDeleteMany(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      return;
    }
    throw error;
  }
}

async function resetGraphFixture(): Promise<void> {
  await prisma.graphLinkDecision.deleteMany({});
  await prisma.graphLinkSuggestion.deleteMany({});
  await prisma.graphSuggestionBatch.deleteMany({});
  await prisma.graphClusterAssignment.deleteMany({});
  await prisma.graphSnapshot.deleteMany({});
  await prisma.graphLayoutState.deleteMany({});
  await prisma.graphPreset.deleteMany({});
  await prisma.graphRejectMemory.deleteMany({});
  await prisma.graphEdge.deleteMany({});
  await prisma.graphNode.deleteMany({});
  await prisma.graphBuildRun.deleteMany({});
  await prisma.reciprocalEdgeRule.deleteMany({});

  await safeDeleteMany(() => prisma.application.deleteMany({}));
  await safeDeleteMany(() => prisma.opportunity.deleteMany({}));
  await prisma.workspaceMembership.deleteMany({});
  await prisma.organizationProfile.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.decisionCapsule.deleteMany({});
  await prisma.claimRecord.deleteMany({});
  await prisma.sourceRecord.deleteMany({});
  await prisma.auditSnapshot.deleteMany({});
  await prisma.verificationArtifact.deleteMany({});
  await prisma.searchObjectACL.deleteMany({});
  await prisma.searchObject.deleteMany({});
}

async function seedGraphFixture(): Promise<{
  clinician1NodeId: string;
  clinician2NodeId: string;
}> {
  const user1 = await prisma.user.create({
    data: {
      clerkUserId: 'clerk_graph_1',
      email: 'graph1@example.com',
    },
  });
  const user2 = await prisma.user.create({
    data: {
      clerkUserId: 'clerk_graph_2',
      email: 'graph2@example.com',
    },
  });

  const person1 = await prisma.personProfile.create({
    data: {
      userId: user1.id,
      npi: '1234567890',
      firstName: 'Alice',
      lastName: 'Cardio',
      specialty: 'Cardiology',
      stateOfPractice: 'CA',
    },
  });
  const person2 = await prisma.personProfile.create({
    data: {
      userId: user2.id,
      npi: '2234567890',
      firstName: 'Bob',
      lastName: 'Cardio',
      specialty: 'Cardiology',
      stateOfPractice: 'CA',
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'Pacific General',
      slug: 'pacific-general',
    },
  });
  await prisma.organizationProfile.create({
    data: {
      organizationId: org.id,
      specialties: ['Cardiology'],
      statesCovered: ['CA'],
      verified: true,
    },
  });
  const orphanOrg = await prisma.organization.create({
    data: {
      name: 'Unused Clinic',
      slug: 'unused-clinic',
    },
  });

  await prisma.workspaceMembership.create({
    data: {
      personProfileId: person1.id,
      organizationProfileId: (await prisma.organizationProfile.findUniqueOrThrow({
        where: { organizationId: org.id },
      })).id,
      role: 'VERIFIER',
      active: true,
    },
  });

  await prisma.verificationArtifact.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000111',
        npi: '1234567890',
        source: 'NPPES',
        status: 'ACTIVE',
        checksum: 'artifact-checksum-1',
        verifiedAt: new Date('2026-03-14T12:00:00.000Z'),
        rawPayload: {
          credentialType: 'Primary License',
          specialty: 'Cardiology',
          state: 'CA',
          attachments: [{ name: 'License PDF', url: 'https://example.com/license.pdf' }],
        },
      },
      {
        id: '00000000-0000-0000-0000-000000000222',
        npi: '2234567890',
        source: 'NPPES',
        status: 'ACTIVE',
        checksum: 'artifact-checksum-2',
        verifiedAt: new Date('2026-03-14T12:00:00.000Z'),
        rawPayload: {
          credentialType: 'Primary License',
          specialty: 'Cardiology',
          state: 'CA',
        },
      },
    ],
  });

  await prisma.sourceRecord.create({
    data: {
      sourceId: 'NPPES',
      subjectNpi: '1234567890',
      sourceRecordKey: 'nppes-1234567890',
      checksum: 'source-record-checksum',
      fetchedAt: new Date('2026-03-14T12:00:00.000Z'),
    },
  });

  await prisma.claimRecord.create({
    data: {
      claimId: 'claim-cardiology-ca',
      subjectNpi: '1234567890',
      claimType: 'SPECIALTY',
      value: { specialty: 'Cardiology', state: 'CA' },
      trustTier: 'GOLD',
      confidenceLabel: 'HIGH',
      confidenceScore: 0.92,
      sourceId: 'NPPES',
      parserVersion: '1',
      status: 'ACTIVE',
      observedAt: new Date('2026-03-14T12:00:00.000Z'),
      derivedAt: new Date('2026-03-14T12:00:00.000Z'),
      verificationArtifactId: '00000000-0000-0000-0000-000000000111',
    },
  });

  await prisma.decisionCapsule.create({
    data: {
      subjectDid: 'did:web:example.com:alice',
      subjectNpi: '1234567890',
      decisionType: 'HIRING',
      decisionTimestamp: new Date('2026-03-14T12:00:00.000Z'),
      credentialIds: ['00000000-0000-0000-0000-000000000111'],
      issuerIds: ['NPPES'],
      artifactHash: 'decision-artifact-hash',
      metadata: {
        organizationName: 'Pacific General',
      },
    },
  });

  await prisma.searchObject.createMany({
    data: [
      {
        id: '00000000-0000-0000-0000-000000000a11',
        type: 'FAQ_DOC',
        title: 'Cardiology Intake Notes',
        body: 'Cardiology onboarding and telemetry details.',
        metadata: {
          tags: ['cardiology', 'telemetry'],
          explicitLinks: ['00000000-0000-0000-0000-000000000a22'],
        },
        embedding: [0.1, 0.2],
      },
      {
        id: '00000000-0000-0000-0000-000000000a22',
        type: 'FAQ_DOC',
        title: 'Telemetry Coverage Checklist',
        body: 'Checklist for cardiology telemetry coverage.',
        metadata: {
          tags: ['cardiology', 'telemetry'],
        },
        embedding: [0.2, 0.3],
      },
      {
        id: '00000000-0000-0000-0000-000000000a33',
        type: 'FAQ_DOC',
        title: 'Isolated orphan document',
        body: 'This note intentionally has no tags or links.',
        metadata: {},
        embedding: [0.4, 0.5],
      },
    ],
  });

  void orphanOrg;

  return {
    clinician1NodeId: createGraphNodeId({ type: 'clinician', sourceKind: 'npi', sourceId: '1234567890' }),
    clinician2NodeId: createGraphNodeId({ type: 'clinician', sourceKind: 'npi', sourceId: '2234567890' }),
  };
}

describe('graph runtime integration', () => {
  beforeEach(async () => {
    await resetGraphFixture();
  });

  afterAll(async () => {
    await resetGraphFixture();
    await prisma.$disconnect();
  });

  it('rebuilds deterministically, preserves reciprocal backlinks, and flags orphans', async () => {
    const { clinician1NodeId } = await seedGraphFixture();

    const first = await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });
    const firstNodeIds = (await prisma.graphNode.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: 'asc' } })).map((row) => row.id);
    const firstEdgeIds = (await prisma.graphEdge.findMany({ where: { status: 'ACTIVE' }, select: { id: true }, orderBy: { id: 'asc' } })).map((row) => row.id);

    const second = await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });
    const secondNodeIds = (await prisma.graphNode.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: 'asc' } })).map((row) => row.id);
    const secondEdgeIds = (await prisma.graphEdge.findMany({ where: { status: 'ACTIVE' }, select: { id: true }, orderBy: { id: 'asc' } })).map((row) => row.id);

    expect(secondNodeIds).toEqual(firstNodeIds);
    expect(secondEdgeIds).toEqual(firstEdgeIds);
    expect(first.nodeCount).toBe(second.nodeCount);
    expect(first.edgeCount).toBe(second.edgeCount);

    const explicit = await prisma.graphEdge.findFirstOrThrow({
      where: { edgeType: 'explicit_link' },
    });
    const backlink = await prisma.graphEdge.findFirstOrThrow({
      where: { edgeType: 'backlink' },
    });
    expect(explicit.reverseEdgeId).toBe(backlink.id);
    expect(backlink.reverseEdgeId).toBe(explicit.id);

    expect(first.orphanNodeIds.length).toBeGreaterThan(0);
    expect(second.reciprocalIssues).toHaveLength(0);

    const local = await queryGraph({
      graphMode: 'blended',
      scope: 'local',
      focusNodeId: clinician1NodeId,
      depth: 2,
      limit: 200,
    });
    expect(local.chunk.nodes.some((node) => node.type === 'document')).toBe(true);
    expect(local.chunk.nodes.some((node) => node.type === 'clinician')).toBe(true);
  });

  it('reuses cached snapshots and keeps blended mode consistent', async () => {
    const { clinician1NodeId } = await seedGraphFixture();
    await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });

    const first = await queryGraph({
      graphMode: 'blended',
      scope: 'local',
      focusNodeId: clinician1NodeId,
      depth: 2,
      limit: 500,
    });
    const second = await queryGraph({
      graphMode: 'blended',
      scope: 'local',
      focusNodeId: clinician1NodeId,
      depth: 2,
      limit: 500,
    });

    expect(first.cacheStatus).toBe('miss');
    expect(second.cacheStatus).toBe('hit');
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.chunk.nodes.some((node) => node.type === 'document')).toBe(true);
    expect(first.chunk.nodes.some((node) => node.type === 'clinician')).toBe(true);
  });

  it('invalidates knowledge snapshots without touching trust snapshots for search-object invalidation scopes', async () => {
    await seedGraphFixture();
    await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });

    const trust = await queryGraph({
      graphMode: 'trust',
      scope: 'global',
      limit: 500,
    });
    const knowledge = await queryGraph({
      graphMode: 'knowledge',
      scope: 'global',
      limit: 500,
    });

    await prisma.searchObject.update({
      where: { id: '00000000-0000-0000-0000-000000000a11' },
      data: {
        title: 'Cardiology Intake Notes (Updated)',
      },
    });

    await invalidateGraphSnapshots(prisma, {
      reason: 'SearchObject:update',
      graphModes: ['knowledge', 'blended'],
      focusNodeIds: [
        createGraphNodeId({
          type: 'document',
          sourceKind: 'search_object',
          sourceId: '00000000-0000-0000-0000-000000000a11',
        }),
      ],
      invalidateGlobal: true,
    });

    const [trustSnapshot, knowledgeSnapshot] = await Promise.all([
      prisma.graphSnapshot.findUniqueOrThrow({ where: { id: trust.snapshotId } }),
      prisma.graphSnapshot.findUniqueOrThrow({ where: { id: knowledge.snapshotId } }),
    ]);

    expect(trustSnapshot.invalidatedAt).toBeNull();
    expect(knowledgeSnapshot.invalidatedAt).not.toBeNull();
    expect(knowledgeSnapshot.lastInvalidationReason).toContain('SearchObject');
  });

  it('suppresses rejected suggestions when the evidence hash has not changed and preserves explanation payloads', async () => {
    await seedGraphFixture();
    await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });

    const batch = await generateGraphLinkSuggestions({ graphMode: 'blended' });
    expect(batch.generated).toBeGreaterThan(0);

    const suggestion = await prisma.graphLinkSuggestion.findFirstOrThrow({
      where: { batchId: batch.batchId },
      orderBy: { confidence: 'desc' },
    });
    const explanation = suggestion.explanation as Record<string, unknown>;
    expect(typeof explanation.summary).toBe('string');
    expect(Array.isArray(explanation.signals)).toBe(true);
    expect(explanation.candidateReciprocalBehavior).toBeTruthy();
    expect(typeof explanation.materialChangeHash).toBe('string');

    const rejected = await applySuggestionDecisions({
      suggestionIds: [suggestion.id],
      action: 'reject',
      reviewerId: 'reviewer:test',
      rationale: 'not helpful',
    });
    expect(rejected.rejectMemoryIds).toHaveLength(1);

    const secondBatch = await generateGraphLinkSuggestions({ graphMode: 'blended' });
    expect(secondBatch.suppressedByRejectMemory).toBeGreaterThan(0);

    const matchingSuggestions = await prisma.graphLinkSuggestion.findMany({
      where: {
        suggestionKey: suggestion.suggestionKey,
        materialChangeHash: suggestion.materialChangeHash,
      },
    });
    expect(matchingSuggestions).toHaveLength(1);
  });

  it('keeps ignored suggestions muted until the source basis changes materially', async () => {
    const { clinician1NodeId, clinician2NodeId } = await seedGraphFixture();
    await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });

    const firstBatch = await generateGraphLinkSuggestions({
      graphMode: 'blended',
      targetNodeId: clinician1NodeId,
      maxSuggestionsPerNode: 10,
      minConfidence: 0.2,
    });

    const candidate = await prisma.graphLinkSuggestion.findFirstOrThrow({
      where: {
        batchId: firstBatch.batchId,
        OR: [
          { sourceNodeId: clinician1NodeId, targetNodeId: clinician2NodeId },
          { sourceNodeId: clinician2NodeId, targetNodeId: clinician1NodeId },
        ],
      },
    });

    await applySuggestionDecisions({
      suggestionIds: [candidate.id],
      action: 'ignore',
      reviewerId: 'reviewer:test',
      rationale: 'wait for stronger evidence',
    });

    await generateGraphLinkSuggestions({
      graphMode: 'blended',
      targetNodeId: clinician1NodeId,
      maxSuggestionsPerNode: 10,
      minConfidence: 0.2,
    });

    const ignoredRows = await prisma.graphLinkSuggestion.findMany({
      where: {
        suggestionKey: candidate.suggestionKey,
        materialChangeHash: candidate.materialChangeHash,
      },
    });
    expect(ignoredRows).toHaveLength(1);
    expect(ignoredRows[0]?.state).toBe('IGNORED');

    await prisma.verificationArtifact.create({
      data: {
        id: '00000000-0000-0000-0000-000000000223',
        npi: '2234567890',
        source: 'NPPES',
        status: 'ACTIVE',
        checksum: 'artifact-checksum-2b',
        verifiedAt: new Date('2026-03-14T13:00:00.000Z'),
        rawPayload: {
          credentialType: 'Supplemental License',
          specialty: 'Cardiology',
          state: 'CA',
        },
      },
    });

    await runGraphRebuild({
      buildType: 'incremental',
      graphMode: 'blended',
      invalidationReasons: ['npi:2234567890'],
      requestedBy: 'test',
    });

    await generateGraphLinkSuggestions({
      graphMode: 'blended',
      targetNodeId: clinician1NodeId,
      maxSuggestionsPerNode: 10,
      minConfidence: 0.2,
    });

    const rowsAfterMaterialChange = await prisma.graphLinkSuggestion.findMany({
      where: {
        suggestionKey: candidate.suggestionKey,
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(rowsAfterMaterialChange.some((row) => row.state === 'PENDING' && row.materialChangeHash !== candidate.materialChangeHash)).toBe(true);
    expect(rowsAfterMaterialChange.some((row) => row.state === 'SUPERSEDED' && row.materialChangeHash === candidate.materialChangeHash)).toBe(true);
  });

  it('creates durable reciprocal AI accepted edges while keeping verified_by edges one-way', async () => {
    const { clinician1NodeId, clinician2NodeId } = await seedGraphFixture();
    await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });

    const batch = await generateGraphLinkSuggestions({
      graphMode: 'blended',
      targetNodeId: clinician1NodeId,
      maxSuggestionsPerNode: 10,
      minConfidence: 0.2,
    });
    expect(batch.generated).toBeGreaterThan(0);

    const candidate = await prisma.graphLinkSuggestion.findFirstOrThrow({
      where: {
        batchId: batch.batchId,
        OR: [
          { sourceNodeId: clinician1NodeId, targetNodeId: clinician2NodeId },
          { sourceNodeId: clinician2NodeId, targetNodeId: clinician1NodeId },
        ],
      },
    });

    const accepted = await applySuggestionDecisions({
      suggestionIds: [candidate.id],
      action: 'accept',
      reviewerId: 'reviewer:test',
      rationale: 'same specialty and network overlap',
    });
    expect(accepted.edgeIds).toHaveLength(2);

    const aiEdges = await prisma.graphEdge.findMany({
      where: {
        id: { in: accepted.edgeIds },
      },
    });
    expect(aiEdges).toHaveLength(2);
    expect(aiEdges[0]?.reverseEdgeId).toBe(aiEdges[1]?.id);
    expect(aiEdges[1]?.reverseEdgeId).toBe(aiEdges[0]?.id);

    const verifiedEdges = await prisma.graphEdge.findMany({
      where: {
        edgeType: 'verified_by',
      },
    });
    expect(verifiedEdges.length).toBeGreaterThan(0);
    expect(verifiedEdges.every((edge) => edge.reverseEdgeId === null)).toBe(true);
  });

  it('computes intelligence signals for clusters, hubs, similarity edges, recommendations, and metrics', async () => {
    const { clinician1NodeId, clinician2NodeId } = await seedGraphFixture();
    await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'test' });

    const result = await queryGraph({
      graphMode: 'blended',
      scope: 'global',
      clusterMode: 'louvain',
      limit: 500,
    });

    expect(result.intelligence).toBeTruthy();
    expect(result.intelligence?.clusters.length).toBeGreaterThan(0);
    expect(result.intelligence?.hubs.length).toBeGreaterThan(0);
    expect(result.chunk.edges.some((edge) => edge.type === 'semantic_similarity')).toBe(true);
    expect(result.intelligence?.recommendations.some((recommendation) =>
      (recommendation.sourceNodeId === clinician1NodeId && recommendation.targetNodeId === clinician2NodeId)
      || (recommendation.sourceNodeId === clinician2NodeId && recommendation.targetNodeId === clinician1NodeId),
    )).toBe(true);
    expect((result.stats.similarityEdgeCount ?? 0)).toBeGreaterThan(0);
    expect((result.stats.hubCount ?? 0)).toBeGreaterThan(0);
    expect((result.stats.avgRelationshipStrength ?? 0)).toBeGreaterThan(0);

    const clinicianNode = result.chunk.nodes.find((node) => node.id === clinician1NodeId);
    const semanticEdge = result.chunk.edges.find((edge) => edge.type === 'semantic_similarity');

    expect(clinicianNode?.metadata['intelligence']).toBeTruthy();
    expect(semanticEdge?.metadata['relationshipStrength']).toBeDefined();
  });
});
