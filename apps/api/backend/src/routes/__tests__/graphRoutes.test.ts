import express from 'express';
import { gunzipSync } from 'node:zlib';
import request from 'supertest';
import prisma from '../../graphql/prisma_client';
import { registerGraphRoutes } from '../graph';
import { runGraphRebuild } from '../../services/graph-engine/rebuildEngine';
import { createGraphNodeId } from '../../services/graph-engine/ids';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerGraphRoutes(app);
  return app;
}

async function resetState(): Promise<void> {
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
  await prisma.workspaceMembership.deleteMany({});
  await prisma.organizationProfile.deleteMany({});
  await prisma.organization.deleteMany({});
  await prisma.personProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.auditSnapshot.deleteMany({});
  await prisma.verificationArtifact.deleteMany({});
  await prisma.searchObjectACL.deleteMany({});
  await prisma.searchObject.deleteMany({});
}

async function seedRoutesFixture(): Promise<string> {
  const user = await prisma.user.create({
    data: {
      clerkUserId: 'route_user',
      email: 'route_user@example.com',
    },
  });
  await prisma.personProfile.create({
    data: {
      userId: user.id,
      npi: '3334567890',
      firstName: 'Route',
      lastName: 'Tester',
      specialty: 'Cardiology',
      stateOfPractice: 'CA',
    },
  });
  await prisma.verificationArtifact.create({
    data: {
      id: '00000000-0000-0000-0000-000000000333',
      npi: '3334567890',
      source: 'NPPES',
      status: 'ACTIVE',
      checksum: 'route-artifact',
      verifiedAt: new Date('2026-03-14T12:00:00.000Z'),
      rawPayload: {
        credentialType: 'Route Credential',
        specialty: 'Cardiology',
        state: 'CA',
      },
    },
  });
  await prisma.searchObject.create({
    data: {
      id: '00000000-0000-0000-0000-000000000b01',
      type: 'FAQ_DOC',
      title: 'Route Graph Note',
      body: 'Cardiology route note.',
      metadata: {
        tags: ['cardiology', 'route'],
      },
      embedding: [0.3, 0.4],
    },
  });

  await runGraphRebuild({ buildType: 'full', graphMode: 'blended', requestedBy: 'route-test' });

  return createGraphNodeId({
    type: 'clinician',
    sourceKind: 'npi',
    sourceId: '3334567890',
  });
}

