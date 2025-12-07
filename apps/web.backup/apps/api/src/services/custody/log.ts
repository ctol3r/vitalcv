import { createHash } from 'crypto';

import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export type CustodyAction = 'upload' | 'viewed' | 'verified' | 'signed' | 'anchored';

export const CUSTODY_ACTION_SEQUENCE: CustodyAction[] = ['upload', 'viewed', 'verified', 'signed', 'anchored'];

const ACTION_ORDER = new Map<CustodyAction, number>(
  CUSTODY_ACTION_SEQUENCE.map((action, index) => [action, index]),
);

export interface CustodyMetadata extends Record<string, unknown> {
  actor?: string;
  channel?: string;
  issuerDid?: string | null;
  signature?: string | null;
  credentialId?: string | null;
  credentialHash?: string | null;
  documentHash?: string | null;
  previousHash?: string | null;
  hash?: string;
  anchorTx?: string | null;
  anchorRoot?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface CustodyTimelineEntry {
  id: string;
  clinicianId: string;
  documentId: string;
  action: CustodyAction;
  timestamp: string;
  metadata: CustodyMetadata;
}

export interface CustodyLogInput {
  clinicianId: string;
  documentId: string;
  action: CustodyAction;
  actor?: string;
  channel?: string;
  issuerDid?: string;
  signature?: string;
  credentialId?: string;
  credentialHash?: string;
  documentHash?: string;
  eventHash?: string;
  previousHash?: string | null;
  metadata?: Record<string, unknown>;
  timestamp?: string | Date;
}

export interface CustodyTimelineQuery {
  clinicianId?: string;
  documentId?: string;
  since?: string | Date;
  limit?: number;
  direction?: 'asc' | 'desc';
}

export interface CustodyHeatmapCell {
  date: string;
  total: number;
  intensity: number;
  actions: Record<CustodyAction, number>;
}

export interface CustodyHeatmapSummary {
  windowDays: number;
  documentsTracked: number;
  totalEvents: number;
  totalsByAction: Record<CustodyAction, number>;
  cells: CustodyHeatmapCell[];
}

const prisma = new PrismaClient();
const MAX_RECENT_EVENTS = 400;
const recentEvents: CustodyTimelineEntry[] = [];

const TIMELINE_SELECT = {
  id: true,
  clinicianId: true,
  documentId: true,
  action: true,
  metadata: true,
  timestamp: true,
} satisfies Prisma.CustodyRecordSelect;

export async function logCustodyEvent(input: CustodyLogInput): Promise<CustodyTimelineEntry> {
  if (!input.clinicianId) {
    throw new Error('clinicianId is required to log custody events');
  }
  if (!input.documentId) {
    throw new Error('documentId is required to log custody events');
  }

  const timestampIso = ensureIso(input.timestamp);

  const { record } = await prisma.$transaction(async (tx) => {
    const previous = await tx.custodyRecord.findFirst({
      where: {
        clinicianId: input.clinicianId,
        documentId: input.documentId,
      },
      orderBy: { timestamp: 'desc' },
      select: TIMELINE_SELECT,
    });

    const previousMetadata = previous ? coerceMetadata(previous.metadata) : undefined;
    const metadata = buildMetadata(input, timestampIso, previousMetadata);

    const created = await tx.custodyRecord.create({
      data: {
        clinicianId: input.clinicianId,
        documentId: input.documentId,
        action: input.action,
        metadata: metadata as Prisma.InputJsonValue,
        timestamp: new Date(timestampIso),
      },
      select: TIMELINE_SELECT,
    });

    await appendDocumentHash(tx, input.documentId, metadata.hash);

    return { record: created };
  });

  const entry = serializeRecord(record);
  pushRecentEvent(entry);
  return entry;
}

export async function listCustodyTimeline(
  query: CustodyTimelineQuery,
  client: PrismaClient = prisma,
): Promise<CustodyTimelineEntry[]> {
  const where: Prisma.CustodyRecordWhereInput = {};
  if (query.clinicianId) {
    where.clinicianId = query.clinicianId;
  }
  if (query.documentId) {
    where.documentId = query.documentId;
  }
  if (query.since) {
    const sinceDate = new Date(query.since);
    if (!Number.isNaN(sinceDate.getTime())) {
      where.timestamp = { gte: sinceDate };
    }
  }

  const direction = query.direction ?? 'asc';
  const records = await client.custodyRecord.findMany({
    where,
    orderBy: { timestamp: direction },
    take: query.limit,
    select: TIMELINE_SELECT,
  });

  const entries = records.map(serializeRecord);
  return direction === 'desc' ? entries.reverse() : entries;
}

export async function getRecentCustodyEvents(
  limit = 50,
  filter?: { clinicianId?: string; documentId?: string },
): Promise<CustodyTimelineEntry[]> {
  const filtered = filterRecentEntries(filter);
  if (filtered.length >= limit) {
    return filtered.slice(0, limit);
  }

  const where: Prisma.CustodyRecordWhereInput = {};
  if (filter?.clinicianId) {
    where.clinicianId = filter.clinicianId;
  }
  if (filter?.documentId) {
    where.documentId = filter.documentId;
  }

  const fallback = await prisma.custodyRecord.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: Math.max(limit, 50),
    select: TIMELINE_SELECT,
  });

  const combined = [...filtered, ...fallback.map(serializeRecord)];
  const deduped = dedupeById(combined).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return deduped.slice(0, limit);
}

