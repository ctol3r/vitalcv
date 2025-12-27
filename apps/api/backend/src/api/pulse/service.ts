import type { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import {
  DEFAULT_PULSE_LIMIT,
  MAX_PULSE_LIMIT,
  PulseEventDto,
  PulseEventInput,
  PulseEventRecord,
  pulseFingerprint,
  toPulseDto,
} from './models';
import { log } from '../../obs/logger';

const WAVE_F_CALM_MS = 3 * 60 * 1000; // 3 minutes to keep UI calm
const WAVE_F_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours of pulse memory

const pulseTableReady = new WeakMap<PrismaClient, Promise<void>>();
async function ensurePulseTable(client: PrismaClient) {
  if (!pulseTableReady.has(client)) {
    pulseTableReady.set(
      client,
      (async () => {
        await client.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "PulseEvent" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL DEFAULT 'info',
            source TEXT,
            scope TEXT,
            fingerprint TEXT NOT NULL,
            occurrences INTEGER NOT NULL DEFAULT 1,
            calmUntil DATETIME,
            lastEmittedAt DATETIME NOT NULL,
            metadata TEXT,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS pulse_fingerprint_last_idx ON "PulseEvent" (fingerprint, lastEmittedAt);',
        );
        await client.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS pulse_type_last_idx ON "PulseEvent" (type, lastEmittedAt);',
        );
        await client.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS pulse_scope_last_idx ON "PulseEvent" (scope, lastEmittedAt);',
        );
      })(),
    );
  }
  return pulseTableReady.get(client);
}

function parseMetadata(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mergeMetadata(
  existing: Record<string, unknown> | null,
  next?: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!next) return existing;
  return { ...(existing ?? {}), ...next };
}

function serializeMetadata(meta?: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

function hydratePulseRow(row: any): PulseEventRecord {
  return {
    id: Number(row.id),
    type: String(row.type),
    title: String(row.title),
    message: String(row.message),
    severity: String(row.severity || 'info'),
    source: row.source ?? null,
    scope: row.scope ?? null,
    occurrences: Number(row.occurrences || 0),
    calmUntil: row.calmUntil ? new Date(row.calmUntil) : null,
    lastEmittedAt: new Date(row.lastEmittedAt),
    metadata: parseMetadata(row.metadata),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

async function fetchPulseById(id: number, client: PrismaClient): Promise<PulseEventRecord | null> {
  const rows = await client.$queryRaw<
    Array<Record<string, unknown>>
  >`SELECT * FROM "PulseEvent" WHERE id = ${id} LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  return hydratePulseRow(row);
}

export async function append(
  input: PulseEventInput,
  options?: {
    calmMs?: number;
    now?: Date;
    client?: PrismaClient;
  },
): Promise<PulseEventRecord> {
  const client = options?.client ?? prisma;
  await ensurePulseTable(client);

  const calmMs = options?.calmMs ?? WAVE_F_CALM_MS;
  const now = options?.now ?? new Date();

  const fingerprint = pulseFingerprint(input);
  const calmBoundaryIso = new Date(now.getTime() - calmMs).toISOString();
  const nowIso = now.toISOString();
  const calmUntilIso = new Date(now.getTime() + calmMs).toISOString();

  const existingRows = await client.$queryRaw<
    Array<Record<string, unknown>>
  >`SELECT * FROM "PulseEvent" WHERE fingerprint = ${fingerprint} AND lastEmittedAt >= ${calmBoundaryIso} ORDER BY lastEmittedAt DESC LIMIT 1`;
  const existing = existingRows[0] ? hydratePulseRow(existingRows[0]) : null;

  if (existing) {
    const mergedMetadata = mergeMetadata(parseMetadata(existing.metadata), input.metadata);
    await client.$executeRaw`
      UPDATE "PulseEvent"
      SET title = ${input.title || existing.title},
          message = ${input.message},
          severity = ${input.severity ?? existing.severity},
          source = ${input.source ?? existing.source ?? null},
          scope = ${input.scope ?? existing.scope ?? null},
          occurrences = occurrences + 1,
          calmUntil = ${calmUntilIso},
          lastEmittedAt = ${nowIso},
          metadata = ${serializeMetadata(mergedMetadata)},
          updatedAt = ${nowIso}
      WHERE id = ${existing.id}
    `;
    const updated = await fetchPulseById(existing.id, client);
    return updated ?? existing;
  }

  await client.$executeRaw`
    INSERT INTO "PulseEvent" (type, title, message, severity, source, scope, fingerprint, occurrences, calmUntil, lastEmittedAt, metadata, createdAt, updatedAt)
    VALUES (${input.type}, ${input.title}, ${input.message}, ${input.severity ?? 'info'}, ${input.source ?? null}, ${input.scope ?? null}, ${fingerprint}, 1, ${calmUntilIso}, ${nowIso}, ${serializeMetadata(input.metadata ?? null)}, ${nowIso}, ${nowIso})
  `;

  const createdRows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "PulseEvent" WHERE id = last_insert_rowid() LIMIT 1
  `;
  const created = createdRows[0] ? hydratePulseRow(createdRows[0]) : null;
  if (!created) throw new Error('Pulse event insert failed');
  return created;
}

export async function list(
  limit = DEFAULT_PULSE_LIMIT,
  options?: { sinceMs?: number; client?: PrismaClient },
): Promise<PulseEventDto[]> {
  const client = options?.client ?? prisma;
  await ensurePulseTable(client);
  const safeLimit = Math.max(1, Math.min(limit, MAX_PULSE_LIMIT));
  const retentionBoundary = new Date(Date.now() - (options?.sinceMs ?? WAVE_F_RETENTION_MS));

  const rows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "PulseEvent" WHERE lastEmittedAt >= ${retentionBoundary.toISOString()} ORDER BY lastEmittedAt DESC LIMIT ${safeLimit}
  `;
  return rows.map((r) => toPulseDto(hydratePulseRow(r)));
}

export async function trimOldPulseEvents(client: PrismaClient = prisma): Promise<number> {
  await ensurePulseTable(client);
  const boundary = new Date(Date.now() - WAVE_F_RETENTION_MS * 3);
  const deleted = await client.$executeRaw`
    DELETE FROM "PulseEvent" WHERE lastEmittedAt < ${boundary.toISOString()}
  `;
  const removed = typeof deleted === 'bigint' ? Number(deleted) : Number(deleted || 0);
  if (removed > 0) {
    log('info', 'pulse_trimmed', { removed });
  }
  return removed;
}

export { WAVE_F_CALM_MS, WAVE_F_RETENTION_MS };
