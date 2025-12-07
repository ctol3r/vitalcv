import { createHash } from 'crypto';
import { PrismaClient, type Prisma, type SafetySignal as PrismaSafetySignal } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

export const SAFETY_SIGNAL_TYPES = ['near-miss', 'adverse-event', 'commendation'] as const;
export type SafetySignalType = (typeof SAFETY_SIGNAL_TYPES)[number];

export const SAFETY_SIGNAL_SEVERITIES = ['low', 'moderate', 'high'] as const;
export type SafetySignalSeverity = (typeof SAFETY_SIGNAL_SEVERITIES)[number];

const INGEST_SCHEMA = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  type: z.enum(SAFETY_SIGNAL_TYPES),
  severity: z.enum(SAFETY_SIGNAL_SEVERITIES),
  deidentifiedEventRef: z.string().min(1, 'deidentifiedEventRef is required'),
  externalSystemId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).default({}),
  reportedAt: z.coerce.date().optional(),
});

type NormalizedIngestInput = z.infer<typeof INGEST_SCHEMA>;

const RISK_WEIGHT_BY_TYPE: Record<
  SafetySignalType,
  { privileging: number; matching: number; rationale: string }
> = {
  'near-miss': {
    privileging: -0.25,
    matching: -0.15,
    rationale: 'Repeated near-miss events erode privilege confidence and slow credential matches.',
  },
  'adverse-event': {
    privileging: -0.55,
    matching: -0.4,
    rationale: 'Adverse events require privileging review and suppress match recommendations.',
  },
  commendation: {
    privileging: 0.35,
    matching: 0.45,
    rationale: 'Sustained positive performance improves privileging posture and recruiter visibility.',
  },
};

const SEVERITY_SCALE: Record<SafetySignalSeverity, number> = {
  low: 0.35,
  moderate: 0.65,
  high: 0.9,
};

const COMMENDATION_WINDOW_DAYS = 120;
const COMMENDATION_MIN_POSITIVE = 3;
const COMMENDATION_MIN_STREAK_DAYS = 45;

export interface CommendationEligibility {
  eligible: boolean;
  badge: 'exemplaryClinician' | null;
  positiveSignals: number;
  windowDays: number;
  lastPositiveAt: string | null;
  streakDays: number;
}

export interface SafetySignalRiskImpact {
  type: SafetySignalType;
  severity: SafetySignalSeverity;
  privilegingDelta: number;
  matchingDelta: number;
  direction: 'positive' | 'negative';
  rationale: string;
}

export type SafetySignalRecord = PrismaSafetySignal & { metadata: Record<string, unknown> };

export interface SafetySignalIngestInput extends z.input<typeof INGEST_SCHEMA> {}

export interface SafetySignalIngestResult {
  record: SafetySignalRecord;
  riskImpact: SafetySignalRiskImpact;
  commendation: CommendationEligibility;
}

export class SafetySignalIngestionService {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient;
  }

  async ingest(rawInput: SafetySignalIngestInput): Promise<SafetySignalIngestResult> {
    const input = INGEST_SCHEMA.parse(rawInput);
    const metadata = this.buildMetadata(input);

    const record = await this.prisma.safetySignal.create({
      data: {
        clinicianId: input.clinicianId,
        type: input.type,
        severity: input.severity,
        metadata: metadata as Prisma.InputJsonValue,
        reportedAt: input.reportedAt ?? new Date(),
      },
    });

    const normalizedRecord: SafetySignalRecord = {
      ...record,
      metadata,
    };
    const riskImpact = calculateRiskImpact(input.type, input.severity);
    const commendation = await evaluateCommendationEligibility(input.clinicianId, this.prisma);

    return {
      record: normalizedRecord,
      riskImpact,
      commendation,
    };
  }

  async ingestBatch(inputs: SafetySignalIngestInput[]): Promise<SafetySignalIngestResult[]> {
    return Promise.all(inputs.map((entry) => this.ingest(entry)));
  }

  async listRecentSignals(clinicianId: string, limit = 25): Promise<SafetySignalRecord[]> {
    const rows = await this.prisma.safetySignal.findMany({
      where: { clinicianId },
      orderBy: { reportedAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      ...row,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }));
  }

  private buildMetadata(input: NormalizedIngestInput): Record<string, unknown> {
    const safeMetadata = sanitizeMetadata(input.metadata);
    const riskImpact = calculateRiskImpact(input.type, input.severity);
    return {
      ...safeMetadata,
      eventRefHash: hashDeidentifiedReference(input.deidentifiedEventRef),
      eventRefSuffix: input.deidentifiedEventRef.slice(-4),
      externalSystemId: input.externalSystemId ?? null,
      severityScore: SEVERITY_SCALE[input.severity],
      type: input.type,
      ingestedAt: new Date().toISOString(),
      riskImpact,
    };
  }
}

