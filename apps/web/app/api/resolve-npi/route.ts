/**
 * GET /api/resolve-npi?npi=NNNNNNNNNN
 *
 * Unauthenticated NPPES identity hook (WAVE C65).
 *
 * Accepts a 10-digit NPI, validates against the standard Luhn check
 * digit, queries the public NPPES API (or the local synthetic mirror
 * when `VCV_NPPES_MIRROR_URL` is set for offline demos), and returns a
 * minimal typed payload: name, credential, taxonomy code + label, and
 * primary practice state.
 *
 * Rate-limited per IP via an in-memory token bucket
 * (`apps/web/lib/rate-limit/ipBucket.ts`). Adequate for unauthenticated
 * demo throughput; not a substitute for a shared store in a
 * multi-process production deployment.
 *
 * NPPES is the public, free, federal provider registry — no API key
 * required. The endpoint never accepts PII beyond the NPI itself.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_POLICY,
  consumeToken,
  extractClientIp,
} from '@/lib/rate-limit/ipBucket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NPPES_BASE =
  process.env.VCV_NPPES_MIRROR_URL ??
  'https://npiregistry.cms.hhs.gov/api/?version=2.1';

const NPPES_TIMEOUT_MS = 4000;

export interface ResolveNpiPayload {
  npi: string;
  name: {
    first: string | null;
    middle: string | null;
    last: string | null;
    full: string;
  };
  credential: string | null;
  taxonomy: {
    code: string | null;
    label: string | null;
    primary: boolean;
  };
  state: string | null;
}

interface NppesNameAddress {
  state?: string;
}

interface NppesBasic {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  credential?: string;
  name_prefix?: string;
  name_suffix?: string;
  name?: string;
}

interface NppesTaxonomy {
  code?: string;
  desc?: string;
  primary?: boolean;
  state?: string;
}

interface NppesResult {
  number?: string;
  basic?: NppesBasic;
  taxonomies?: NppesTaxonomy[];
  addresses?: NppesNameAddress[];
}

interface NppesResponse {
  result_count?: number;
  results?: NppesResult[];
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

  let upstream: NppesResponse;
  try {
    const url = `${NPPES_BASE}&number=${encodeURIComponent(npi)}`;
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), NPPES_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
      return NextResponse.json(
        { error: 'upstream_unavailable', status: res.status },
        { status: 502 },
      );
    }
    upstream = (await res.json()) as NppesResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return NextResponse.json(
      { error: 'upstream_unreachable', detail: msg.slice(0, 120) },
      { status: 504 },
    );
  }

  if (!upstream.results || upstream.results.length === 0) {
    return NextResponse.json(
      { error: 'npi_not_found', npi },
      { status: 404 },
    );
  }

  const payload = projectMinimalPayload(npi, upstream.results[0]);
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'X-RateLimit-Remaining': String(rl.tokensRemaining),
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}

/**
 * Projects the NPPES result into the minimal demo-grade payload defined
 * by the C65 spec. We deliberately do NOT expose addresses (other than
 * the practice state), DOB, or any other PII beyond what is legally
 * public on the federal registry.
 */
function projectMinimalPayload(
  npi: string,
  r: NppesResult,
): ResolveNpiPayload {
  const basic = r.basic ?? {};
  const taxonomies = r.taxonomies ?? [];
  const primary =
    taxonomies.find((t) => t.primary === true) ?? taxonomies[0] ?? null;
  const firstAddr = r.addresses?.find((a) => a.state) ?? null;
  const first = basic.first_name?.trim() ?? null;
  const last = basic.last_name?.trim() ?? null;
  const middle = basic.middle_name?.trim() ?? null;
  const fullParts = [first, middle, last].filter(
    (s): s is string => Boolean(s),
  );
  const full = fullParts.length > 0 ? fullParts.join(' ') : (basic.name ?? npi);
  return {
    npi,
    name: { first, middle, last, full },
    credential: basic.credential?.trim() ?? null,
    taxonomy: {
      code: primary?.code ?? null,
      label: primary?.desc ?? null,
      primary: primary?.primary === true,
    },
    state: primary?.state ?? firstAddr?.state ?? null,
  };
}

/**
 * NPI Luhn check (ISO/IEC 7812 with "80840" prefix).
 *
 * Validates the standard NPI checksum so casual mistyped NPIs are
 * rejected before we issue the upstream request — protects NPPES from
 * unnecessary load and gives the caller a clear error.
 */
function isValidNpiChecksum(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = ('80840' + npi).split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if ((digits.length - 1 - i) % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
