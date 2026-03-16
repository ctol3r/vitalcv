import assert from 'node:assert/strict';

import {
  communityDetection,
  createDualGraph,
  createEventGraph,
  createIdentityEntity,
  createIdentityGraph,
  createIdentityRelation,
  createIntelligenceGraph,
  createNetworkEdge,
  createNetworkEntity,
  createNetworkGraph,
  createOntologyEntity,
  createOntologyGraph,
  createOntologyRelation,
  createProviderEvent,
  createWeeklyGraphSnapshot,
  deriveStorylineGraphSignal,
  diffWeeklyGraphSnapshots,
  InMemoryWeeklyGraphSnapshotStore,
  pageRank,
  betweennessCentrality,
  articulationPoints,
  projectDualGraph,
  projectIntelligenceGraph,
  scoreProviderInfluence,
  storeWeeklyGraphSnapshot,
  type GraphProjection,
} from '../index';
import { rankStoryline } from '../../../core/storylines/storylineRanker';
import { defaultStorylineEngineConfig } from '../../../core/storylines/storylineEngine';

function buildWeightedTestGraph(): GraphProjection {
  return {
    nodes: [
      { id: 'a', kind: 'provider', label: 'A', layer: 'dual', confidence: 1, metadata: {} },
      { id: 'b', kind: 'provider', label: 'B', layer: 'dual', confidence: 1, metadata: {} },
      { id: 'c', kind: 'provider', label: 'C', layer: 'dual', confidence: 1, metadata: {} },
      { id: 'd', kind: 'provider', label: 'D', layer: 'dual', confidence: 1, metadata: {} },
      { id: 'e', kind: 'provider', label: 'E', layer: 'dual', confidence: 1, metadata: {} },
      { id: 'f', kind: 'provider', label: 'F', layer: 'dual', confidence: 1, metadata: {} },
    ],
    edges: [
      { id: 'ab', source: 'a', target: 'b', relation: 'peer', directed: false, weight: 1, confidence: 1, layer: 'dual', metadata: {} },
      { id: 'bc', source: 'b', target: 'c', relation: 'peer', directed: false, weight: 1, confidence: 1, layer: 'dual', metadata: {} },
      { id: 'ca', source: 'c', target: 'a', relation: 'peer', directed: false, weight: 1, confidence: 1, layer: 'dual', metadata: {} },
      { id: 'de', source: 'd', target: 'e', relation: 'peer', directed: false, weight: 1, confidence: 1, layer: 'dual', metadata: {} },
      { id: 'ef', source: 'e', target: 'f', relation: 'peer', directed: false, weight: 1, confidence: 1, layer: 'dual', metadata: {} },
      { id: 'fd', source: 'f', target: 'd', relation: 'peer', directed: false, weight: 1, confidence: 1, layer: 'dual', metadata: {} },
      { id: 'cd', source: 'c', target: 'd', relation: 'bridge', directed: false, weight: 0.1, confidence: 1, layer: 'dual', metadata: {} },
    ],
  };
}

