import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import {
  EmployerAcceptance,
} from '@vitalcv/domain';
import prisma from '../src/graphql/prisma_client';
import { log } from '../src/obs/logger';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function eventHash(event: EmployerAcceptance): string {
  return crypto
    .createHash('sha256')
    .update(
      stableStringify({
        eventType: 'ACCEPTANCE_EMITTED',
        payload: {
          acceptanceId: event.acceptanceId,
          recognitionId: event.recognitionId,
          subjectId: event.subjectId,
          employerId: event.employerId,
          acceptedAt: event.acceptedAt,
        },
      }),
    )
    .digest('hex');
}

export interface AcceptanceGraphPersistenceInput {
  decisionState?: string | null;
  trustSignalsSnapshot?: unknown;
  role?: string | null;
}

const MAX_TRUST_SIGNALS_SNAPSHOT_BYTES = 32 * 1024;

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeDecisionState(value: unknown): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  return normalized.replace(/[\s-]+/g, '_').toUpperCase();
}

type JsonLike =
  | null
  | boolean
  | number
  | string
  | JsonLike[]
  | { [key: string]: JsonLike };

function normalizeJsonLike(value: unknown, seen = new WeakSet<object>()): JsonLike | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (
    value === null
    || typeof value === 'boolean'
    || typeof value === 'string'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value !== 'object') {
    return String(value);
  }

  if (seen.has(value)) {
    throw new TypeError('circular_reference');
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const normalizedArray = value.map((entry) => {
      const normalizedEntry = normalizeJsonLike(entry, seen);
      return normalizedEntry === undefined ? null : normalizedEntry;
    });
    seen.delete(value);
    return normalizedArray;
  }

  const normalizedRecord: Record<string, JsonLike> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const normalizedEntry = normalizeJsonLike(
      (value as Record<string, unknown>)[key],
      seen,
    );
    if (normalizedEntry !== undefined) {
      normalizedRecord[key] = normalizedEntry;
    }
  }

  seen.delete(value);
  return normalizedRecord;
}

function normalizeTrustSignalsInput(rawInput: unknown): Record<string, JsonLike> | undefined {
  const normalized = normalizeJsonLike(rawInput);
  if (normalized === undefined) return undefined;

  if (normalized && typeof normalized === 'object' && !Array.isArray(normalized)) {
    return normalized as Record<string, JsonLike>;
  }

  return { value: normalized };
}

function buildSnapshot(
  acceptanceId: string,
  rawInput: unknown,
): Prisma.InputJsonValue | undefined {
  if (rawInput === undefined) return undefined;

  try {
    const input = normalizeTrustSignalsInput(rawInput);
    if (input === undefined) return undefined;

    const serialized = JSON.stringify(input);
    if (typeof serialized !== 'string') {
      return undefined;
    }

    const snapshotBytes = Buffer.byteLength(serialized, 'utf8');
    if (snapshotBytes > MAX_TRUST_SIGNALS_SNAPSHOT_BYTES) {
      log('warn', 'acceptance_graph_snapshot_dropped', {
        acceptanceId,
        reason: 'snapshot_too_large',
        snapshotBytes,
        snapshotBytesLimit: MAX_TRUST_SIGNALS_SNAPSHOT_BYTES,
      });
      return undefined;
    }

    const snapshot = JSON.parse(JSON.stringify(input));
    return snapshot as Prisma.InputJsonValue;
  } catch (error) {
    log('warn', 'acceptance_graph_snapshot_dropped', {
      acceptanceId,
      reason: 'snapshot_serialization_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return undefined;
  }
}

function buildGraphPersistenceData(
  acceptanceId: string,
  graph?: AcceptanceGraphPersistenceInput,
): {
  decisionState?: string;
  trustSignalsSnapshot?: Prisma.InputJsonValue;
  role?: string;
} {
  return {
    decisionState: normalizeDecisionState(graph?.decisionState),
    trustSignalsSnapshot: buildSnapshot(acceptanceId, graph?.trustSignalsSnapshot),
    role: normalizeOptionalString(graph?.role),
  };
}

function hasGraphPersistenceData(data: {
  decisionState?: string;
  trustSignalsSnapshot?: Prisma.InputJsonValue;
  role?: string;
}): boolean {
  return data.decisionState !== undefined
    || data.trustSignalsSnapshot !== undefined
    || data.role !== undefined;
}

function rowToAcceptance(row: {
  acceptanceId: string;
  recognitionId: string;
  subjectId: string;
  employerId: string;
  facilityId: string;
  acceptedAt: Date;
  psvReportId: string;
}): EmployerAcceptance {
  return new EmployerAcceptance({
    acceptanceId: row.acceptanceId,
    recognitionId: row.recognitionId,
    subjectId: row.subjectId,
    employerId: row.employerId,
    facilityId: row.facilityId,
    acceptedAt: row.acceptedAt.toISOString(),
    psvReportId: row.psvReportId,
  });
}

export async function insertAcceptance(
  event: EmployerAcceptance,
  graph?: AcceptanceGraphPersistenceInput,
): Promise<void> {
  const existing = await prisma.acceptance.findUnique({
    where: { acceptanceId: event.acceptanceId },
  });
  if (existing) {
    throw new Error(`EmployerAcceptance already exists for ${event.acceptanceId}`);
  }

  const baseData = {
    acceptanceId: event.acceptanceId,
    recognitionId: event.recognitionId,
    subjectId: event.subjectId,
    employerId: event.employerId,
    facilityId: event.facilityId,
    acceptedAt: new Date(event.acceptedAt),
    psvReportId: event.psvReportId,
    eventHash: eventHash(event),
  };
  const graphData = buildGraphPersistenceData(event.acceptanceId, graph);

  try {
    await prisma.acceptance.create({
      data: {
        ...baseData,
        ...graphData,
      },
    });
  } catch (error) {
    if (!hasGraphPersistenceData(graphData)) {
      throw error;
    }

    log('warn', 'acceptance_graph_persist_retry_without_graph_fields', {
      acceptanceId: event.acceptanceId,
      recognitionId: event.recognitionId,
      decisionState: graphData.decisionState ?? null,
      hasTrustSignalsSnapshot: graphData.trustSignalsSnapshot !== undefined,
      role: graphData.role ?? null,
      error: error instanceof Error ? error.message : 'unknown',
    });

    await prisma.acceptance.create({ data: baseData });
  }
}

export async function getAcceptanceById(acceptanceId: string): Promise<EmployerAcceptance | null> {
  const row = await prisma.acceptance.findUnique({
    where: { acceptanceId },
  });
  if (!row) return null;
  return rowToAcceptance(row);
}

export async function listAcceptancesBySubject(subjectId: string): Promise<EmployerAcceptance[]> {
  const rows = await prisma.acceptance.findMany({
    where: { subjectId },
    orderBy: { acceptedAt: 'desc' },
  });
  return rows.map(rowToAcceptance);
}
