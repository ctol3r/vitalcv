import express from 'express';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import compactsStatusRouter from '../status.js';

const prisma = new PrismaClient();

describe('Compacts status consent gating', () => {
  const clinicianDid = 'did:example:consent-gating';
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/compacts/status', compactsStatusRouter);
  });

  beforeEach(async () => {
    await prisma.compactConsent.deleteMany({ where: { clinicianId: clinicianDid } });
    await prisma.compactsStatus.deleteMany({ where: { clinicianDid } });
    await prisma.iMLCEligibility.deleteMany({ where: { clinicianDid } });
    await prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid } });
    await prisma.counselingCompact.deleteMany({ where: { clinicianDid } });
  });

  afterAll(async () => {
    await prisma.compactConsent.deleteMany({ where: { clinicianId: clinicianDid } });
    await prisma.compactsStatus.deleteMany({ where: { clinicianDid } });
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
        clinicianId: clinicianDid,
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
});
import express from 'express';
import request from 'supertest';
import { describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import compactsStatusRouter from '../../compacts/status.js';

const prisma = new PrismaClient();

describe('Compacts status consent gating', () => {
  const clinicianDid = 'did:example:consent-gating';
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/compacts/status', compactsStatusRouter);
  });

  beforeEach(async () => {
    await prisma.compactConsent.deleteMany({ where: { clinicianId: clinicianDid } });
    await prisma.compactsStatus.deleteMany({ where: { clinicianDid } });
    await prisma.iMLCEligibility.deleteMany({ where: { clinicianDid } });
    await prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid } });
    await prisma.counselingCompact.deleteMany({ where: { clinicianDid } });
  });

  afterAll(async () => {
    await prisma.compactConsent.deleteMany({ where: { clinicianId: clinicianDid } });
    await prisma.compactsStatus.deleteMany({ where: { clinicianDid } });
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
        clinicianId: clinicianDid,
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
});