function buildDualGraph(crossInstitution = false, capturedAt = '2026-03-15T12:00:00.000Z') {
  const ontology = createOntologyGraph({
    createdAt: capturedAt,
    entities: [
      createOntologyEntity({ entityId: 'provider:ada', entityType: 'provider', label: 'Dr. Ada' }),
      createOntologyEntity({ entityId: 'provider:ben', entityType: 'provider', label: 'Dr. Ben' }),
      createOntologyEntity({ entityId: 'provider:cara', entityType: 'provider', label: 'Dr. Cara' }),
      createOntologyEntity({ entityId: 'provider:dex', entityType: 'provider', label: 'Dr. Dex' }),
      createOntologyEntity({ entityId: 'institution:alpha', entityType: 'institution', label: 'Alpha Health' }),
      createOntologyEntity({ entityId: 'institution:beta', entityType: 'institution', label: 'Beta Medical' }),
      createOntologyEntity({ entityId: 'group:alpha', entityType: 'practice_group', label: 'Alpha Cardiology' }),
      createOntologyEntity({ entityId: 'group:beta', entityType: 'practice_group', label: 'Beta Oncology' }),
      createOntologyEntity({ entityId: 'specialty:cardiology', entityType: 'specialty', label: 'Cardiology' }),
      createOntologyEntity({ entityId: 'specialty:oncology', entityType: 'specialty', label: 'Oncology' }),
      createOntologyEntity({ entityId: 'board:abim', entityType: 'board_certification', label: 'ABIM Cardiology' }),
      createOntologyEntity({ entityId: 'board:abem', entityType: 'board_certification', label: 'ABEM Oncology' }),
      createOntologyEntity({ entityId: 'credential:ca-med', entityType: 'credential', label: 'CA Medical License' }),
      createOntologyEntity({ entityId: 'credential:ny-med', entityType: 'credential', label: 'NY Medical License' }),
    ],
    relations: [
      createOntologyRelation({ sourceEntityId: 'provider:ada', targetEntityId: 'institution:alpha', relationType: 'affiliated_with', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ben', targetEntityId: 'institution:alpha', relationType: 'affiliated_with', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:cara', targetEntityId: 'institution:beta', relationType: 'affiliated_with', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:dex', targetEntityId: 'institution:beta', relationType: 'affiliated_with', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ada', targetEntityId: 'group:alpha', relationType: 'member_of', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ben', targetEntityId: 'group:alpha', relationType: 'member_of', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:cara', targetEntityId: 'group:beta', relationType: 'member_of', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:dex', targetEntityId: 'group:beta', relationType: 'member_of', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ada', targetEntityId: 'specialty:cardiology', relationType: 'specializes_in', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ben', targetEntityId: 'specialty:cardiology', relationType: 'specializes_in', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:cara', targetEntityId: 'specialty:oncology', relationType: 'specializes_in', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:dex', targetEntityId: 'specialty:oncology', relationType: 'specializes_in', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ada', targetEntityId: 'board:abim', relationType: 'board_certified_in', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:cara', targetEntityId: 'board:abem', relationType: 'board_certified_in', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:ada', targetEntityId: 'credential:ca-med', relationType: 'holds_credential', directed: false }),
      createOntologyRelation({ sourceEntityId: 'provider:cara', targetEntityId: 'credential:ny-med', relationType: 'holds_credential', directed: false }),
      ...(crossInstitution
        ? [createOntologyRelation({ sourceEntityId: 'provider:ada', targetEntityId: 'institution:beta', relationType: 'affiliated_with', directed: false })]
        : []),
    ],
  });

  const events = createEventGraph({
    createdAt: capturedAt,
    events: [
      createProviderEvent({
        eventId: 'event:pub:ada',
        entityId: 'provider:ada',
        eventType: 'publication',
        source: 'openalex',
        timestamp: '2026-03-14T00:00:00.000Z',
        confidence: 0.92,
        rawEvidence: { doi: '10.1000/ada' },
      }),
      createProviderEvent({
        eventId: 'event:trial:ada',
        entityId: 'provider:ada',
        eventType: 'trial_registration',
        source: 'clinicaltrials',
        timestamp: '2026-03-15T00:00:00.000Z',
        confidence: 0.88,
        rawEvidence: { nct: 'NCT0001' },
      }),
      createProviderEvent({
        eventId: 'event:grant:cara',
        entityId: 'provider:cara',
        eventType: 'grant_award',
        source: 'nih-reporter',
        timestamp: '2026-03-13T00:00:00.000Z',
        confidence: 0.84,
        rawEvidence: { grant: 'R01-TEST' },
      }),
      ...(crossInstitution
        ? [createProviderEvent({
          eventId: 'event:address:ada',
          entityId: 'provider:ada',
          eventType: 'address_change',
          source: 'nppes',
          timestamp: '2026-03-21T00:00:00.000Z',
          confidence: 0.91,
          rawEvidence: { city: 'San Diego' },
        })]
        : []),
    ],
  });

  return createDualGraph({
    createdAt: capturedAt,
    ontology,
    events,
  });
}

