import { describe, it, beforeEach, afterAll, expect } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { runAnnualCompactReevaluation } from '../annualReeval.js';

const prisma = new PrismaClient();
const clinicianDid = 'did:example:reeval';

describe('annual compact re-evaluation job', () => {
  beforeEach(async () => {
    await prisma.revalidationTask.deleteMany({});
    await prisma.clinicianCompactWallet.deleteMany({});
    await prisma.compactConsent.deleteMany({});
    await prisma.compactsStatus.deleteMany({ where: { clinicianDid } });
    await prisma.pSYPACTCompact.deleteMany({ where: { clinicianDid } });
    await prisma.didUserLink.deleteMany({ where: { did: clinicianDid } });
    await prisma.user.deleteMany({ where: { email: { contains: 'compact-reeval' } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates wallet entries based on compacts status', async () => {
    const clinicianId = await seedClinician();
    await prisma.compactConsent.create({
      data: {
        clinicianId,
        compactType: 'IMLC',
        consentGivenAt: new Date(),
      },
    });
    await prisma.compactsStatus.create({
      data: {
        clinicianDid,
        imlcStatus: 'ELIGIBLE',
        imlcHomeState: 'TX',
        imlcCompactStates: ['CA', 'CO'],
        psypactStatus: 'NOT_ELIGIBLE',
        psypactStates: [],
        counselingStatus: 'NOT_ELIGIBLE',
        counselingStates: [],
        lastComputedAt: new Date(),
      },
    });

    const summary = await runAnnualCompactReevaluation({ prisma });

    expect(summary.walletUpdates).toBe(1);
    expect(summary.revalidationTasks).toBe(0);

    const wallet = await prisma.clinicianCompactWallet.findUnique({
      where: {
        clinicianId_compactType: {
          clinicianId,
          compactType: 'IMLC',
        },
      },
    });

    expect(wallet?.privileges).toEqual(['CA', 'CO']);
    expect(wallet?.homeState).toBe('TX');
  });

  it('creates revalidation tasks when states are removed', async () => {
    const clinicianId = await seedClinician();
    await prisma.compactConsent.create({
      data: {
        clinicianId,
        compactType: 'IMLC',
        consentGivenAt: new Date(),
      },
    });

    await prisma.compactsStatus.create({
      data: {
        clinicianDid,
        imlcStatus: 'ELIGIBLE',
        imlcHomeState: 'TX',
        imlcCompactStates: ['CA'],
        psypactStatus: 'NOT_ELIGIBLE',
        psypactStates: [],
        counselingStatus: 'NOT_ELIGIBLE',
        counselingStates: [],
        lastComputedAt: new Date(),
      },
    });

    await prisma.clinicianCompactWallet.create({
      data: {
        clinicianId,
        compactType: 'IMLC',
        homeState: 'TX',
        privileges: ['CA', 'CO'],
      },
    });

    const summary = await runAnnualCompactReevaluation({ prisma });

    expect(summary.walletUpdates).toBe(1);
    expect(summary.revalidationTasks).toBe(1);

    const wallet = await prisma.clinicianCompactWallet.findUnique({
      where: {
        clinicianId_compactType: {
          clinicianId,
          compactType: 'IMLC',
        },
      },
    });
    expect(wallet?.privileges).toEqual(['CA']);

    const task = await prisma.revalidationTask.findFirst({
      where: {
        clinicianId,
        type: 'CREDENTIALING',
      },
    });

    expect(task).not.toBeNull();
    expect(task?.metadata).toMatchObject({
      compactType: 'IMLC',
      compactState: 'CO',
      reason: 'COMPACT_STATE_REMOVED',
    });
  });

  async function seedClinician(): Promise<string> {
    const email = `compact-reeval-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Compact Reeval',
        role: 'CLINICIAN',
      },
    });

    const profile = await prisma.clinicianProfile.create({
      data: {
        userId: user.id,
        npi: String(1000000000 + Math.floor(Math.random() * 9000000000)),
        specialty: 'Internal Medicine',
        state: 'TX',
      },
    });

    await prisma.didUserLink.create({
      data: {
        did: clinicianDid,
        userId: user.id,
      },
    });

    return profile.id;
  }
});
