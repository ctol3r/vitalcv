import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  ClientTelemetryBodySchema,
  normalizeSignals,
} from '../models/ClientFingerprint';

const prisma = new PrismaClient();

describe('ClientFingerprint model', () => {
  beforeEach(async () => {
    await prisma.clientFingerprint.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('validates telemetry payloads', () => {
    const payload = {
      deviceId: randomUUID(),
      signals: {
        userAgent: 'Mozilla/5.0',
        timezone: 'America/Los_Angeles',
        tzOffset: -420,
        languages: ['en-US', 'en'],
        screen: {
          width: 1920,
          height: 1080,
        },
        platform: 'MacIntel',
      },
    };

    expect(() => ClientTelemetryBodySchema.parse(payload)).not.toThrow();
    expect(() =>
      ClientTelemetryBodySchema.parse({
        deviceId: 'not-a-uuid',
        signals: {},
      })
    ).toThrow();
  });

  it('persists a new fingerprint with normalized signals', async () => {
    const payload = ClientTelemetryBodySchema.parse({
      deviceId: randomUUID(),
      signals: {
        userAgent: 'Mozilla/5.0',
        timezone: 'UTC',
        screen: { width: 1280, height: 720 },
        languages: ['en-US'],
      },
    });

    const now = new Date();
    const record = await prisma.clientFingerprint.create({
      data: {
        deviceId: payload.deviceId,
        userId: null,
        signals: normalizeSignals(payload.signals),
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });

    expect(record.deviceId).toBe(payload.deviceId);
    expect(record.signals).toMatchObject({
      userAgent: 'Mozilla/5.0',
      timezone: 'UTC',
      screen: { width: 1280, height: 720 },
    });
  });

  it('updates lastSeenAt without losing firstSeenAt', async () => {
    const deviceId = randomUUID();
    const firstSeen = new Date('2024-01-01T00:00:00.000Z');

    await prisma.clientFingerprint.create({
      data: {
        deviceId,
        userId: 'user-123',
        signals: { userAgent: 'Test' },
        firstSeenAt: firstSeen,
        lastSeenAt: firstSeen,
      },
    });

    const updated = await prisma.clientFingerprint.upsert({
      where: { deviceId },
      create: {
        deviceId,
        userId: 'user-123',
        signals: {},
        firstSeenAt: firstSeen,
        lastSeenAt: firstSeen,
      },
      update: {
        signals: { timezone: 'UTC' },
        lastSeenAt: new Date(),
      },
    });

    expect(updated.firstSeenAt.toISOString()).toBe(firstSeen.toISOString());
    expect(updated.lastSeenAt.getTime()).toBeGreaterThan(firstSeen.getTime());
    expect(updated.signals).toMatchObject({ timezone: 'UTC' });
  });
});

