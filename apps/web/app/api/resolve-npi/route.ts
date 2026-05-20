/**
 * GET /api/resolve-npi?npi=NNNNNNNNNN
 *
 * Live NPPES NPI resolver (WAVE C77). Consumes
 * `@vitalcv/core` `resolveNppes(...)` and overlays:
 *   - per-IP rate-limit (token bucket; 30/min default)
 *   - in-memory positive-result cache (TTL 5 min) for <300ms repeat reads
 *   - error-token discipline (machine-readable strings, not marketing copy)
 *
 * The route is unauthenticated. NPPES is the public, free CMS registry;
 * the payload contains nothing beyond what is legally published there.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isValidNpiChecksum,
  resolveNppes,
  type NppesProviderDto,
} from '@vitalcv/core';
import {
  DEFAULT_POLICY,
  consumeToken,
  extractClientIp,
} from '@/lib/rate-limit/ipBucket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: NppesProviderDto; expiresAt: number }>();

export function __resetResolveNpiCache(): void {
  cache.clear();
}

export async function GET(req: NextRequest) {
  const ip = extractClientIp(req.headers);
  const rl = consumeToken(ip, DEFAULT_POLICY);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_seconds: rl.retryAfterSeconds },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const npi = req.nextUrl.searchParams.get('npi')?.trim() ?? '';
  if (!/^\d{10}$/.test(npi)) {
    return NextResponse.json(
      { error: 'invalid_npi_format', expected: '10 digits' },
      { status: 400 },
    );
  }
  if (!isValidNpiChecksum(npi)) {
    return NextResponse.json(
      { error: 'invalid_npi_checksum' },
      { status: 400 },
    );
  }

  const now = Date.now();
  const hit = cache.get(npi);
  if (hit && hit.expiresAt > now) {
    return NextResponse.json(
      { npi, ...hit.value, cached: true },
      {
        status: 200,
        headers: {
          'X-RateLimit-Remaining': String(rl.tokensRemaining),
          'X-Cache': 'HIT',
          'Cache-Control':
            'public, max-age=300, stale-while-revalidate=600',
        },
      },
    );
  }

  const outcome = await resolveNppes(npi);
  if (outcome.kind === 'not_found') {
    return NextResponse.json(
      { error: 'npi_not_found', npi },
      { status: 404 },
    );
  }
  if (outcome.kind === 'upstream_error') {
    return NextResponse.json(
      { error: 'upstream_unavailable', status: outcome.status },
      { status: 502 },
    );
  }
  if (outcome.kind === 'network_error') {
    return NextResponse.json(
      { error: 'upstream_unreachable', detail: outcome.detail },
      { status: 504 },
    );
  }

  cache.set(npi, {
    value: outcome.provider,
    expiresAt: now + CACHE_TTL_MS,
  });

  return NextResponse.json(
    { npi, ...outcome.provider, cached: false },
    {
      status: 200,
      headers: {
        'X-RateLimit-Remaining': String(rl.tokensRemaining),
        'X-Cache': 'MISS',
        'Cache-Control':
          'public, max-age=300, stale-while-revalidate=600',
      },
    },
  );
}
