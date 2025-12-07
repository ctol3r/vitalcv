import { PrismaClient } from '@prisma/client';
import { clampRiskScore, mergeReasonTags } from '../models/RiskScore';

const prisma = new PrismaClient();

describe('RiskScore model', () => {
  beforeEach(async () => {
    await prisma.riskScore.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a risk score record with normalized score', async () => {
    const record = await prisma.riskScore.create({
      data: {
        deviceId: 'device-1',
        ipHash: 'hash-1',
        score: clampRiskScore(140),
        reasonTags: mergeReasonTags(['HIGH_VELOCITY'], ['SUSPICIOUS_UA']),
      },
    });

    expect(record.score).toBeLessThanOrEqual(100);
    expect(record.reasonTags).toEqual(['HIGH_VELOCITY', 'SUSPICIOUS_UA']);
  });

  it('upserts a risk score and merges reasons without duplicates', async () => {
    await prisma.riskScore.create({
      data: {
        deviceId: 'device-2',
        ipHash: 'hash-2',
        score: 20,
        reasonTags: ['BASELINE'],
      },
    });

    const updated = await prisma.riskScore.upsert({
      where: {
        deviceId_ipHash: {
          deviceId: 'device-2',
          ipHash: 'hash-2',
        },
      },
      create: {
        deviceId: 'device-2',
        ipHash: 'hash-2',
        score: 40,
        reasonTags: ['BASELINE'],
      },
      update: {
        score: clampRiskScore(72.4),
        reasonTags: mergeReasonTags(['BASELINE'], ['HIGH_VELOCITY', 'BASELINE']),
        lastUpdatedAt: new Date(),
      },
    });

    expect(updated.score).toBe(72);
    expect(updated.reasonTags).toEqual(['BASELINE', 'HIGH_VELOCITY']);
  });
});

