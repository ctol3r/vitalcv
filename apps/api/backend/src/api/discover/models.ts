import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import prisma from '../../graphql/prisma_client';

export type DiscoverItemInput = {
  source: string;
  sourceId: string;
  specialty: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string | Date | null;
  metadata?: Record<string, unknown>;
};

export type DiscoverItemResult = {
  item: DiscoverItemRecord;
  created: boolean;
};

export type DiscoverItemDto = {
  id: number;
  source: string;
  sourceId: string;
  specialty: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string | null;
  ingestedAt: string;
  metadata?: Record<string, unknown> | null;
};

export type DiscoverItemRecord = {
  id: number;
  source: string;
  sourceId: string;
  specialty: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: Date | null;
  ingestedAt: Date;
  metadata?: Record<string, unknown> | null;
  fingerprint: string;
};

const discoverTableReady = new WeakMap<PrismaClient, Promise<void>>();
async function ensureDiscoverTable(client: PrismaClient) {
  if (!discoverTableReady.has(client)) {
    discoverTableReady.set(
      client,
      (async () => {
        await client.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "DiscoverItem" (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            sourceId TEXT NOT NULL,
            specialty TEXT NOT NULL,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            url TEXT NOT NULL,
            publishedAt DATETIME,
            ingestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT,
            fingerprint TEXT NOT NULL
          );
        `);
        await client.$executeRawUnsafe(
          'CREATE UNIQUE INDEX IF NOT EXISTS discover_source_sourceId_idx ON "DiscoverItem" (source, sourceId);',
        );
        await client.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS discover_specialty_idx ON "DiscoverItem" (specialty, publishedAt);',
        );
        await client.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS discover_fingerprint_idx ON "DiscoverItem" (fingerprint);',
        );
      })(),
    );
  }
  return discoverTableReady.get(client);
}

export function discoverFingerprint(input: DiscoverItemInput): string {
  const hash = crypto.createHash('sha256');
  hash.update(input.source.trim().toLowerCase());
  hash.update('|');
  hash.update(input.sourceId.trim().toLowerCase());
  hash.update('|');
  hash.update(input.specialty.trim().toLowerCase());
  hash.update('|');
  hash.update(input.title.trim().toLowerCase());
  return hash.digest('hex');
}

function normalizeJson(meta?: Record<string, unknown>): string | null {
  if (!meta) return null;
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

function parseJson(raw: unknown): Record<string, unknown> | null {
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

function toDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const asDate = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate;
}

function hydrateDiscoverRow(row: any): DiscoverItemRecord {
  return {
    id: Number(row.id),
    source: String(row.source),
    sourceId: String(row.sourceId),
    specialty: String(row.specialty),
    title: String(row.title),
    summary: String(row.summary),
    url: String(row.url),
    publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
    ingestedAt: new Date(row.ingestedAt),
    metadata: parseJson(row.metadata),
    fingerprint: String(row.fingerprint),
  };
}

export async function persistDiscoverItem(
  input: DiscoverItemInput,
  client: PrismaClient = prisma,
): Promise<DiscoverItemResult> {
  await ensureDiscoverTable(client);
  const fingerprint = discoverFingerprint(input);
  const publishedAt = toDate(input.publishedAt);

  const existingRows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "DiscoverItem" WHERE source = ${input.source} AND sourceId = ${input.sourceId} LIMIT 1
  `;
  const existing = existingRows[0] ? hydrateDiscoverRow(existingRows[0]) : null;

  if (existing) {
    await client.$executeRaw`
      UPDATE "DiscoverItem"
      SET specialty = ${input.specialty},
          title = ${input.title},
          summary = ${input.summary},
          url = ${input.url},
          publishedAt = ${publishedAt ? publishedAt.toISOString() : null},
          metadata = ${normalizeJson({ ...(existing.metadata ?? {}), ...(input.metadata ?? {}) })},
          fingerprint = ${fingerprint}
      WHERE id = ${existing.id}
    `;
    const refreshed = await client.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "DiscoverItem" WHERE id = ${existing.id} LIMIT 1
    `;
    const updated = refreshed[0] ? hydrateDiscoverRow(refreshed[0]) : existing;
    return { item: updated, created: false };
  }

  await client.$executeRaw`
    INSERT INTO "DiscoverItem" (source, sourceId, specialty, title, summary, url, publishedAt, metadata, fingerprint, ingestedAt)
    VALUES (${input.source}, ${input.sourceId}, ${input.specialty}, ${input.title}, ${input.summary}, ${input.url}, ${publishedAt ? publishedAt.toISOString() : null}, ${normalizeJson(input.metadata)}, ${fingerprint}, ${new Date().toISOString()})
  `;
  const createdRows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "DiscoverItem" WHERE id = last_insert_rowid() LIMIT 1
  `;
  const created = createdRows[0] ? hydrateDiscoverRow(createdRows[0]) : null;
  if (!created) throw new Error('Discover item insert failed');
  return { item: created, created: true };
}

export function toDiscoverDto(item: DiscoverItemRecord): DiscoverItemDto {
  return {
    id: item.id,
    source: item.source,
    sourceId: item.sourceId,
    specialty: item.specialty,
    title: item.title,
    summary: item.summary,
    url: item.url,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    ingestedAt: item.ingestedAt.toISOString(),
    metadata: item.metadata ?? null,
  };
}

export async function listDiscoverItems(
  specialty: string,
  options?: { limit?: number; client?: PrismaClient },
): Promise<DiscoverItemDto[]> {
  const client = options?.client ?? prisma;
  await ensureDiscoverTable(client);
  const limit = Math.max(1, Math.min(options?.limit ?? 10, 50));

  const rows = await client.$queryRaw<Array<Record<string, unknown>>>`
    SELECT * FROM "DiscoverItem" WHERE specialty = ${specialty} ORDER BY publishedAt DESC, ingestedAt DESC LIMIT ${limit}
  `;

  return rows.map((row) => toDiscoverDto(hydrateDiscoverRow(row)));
}
