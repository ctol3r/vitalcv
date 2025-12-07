import { PrismaClient, Prisma, CredentialLifecycle } from '@prisma/client';
import type { LifecyclePhase } from './transition';
import { LifecycleTransitionEngine } from './transition';

const prisma = new PrismaClient();
const PHASE_ORDER = LifecycleTransitionEngine.phaseOrder();
const PHASE_INDEX = PHASE_ORDER.reduce<Record<LifecyclePhase, number>>((acc, phase, idx) => {
  acc[phase] = idx;
  return acc;
}, {} as Record<LifecyclePhase, number>);

export type LifecycleAnomalyType =
  | 'overlapping_expiration'
  | 'phase_sequence_violation'
  | 'timestamp_regression';

export interface LifecycleAnomaly {
  clinicianId: string;
  credentialId: string;
  type: LifecycleAnomalyType;
  severity: 'warning' | 'critical';
  detectedAt: string;
  context: Record<string, unknown>;
}

interface CredentialSnapshot {
  credentialId: string;
  clinicianId: string;
  type: string;
  payload: Prisma.JsonValue;
}

interface ExpirationEntry {
  credentialId: string;
  clinicianId: string;
  expiresAt: Date;
  source: 'lifecycle' | 'payload';
}

export class LifecycleAnomalyDetector {
  constructor(private readonly db: PrismaClient = prisma) {}

  async detectForClinician(clinicianId: string): Promise<LifecycleAnomaly[]> {
    const credentials = await this.db.walletCredential.findMany({
      where: { clinicianId },
      select: { credentialId: true, clinicianId: true, type: true, payload: true },
    });

    if (!credentials.length) {
      return [];
    }

    const lifecycleRecords = await this.db.credentialLifecycle.findMany({
      where: { credentialId: { in: credentials.map((record) => record.credentialId) } },
      orderBy: { timestamp: 'asc' },
    });

    const history = groupByCredential(lifecycleRecords);
    const overlaps = detectOverlappingExpirations(credentials, history);
    const sequenceIssues = detectSequenceIssues(credentials, history);

    return [...overlaps, ...sequenceIssues].sort((a, b) => {
      if (a.severity === b.severity) {
        return a.type.localeCompare(b.type);
      }
      return a.severity === 'critical' ? -1 : 1;
    });
  }
}

function detectOverlappingExpirations(
  credentials: CredentialSnapshot[],
  history: Map<string, CredentialLifecycle[]>,
): LifecycleAnomaly[] {
  const expirationEntries: ExpirationEntry[] = [];
  const credentialMap = new Map(credentials.map((snapshot) => [snapshot.credentialId, snapshot]));

  history.forEach((records, credentialId) => {
    const latestWithMetadata = [...records].reverse().find((record) => parseExpiresAt(record.metadata));
    let expiresAt = latestWithMetadata ? (parseExpiresAt(latestWithMetadata.metadata) as Date) : undefined;
    if (!expiresAt) {
      const snapshot = credentialMap.get(credentialId);
      expiresAt = snapshot ? extractExpiryFromPayload(snapshot.payload) : undefined;
    }
    if (!expiresAt) {
      return;
    }
    const snapshot = credentialMap.get(credentialId);
    if (!snapshot) {
      return;
    }
    expirationEntries.push({
      credentialId,
      clinicianId: snapshot.clinicianId,
      expiresAt,
      source: latestWithMetadata ? 'lifecycle' : 'payload',
    });
  });

  if (expirationEntries.length < 2) {
    return [];
  }

  expirationEntries.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  const anomalies: LifecycleAnomaly[] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < expirationEntries.length - 1; i += 1) {
    for (let j = i + 1; j < expirationEntries.length; j += 1) {
      const current = expirationEntries[i];
      const next = expirationEntries[j];
      const diffDays = Math.abs(diffInDays(current.expiresAt, next.expiresAt));
      if (diffDays > 10) {
        break;
      }
      const pairKey = `${current.credentialId}:${next.credentialId}`;
      if (seenPairs.has(pairKey)) {
        continue;
      }
      seenPairs.add(pairKey);
      anomalies.push({
        clinicianId: current.clinicianId,
        credentialId: current.credentialId,
        type: 'overlapping_expiration',
        severity: diffDays <= 3 ? 'critical' : 'warning',
        detectedAt: new Date().toISOString(),
        context: {
          primaryCredential: current.credentialId,
          secondaryCredential: next.credentialId,
          daysBetween: diffDays,
          expiresAt: current.expiresAt.toISOString(),
          secondaryExpiresAt: next.expiresAt.toISOString(),
          sources: [current.source, next.source],
        },
      });
    }
  }

  return anomalies;
}

