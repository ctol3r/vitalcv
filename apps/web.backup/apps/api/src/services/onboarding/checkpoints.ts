import { randomUUID } from 'crypto';
import { differenceInMinutes } from 'date-fns';
import { PrismaClient, type Prisma } from '@prisma/client';

import { anchorOnboardingCheckpoint } from '../audit/anchor';

const prisma = new PrismaClient();

export interface OnboardingCheckpointInput {
  clinicianId: string;
  step: string;
  status: string;
  blockerCode?: string | null;
  metadata?: Prisma.JsonValue | null;
  timestamp?: Date;
  prisma?: PrismaClient;
}

export interface OnboardingCheckpointRecord {
  id: string;
  clinicianId: string;
  step: string;
  status: string;
  blockerCode: string | null;
  metadata: Prisma.JsonValue | null;
  timestamp: Date;
}

export interface OnboardingCheckpointSummary {
  clinicianId: string;
  checkpoints: OnboardingCheckpointRecord[];
  summary: {
    latestByStep: Record<
      string,
      {
        status: string;
        timestamp: string;
        blockerCode: string | null;
      }
    >;
    activeBlockers: Array<{
      step: string;
      blockerCode: string | null;
      status: string;
      since: string;
    }>;
    completedSteps: number;
    totalSteps: number;
    fastPathEligible: boolean;
  };
}

export interface BlockerAnalyticsEntry {
  blockerCode: string;
  label: string;
  occurrences: number;
  totalMinutes: number;
  medianMinutes: number;
  averageMinutes: number;
  affectedClinicians: number;
  latestExample?: {
    clinicianId: string;
    step: string;
    since: string;
  };
}

export interface BlockerAnalyticsResponse {
  generatedAt: string;
  windowDays: number;
  blockers: BlockerAnalyticsEntry[];
}

const fallbackCheckpoints = new Map<string, OnboardingCheckpointRecord[]>();

export async function recordOnboardingCheckpoint(
  input: OnboardingCheckpointInput,
): Promise<OnboardingCheckpointRecord> {
  const client = input.prisma ?? prisma;
  const delegate = resolveDelegate(client);
  const timestamp = input.timestamp ?? new Date();

  if (delegate) {
    const created = await delegate.create({
      data: {
        clinicianId: input.clinicianId,
        step: input.step,
        status: input.status,
        blockerCode: input.blockerCode ?? null,
        metadata: input.metadata ?? null,
        timestamp,
      },
    });
    await safeAnchor(created);
    return normalizeRecord(created);
  }

  const fallback = createFallbackRecord({
    clinicianId: input.clinicianId,
    step: input.step,
    status: input.status,
    blockerCode: input.blockerCode ?? null,
    metadata: input.metadata ?? null,
    timestamp,
  });
  await safeAnchor(fallback);
  return fallback;
}

export async function listOnboardingCheckpoints(
  clinicianId: string,
  options: { limit?: number; prisma?: PrismaClient } = {},
): Promise<OnboardingCheckpointRecord[]> {
  const client = options.prisma ?? prisma;
  const delegate = resolveDelegate(client);

  if (delegate) {
    const rows = await delegate.findMany({
      where: { clinicianId },
      orderBy: { timestamp: 'desc' },
      take: options.limit ?? 50,
    });
    return rows.map(normalizeRecord);
  }

  const sample = ensureFallbackSeed(clinicianId);
  const sliced = options.limit ? sample.slice(-options.limit) : sample;
  return [...sliced].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function listOnboardingCheckpointSummary(
  clinicianId: string,
  options: { prisma?: PrismaClient } = {},
): Promise<OnboardingCheckpointSummary> {
  const checkpoints = await listOnboardingCheckpoints(clinicianId, {
    prisma: options.prisma,
    limit: 100,
  });
  const summary = buildSummary(checkpoints);
  return {
    clinicianId,
    checkpoints,
    summary,
  };
}

export async function summarizeOnboardingBlockers(
  options: { windowDays?: number; prisma?: PrismaClient } = {},
): Promise<BlockerAnalyticsResponse> {
  const windowDays = Math.max(7, Math.min(options.windowDays ?? 45, 180));
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const client = options.prisma ?? prisma;
  const delegate = resolveDelegate(client);
  let records: OnboardingCheckpointRecord[];

  if (delegate) {
    const rows = await delegate.findMany({
      where: {
        timestamp: {
          gte: since,
        },
      },
      orderBy: { timestamp: 'asc' },
      take: 2000,
    });
    records = rows.map(normalizeRecord);
  } else {
    records = collectFallbackSince(since);
  }

  const analytics = buildBlockerAnalytics(records);
  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    blockers: analytics,
  };
}