export function summarizeCustodyHeatmap(
  records: CustodyTimelineEntry[],
  windowDays = 14,
): CustodyHeatmapSummary {
  const totalsByAction = CUSTODY_ACTION_SEQUENCE.reduce<Record<CustodyAction, number>>((acc, action) => {
    acc[action] = 0;
    return acc;
  }, {} as Record<CustodyAction, number>);

  const docs = new Set<string>();
  const buckets = new Map<string, CustodyHeatmapCell>();

  for (const record of records) {
    docs.add(record.documentId);
    totalsByAction[record.action] = (totalsByAction[record.action] ?? 0) + 1;
    const dateKey = record.timestamp.slice(0, 10);
    if (!buckets.has(dateKey)) {
      buckets.set(dateKey, {
        date: dateKey,
        total: 0,
        intensity: 0,
        actions: CUSTODY_ACTION_SEQUENCE.reduce<Record<CustodyAction, number>>((acc, action) => {
          acc[action] = 0;
          return acc;
        }, {} as Record<CustodyAction, number>),
      });
    }
    const bucket = buckets.get(dateKey)!;
    bucket.total += 1;
    bucket.actions[record.action] += 1;
  }

  const today = new Date();
  const cells: CustodyHeatmapCell[] = [];
  const maxWindow = Math.max(windowDays, 1);

  for (let offset = maxWindow - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    const cell =
      buckets.get(key) ??
      ({
        date: key,
        total: 0,
        intensity: 0,
        actions: CUSTODY_ACTION_SEQUENCE.reduce<Record<CustodyAction, number>>((acc, action) => {
          acc[action] = 0;
          return acc;
        }, {} as Record<CustodyAction, number>),
      } as CustodyHeatmapCell);
    cells.push(cell);
  }

  const maxValue = cells.reduce((acc, cell) => Math.max(acc, cell.total), 0);
  const normalized = cells.map((cell) => ({
    ...cell,
    intensity: maxValue ? Number((cell.total / maxValue).toFixed(3)) : 0,
  }));

  return {
    windowDays: maxWindow,
    documentsTracked: docs.size,
    totalEvents: records.length,
    totalsByAction,
    cells: normalized,
  };
}

export function groupTimelineByDocument(
  records: CustodyTimelineEntry[],
): Record<string, CustodyTimelineEntry[]> {
  return records.reduce<Record<string, CustodyTimelineEntry[]>>((acc, entry) => {
    if (!acc[entry.documentId]) {
      acc[entry.documentId] = [];
    }
    acc[entry.documentId].push(entry);
    acc[entry.documentId].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    return acc;
  }, {});
}

