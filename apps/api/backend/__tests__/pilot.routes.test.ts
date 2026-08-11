import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';

const runPilotRouteSuite = process.env.DATABASE_URL ? describe : describe.skip;

beforeEach(async () => {
  await prisma.pilotPlan.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.verifierAcceptance.deleteMany();
  await prisma.pilotOrg.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

runPilotRouteSuite('pilot routes', () => {
  it('resolves verifier cross-check links', async () => {
    const created = await prisma.shareLink.create({
      data: {
        npi: '1234567890',
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    });

    const firstVisit = await request(app).get(`/api/verify/${created.id}`);
    expect(firstVisit.status).toBe(200);
    expect(firstVisit.body).toMatchObject({
      source: 'NPI:1234567890',
      status: 'VERIFIED',
      monitoring: 'pending verifier confirmation',
      signature: expect.stringContaining('rev-'),
      hash: expect.any(String),
    });
    expect(typeof firstVisit.body.timestamp).toBe('string');

    const viewedRecord = await prisma.shareLink.findUnique({
      where: { id: created.id },
    });
    expect(viewedRecord?.firstViewedAt).toBeTruthy();

    const secondVisit = await request(app).get(`/api/verify/${created.id}`);
    expect(secondVisit.status).toBe(200);
    expect(secondVisit.body.status).toBe('VERIFIED');
  });

  // These two cases previously asserted that POST /api/pilot/acceptance
  // accepted an unauthenticated write (201) and validated its body (400). Both
  // were green throughout, because they described the defect as the contract:
  // the endpoint had no authentication, and its rows were counted into the
  // metrics payload as "employers accepted". The route is retired (VCD-01d);
  // full reasoning and the primary guard live in
  // src/routes/__tests__/pilotAcceptanceCounterRetired.test.ts.
  it('no longer accepts an unauthenticated acceptance write', async () => {
    const res = await request(app).post('/api/pilot/acceptance').send({
      organization: 'Regional Health Center',
    });

    expect(res.status).toBe(404);
  });

  it('returns YC and pilot metrics aggregates', async () => {
    await prisma.shareLink.createMany({
      data: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          npi: '1111111111',
          createdAt: new Date('2026-01-01T10:00:00.000Z'),
          firstViewedAt: new Date('2026-01-01T10:12:00.000Z'),
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          npi: '2222222222',
          createdAt: new Date('2026-01-02T09:00:00.000Z'),
          firstViewedAt: new Date('2026-01-02T09:36:00.000Z'),
        },
        {
          id: '00000000-0000-0000-0000-000000000003',
          npi: '1111111111',
          createdAt: new Date('2026-01-03T08:00:00.000Z'),
        },
      ],
    });

    // Seeded on purpose: rows may still exist from before the counter was
    // retired (VCD-01d), and no metrics payload may surface them again.
    await prisma.verifierAcceptance.createMany({
      data: [
        { organization: 'Regional Health Center' },
        { organization: 'Metro Credential Group' },
      ],
    });

    const yc = await request(app).get('/api/metrics/yc');
    expect(yc.status).toBe(200);
    expect(yc.body).toMatchObject({
      totalNPIs: 2,
      shareLinks: 3,
      verifierViews: 2,
      exports: 0,
      activePilotOrgs: 0,
      estimatedRevenueImpact: 0,
    });
    expect(yc.body).not.toHaveProperty('verifierAcceptances');
    expect(typeof yc.body.avgTimeToView).toBe('number');
    expect(yc.body.estimatedStartDateAccelerationDays).not.toBeNull();

    const report = await request(app).get('/api/pilot/report');
    expect(report.status).toBe(200);
    expect(report.body).toMatchObject({
      totalNPIs: 2,
      shareLinks: 3,
      verifierViews: 2,
      exports: 0,
      pilotOrgCount: 0,
      bundlesGenerated: 0,
      activePilotOrgs: 0,
      estimatedRevenueImpact: 0,
      pilotOrgs: [],
    });
  });

  it('activates pilot organizations', async () => {
    const res = await request(app).post('/api/pilot/activate').send({
      organizationName: 'Regional Health Center',
      contactEmail: 'pilot-access@regional.example',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      organization: 'Regional Health Center',
      contactEmail: 'pilot-access@regional.example',
      accepted: true,
      id: expect.any(String),
    });

    const created = await prisma.pilotOrg.findFirst({
      where: {
        name: 'Regional Health Center',
      },
    });
    expect(created).not.toBeNull();
    expect(created?.accepted).toBe(true);

    const report = await request(app).get('/api/pilot/report');
    expect(report.status).toBe(200);
    expect(report.body.pilotOrgCount).toBe(1);
    expect(report.body.activePilotOrgs).toBe(1);
    expect(report.body.pilotOrgs).toHaveLength(1);
    expect(report.body.pilotOrgs[0]).toMatchObject({
      name: 'Regional Health Center',
      bundlesGenerated: 0,
    });
  });

  it('rejects invalid pilot activation requests without crashing the process', async () => {
    const res = await request(app).post('/api/pilot/activate').send({
      contactEmail: 'pilot-access@regional.example',
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'organizationName is required',
    });
  });

  it('increments pilot plan bundle count when artifact bundle is generated', async () => {
    const activation = await request(app).post('/api/pilot/activate').send({
      organizationName: 'Regional Health Center',
      contactEmail: 'pilot-access@regional.example',
    });
    expect(activation.status).toBe(201);
    expect(activation.body.id).toBeTruthy();

    const bundle = await request(app).get(`/api/artifact/bundle/1234567890?organizationId=${activation.body.id}`);
    expect(bundle.status).toBe(200);

    const report = await request(app).get('/api/pilot/report');
    expect(report.status).toBe(200);
    expect(report.body.pilotOrgs).toHaveLength(1);
    expect(report.body.pilotOrgs[0]).toMatchObject({
      name: 'Regional Health Center',
      bundlesGenerated: 1,
    });

    const metrics = await request(app).get('/api/metrics/yc');
    expect(metrics.status).toBe(200);
    expect(metrics.body.bundlesGenerated).toBe(1);
    expect(metrics.body.estimatedRevenueImpact).toBe(7000);
  });
});
