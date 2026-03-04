import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';

const suite = process.env.DATABASE_URL ? describe : describe.skip;

const ORG_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_ORG_ID = '22222222-2222-2222-2222-222222222222';
const NPI = '1234567891';
const OTHER_NPI = '1234567892';

suite('revocation cascade routes', () => {
  beforeEach(async () => {
    await prisma.decisionCapsule.deleteMany({
      where: {
        subjectNpi: { in: [NPI, OTHER_NPI] },
      },
    });
    await prisma.verificationArtifact.deleteMany({
      where: {
        npi: { in: [NPI, OTHER_NPI] },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns 401 when tenant context is missing', async () => {
    const credentialId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const response = await request(app).get(`/api/revocation/cascade/${credentialId}`);

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'organization_context_required',
    });
  });

  it('returns 400 for malformed credentialId', async () => {
    const response = await request(app)
      .get('/api/revocation/cascade/not-a-uuid')
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'credentialId must be a valid UUID.',
    });
  });

  it('returns 404 when credential is not found', async () => {
    const credentialId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const response = await request(app)
      .get(`/api/revocation/cascade/${credentialId}`)
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: 'not_found',
    });
  });

  it('returns 403 for organization scope mismatch', async () => {
    const artifact = await prisma.verificationArtifact.create({
      data: {
        npi: OTHER_NPI,
        source: 'NURSYS',
        status: 'ACTIVE',
        checksum: 'scope-mismatch-checksum',
        trustState: 'verified',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        organizationId: OTHER_ORG_ID,
      },
    });

    const response = await request(app)
      .get(`/api/revocation/cascade/${artifact.id}`)
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: 'forbidden',
    });
  });

  it('returns populated cascade report with impacted decisions, employers, and deployments', async () => {
    const artifact = await prisma.verificationArtifact.create({
      data: {
        npi: NPI,
        source: 'NURSYS',
        status: 'ACTIVE',
        checksum: 'cascade-checksum-a',
        trustState: 'verified',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        organizationId: ORG_ID,
      },
    });

    const nonImpactedArtifact = await prisma.verificationArtifact.create({
      data: {
        npi: NPI,
        source: 'DEA',
        status: 'ACTIVE',
        checksum: 'cascade-checksum-b',
        trustState: 'verified',
        verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        organizationId: ORG_ID,
      },
    });

    const hiringDecision = await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'HIRING',
        decisionTimestamp: new Date('2026-02-01T10:00:00.000Z'),
        credentialIds: [artifact.id],
        issuerIds: ['issuer:nursys'],
        artifactHash: 'decision-hash-1',
        methodology: 'CRS_v1.0',
        status: 'VALID',
        metadata: { employerId: 'employer:alpha' },
      },
    });

    const deploymentDecision = await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'DEPLOYMENT',
        decisionTimestamp: new Date('2026-02-02T10:00:00.000Z'),
        credentialIds: [artifact.id],
        issuerIds: ['issuer:nursys'],
        artifactHash: 'decision-hash-2',
        methodology: 'CRS_v1.0',
        status: 'AT_RISK',
        metadata: {
          employerId: 'employer:beta',
          deploymentRef: 'deployment:icu-night-shift',
        },
      },
    });

    await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'PRIVILEGING',
        decisionTimestamp: new Date('2026-02-03T10:00:00.000Z'),
        credentialIds: [nonImpactedArtifact.id],
        issuerIds: ['issuer:dea'],
        artifactHash: 'decision-hash-3',
        methodology: 'CRS_v1.0',
        status: 'VALID',
        metadata: { employerId: 'employer:gamma' },
      },
    });

    const response = await request(app)
      .get(`/api/revocation/cascade/${artifact.id}`)
      .set('x-org-id', ORG_ID);

    expect(response.status).toBe(200);
    expect(response.body.credentialId).toBe(artifact.id);
    expect(Array.isArray(response.body.impactedDecisions)).toBe(true);
    expect(Array.isArray(response.body.impactedEmployers)).toBe(true);
    expect(Array.isArray(response.body.impactedDeployments)).toBe(true);
    expect(response.body.impactedDecisions).toHaveLength(2);
    expect(response.body.impactedEmployers).toHaveLength(2);
    expect(response.body.impactedDeployments).toHaveLength(1);

    const impactedDecisionIds = response.body.impactedDecisions.map(
      (decision: { decisionId: string }) => decision.decisionId,
    );
    expect(impactedDecisionIds).toEqual(
      expect.arrayContaining([hiringDecision.id, deploymentDecision.id]),
    );

    expect(response.body.impactedDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionId: deploymentDecision.id,
          decisionType: 'DEPLOYMENT',
          employerId: 'employer:beta',
          deploymentRef: 'deployment:icu-night-shift',
        }),
      ]),
    );

    expect(
      response.body.impactedDeployments.every(
        (deployment: { decisionId: string }) => impactedDecisionIds.includes(deployment.decisionId),
      ),
    ).toBe(true);

    expect(
      response.body.impactedEmployers.find(
        (employer: { employerId: string }) => employer.employerId === 'employer:beta',
      ),
    ).toEqual(
      expect.objectContaining({
        employerId: 'employer:beta',
        impactedDecisionCount: 1,
        impactedDeploymentCount: 1,
      }),
    );
  });

  it('returns legacy blast-radius alias with counts consistent with new report', async () => {
    const artifact = await prisma.verificationArtifact.create({
      data: {
        npi: NPI,
        source: 'STATE_BOARD',
        status: 'ACTIVE',
        checksum: 'legacy-checksum',
        trustState: 'verified',
        verifiedAt: new Date('2026-01-15T00:00:00.000Z'),
        organizationId: ORG_ID,
      },
    });

    await prisma.decisionCapsule.create({
      data: {
        subjectDid: `did:npi:${NPI}`,
        subjectNpi: NPI,
        decisionType: 'DEPLOYMENT',
        decisionTimestamp: new Date('2026-02-10T10:00:00.000Z'),
        credentialIds: [artifact.id],
        issuerIds: ['issuer:state'],
        artifactHash: 'legacy-decision-hash',
        methodology: 'CRS_v1.0',
        status: 'VALID',
        metadata: {
          employerId: 'employer:delta',
          deploymentRef: 'deployment:telehealth',
        },
      },
    });

    const [newRouteResponse, aliasResponse] = await Promise.all([
      request(app)
        .get(`/api/revocation/cascade/${artifact.id}`)
        .set('x-org-id', ORG_ID),
      request(app)
        .get(`/api/decisions/blast-radius/${artifact.id}`)
        .set('x-org-id', ORG_ID),
    ]);

    expect(newRouteResponse.status).toBe(200);
    expect(aliasResponse.status).toBe(200);
    expect(aliasResponse.body).toEqual(
      expect.objectContaining({
        credentialId: artifact.id,
        impactedCapsules: expect.any(Array),
        impactedNpis: expect.any(Array),
        impactedDecisionTypes: expect.any(Array),
        totalImpacted: expect.any(Number),
      }),
    );
    expect(aliasResponse.body.totalImpacted).toBe(aliasResponse.body.impactedCapsules.length);
    expect(aliasResponse.body.totalImpacted).toBe(newRouteResponse.body.impactedDecisions.length);
    expect(aliasResponse.body.impactedNpis).toEqual([NPI]);
    expect(aliasResponse.body.impactedDecisionTypes).toEqual(['DEPLOYMENT']);
  });
});
