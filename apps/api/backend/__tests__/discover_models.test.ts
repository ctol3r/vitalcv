import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { listDiscoverItems, persistDiscoverItem } from '../src/api/discover/models';

function buildClient(fileName: string) {
  const dbPath = path.join(__dirname, '..', 'prisma', fileName);
  const client = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });
  return { client, dbPath };
}

describe('discover persistence', () => {
  const { client, dbPath } = buildClient('dev-discover-test.db');

  beforeEach(async () => {
    await client.$executeRawUnsafe('DROP TABLE IF EXISTS "DiscoverItem";');
  });

  afterAll(async () => {
    await client.$disconnect();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('creates and updates discover items by source key', async () => {
    const first = await persistDiscoverItem(
      {
        source: 'pubmed',
        sourceId: '12345',
        specialty: 'cardiology',
        title: 'Initial signal',
        summary: 'First ingest',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12345/',
        metadata: { initial: true },
      },
      client,
    );
    expect(first.created).toBe(true);

    const second = await persistDiscoverItem(
      {
        source: 'pubmed',
        sourceId: '12345',
        specialty: 'cardiology',
        title: 'Refreshed signal',
        summary: 'Updated ingest',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12345/',
        metadata: { updated: true },
      },
      client,
    );
    expect(second.created).toBe(false);
    expect(second.item.title).toBe('Refreshed signal');
    expect(second.item.metadata).toMatchObject({ initial: true, updated: true });

    const rows = await listDiscoverItems('cardiology', { client });
    expect(rows.length).toBe(1);
    expect(rows[0].title).toBe('Refreshed signal');
  });
});
