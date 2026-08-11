// The backend test script provisions a real ephemeral Postgres instance and
// exports DATABASE_URL before Jest starts. Avoid injecting a fake local URL.
process.env.NODE_ENV ??= 'test';
process.env.YC_DEMO_MODE = 'false';

import type { AddressInfo } from 'node:net';

import { loadEnv } from './src/config/env';

/**
 * Bind supertest's ephemeral servers to loopback instead of the wildcard.
 *
 * supertest starts every server with `server.listen(0)` (supertest/lib/test.js,
 * `serverAddress`) and then issues the request to `http://127.0.0.1:<port>`.
 * A bare port binds the WILDCARD address, and on macOS/BSD the SO_REUSEADDR that
 * Node sets by default lets that wildcard bind SUCCEED even when another process
 * already holds the more specific `127.0.0.1:<port>`. The kernel delivers each
 * connection to the MOST SPECIFIC listener — so our server comes up clean and
 * reports a healthy address, while the foreign process answers the request. The
 * suite then sees a well-formed HTTP response its own app never produced.
 *
 * Ephemeral ports (49152-65535 on macOS) are exactly where desktop apps park
 * their local control servers, and at least one of them answers 403 to
 * everything. That surfaced as an intermittent full-suite failure in unrelated
 * files — `routes/__tests__/activation.test.ts` (expected 404, got 403) and
 * `routes/__tests__/gardenNotes.test.ts` (expected 400, got 403) — neither of
 * which contains any code path that returns 403. Both passed in isolation,
 * because one file opens too few servers to land on the occupied port. 66 files
 * import supertest, so every one of them was exposed.
 *
 * Two sockets cannot both hold `127.0.0.1:<port>`, so binding the host closes
 * the hole: the OS hands out a genuinely free port rather than a shared one.
 *
 * Why patch supertest rather than `net.Server.prototype.listen`: a bare
 * `listen(0)` binds synchronously, but any form that names a host defers through
 * `dns.lookup`, so `server.address()` is still null when `serverAddress` reads it
 * on the next line. Pinning the host underneath supertest therefore breaks every
 * request with "Cannot read properties of null (reading 'port')". Instead we let
 * the bind be asynchronous and hold the request back until it completes — the URL
 * is rebuilt from the listening server, through supertest's own `serverAddress`,
 * so protocol selection and server cleanup stay exactly as upstream wrote them.
 *
 * supertest 7.2.2 still does the same thing, so upgrading is not a fix.
 * Closure is asserted in `__tests__/supertestLoopbackBinding.test.ts`, which
 * fails loudly if a supertest upgrade changes these internals.
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
interface PendingLoopbackTest {
  _server?: any;
  _loopbackReady?: Promise<void>;
  _loopbackPath?: string;
  url: string;
}

const LOOPBACK_READY = Symbol.for('vitalcv.supertest.loopbackReady');

const SupertestTest = require('supertest/lib/test');

const originalServerAddress = SupertestTest.prototype.serverAddress;
const originalEnd = SupertestTest.prototype.end;

SupertestTest.prototype.serverAddress = function loopbackServerAddress(
  this: PendingLoopbackTest,
  app: any,
  path: string,
): string {
  // Already listening (an agent, or a caller that bound it themselves): upstream
  // never calls listen in that case, so there is nothing to correct.
  if (!app || typeof app.address !== 'function' || app.address()) {
    return originalServerAddress.call(this, app, path);
  }

  this._server = app;
  this._loopbackPath = path;
  // Memoised on the server for the duration of the bind only. `request.agent(app)`
  // reuses one server, so two Tests built before the bind lands would otherwise
  // both call listen and trip ERR_SERVER_ALREADY_LISTEN — a window the async bind
  // widens. Cleared once listening, because supertest closes the server after each
  // response and the next Test must be free to bind it again.
  this._loopbackReady =
    app[LOOPBACK_READY] ??
    (app[LOOPBACK_READY] = new Promise<void>((resolve, reject) => {
      app.once('error', reject);
      app.listen(0, '127.0.0.1', () => {
        app[LOOPBACK_READY] = undefined;
        resolve();
      });
    }));

  // Placeholder only. `end` rewrites this once the port is known, and no request
  // can be issued before then.
  return `http://127.0.0.1:0${path}`;
};

SupertestTest.prototype.end = function loopbackEnd(this: PendingLoopbackTest, fn: any) {
  const ready = this._loopbackReady;
  if (!ready) {
    return originalEnd.call(this, fn);
  }
  this._loopbackReady = undefined;

  // Surface a bind failure as a normal request error rather than an unhandled
  // rejection, which jest would attribute to whatever test happened to be running.
  const fail = (error: Error) => {
    if (typeof fn === 'function') {
      fn(error);
      return;
    }
    (this as unknown as { emit(event: string, error: Error): void }).emit('error', error);
  };

  ready.then(() => {
    const address = this._server.address() as AddressInfo | null;
    if (!address) {
      fail(new Error('supertest server reported no address after listening'));
      return;
    }
    // Rebuild through upstream so protocol selection stays theirs.
    this.url = originalServerAddress.call(this, this._server, this._loopbackPath);
    originalEnd.call(this, fn);
  }, fail);

  return this;
};
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */

loadEnv();