function run(): void {
  const dualGraph = buildDualGraph();
  assert.equal(dualGraph.ontology.entities.some((entity) => entity.entityType === 'provider'), true);
  assert.equal(dualGraph.events.events.every((event) => Boolean(event.rawEvidence)), true);

  const projection = projectDualGraph(dualGraph, {
    mode: 'dual',
    now: '2026-03-15T12:00:00.000Z',
  });
  assert.equal(projection.nodes.some((node) => node.id === 'provider:ada' && node.layer === 'dual'), true);
  assert.equal(projection.nodes.some((node) => node.id === 'event:pub:ada' && node.kind === 'publication'), true);
  assert.equal(projection.edges.some((edge) => edge.relation === 'describes_entity'), true);

  const identity = createIdentityGraph({
    entities: [
      createIdentityEntity({
        entityId: 'provider:ada',
        entityType: 'provider',
        label: 'Dr. Ada',
        keys: { NPI: '1234567890', ORCID: '0000-0001' },
      }),
      createIdentityEntity({
        entityId: 'institution:alpha',
        entityType: 'institution',
        label: 'Alpha Health',
        keys: { ROR_ID: '01alpha' },
      }),
    ],
    relations: [
      createIdentityRelation({
        sourceEntityId: 'provider:ada',
        targetEntityId: 'institution:alpha',
        relationType: 'provider_to_institution',
      }),
    ],
  });
  const network = createNetworkGraph({
    entities: [
      createNetworkEntity({ entityId: 'provider:ada', label: 'Dr. Ada' }),
      createNetworkEntity({ entityId: 'provider:ben', label: 'Dr. Ben' }),
    ],
    edges: [
      createNetworkEdge({
        sourceEntityId: 'provider:ada',
        targetEntityId: 'provider:ben',
        relationshipType: 'co_author',
        weight: 2,
        firstSeen: '2026-03-10T00:00:00.000Z',
        lastSeen: '2026-03-15T00:00:00.000Z',
      }),
    ],
  });
  const intelligenceGraph = createIntelligenceGraph({
    createdAt: '2026-03-15T12:00:00.000Z',
    identity,
    events: dualGraph.events,
    network,
  });
  const intelligenceProjection = projectIntelligenceGraph(intelligenceGraph, {
    now: '2026-03-15T12:00:00.000Z',
  });

  assert.equal(intelligenceProjection.nodes.some((node) => node.id === 'provider:ada' && node.layer === 'intelligence'), true);
  assert.equal(intelligenceProjection.edges.some((edge) => edge.relation === 'co_author' && edge.layer === 'intelligence'), true);

  const graph = buildWeightedTestGraph();
  const pageRanks = pageRank(graph);
  const betweenness = betweennessCentrality(graph);
  const cutVertices = articulationPoints(graph);
  const communities = communityDetection(graph);

  assert.match(pageRanks[0]?.nodeId ?? '', /c|d/);
  assert.match(betweenness[0]?.nodeId ?? '', /c|d/);
  assert.deepEqual(cutVertices, ['c', 'd']);
  assert.equal(communities.length, 2);
  assert.equal(communities[0]?.size, 3);

  const weekOneGraph = buildDualGraph(false, '2026-03-15T12:00:00.000Z');
  const weekTwoGraph = buildDualGraph(true, '2026-03-22T12:00:00.000Z');
  const store = new InMemoryWeeklyGraphSnapshotStore();
  const weekOne = storeWeeklyGraphSnapshot(store, {
    dualGraph: weekOneGraph,
    capturedAt: '2026-03-15T12:00:00.000Z',
  });
  const weekTwo = storeWeeklyGraphSnapshot(store, {
    dualGraph: weekTwoGraph,
    capturedAt: '2026-03-22T12:00:00.000Z',
  });
  const delta = diffWeeklyGraphSnapshots(weekOne, weekTwo, {
    minCombinedShift: 0.01,
  });

  assert.equal(store.latest(weekTwoGraph.graphId)?.snapshotId, weekTwo.snapshotId);
  assert.equal(delta.newEdges.some((edge) => edge.source === 'provider:ada' && edge.target === 'institution:beta'), true);
  assert.equal(delta.centralityShifts.some((shift) => shift.nodeId === 'provider:ada'), true);
  assert.equal(delta.clusterChanges.length > 0, true);
  assert.equal(delta.severityScore > 0, true);

  const scores = scoreProviderInfluence(buildDualGraph(true));
  assert.equal(scores[0]?.providerId, 'provider:ada');
  assert.equal(scores[0]?.articulationPoint, true);
  assert.equal((scores[0]?.influenceScore ?? 0) > (scores.at(-1)?.influenceScore ?? 0), true);

  const previousSnapshot = createWeeklyGraphSnapshot({
    dualGraph: buildDualGraph(false, '2026-03-15T12:00:00.000Z'),
    capturedAt: '2026-03-15T12:00:00.000Z',
  });
  const currentSnapshot = createWeeklyGraphSnapshot({
    dualGraph: buildDualGraph(true, '2026-03-22T12:00:00.000Z'),
    capturedAt: '2026-03-22T12:00:00.000Z',
  });
  const storylineDelta = diffWeeklyGraphSnapshots(previousSnapshot, currentSnapshot, {
    minCombinedShift: 0.01,
  });
  const graphSignal = deriveStorylineGraphSignal({
    snapshot: currentSnapshot,
    delta: storylineDelta,
    entityIds: ['provider:ada'],
  });

  const baseCluster = {
    clusterId: 'cluster:1',
    fingerprint: 'fingerprint:1',
    storylineType: 'institution shift' as const,
    perspective: 'provider' as const,
    findings: [
      {
        findingId: 'finding:1',
        category: 'network',
        severity: 'medium' as const,
        title: 'Affiliation changed',
        summary: 'Provider changed institutional attachment.',
        explanation: 'Institutional relationship changed.',
        entityIds: ['provider:ada'],
        providerIds: ['provider:ada'],
        institutionIds: ['institution:beta'],
        graphEntityIds: ['provider:ada', 'institution:beta'],
        relatedFindingIds: [],
        evidence: [
          {
            source: 'nppes',
            claim: 'address changed',
            confidence: 0.92,
            timestamp: '2026-03-22T00:00:00.000Z',
          },
        ],
        actions: [],
        metadata: {},
        createdAt: '2026-03-22T00:00:00.000Z',
      },
    ],
    entityIds: ['provider:ada'],
    providerIds: ['provider:ada'],
    institutionIds: ['institution:beta'],
    firstObservedAt: '2026-03-20T00:00:00.000Z',
    lastObservedAt: '2026-03-22T00:00:00.000Z',
    recurrencePattern: 'emerging' as const,
    featureScores: {
      entityOverlap: 0.48,
      temporalProximity: 0.7,
      graphProximity: 0.62,
      typeAffinity: 0.45,
      recurrence: 0.38,
      cohesion: 0.52,
    },
    dominantKeywords: ['institution', 'shift'],
    metadata: {},
  };

  const withoutGraphWeight = rankStoryline({
    cluster: baseCluster,
    now: '2026-03-22T12:00:00.000Z',
    config: defaultStorylineEngineConfig,
  });
  const withGraphWeight = rankStoryline({
    cluster: {
      ...baseCluster,
      metadata: {
        graphSignal,
      },
    },
    now: '2026-03-22T12:00:00.000Z',
    config: defaultStorylineEngineConfig,
  });

  assert.equal(graphSignal.centralityShift > 0, true);
  assert.equal(withGraphWeight.progressionScore > withoutGraphWeight.progressionScore, true);
  assert.equal(['medium', 'high', 'critical'].includes(withGraphWeight.severity), true);
}

run();