async function safeAnchor(record: OnboardingCheckpointRecord) {
  try {
    await anchorOnboardingCheckpoint({
      checkpointId: record.id,
      clinicianId: record.clinicianId,
      step: record.step,
      status: record.status,
      blockerCode: record.blockerCode ?? undefined,
    });
  } catch (error) {
    console.warn('[onboarding][checkpoint] anchor failed', error);
  }
}

function resolveDelegate(client: PrismaClient) {
  const delegate = (client as unknown as Record<string, any>).onboardingCheckpoint;
  if (!delegate) {
    return null;
  }
  return delegate as typeof (client as any).onboardingKinetics;
}

function createFallbackRecord(input: {
  clinicianId: string;
  step: string;
  status: string;
  blockerCode: string | null;
  metadata: Prisma.JsonValue | null;
  timestamp: Date;
}): OnboardingCheckpointRecord {
  const bucket = ensureFallbackSeed(input.clinicianId);
  const record: OnboardingCheckpointRecord = {
    id: randomUUID(),
    clinicianId: input.clinicianId,
    step: input.step,
    status: input.status,
    blockerCode: input.blockerCode,
    metadata: input.metadata,
    timestamp: input.timestamp,
  };
  bucket.push(record);
  bucket.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  fallbackCheckpoints.set(input.clinicianId, bucket);
  return record;
}

function ensureFallbackSeed(clinicianId: string): OnboardingCheckpointRecord[] {
  if (fallbackCheckpoints.has(clinicianId)) {
    return fallbackCheckpoints.get(clinicianId)!;
  }
  const seeded = buildSyntheticTimeline(clinicianId);
  fallbackCheckpoints.set(clinicianId, seeded);
  return seeded;
}