function detectSequenceIssues(
  credentials: CredentialSnapshot[],
  history: Map<string, CredentialLifecycle[]>,
): LifecycleAnomaly[] {
  const anomalies: LifecycleAnomaly[] = [];
  const credentialMap = new Map(credentials.map((snapshot) => [snapshot.credentialId, snapshot]));

  history.forEach((records, credentialId) => {
    if (records.length < 2) {
      return;
    }
    let prevTimestamp = new Date(records[0].timestamp).getTime();
    let prevPhase = records[0].phase as LifecyclePhase;
    for (let idx = 1; idx < records.length; idx += 1) {
      const current = records[idx];
      const currentTs = new Date(current.timestamp).getTime();
      const currentPhase = current.phase as LifecyclePhase;

      if (currentTs + 60000 < prevTimestamp) {
        anomalies.push({
          clinicianId: credentialMap.get(credentialId)?.clinicianId ?? 'unknown',
          credentialId,
          type: 'timestamp_regression',
          severity: 'warning',
          detectedAt: new Date().toISOString(),
          context: {
            previousPhase: prevPhase,
            previousTimestamp: new Date(prevTimestamp).toISOString(),
            currentPhase,
            currentTimestamp: current.timestamp.toISOString(),
          },
        });
      }

      const previousRank = PHASE_INDEX[prevPhase] ?? 0;
      const currentRank = PHASE_INDEX[currentPhase] ?? previousRank;

      if (currentRank + 0 < previousRank && !isIntentionalRegression(prevPhase, currentPhase)) {
        anomalies.push({
          clinicianId: credentialMap.get(credentialId)?.clinicianId ?? 'unknown',
          credentialId,
          type: 'phase_sequence_violation',
          severity: 'warning',
          detectedAt: new Date().toISOString(),
          context: {
            previousPhase: prevPhase,
            currentPhase,
            previousRank,
            currentRank,
          },
        });
      }

      prevTimestamp = Math.max(prevTimestamp, currentTs);
      prevPhase = currentPhase;
    }
  });

  return anomalies;
}

function groupByCredential(records: CredentialLifecycle[]): Map<string, CredentialLifecycle[]> {
  return records.reduce<Map<string, CredentialLifecycle[]>>((acc, record) => {
    const list = acc.get(record.credentialId) ?? [];
    list.push(record);
    acc.set(record.credentialId, list);
    return acc;
  }, new Map());
}

function diffInDays(a: Date, b: Date): number {
  return (a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function isIntentionalRegression(prev: LifecyclePhase, current: LifecyclePhase): boolean {
  if (prev === 'expired' && current === 'active') {
    return true;
  }
  if (prev === 'retired' && current === 'active') {
    return true;
  }
  return false;
}

function parseExpiresAt(metadata: Prisma.JsonValue | null): Date | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  const record = metadata as Record<string, unknown>;
  return (
    parseMaybeDate(record.expiresAt) ??
    parseMaybeDate(record.dueBy) ??
    (record.window && typeof record.window === 'object'
      ? parseMaybeDate((record.window as Record<string, unknown>).end)
      : undefined)
  );
}

function extractExpiryFromPayload(payload: Prisma.JsonValue): Date | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const subject =
    toRecord(record.credentialSubject) ??
    (toRecord(record.claims)?.credentialSubject && toRecord((record.claims as Record<string, unknown>).credentialSubject)) ??
    record;
  const license = toRecord(subject?.license) ?? (Array.isArray(subject?.licenses) ? toRecord(subject?.licenses?.[0]) : null);
  if (!license) {
    return undefined;
  }
  return (
    parseMaybeDate(license.expires) ??
    parseMaybeDate(license.expirationDate) ??
    parseMaybeDate(license.expiryDate) ??
    parseMaybeDate(license.validThrough)
  );
}

function parseMaybeDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, any>;
}


