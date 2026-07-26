import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

/**
 * GET /api/health/db — web→database connectivity signal.
 *
 * Exists because of the 2026-07-17 incident: vitalcv-web ran with a
 * placeholder DATABASE_URL (localhost) for an unknown period and nothing
 * surfaced it. Every product route that touches web Prisma (the /api/matcha/*
 * family) is DELIBERATELY fail-open — a dead database degrades them to
 * persisted:false / empty reads, never a 500 — and neither /api/version nor
 * the release-verify synthetic flow touches web Prisma at all. This route is
 * the one place a dead web→DB link becomes visible: a trivial `SELECT 1`
 * through the same client (@/lib/db) the product routes use.
 *
 * Contract (consumed by scripts/deploy-smoke.mjs in the release-verify
 * workflow):
 *   - db "ok"          → HTTP 200
 *   - db "unreachable" → HTTP 503 (connect failure, missing env, or timeout)
 *
 * Public like /api/health/auth, and equally non-secret: the body is this
 * fixed three-field shape. Prisma errors are NEVER echoed — a P1001 message
 * embeds the database host:port, i.e. connection details.
 *
 * Product routes stay fail-open; this route observes, it does not gate. It is
 * intentionally NOT part of /api/readyz — a dead DB must alert, not block
 * container rollout.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PROBE_TIMEOUT_MS = 2_000;

function probeTimeoutMs(): number {
  const raw = Number(process.env.DB_HEALTH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PROBE_TIMEOUT_MS;
}

export async function GET() {
  let db: 'ok' | 'unreachable' = 'unreachable';
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const probe = prisma.$queryRaw`SELECT 1`;
    // A probe that loses the race can still reject later — pre-attach a
    // handler so it can never surface as an unhandled rejection.
    probe.catch(() => undefined);
    await Promise.race([
      probe,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('db probe timeout')), probeTimeoutMs());
      }),
    ]);
    db = 'ok';
  } catch {
    db = 'unreachable';
  } finally {
    if (timer) clearTimeout(timer);
  }

  return NextResponse.json(
    { service: 'web', check: 'db-connectivity', db },
    {
      status: db === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}
