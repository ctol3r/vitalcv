import { PrismaClient, DriftSeverity, DriftType, type Prisma } from '@prisma/client';

import type {
  DriftSeverityLevel,
  NpiChangeDelta,
  NpiChangeRecord,
  ValidationSnapshot,
} from './types';

const prisma = new PrismaClient();
const MAX_RECENT_HISTORY = 200;
const recentHistory: NpiChangeRecord[] = [];

export interface RecordNpiChangeInput {
  clinicianId: string;
  npi: string;
  nextSnapshot: ValidationSnapshot;
  previousSnapshot?: ValidationSnapshot | null;
  prisma?: PrismaClient;
  reason?: string;
  source?: string;
}

export interface ListNpiHistoryOptions {
  prisma?: PrismaClient;
  limit?: number;
}

export async function recordNpiChange(
  input: RecordNpiChangeInput,
): Promise<NpiChangeRecord | null> {
  const diffs = diffSnapshots(input.previousSnapshot, input.nextSnapshot);
  if (!diffs.length && input.previousSnapshot) {
    return null;
  }

  const severity = determineSeverity(diffs, input.nextSnapshot);
  const summary = buildSummary(diffs, input.nextSnapshot.score);
  const metadata = {
    npi: input.npi,
    reason: input.reason ?? (input.previousSnapshot ? 'delta-detected' : 'baseline-recorded'),
    source: input.source ?? 'npi-validator',
    diffs,
    summary,
  };

  const client = input.prisma ?? prisma;
  const record = await client.driftEvent.create({
    data: {
      clinicianId: input.clinicianId,
      driftType: DriftType.NPPES_DRIFT,
      severity: toPrismaSeverity(severity),
      oldValue: (input.previousSnapshot ?? null) as Prisma.InputJsonValue,
      newValue: input.nextSnapshot as Prisma.InputJsonValue,
      metadata,
    },
  });

  const historyEntry: NpiChangeRecord = {
    id: record.id,
    clinicianId: record.clinicianId,
    npi: input.npi,
    severity,
    driftType: 'NPPES_DRIFT',
    summary,
    detectedAt: record.detectedAt.toISOString(),
    diffs,
    source: metadata.source,
    reason: metadata.reason,
  };

  pushHistory(historyEntry);
  return historyEntry;
}

export async function listNpiHistory(
  clinicianId: string,
  options: ListNpiHistoryOptions = {},
): Promise<NpiChangeRecord[]> {
  const limit = Math.max(1, options.limit ?? 10);
  const cachedEntries = recentHistory.filter((entry) => entry.clinicianId === clinicianId);
  if (cachedEntries.length >= limit) {
    return cachedEntries.slice(0, limit);
  }

  const client = options.prisma ?? prisma;
  const records = await client.driftEvent.findMany({
    where: {
      clinicianId,
      driftType: DriftType.NPPES_DRIFT,
    },
    orderBy: { detectedAt: 'desc' },
    take: limit,
  });

  const mapped = records.map<NpiChangeRecord>((event) => {
    const metadata = (event.metadata as Record<string, unknown> | null) ?? null;
    return {
      id: event.id,
      clinicianId: event.clinicianId,
      npi: typeof metadata?.npi === 'string' ? (metadata.npi as string) : 'unknown',
      severity: fromPrismaSeverity(event.severity),
      driftType: 'NPPES_DRIFT',
      summary:
        typeof metadata?.summary === 'string'
          ? (metadata.summary as string)
          : summarizeDiffs((metadata?.diffs as NpiChangeDelta[] | undefined) ?? []),
      detectedAt: event.detectedAt.toISOString(),
      diffs: ((metadata?.diffs as NpiChangeDelta[] | undefined) ?? []).map((delta) => ({
        ...delta,
      })),
      source: typeof metadata?.source === 'string' ? (metadata.source as string) : 'npi-validator',
      reason: typeof metadata?.reason === 'string' ? (metadata.reason as string) : undefined,
    };
  });

  const merged = dedupeById([...mapped, ...cachedEntries])
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, limit);

  merged.forEach(pushHistory);
  return merged;
}