describe('graph routes', () => {
  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.$disconnect();
  });

  it('serves global and local graph queries with the canonical contract', async () => {
    const clinicianNodeId = await seedRoutesFixture();
    const app = buildApp();

    const global = await request(app)
      .get('/api/graph/global?graphMode=blended&limit=100')
      .expect(200);

    expect(global.body.nodes.length).toBeGreaterThan(0);
    expect(global.body.edges.length).toBeGreaterThan(0);
    expect(global.body.snapshotId).toBeTruthy();
    expect(global.body.stats.totalNodes).toBeGreaterThan(0);
    expect(global.body.intelligence).toBeTruthy();
    expect(global.body.intelligence.metrics.hubCount).toBeGreaterThan(0);

    const local = await request(app)
      .get(`/api/graph/local/${encodeURIComponent(clinicianNodeId)}?depth=2`)
      .expect(200);

    expect(local.body.focusNodeId).toBe(clinicianNodeId);
    expect(local.body.nodes.some((node: { id: string }) => node.id === clinicianNodeId)).toBe(true);
    expect(local.body.nodes.length).toBeLessThanOrEqual(global.body.nodes.length);
    expect(local.body.intelligence).toBeTruthy();
  });

  it('persists presets and layout state through the API', async () => {
    const clinicianNodeId = await seedRoutesFixture();
    const app = buildApp();

    const presetResponse = await request(app)
      .post('/api/graph/presets')
      .send({
        ownerKey: 'user:test',
        name: 'Cardiology Local',
        graphMode: 'blended',
        focusNodeId: clinicianNodeId,
        depth: 2,
        filters: { tags: ['cardiology'] },
        display: { clusterMode: 'type' },
        physics: { frozen: false },
        camera: { x: 0, y: 0, zoom: 1 },
        pinnedNodes: {},
      })
      .expect(201);

    expect(presetResponse.body.id).toBeTruthy();

    const presetsResponse = await request(app)
      .get('/api/graph/presets?ownerKey=user:test')
      .expect(200);

    expect(presetsResponse.body.presets).toHaveLength(1);
    expect(presetsResponse.body.presets[0].name).toBe('Cardiology Local');

    const layoutResponse = await request(app)
      .post('/api/graph/layout/save')
      .send({
        ownerKey: 'user:test',
        scopeType: 'local',
        scopeKey: clinicianNodeId,
        graphMode: 'blended',
        filterSignature: 'test-signature',
        positions: {
          [clinicianNodeId]: { x: 100, y: 150 },
        },
        pinnedNodes: {
          [clinicianNodeId]: { x: 100, y: 150 },
        },
        frozenNodeIds: [clinicianNodeId],
        camera: { x: 10, y: 20, zoom: 1.2 },
        display: { clusterMode: 'type' },
      })
      .expect(201);

    expect(layoutResponse.body.ownerKey).toBe('user:test');

    const layoutLoadResponse = await request(app)
      .get('/api/graph/layout')
      .query({
        ownerKey: 'user:test',
        scopeType: 'local',
        scopeKey: clinicianNodeId,
        graphMode: 'blended',
        filterSignature: 'test-signature',
      })
      .expect(200);

    expect(layoutLoadResponse.body.pinnedNodes[clinicianNodeId]).toEqual({ x: 100, y: 150 });

    const pinResponse = await request(app)
      .post('/api/graph/node/pin')
      .send({
        ownerKey: 'user:test',
        scopeType: 'local',
        scopeKey: clinicianNodeId,
        graphMode: 'blended',
        filterSignature: 'test-signature',
        nodeId: clinicianNodeId,
        x: 120,
        y: 180,
      })
      .expect(200);

    expect(pinResponse.body.pinnedNodes[clinicianNodeId]).toEqual({ x: 120, y: 180 });
  });

  it('deduplicates queued AI suggestion batches and exposes graph diagnostics', async () => {
    const clinicianNodeId = await seedRoutesFixture();
    const app = buildApp();

    const firstBatch = await request(app)
      .post('/api/graph/ai-links/suggest')
      .send({
        sync: false,
        graphMode: 'blended',
        targetNodeId: clinicianNodeId,
        maxSuggestionsPerNode: 5,
        minConfidence: 0.2,
      })
      .expect(202);

    const secondBatch = await request(app)
      .post('/api/graph/ai-links/suggest')
      .send({
        sync: false,
        graphMode: 'blended',
        targetNodeId: clinicianNodeId,
        maxSuggestionsPerNode: 5,
        minConfidence: 0.2,
      })
      .expect(202);

    expect(secondBatch.body.batchId).toBe(firstBatch.body.batchId);
    expect(secondBatch.body.deduped).toBe(true);

    const diagnostics = await request(app)
      .get('/api/graph/diagnostics?limit=5')
      .expect(200);

    expect(diagnostics.body.snapshotFreshness).toBeTruthy();
    expect(Array.isArray(diagnostics.body.payloadSizeDiagnostics)).toBe(true);
    expect(Array.isArray(diagnostics.body.recentBuildRuns)).toBe(true);
  });

  it('serves mobile graph payloads with bounded pagination and compression support', async () => {
    const clinicianNodeId = await seedRoutesFixture();
    const app = buildApp();

    const firstPage = await request(app)
      .get(`/api/graph/local/${encodeURIComponent(clinicianNodeId)}?view=mobile&depth=1&limit=1`)
      .expect(200);

    expect(firstPage.body.view).toBe('mobile');
    expect(firstPage.body.nodes).toHaveLength(1);
    expect(firstPage.body.page.limit).toBe(1);
    expect(firstPage.body.page.nextCursor).toBeTruthy();
    expect(Array.isArray(firstPage.body.relationships)).toBe(true);

    const secondPage = await request(app)
      .get(`/api/graph/local/${encodeURIComponent(clinicianNodeId)}?view=mobile&depth=1&limit=1&cursor=${firstPage.body.page.nextCursor}`)
      .expect(200);

    expect(secondPage.body.nodes).toHaveLength(1);
    expect(secondPage.body.nodes[0].id).not.toBe(firstPage.body.nodes[0].id);

    const compressed = await request(app)
      .get(`/api/graph/mobile/${encodeURIComponent(clinicianNodeId)}?limit=2`)
      .set('Accept-Encoding', 'gzip')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(compressed.headers['content-encoding']).toBe('gzip');
    const compressedBody = Buffer.isBuffer(compressed.body) ? compressed.body : Buffer.from(compressed.body);
    let decoded = compressedBody.toString('utf8');
    try {
      decoded = gunzipSync(compressedBody).toString('utf8');
    } catch {
      decoded = compressedBody.toString('utf8');
    }
    const inflated = JSON.parse(decoded);
    expect(inflated.view).toBe('mobile');
    expect(inflated.nodes.length).toBeLessThanOrEqual(2);
    expect(Array.isArray(inflated.relationships)).toBe(true);
  });

  it('builds the investigation graph payload for a provider', async () => {
    await seedRoutesFixture();
    const app = buildApp();

    const response = await request(app)
      .get('/api/graph/investigation')
      .query({
        providerId: '3334567890',
        depth: 2,
        relationshipTypes: 'institutional,co_author',
      })
      .expect(200);

    expect(response.body.schema).toBe('https://vitalcv.com/graph/investigation/v1');
    expect(Array.isArray(response.body.nodes)).toBe(true);
    expect(Array.isArray(response.body.edges)).toBe(true);
    expect(response.body.highlights).toBeTruthy();
    expect(response.body.semanticZoom).toBeTruthy();
  });
});
