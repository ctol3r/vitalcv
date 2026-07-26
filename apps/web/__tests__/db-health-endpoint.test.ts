import { afterEach, describe, expect, it, vi } from 'vitest';

const queryRaw = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
  },
}));

import { GET } from '../app/api/health/db/route';

const SNAPSHOT = { ...process.env };
afterEach(() => {
  process.env = { ...SNAPSHOT };
  queryRaw.mockReset();
});

describe('GET /api/health/db', () => {
  it('reports db ok with HTTP 200 and no-store when SELECT 1 succeeds', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(await res.json()).toEqual({
      service: 'web',
      check: 'db-connectivity',
      db: 'ok',
    });
  });

  it('reports db unreachable with HTTP 503 when the query rejects — and never echoes connection details', async () => {
    // Realistic Prisma P1001 shape: the message embeds host:port. The response
    // must be the fixed three-field body with none of it.
    queryRaw.mockRejectedValue(
      new Error("Can't reach database server at `localhost`:`5432`"),
    );

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({
      service: 'web',
      check: 'db-connectivity',
      db: 'unreachable',
    });
    expect(JSON.stringify(body)).not.toContain('localhost');
    expect(JSON.stringify(body)).not.toContain('5432');
  });

  it('reports db unreachable when the query hangs past the probe timeout', async () => {
    process.env.DB_HEALTH_TIMEOUT_MS = '25';
    queryRaw.mockReturnValue(new Promise(() => undefined));

    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).db).toBe('unreachable');
  });

  it('reports db unreachable when the hung probe eventually rejects (no unhandled rejection)', async () => {
    process.env.DB_HEALTH_TIMEOUT_MS = '25';
    let rejectLater: (reason: Error) => void = () => undefined;
    queryRaw.mockReturnValue(
      new Promise((_, reject) => {
        rejectLater = reject;
      }),
    );

    const res = await GET();
    expect(res.status).toBe(503);

    // The losing probe rejecting after the race must be swallowed by the
    // route's pre-attached handler, not crash the process.
    rejectLater(new Error('late failure'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
