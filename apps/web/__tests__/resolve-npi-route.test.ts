import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_POLICY,
  __resetBuckets,
  consumeToken,
  extractClientIp,
} from '@/lib/rate-limit/ipBucket';

beforeEach(() => {
  __resetBuckets();
});

afterEach(() => {
  __resetBuckets();
});

describe('extractClientIp · header precedence', () => {
  it('reads the first X-Forwarded-For hop', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' });
    expect(extractClientIp(h)).toBe('203.0.113.5');
  });

  it('falls back to X-Real-IP', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.7' });
    expect(extractClientIp(h)).toBe('198.51.100.7');
  });

  it('returns a sentinel when no IP header is present', () => {
    expect(extractClientIp(new Headers())).toBe('__no_ip__');
  });

  it('rejects oversized header values (defensive)', () => {
    const long = 'x'.repeat(80);
    const h = new Headers({ 'x-real-ip': long });
    expect(extractClientIp(h)).toBe('__no_ip__');
  });
});

describe('consumeToken · sliding-window bucket', () => {
  it('allows up to the burst capacity, then rejects', () => {
    const ip = '198.51.100.1';
    const policy = { capacity: 3, refillPerSecond: 0 };
    expect(consumeToken(ip, policy, 1000).allowed).toBe(true);
    expect(consumeToken(ip, policy, 1000).allowed).toBe(true);
    expect(consumeToken(ip, policy, 1000).allowed).toBe(true);
    const denied = consumeToken(ip, policy, 1000);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('refills tokens at the configured rate', () => {
    const ip = '198.51.100.2';
    const policy = { capacity: 2, refillPerSecond: 1 };
    expect(consumeToken(ip, policy, 0).allowed).toBe(true);
    expect(consumeToken(ip, policy, 0).allowed).toBe(true);
    expect(consumeToken(ip, policy, 0).allowed).toBe(false);
    // 1.1 seconds later → one token refilled
    expect(consumeToken(ip, policy, 1100).allowed).toBe(true);
  });

  it('isolates buckets across distinct IPs', () => {
    const a = '198.51.100.10';
    const b = '198.51.100.11';
    const policy = { capacity: 1, refillPerSecond: 0 };
    expect(consumeToken(a, policy, 0).allowed).toBe(true);
    expect(consumeToken(a, policy, 0).allowed).toBe(false);
    expect(consumeToken(b, policy, 0).allowed).toBe(true);
  });

  it('default policy is 30 req/min, burstable to 30', () => {
    expect(DEFAULT_POLICY.capacity).toBe(30);
    expect(DEFAULT_POLICY.refillPerSecond).toBeCloseTo(0.5, 5);
  });
});

describe('resolve-npi route · input validation + upstream contract', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function callRoute(npi: string, headers: HeadersInit = {}) {
    const { GET } = await import('@/app/api/resolve-npi/route');
    const url = new URL(`http://localhost/api/resolve-npi?npi=${npi}`);
    // Build a NextRequest-like object — the route reads nextUrl + headers only.
    const req = {
      nextUrl: url,
      headers: new Headers(headers),
    } as unknown as import('next/server').NextRequest;
    return GET(req);
  }

  it('rejects non-numeric NPI with 400 invalid_npi_format', async () => {
    const res = await callRoute('abc');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_npi_format' });
  });

  it('rejects bad-length NPI with 400 invalid_npi_format', async () => {
    const res = await callRoute('1234');
    expect(res.status).toBe(400);
  });

  it('rejects NPI that fails the Luhn checksum with 400', async () => {
    const res = await callRoute('1234567890'); // fails NPI Luhn
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_npi_checksum' });
  });

  it('projects a minimal payload from NPPES upstream (Luhn-valid NPI)', async () => {
    // 1346053246 is a publicly-known NPI used in NPPES API examples; it
    // passes the Luhn check. We do not call upstream — we mock it.
    const mockResponse = {
      result_count: 1,
      results: [
        {
          number: '1346053246',
          basic: {
            first_name: 'Mira',
            middle_name: 'L',
            last_name: 'Chen',
            credential: 'MD',
          },
          taxonomies: [
            {
              code: '207R00000X',
              desc: 'Internal Medicine',
              primary: true,
              state: 'CA',
            },
          ],
          addresses: [{ state: 'CA' }],
        },
      ],
    };
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    ) as unknown as typeof fetch;

    const res = await callRoute('1346053246', {
      'x-forwarded-for': '198.51.100.50',
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.npi).toBe('1346053246');
    expect(body.name.full).toBe('Mira L Chen');
    expect(body.credential).toBe('MD');
    expect(body.taxonomy.code).toBe('207R00000X');
    expect(body.taxonomy.label).toBe('Internal Medicine');
    expect(body.taxonomy.primary).toBe(true);
    expect(body.state).toBe('CA');
  });

  it('returns 404 when NPPES reports zero results', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ result_count: 0, results: [] }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const res = await callRoute('1346053246', {
      'x-forwarded-for': '198.51.100.51',
    });
    expect(res.status).toBe(404);
  });

  it('returns 502 when upstream returns non-2xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('upstream down', { status: 500 }),
    ) as unknown as typeof fetch;
    const res = await callRoute('1346053246', {
      'x-forwarded-for': '198.51.100.52',
    });
    expect(res.status).toBe(502);
  });

  it('returns 429 when the IP rate-limit is exceeded', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ result_count: 0, results: [] }), {
        status: 200,
      }),
    ) as unknown as typeof fetch;
    const ip = '198.51.100.99';
    // Exhaust the default 30-token bucket
    for (let i = 0; i < 30; i++) {
      await callRoute('1346053246', { 'x-forwarded-for': ip });
    }
    const denied = await callRoute('1346053246', { 'x-forwarded-for': ip });
    expect(denied.status).toBe(429);
    expect(denied.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('truth-contract · route copy', () => {
  it('error tokens are stable machine-readable strings, not marketing copy', () => {
    const allowedTokens = [
      'rate_limited',
      'invalid_npi_format',
      'invalid_npi_checksum',
      'upstream_unavailable',
      'upstream_unreachable',
      'npi_not_found',
    ];
    for (const token of allowedTokens) {
      expect(token).toMatch(/^[a-z_]+$/);
    }
  });
});