function buildMetadata(
  input: CustodyLogInput,
  timestampIso: string,
  previous?: CustodyMetadata,
): CustodyMetadata {
  const base = input.metadata ?? {};
  const previousHash = input.previousHash ?? previous?.hash ?? null;

  const metadata: CustodyMetadata = sanitizeMetadata({
    ...base,
    actor: input.actor ?? coerceString(base.actor) ?? 'system',
    channel: input.channel ?? coerceString(base.channel) ?? null,
    issuerDid: input.issuerDid ?? coerceString(base.issuerDid) ?? null,
    signature: input.signature ?? coerceString(base.signature) ?? null,
    credentialId: input.credentialId ?? coerceString(base.credentialId) ?? null,
    credentialHash: input.credentialHash ?? coerceString(base.credentialHash) ?? null,
    documentHash: input.documentHash ?? coerceString(base.documentHash) ?? null,
    previousHash,
    anchorTx: coerceString(base.anchorTx) ?? null,
    anchorRoot: coerceString(base.anchorRoot) ?? null,
    notes: coerceString(base.notes) ?? null,
    tags: Array.isArray(base.tags) ? uniqueTags(base.tags) : undefined,
  });

  const payloadForHash = {
    clinicianId: input.clinicianId,
    documentId: input.documentId,
    action: input.action,
    timestamp: timestampIso,
    previousHash,
    metadata: pruneUndefined({
      ...base,
      actor: metadata.actor,
      channel: metadata.channel,
      issuerDid: metadata.issuerDid,
      signature: metadata.signature,
      credentialId: metadata.credentialId,
      credentialHash: metadata.credentialHash,
      documentHash: metadata.documentHash,
    }),
  };

  metadata.hash = input.eventHash ?? hashPayload(payloadForHash);
  return metadata;
}

function sanitizeMetadata(metadata: CustodyMetadata): CustodyMetadata {
  return pruneUndefined(metadata);
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.entries(value).reduce((acc, [key, val]) => {
    if (val !== undefined) {
      acc[key as keyof T] = val as T[keyof T];
    }
    return acc;
  }, {} as T);
}

function coerceMetadata(value: Prisma.JsonValue | null): CustodyMetadata {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

async function appendDocumentHash(
  tx: Prisma.TransactionClient,
  docId: string,
  hash?: string,
): Promise<void> {
  if (!hash) return;

  const existing = await tx.documentHashChain.findUnique({
    where: { docId },
  });

  if (!existing) {
    await tx.documentHashChain.create({
      data: {
        docId,
        hashSeq: [hash],
      },
    });
    return;
  }

  const nextSeq = [...existing.hashSeq, hash].slice(-128);
  await tx.documentHashChain.update({
    where: { id: existing.id },
    data: { hashSeq: nextSeq },
  });
}

function serializeRecord(record: Prisma.CustodyRecordGetPayload<{ select: typeof TIMELINE_SELECT }>) {
  return {
    id: record.id,
    clinicianId: record.clinicianId,
    documentId: record.documentId,
    action: record.action as CustodyAction,
    timestamp: record.timestamp.toISOString(),
    metadata: coerceMetadata(record.metadata),
  } satisfies CustodyTimelineEntry;
}

function ensureIso(value?: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function pushRecentEvent(entry: CustodyTimelineEntry) {
  const existingIndex = recentEvents.findIndex((candidate) => candidate.id === entry.id);
  if (existingIndex >= 0) {
    recentEvents.splice(existingIndex, 1);
  }
  recentEvents.unshift(entry);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.pop();
  }
}

function filterRecentEntries(filter?: { clinicianId?: string; documentId?: string }) {
  return recentEvents.filter((entry) => {
    if (filter?.clinicianId && entry.clinicianId !== filter.clinicianId) {
      return false;
    }
    if (filter?.documentId && entry.documentId !== filter.documentId) {
      return false;
    }
    return true;
  });
}

function dedupeById(entries: CustodyTimelineEntry[]): CustodyTimelineEntry[] {
  const seen = new Set<string>();
  const result: CustodyTimelineEntry[] = [];
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

function coerceString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function uniqueTags(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}










