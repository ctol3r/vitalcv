import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { append, list, WAVE_F_CALM_MS } from '../src/api/pulse/service';

function buildClient(fileName: string) {
  const dbPath = path.join(__dirname, '..', 'prisma', fileName);
  const client = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });
  return { client, dbPath };
}

describe('pulse service', () => {
  const { client, dbPath } = buildClient('dev-pulse-test.db');

  beforeEach(async () => {
    await client.$executeRawUnsafe('DROP TABLE IF EXISTS "PulseEvent";');
  });

  afterAll(async () => {
    await client.$disconnect();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('coalesces events within the calm window', async () => {
    const now = new Date('2024-01-01T00:00:00Z');
    await append(
      { type: 'ingest', title: 'PubMed ingest', message: 'Initial fetch' },
      { client, calmMs: WAVE_F_CALM_MS, now },
    );
    const updated = await append(
      { type: 'ingest', title: 'PubMed ingest', message: 'Initial fetch' },
      { client, calmMs: WAVE_F_CALM_MS, now: new Date(now.getTime() + 1000) },
    );

    const events = await list(10, { client });
    expect(updated.occurrences).toBe(2);
    expect(events[0].occurrences).toBe(2);
  });

  it('emits a new row after calm window expiry', async () => {
    const now = new Date('2024-01-01T00:00:00Z');
    await append(
      { type: 'ingest', title: 'PubMed ingest', message: 'Initial fetch' },
      { client, calmMs: 500, now },
    );
    await append(
      { type: 'ingest', title: 'PubMed ingest', message: 'Initial fetch' },
      { client, calmMs: 500, now: new Date(now.getTime() + 1200) },
    );

    const events = await list(10, { client });
    expect(events.length).toBe(2);
    expect(events[0].occurrences).toBe(1);
  });
});