function collectFallbackSince(since: Date): OnboardingCheckpointRecord[] {
  const items: OnboardingCheckpointRecord[] = [];
  for (const bucket of fallbackCheckpoints.values()) {
    for (const record of bucket) {
      if (record.timestamp >= since) {
        items.push(record);
      }
    }
  }
  return items.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function buildSyntheticTimeline(clinicianId: string): OnboardingCheckpointRecord[] {
  const now = Date.now();
  const steps: Array<Omit<OnboardingCheckpointRecord, 'id'>> = [
    {
      clinicianId,
      step: 'identity:npi',
      status: 'complete',
      blockerCode: null,
      metadata: { confidence: 0.93 },
      timestamp: new Date(now - 72 * 60 * 60 * 1000),
    },
    {
      clinicianId,
      step: 'documents:license',
      status: 'blocked_missing',
      blockerCode: 'missing_primary_license',
      metadata: {
        missing: ['WA license PDF'],
        reviewer: 'Automation',
      },
      timestamp: new Date(now - 58 * 60 * 60 * 1000),
    },
    {
      clinicianId,
      step: 'documents:license',
      status: 'complete',
      blockerCode: null,
      metadata: {
        clearedBy: 'CV-Scan',
      },
      timestamp: new Date(now - 50 * 60 * 60 * 1000),
    },
    {
      clinicianId,
      step: 'psv',
      status: 'blocked_attestation',
      blockerCode: 'npdb_alert',
      metadata: { findings: 1 },
      timestamp: new Date(now - 42 * 60 * 60 * 1000),
    },
    {
      clinicianId,
      step: 'psv',
      status: 'ready',
      blockerCode: null,
      metadata: { reviewer: 'AutoPSV' },
      timestamp: new Date(now - 30 * 60 * 60 * 1000),
    },
    {
      clinicianId,
      step: 'compact',
      status: 'pending',
      blockerCode: 'awaiting_home_state_attestation',
      metadata: { requestedAt: new Date(now - 18 * 60 * 60 * 1000).toISOString() },
      timestamp: new Date(now - 18 * 60 * 60 * 1000),
    },
  ];

  return steps.map((entry) => ({
    ...entry,
    id: randomUUID(),
  }));
}

function normalizeRecord(record: {
  id: string;
  clinicianId: string;
  step: string;
  status: string;
  blockerCode: string | null;
  metadata: Prisma.JsonValue | null;
  timestamp: Date;
}): OnboardingCheckpointRecord {
  return {
    ...record,
    timestamp: new Date(record.timestamp),
  };
}

function buildSummary(records: OnboardingCheckpointRecord[]) {
  const latestByStep: OnboardingCheckpointSummary['summary']['latestByStep'] = {};
  const sorted = [...records].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  for (const record of sorted) {
    latestByStep[record.step] = {
      status: record.status,
      timestamp: record.timestamp.toISOString(),
      blockerCode: record.blockerCode,
    };
  }

  const activeBlockers = Object.entries(latestByStep)
    .filter(([, detail]) => isBlockingStatus(detail.status))
    .map(([step, detail]) => ({
      step,
      blockerCode: detail.blockerCode,
      status: detail.status,
      since: detail.timestamp,
    }));

  const totalSteps = Object.keys(latestByStep).length;
  const completedSteps = Object.values(latestByStep).filter((detail) =>
    isCompleteStatus(detail.status),
  ).length;
  const fastPathEligible = activeBlockers.length === 0 && completedSteps >= totalSteps - 1;

  return {
    latestByStep,
    activeBlockers,
    completedSteps,
    totalSteps,
    fastPathEligible,
  };
}

function buildBlockerAnalytics(records: OnboardingCheckpointRecord[]): BlockerAnalyticsEntry[] {
  if (records.length === 0) {
    return [];
  }

  const groupedByKey = new Map<
    string,
    {
      label: string;
      durations: number[];
      clinicians: Set<string>;
      latest?: { clinicianId: string; step: string; since: string };
    }
  >();

  const byClinicianStep = new Map<string, OnboardingCheckpointRecord[]>();
  for (const record of records) {
    const key = `${record.clinicianId}:${record.step}`;
    const bucket = byClinicianStep.get(key) ?? [];
    bucket.push(record);
    byClinicianStep.set(key, bucket);
  }

  for (const [, bucket] of byClinicianStep.entries()) {
    bucket.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    let currentBlock: OnboardingCheckpointRecord | null = null;
    for (const entry of bucket) {
      if (!currentBlock && isBlockingStatus(entry.status)) {
        currentBlock = entry;
        continue;
      }
      if (currentBlock && clearsBlockingStatus(entry.status)) {
        const duration = Math.max(
          1,
          differenceInMinutes(entry.timestamp, currentBlock.timestamp),
        );
        const blockerKey = currentBlock.blockerCode ?? currentBlock.step;
        const analytics = groupedByKey.get(blockerKey) ?? {
          label: friendlyBlockerLabel(blockerKey),
          durations: [],
          clinicians: new Set<string>(),
        };
        analytics.durations.push(duration);
        analytics.clinicians.add(entry.clinicianId);
        analytics.latest = {
          clinicianId: entry.clinicianId,
          step: currentBlock.step,
          since: currentBlock.timestamp.toISOString(),
        };
        groupedByKey.set(blockerKey, analytics);
        currentBlock = null;
      }
    }
  }

  const results: BlockerAnalyticsEntry[] = [];
  for (const [blockerCode, data] of groupedByKey) {
    if (data.durations.length === 0) continue;
    const sortedDurations = [...data.durations].sort((a, b) => a - b);
    const median =
      sortedDurations.length % 2 === 1
        ? sortedDurations[(sortedDurations.length - 1) / 2]
        : (sortedDurations[sortedDurations.length / 2 - 1] +
            sortedDurations[sortedDurations.length / 2]) /
          2;
    const total = sortedDurations.reduce((sum, value) => sum + value, 0);

    results.push({
      blockerCode,
      label: data.label,
      occurrences: sortedDurations.length,
      totalMinutes: total,
      medianMinutes: Number(median.toFixed(1)),
      averageMinutes: Number((total / sortedDurations.length).toFixed(1)),
      affectedClinicians: data.clinicians.size,
      latestExample: data.latest,
    });
  }

  return results.sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 8);
}

function friendlyBlockerLabel(blockerCode: string) {
  if (blockerCode.includes('license')) return 'Primary license evidence';
  if (blockerCode.includes('npdb')) return 'NPDB clearance';
  if (blockerCode.includes('attestation')) return 'Attestation packet';
  if (blockerCode.includes('compact')) return 'Compact eligibility proof';
  if (blockerCode.includes('references')) return 'Peer references';
  if (blockerCode.includes('psv')) return 'PSV verification';
  return blockerCode.replace(/[_:]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function isBlockingStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized.includes('blocked') ||
    normalized.includes('missing') ||
    normalized.includes('hold') ||
    normalized.includes('awaiting') ||
    normalized.includes('pending')
  );
}

function clearsBlockingStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized.includes('ready') ||
    normalized.includes('complete') ||
    normalized.includes('resolved') ||
    normalized.includes('cleared') ||
    normalized.includes('scheduled')
  );
}

function isCompleteStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return normalized.includes('complete') || normalized.includes('ready');
}

