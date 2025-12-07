import type { CustodyRecord, PrismaClient, Prisma } from '@prisma/client';
import { PrismaClient as DefaultPrisma } from '@prisma/client';

import { buildSignalId, clampScore, ForensicsSignal, severityFromScore } from './types';

const prisma = new DefaultPrisma();
const LOGIN_LOOKBACK_DAYS = 30;

export interface BehaviorAnalyticsOptions {
  prisma?: PrismaClient;
  now?: Date;
  lookbackDays?: number;
}

export async function analyzeBehaviorSignals(
  clinicianId: string,
  options: BehaviorAnalyticsOptions = {},
): Promise<ForensicsSignal[]> {
  if (!clinicianId) {
    throw new Error('clinicianId is required for behavior analytics');
  }

  const client = options.prisma ?? prisma;
  const now = options.now ?? new Date();
  const lookbackStart = new Date(now);
  lookbackStart.setDate(now.getDate() - (options.lookbackDays ?? LOGIN_LOOKBACK_DAYS));

  const [devices, custodyEvents] = await Promise.all([
    client.walletDevice.findMany({
      where: { clinicianId },
      orderBy: { lastUsedAt: 'desc' },
    }),
    client.custodyRecord.findMany({
      where: {
        clinicianId,
        timestamp: { gte: lookbackStart },
      },
      orderBy: { timestamp: 'desc' },
      take: 200,
    }),
  ]);

  const signals: ForensicsSignal[] = [];
  const ipSignal = evaluateIpRanges(clinicianId, devices);
  if (ipSignal) {
    signals.push(ipSignal);
  }
  const deviceSignal = evaluateDeviceFingerprints(clinicianId, devices);
  if (deviceSignal) {
    signals.push(deviceSignal);
  }
  const oddHourSignal = evaluateOddHourAccess(clinicianId, custodyEvents, lookbackStart, now);
  if (oddHourSignal) {
    signals.push(oddHourSignal);
  }

  return signals;
}

function evaluateIpRanges(
  clinicianId: string,
  devices: Awaited<ReturnType<PrismaClient['walletDevice']['findMany']>>,
): ForensicsSignal | null {
  if (!devices.length) {
    return null;
  }
  const rangeCounts = new Map<string, number>();
  const lastSeenByRange = new Map<string, string>();

  devices.forEach((device) => {
    const metadata = coerceDeviceMetadata(device.metadata);
    const range = metadata.ipRange ?? metadata.ip ?? null;
    if (!range) {
      return;
    }
    rangeCounts.set(range, (rangeCounts.get(range) ?? 0) + 1);
    if (device.lastUsedAt) {
      const timestamp = device.lastUsedAt.toISOString();
      const previous = lastSeenByRange.get(range);
      if (!previous || timestamp > previous) {
        lastSeenByRange.set(range, timestamp);
      }
    }
  });

  if (rangeCounts.size <= 1) {
    return null;
  }

  const score = clampScore(Math.min(1, (rangeCounts.size - 1) / 4));

  return {
    id: buildSignalId('behavior', 'ip_range_anomaly'),
    clinicianId,
    category: 'behavior',
    type: 'ip_range_anomaly',
    severity: severityFromScore(score),
    score,
    description: `Wallet devices observed across ${rangeCounts.size} distinct IP ranges.`,
    observedAt: new Date().toISOString(),
    metadata: {
      ranges: Array.from(rangeCounts.entries()).map(([range, count]) => ({
        range,
        devices: count,
        lastSeen: lastSeenByRange.get(range),
      })),
    },
  };
}

function evaluateDeviceFingerprints(
  clinicianId: string,
  devices: Awaited<ReturnType<PrismaClient['walletDevice']['findMany']>>,
): ForensicsSignal | null {
  if (devices.length < 2) {
    return null;
  }
  const fingerprintMap = new Map<string, Set<string>>();
  devices.forEach((device) => {
    const metadata = coerceDeviceMetadata(device.metadata);
    if (!metadata.fingerprint) {
      return;
    }
    const current = fingerprintMap.get(metadata.fingerprint) ?? new Set<string>();
    current.add(device.deviceId);
    fingerprintMap.set(metadata.fingerprint, current);
  });

  const overlapping = Array.from(fingerprintMap.entries())
    .filter(([, ids]) => ids.size > 1)
    .map(([fingerprint, ids]) => ({ fingerprint, deviceIds: Array.from(ids.values()) }));

  if (!overlapping.length) {
    return null;
  }

  const score = clampScore(Math.min(1, overlapping.length / devices.length));
  return {
    id: buildSignalId('behavior', 'device_fingerprint_overlap'),
    clinicianId,
    category: 'behavior',
    type: 'device_fingerprint_overlap',
    severity: severityFromScore(score),
    score,
    description: 'Multiple wallet registrations share identical device fingerprints.',
    observedAt: new Date().toISOString(),
    metadata: { collisions: overlapping },
  };
}

function evaluateOddHourAccess(
  clinicianId: string,
  events: CustodyRecord[],
  start: Date,
  now: Date,
): ForensicsSignal | null {
  if (!events.length) {
    return null;
  }
  const oddEvents = events.filter((event) => {
    const hour = event.timestamp.getUTCHours();
    return hour < 5 || hour >= 23;
  });
  const ratio = clampScore(oddEvents.length / events.length);
  if (ratio < 0.25) {
    return null;
  }

  return {
    id: buildSignalId('behavior', 'odd_hour_access'),
    clinicianId,
    category: 'behavior',
    type: 'odd_hour_access',
    severity: severityFromScore(ratio),
    score: ratio,
    description: `${Math.round(ratio * 100)}% of custody events occurred during odd-hour windows.`,
    observedAt: events[0]?.timestamp.toISOString() ?? now.toISOString(),
    metadata: {
      oddEvents: oddEvents.slice(0, 10).map((event) => ({
        documentId: event.documentId,
        action: event.action,
        timestamp: event.timestamp.toISOString(),
      })),
      windowStart: start.toISOString(),
      totalEvents: events.length,
    },
  };
}

function coerceDeviceMetadata(metadata: Prisma.JsonValue | null | undefined): DeviceMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  const record = metadata as Record<string, unknown>;
  return {
    ipRange: coerceString(record.ipRange ?? record.ip_range ?? record.ip),
    ip: coerceString(record.ip),
    fingerprint: coerceString(record.fingerprint ?? record.deviceFingerprint),
    userAgent: coerceString(record.userAgent),
  };
}

interface DeviceMetadata {
  ipRange?: string | null;
  ip?: string | null;
  fingerprint?: string | null;
  userAgent?: string | null;
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length) {
    return value;
  }
  return null;
}


