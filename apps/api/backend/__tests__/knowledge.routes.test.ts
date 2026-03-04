import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const NPI = '1234567893';
const ORG_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG_ID = '22222222-2222-2222-2222-222222222222';

type ResponseNode = {
  id: string;
  label: string;
  group: 'credential' | 'issuer' | 'decision' | 'employer' | 'trust_state';
};

type ResponseEdge = {
  source: string;
  target: string;
  label: string;
};

suite('knowledge graph routes', () => {
  beforeEach(async () => {
    await prisma.decisionCapsule.deleteMany({
      where: { subjectNpi: NPI },
    });
    await prisma.verificationArtifact.deleteMany({
      where: { npi: NPI },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 401 when tenant context is missing', async () => {
    const response = await request(app).get(`/api/knowledge/${NPI}`);
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'organization_context_required',
    });
  });

  it('returns 400 for invalid NPI', async () => {
    const response = await request(app)
      .get('/api/knowledge/not-an-npi')
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invalid NPI format — expected 10 digits',
    });
  });

  it('returns an empty graph with zero provenance counts when no source data exists', async () => {
    const response = await request(app)
      .get(`/api/knowledge/${NPI}`)
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(200);
    expect(response.body.npi).toBe(NPI);
    expect(response.body.graph).toEqual({ nodes: [], edges: [] });
    expect(response.body.provenance).toEqual({
      trust_state: { count: 0, values: [] },
      decision_capsules: { count: 0 },
      verification_artifacts: { count: 0 },
    });
    expect(typeof response.body.generatedAt).toBe('string');
  });

  it('derives nodes and edges with strict employer metadata and tenant artifact isolation', async () => {
    const orgArtifact = await prisma.verificationArtifact.create({
      data: {
        npi: NPI,
        source: 'NURSYS',
        status: 'ACTIVE',
        checksum: 'checksum-org-a',
        trustState: 'verified',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        organizationId: ORG_ID,
      },
    });

    const otherOrgArtifact = await prisma.verificationArtifact.create({
      data: {
        npi: NPI,
        source: 'DEA',
        status: 'ACTIVE',
        checksum: 'checksum-org-b',
        trustState: 'verified_monitoring',
        verifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        organizationId: OTHER_ORG_ID,
      },
    });

    await prisma.verificationArtifact.create({
      data: {
        npi: NPI,
        source: 'STATE_BOARD',
        status: 'ACTIVE',
        checksum: 'checksum-null-org',
        trustState: 'expiring_soon',
        verifiedAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    });

    const withEmployer = await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'HIRING',
        decisionTimestamp: new Date('2026-02-01T00:00:00.000Z'),
        credentialIds: [orgArtifact.id],
        issuerIds: ['issuer:nursys'],
        artifactHash: 'capsule-hash-1',
        methodology: 'CRS_v1.0',
        status: 'VALID',
        metadata: { employerId: 'General Hospital' },
      },
    });

    const withoutEmployer = await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'PRIVILEGING',
        decisionTimestamp: new Date('2026-02-02T00:00:00.000Z'),
        credentialIds: ['missing-credential-id'],
        issuerIds: ['issuer:missing'],
        artifactHash: 'capsule-hash-2',
        methodology: 'CRS_v1.0',
        status: 'VALID',
        metadata: { note: 'missing employer metadata' },
      },
    });

    const linkedToOtherOrgArtifact = await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'DEPLOYMENT',
        decisionTimestamp: new Date('2026-02-03T00:00:00.000Z'),
        credentialIds: [otherOrgArtifact.id],
        issuerIds: ['issuer:dea'],
        artifactHash: 'capsule-hash-3',
        methodology: 'CRS_v1.0',
        status: 'AT_RISK',
        metadata: { employerId: 'Other Employer' },
      },
    });

    const response = await request(app)
      .get(`/api/knowledge/${NPI}`)
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(200);
    expect(response.body.npi).toBe(NPI);

    const nodes = response.body.graph.nodes as ResponseNode[];
    const edges = response.body.graph.edges as ResponseEdge[];

    expect(response.body.provenance).toEqual({
      trust_state: { count: 1, values: ['verified'] },
      decision_capsules: { count: 3 },
      verification_artifacts: { count: 1 },
    });

    const credentialNodeId = `credential-${orgArtifact.id}`;
    const otherCredentialNodeId = `credential-${otherOrgArtifact.id}`;
    const issuerNodeId = `issuer-${encodeURIComponent('NURSYS')}`;
    const trustStateNodeId = 'trust-state-verified';

    expect(nodes.some((node) => node.id === credentialNodeId)).toBe(true);
    expect(nodes.some((node) => node.id === otherCredentialNodeId)).toBe(false);
    expect(nodes.some((node) => node.id === issuerNodeId)).toBe(true);
    expect(nodes.some((node) => node.id === trustStateNodeId)).toBe(true);
    expect(nodes.filter((node) => node.group === 'decision')).toHaveLength(3);
    expect(nodes.filter((node) => node.group === 'employer')).toHaveLength(2);

    expect(edges).toEqual(
      expect.arrayContaining([
        {
          source: credentialNodeId,
          target: issuerNodeId,
          label: 'ISSUED_BY',
        },
        {
          source: credentialNodeId,
          target: trustStateNodeId,
          label: 'HAS_TRUST_STATE',
        },
        {
          source: credentialNodeId,
          target: `decision-${withEmployer.id}`,
          label: 'SUPPORTS_DECISION',
        },
        {
          source: `decision-${withEmployer.id}`,
          target: `employer-${encodeURIComponent('General Hospital')}`,
          label: 'EVALUATED_FOR',
        },
        {
          source: `decision-${linkedToOtherOrgArtifact.id}`,
          target: `employer-${encodeURIComponent('Other Employer')}`,
          label: 'EVALUATED_FOR',
        },
      ]),
    );

    expect(
      edges.some(
        (edge) =>
          edge.source === `decision-${withoutEmployer.id}` &&
          edge.label === 'EVALUATED_FOR',
      ),
    ).toBe(false);

    expect(
      edges.some(
        (edge) =>
          edge.source === otherCredentialNodeId &&
          edge.label === 'SUPPORTS_DECISION',
      ),
    ).toBe(false);
  });
});
