import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  resolveIssuerHost,
  resolveIssuerOrigin,
  resolveIssuerDid,
} from '@/lib/discovery/issuerHost';

const ORIGINAL_ENV = process.env.VCV_ISSUER_HOST;

beforeEach(() => {
  delete process.env.VCV_ISSUER_HOST;
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env.VCV_ISSUER_HOST;
  } else {
    process.env.VCV_ISSUER_HOST = ORIGINAL_ENV;
  }
});

function buildHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

describe('resolveIssuerHost · precedence order', () => {
  it('returns the env override when set', () => {
    process.env.VCV_ISSUER_HOST = 'demo-tunnel.trycloudflare.com';
    const host = resolveIssuerHost(
      buildHeaders({
        host: 'localhost:3000',
        'x-forwarded-host': 'wrong.example.com',
      }),
    );
    expect(host).toBe('demo-tunnel.trycloudflare.com');
  });

  it('falls back to x-forwarded-host when env is unset', () => {
    expect(
      resolveIssuerHost(
        buildHeaders({
          host: 'localhost:3000',
          'x-forwarded-host': 'demo-tunnel.trycloudflare.com',
        }),
      ),
    ).toBe('demo-tunnel.trycloudflare.com');
  });

  it('uses the first value when x-forwarded-host is comma-separated', () => {
    expect(
      resolveIssuerHost(
        buildHeaders({
          'x-forwarded-host':
            'demo-tunnel.trycloudflare.com, internal.example.com',
        }),
      ),
    ).toBe('demo-tunnel.trycloudflare.com');
  });

  it('falls back to host header when env and x-forwarded-host are unset', () => {
    expect(
      resolveIssuerHost(buildHeaders({ host: 'preview-1234.vercel.app' })),
    ).toBe('preview-1234.vercel.app');
  });

  it('falls back to vitalcv.com when no header is present', () => {
    expect(resolveIssuerHost(buildHeaders())).toBe('vitalcv.com');
  });
});

describe('resolveIssuerHost · injection resistance', () => {
  it.each([
    'evil.com/.well-known',
    'evil.com://attack',
    '   ',
    'with whitespace',
    '',
    'a'.repeat(254),
  ])('rejects malformed candidate "%s" and falls through', (bad) => {
    process.env.VCV_ISSUER_HOST = bad;
    expect(resolveIssuerHost(buildHeaders())).toBe('vitalcv.com');
  });

  it('strips the env override path-injection attempt', () => {
    process.env.VCV_ISSUER_HOST = 'good.com';
    expect(
      resolveIssuerHost(
        buildHeaders({ 'x-forwarded-host': 'attacker.com/evil' }),
      ),
    ).toBe('good.com');
  });
});

describe('resolveIssuerOrigin / resolveIssuerDid composition', () => {
  it('builds https origin from resolved host', () => {
    process.env.VCV_ISSUER_HOST = 'demo-tunnel.trycloudflare.com';
    expect(resolveIssuerOrigin(buildHeaders())).toBe(
      'https://demo-tunnel.trycloudflare.com',
    );
  });

  it('builds did:web from resolved host', () => {
    process.env.VCV_ISSUER_HOST = 'demo-tunnel.trycloudflare.com';
    expect(resolveIssuerDid(buildHeaders())).toBe(
      'did:web:demo-tunnel.trycloudflare.com',
    );
  });

  it('production default remains did:web:vitalcv.com', () => {
    expect(resolveIssuerDid(buildHeaders())).toBe('did:web:vitalcv.com');
    expect(resolveIssuerOrigin(buildHeaders())).toBe('https://vitalcv.com');
  });
});