function diffSnapshots(
  previous: ValidationSnapshot | null | undefined,
  next: ValidationSnapshot,
): NpiChangeDelta[] {
  if (!previous) {
    return [
      {
        field: 'score',
        before: null,
        after: Number(next.score.toFixed(4)),
        delta: Number(next.score.toFixed(4)),
        notes: 'Baseline validation snapshot captured.',
      },
    ];
  }

  const deltas: NpiChangeDelta[] = [];
  pushIfSignificant(deltas, {
    field: 'score',
    before: previous.score,
    after: next.score,
    delta: next.score - previous.score,
  });

  pushIfSignificant(deltas, {
    field: 'identity.summaryScore',
    before: previous.identityConsistency.summaryScore,
    after: next.identityConsistency.summaryScore,
    delta: next.identityConsistency.summaryScore - previous.identityConsistency.summaryScore,
  });

  pushIfSignificant(deltas, {
    field: 'fraud.riskScore',
    before: previous.fraud.riskScore,
    after: next.fraud.riskScore,
    delta: next.fraud.riskScore - previous.fraud.riskScore,
  });

  const prevMismatch = previous.identityConsistency.mismatchedFields.length +
    previous.specialty.mismatches.length +
    previous.fraud.flags.length;
  const nextMismatch =
    next.identityConsistency.mismatchedFields.length +
    next.specialty.mismatches.length +
    next.fraud.flags.length;

  if (prevMismatch !== nextMismatch) {
    deltas.push({
      field: 'mismatch.count',
      before: prevMismatch,
      after: nextMismatch,
      delta: nextMismatch - prevMismatch,
      notes: 'Aggregate mismatches across identity, specialty, and fraud flags.',
    });
  }

  const newMismatches = next.identityConsistency.mismatchedFields.filter(
    (field) => !previous.identityConsistency.mismatchedFields.includes(field),
  );
  if (newMismatches.length) {
    deltas.push({
      field: 'identity.mismatchedFields',
      before: previous.identityConsistency.mismatchedFields,
      after: next.identityConsistency.mismatchedFields,
      notes: `New mismatches detected: ${newMismatches.join(', ')}`,
    });
  }

  if (next.specialty.mismatches.length !== previous.specialty.mismatches.length) {
    deltas.push({
      field: 'specialty.mismatches',
      before: previous.specialty.mismatches,
      after: next.specialty.mismatches,
      notes: 'Specialty alignment changed.',
    });
  }

  if (next.fraud.flags.length !== previous.fraud.flags.length) {
    deltas.push({
      field: 'fraud.flags',
      before: previous.fraud.flags,
      after: next.fraud.flags,
      notes: 'Fraud signal count changed.',
    });
  }

  return deltas;
}

function pushIfSignificant(deltas: NpiChangeDelta[], delta: NpiChangeDelta, threshold = 0.01) {
  if (typeof delta.before !== 'number' || typeof delta.after !== 'number') {
    return;
  }
  if (Math.abs(delta.delta ?? 0) < threshold) {
    return;
  }
  delta.before = Number(delta.before.toFixed(4));
  delta.after = Number(delta.after.toFixed(4));
  delta.delta = Number((delta.delta ?? 0).toFixed(4));
  deltas.push(delta);
}

function determineSeverity(
  deltas: NpiChangeDelta[],
  snapshot: ValidationSnapshot,
): DriftSeverityLevel {
  if (!deltas.length) {
    return 'LOW';
  }

  if (snapshot.fraud.riskScore >= 0.6) {
    return 'HIGH';
  }

  if (
    deltas.some(
      (delta) =>
        typeof delta.delta === 'number' &&
        Math.abs(delta.delta) >= 0.1 &&
        delta.field !== 'score',
    )
  ) {
    return 'HIGH';
  }

  if (
    deltas.some(
      (delta) =>
        typeof delta.delta === 'number' &&
        Math.abs(delta.delta) >= 0.04,
    )
  ) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function buildSummary(deltas: NpiChangeDelta[], score: number): string {
  if (!deltas.length) {
    return 'No material change detected.';
  }
  const headline =
    deltas[0]?.notes ??
    `${deltas[0]?.field ?? 'score'} shifted ${formatDeltaValue(deltas[0]?.delta)}`;
  return `${headline} · score ${(score * 100).toFixed(1)}%`;
}

function summarizeDiffs(deltas: NpiChangeDelta[]): string {
  if (!deltas.length) {
    return 'Snapshot recorded';
  }
  const primary = deltas[0];
  return (
    primary.notes ??
    `${primary.field} changed ${formatDeltaValue(primary.delta)}`
  );
}

function formatDeltaValue(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return 'Δ0';
  }
  const percent = (value * 100).toFixed(1);
  return `Δ${percent}%`;
}

function pushHistory(entry: NpiChangeRecord) {
  const existingIndex = recentHistory.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    recentHistory.splice(existingIndex, 1);
  }
  recentHistory.unshift(entry);
  if (recentHistory.length > MAX_RECENT_HISTORY) {
    recentHistory.pop();
  }
}

function dedupeById(records: NpiChangeRecord[]): NpiChangeRecord[] {
  const seen = new Set<string>();
  const result: NpiChangeRecord[] = [];
  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    result.push(record);
  }
  return result;
}

function toPrismaSeverity(level: DriftSeverityLevel): DriftSeverity {
  switch (level) {
    case 'CRITICAL':
      return DriftSeverity.CRITICAL;
    case 'HIGH':
      return DriftSeverity.HIGH;
    case 'MEDIUM':
      return DriftSeverity.MEDIUM;
    case 'LOW':
    default:
      return DriftSeverity.LOW;
  }
}

function fromPrismaSeverity(severity: DriftSeverity): DriftSeverityLevel {
  switch (severity) {
    case DriftSeverity.CRITICAL:
      return 'CRITICAL';
    case DriftSeverity.HIGH:
      return 'HIGH';
    case DriftSeverity.MEDIUM:
      return 'MEDIUM';
    case DriftSeverity.LOW:
    default:
      return 'LOW';
  }
}

