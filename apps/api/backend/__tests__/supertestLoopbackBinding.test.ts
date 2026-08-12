/**
 * The test harness must not let a foreign process answer for our app.
 *
 * supertest starts every ephemeral server with `server.listen(0)`, which binds
 * the WILDCARD address, and then issues the request to `http://127.0.0.1:<port>`.
 * On macOS/BSD the SO_REUSEADDR Node sets by default lets that wildcard bind
 * SUCCEED even when another process already holds the more specific
 * `127.0.0.1:<port>`, and the kernel delivers the connection to the MOST SPECIFIC
 * listener. The test server comes up clean and the foreign process answers.
 *
 * Ephemeral ports (49152-65535 on macOS) are where desktop apps park their local
 * control servers, and at least one answers 403 to everything. That surfaced as
 * an intermittent full-suite failure in unrelated files — activation.test.ts
 * (expected 404, got 403) and gardenNotes.test.ts (expected 400, got 403) —
 * neither of which has any code path returning 403.
 *
 * `jest.setup.ts` binds supertest's servers to 127.0.0.1 instead. These assert
 * the closure — a foreign loopback listener cannot answer for a supertest server
 * — not the mechanism, and they fail loudly if a supertest upgrade moves the
 * internals the patch depends on.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import request from 'supertest';

function listen(server: http.Server, ...args: unknown[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    (server.listen as (...a: unknown[]) => unknown)(...args, () => resolve());
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/** Stands in for the desktop app that holds a loopback port and 403s everything. */
async function startForeignLoopbackListener(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(403, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ from: 'foreign-process', error: 'forbidden' }));
  });
  await listen(server, 0, '127.0.0.1');
  return { server, port: (server.address() as AddressInfo).port };
}

/** The app under test: this surface has no 403 in it, exactly like the victims. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/applications/:appId/start/cancel', (_req, res) => {
    res.status(404).json({ from: 'our-app' });
  });
  return app;
}

describe('test harness — a foreign loopback listener cannot answer for a supertest server', () => {
  it('binds supertest servers to loopback, never the wildcard', async () => {
    // Reported from inside the request, because supertest closes the server as
    // soon as the response lands. A wildcard-bound server reports `::` here, and
    // the connection arrives IPv4-mapped as `::ffff:127.0.0.1`.
    const app = express();
    app.get('/where-am-i', (req, res) => {
      const bound = (req.socket as unknown as { server: http.Server }).server.address();
      res.json({
        boundAddress: (bound as AddressInfo).address,
        localAddress: req.socket.localAddress,
      });
    });

    const res = await request(app).get('/where-am-i');

    expect(res.status).toBe(200);
    expect(res.body.boundAddress).toBe('127.0.0.1');
    expect(res.body.localAddress).toBe('127.0.0.1');
  });

  it('keeps answering from our own app while a foreign listener holds a loopback port', async () => {
    const foreign = await startForeignLoopbackListener();

    // Enough servers that a wildcard bind has a real chance of landing on the
    // foreign port; every one of them must still be answered by our own app.
    for (let i = 0; i < 40; i++) {
      const res = await request(buildApp())
        .post('/api/applications/11111111-1111-4111-8111-111111111111/start/cancel')
        .send({ reasonCode: 'x' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ from: 'our-app' });
    }

    await close(foreign.server);
  });

  it('refuses to share a port already held on 127.0.0.1 rather than binding over it', async () => {
    const foreign = await startForeignLoopbackListener();

    // The bind supertest now performs. Unpinned (a bare port) this SUCCEEDS on
    // macOS and the app is silently shadowed; pinned it must be refused.
    const ours = http.createServer(buildApp());
    await expect(listen(ours, foreign.port, '127.0.0.1')).rejects.toMatchObject({
      code: 'EADDRINUSE',
    });

    await close(ours).catch(() => undefined);
    await close(foreign.server);
  });
});