export function calculateRiskImpact(
  type: SafetySignalType,
  severity: SafetySignalSeverity,
): SafetySignalRiskImpact {
  const base = RISK_WEIGHT_BY_TYPE[type];
  const severityScale = SEVERITY_SCALE[severity];
  const privilegingDelta = Number((base.privileging * severityScale).toFixed(4));
  const matchingDelta = Number((base.matching * severityScale).toFixed(4));
  return {
    type,
    severity,
    privilegingDelta,
    matchingDelta,
    direction: privilegingDelta >= 0 && matchingDelta >= 0 ? 'positive' : 'negative',
    rationale: base.rationale,
  };
}

export async function evaluateCommendationEligibility(
  clinicianId: string,
  prismaClient: PrismaClient = prisma,
): Promise<CommendationEligibility> {
  const now = new Date();
  const windowStart = daysAgo(COMMENDATION_WINDOW_DAYS, now);
  const positiveSignals = await prismaClient.safetySignal.findMany({
    where: {
      clinicianId,
      type: 'commendation',
      reportedAt: { gte: windowStart },
    },
    orderBy: { reportedAt: 'desc' },
  });

  const elevatedSignals = positiveSignals.filter((signal) => signal.severity !== 'low');
  const streakDays = calculateStreakDays(elevatedSignals);
  const eligible =
    elevatedSignals.length >= COMMENDATION_MIN_POSITIVE && streakDays >= COMMENDATION_MIN_STREAK_DAYS;

  return {
    eligible,
    badge: eligible ? 'exemplaryClinician' : null,
    positiveSignals: elevatedSignals.length,
    windowDays: COMMENDATION_WINDOW_DAYS,
    lastPositiveAt: elevatedSignals[0]?.reportedAt
      ? new Date(elevatedSignals[0].reportedAt).toISOString()
      : null,
    streakDays,
  };
}

export function hashDeidentifiedReference(reference: string): string {
  return createHash('sha256').update(reference).digest('hex');
}

export function hashWithSalt(value: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const safeEntries: Record<string, unknown> = {};
  Object.entries(metadata ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      // Truncate long blobs and strip obvious PHI markers.
      safeEntries[key] = value.slice(0, 256);
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      safeEntries[key] = value;
      return;
    }
    if (Array.isArray(value)) {
      safeEntries[key] = value.slice(0, 10);
      return;
    }
    if (typeof value === 'object') {
      safeEntries[key] = value;
    }
  });
  return safeEntries;
}

function calculateStreakDays(signals: PrismaSafetySignal[]): number {
  if (signals.length < 2) {
    return signals.length ? 1 : 0;
  }
  const sorted = [...signals].sort(
    (a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime(),
  );
  const first = new Date(sorted[0].reportedAt);
  const last = new Date(sorted[sorted.length - 1].reportedAt);
  return Math.max(1, Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)));
}

function daysAgo(days: number, now: Date = new Date()): Date {
  const clone = new Date(now);
  clone.setDate(clone.getDate() - days);
  return clone;
}

