import express from 'express';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import compactsStatusRouter from '../status.js';

const prisma = new PrismaClient();
const clinicianDid = 'did:example:consent-gating';

describe('Compacts status consent gating', () => {
  let app: express.Application;
  let clinicianProfileId: string | null = null;
  let userId: string | null = null;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/compacts/status', compactsStatusRouter);
  });

  beforeEach(async () => {
    await teardownClinicianFixture();
    const fixture = await createClinicianFixture();
    clinicianProfileId = fixture.clinicianProfileId;
    userId = fixture.userId;
  });

  afterAll(async () => {
    await teardownClinicianFixture();
    await prisma.$disconnect();
  });

  it('returns 403 when no compact consent is recorded', async () => {
    await prisma.compactsStatus.create({
      data: {
        clinicianDid,
        imlcStatus: 'ELIGIBLE',
        imlcCompactStates: ['AL', 'AZ'],
        psypactStatus: 'NOT_ELIGIBLE',
        psypactStates: [],
        counselingStatus: 'NOT_ELIGIBLE',
        counselingStates: [],
        lastComputedAt: new Date(),
        nextRefreshAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const response = await request(app).get(`/api/compacts/status/${clinicianDid}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('COMPACT_CONSENT_REQUIRED');
    expect(response.body.clinicianId).toBe(clinicianProfileId);
  });

  it('returns consent-aware sections when consent exists for IMLC only', async () => {
    const now = new Date();
    await prisma.compactsStatus.create({
      data: {
        clinicianDid,
        imlcStatus: 'ELIGIBLE',
        imlcHomeState: 'TX',
        imlcCompactStates: ['AL', 'AZ'],
        psypactStatus: 'ELIGIBLE',
        psypactStates: ['CO', 'IL'],
        counselingStatus: 'ACTIVE',
        counselingStates: ['VA'],
        counselingHomeState: 'VA',
        lastComputedAt: now,
        nextRefreshAt: new Date(now.getTime() + 60 * 60 * 1000),
      },
    });

    await prisma.compactConsent.create({
      data: {
        clinicianId: clinicianProfileId!,
        compactType: 'IMLC',
        consentGivenAt: new Date(),
      },
    });

    const response = await request(app).get(`/api/compacts/status/${clinicianDid}`);

    expect(response.status).toBe(200);
    expect(response.body.imlc.consentRequired).toBe(false);
    expect(response.body.psypact.consentRequired).toBe(true);
    expect(response.body.counseling.consentRequired).toBe(true);
    expect(response.body.unified.consentedCompactTypes).toEqual(['IMLC']);
    expect(response.body.imlc.status).toBe('ELIGIBLE');
    expect(response.body.psypact.status).toBe('CONSENT_REQUIRED');
  });

  async function createClinicianFixture() {
    const email = `compact-consent-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Compact Clinician',
        role: 'CLINICIAN',
      },
    });

    const profile = await prisma.clinicianProfile.create({
      data: {
        userId: user.id,
        npi: String(1000000000 + Math.floor(Math.random() * 9000000000)),
        specialty: 'General Medicine',
        state: 'TX',
      },
    });

    await prisma.didUserLink.create({
      data: {
        did: clinicianDid,
        userId: user.id,
      },
    });

    return { userId: user.id, clinicianProfileId: profile.id };
  }

  async function teardownClinicianFixture() {
    await prisma.compactsStatus.deleteMany({ where: { clinicianDid } });
    await prisma.iMLCEligibility.deleteMany({ where: { clinicianDid } });
    await prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid } });
    await prisma.counselingCompact.deleteMany({ where: { clinicianDid } });
    if (clinicianProfileId) {
      await prisma.compactConsent.deleteMany({ where: { clinicianId: clinicianProfileId } });
    }
    await prisma.didUserLink.deleteMany({ where: { did: clinicianDid } });
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    clinicianProfileId = null;
    userId = null;
  }
});
