/**
 * originAllowlist.test.ts — Canonical origin normalization and allowlist tests.
 *
 * Verifies:
 *   - https://vitalcv.com accepted
 *   - https://www.vitalcv.com accepted (apex/www equivalence)
 *   - localhost accepted in dev only
 *   - preview deployments accepted by pattern
 *   - same-origin requests never CORS-block
 *   - trailing slash stripped
 *   - protocol mismatch rejected in production
 *   - structured reject reasons present
 */

// Jest — no explicit import needed (globals injected by jest runner)
import {
  normalizeOrigin,
  checkOrigin,
  buildCorsOriginCallback,
  type OriginAllowlistOptions,
} from '../originAllowlist';

// ─── normalizeOrigin ──────────────────────────────────────────────────────────

describe('normalizeOrigin', () => {
  it('strips trailing slash', () => {
    expect(normalizeOrigin('https://vitalcv.com/')).toBe('https://vitalcv.com');
  });

  it('lowercases host', () => {
    expect(normalizeOrigin('https://VitalCV.COM')).toBe('https://vitalcv.com');
  });

  it('strips default port 443', () => {
    expect(normalizeOrigin('https://vitalcv.com:443')).toBe('https://vitalcv.com');
  });

  it('strips default port 80', () => {
    expect(normalizeOrigin('http://vitalcv.com:80')).toBe('http://vitalcv.com');
  });

  it('preserves non-default port', () => {
    expect(normalizeOrigin('https://vitalcv.com:8443')).toBe('https://vitalcv.com:8443');
  });

  it('preserves localhost port', () => {
    expect(normalizeOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('returns null for empty string', () => {
    expect(normalizeOrigin('')).toBeNull();
  });

  it('returns null for "null"', () => {
    expect(normalizeOrigin('null')).toBeNull();
  });

  it('returns null for unparseable', () => {
    expect(normalizeOrigin('not-a-url')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(normalizeOrigin(undefined)).toBeNull();
  });
});

// ─── checkOrigin — production ─────────────────────────────────────────────────

const prodOpts: OriginAllowlistOptions = {
  explicit: ['https://vitalcv.com'],
  allowInsecure: false,
  allowLocalhost: false,
  allowVercelPreview: true,
  env: 'production',
};

describe('checkOrigin — production', () => {
  it('accepts https://vitalcv.com', () => {
    const v = checkOrigin('https://vitalcv.com', prodOpts);
    expect(v.allowed).toBe(true);
    if (v.allowed) expect(v.rule).toBe('exact_match');
  });

  it('accepts https://www.vitalcv.com (www equivalence)', () => {
    const v = checkOrigin('https://www.vitalcv.com', prodOpts);
    expect(v.allowed).toBe(true);
    if (v.allowed) expect(v.rule).toBe('www_apex');
  });

  it('accepts https://vitalcv.com/ (trailing slash)', () => {
    const v = checkOrigin('https://vitalcv.com/', prodOpts);
    expect(v.allowed).toBe(true);
  });

  it('rejects http://vitalcv.com in production', () => {
    const v = checkOrigin('http://vitalcv.com', prodOpts);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toBe('http_in_production');
  });

  it('rejects localhost in production', () => {
    const v = checkOrigin('http://localhost:3000', prodOpts);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toBe('localhost_in_production');
  });

  it('rejects unknown origin', () => {
    const v = checkOrigin('https://evil.com', prodOpts);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toBe('not_in_allowlist');
  });

  it('rejects vercel preview in production (not explicitly listed)', () => {
    const v = checkOrigin('https://vitalcv-abc123.vercel.app', prodOpts);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toBe('vercel_preview_in_production');
  });

  it('rejects null origin', () => {
    const v = checkOrigin('null', prodOpts);
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.reason).toBe('null_origin');
  });
});

// ─── checkOrigin — development ────────────────────────────────────────────────

const devOpts: OriginAllowlistOptions = {
  explicit: ['https://vitalcv.com'],
  allowInsecure: true,
  allowLocalhost: true,
  allowVercelPreview: true,
  env: 'development',
};

describe('checkOrigin — development', () => {
  it('accepts localhost:3000', () => {
    const v = checkOrigin('http://localhost:3000', devOpts);
    expect(v.allowed).toBe(true);
    if (v.allowed) expect(v.rule).toBe('localhost_dev');
  });

  it('accepts https://localhost:3000', () => {
    const v = checkOrigin('https://localhost:3000', devOpts);
    expect(v.allowed).toBe(true);
    if (v.allowed) expect(v.rule).toBe('localhost_dev');
  });

  it('accepts vercel preview domain', () => {
    const v = checkOrigin('https://vitalcv-abc123.vercel.app', devOpts);
    expect(v.allowed).toBe(true);
    if (v.allowed) expect(v.rule).toBe('vercel_preview');
  });

  it('accepts http:// in dev (insecure allowed)', () => {
    const v = checkOrigin('http://vitalcv.com', devOpts);
    // http passes insecure gate but must match allowlist — http vitalcv.com != https vitalcv.com
    // So it won't match explicit 'https://vitalcv.com' — expected not_in_allowlist
    expect(v.allowed).toBe(false);
  });
});

// ─── buildCorsOriginCallback ──────────────────────────────────────────────────

function callbackAsPromise(
  cb: (origin: string | undefined, done: (err: Error | null, allow?: boolean) => void) => void,
  origin: string | undefined,
): Promise<{ err: Error | null; allow: boolean | undefined }> {
  return new Promise((resolve) => {
    cb(origin, (err, allow) => resolve({ err, allow }));
  });
}

describe('buildCorsOriginCallback', () => {
  it('wildcard: accepts any origin', async () => {
    const cb = buildCorsOriginCallback('*', 'development');
    const { err, allow } = await callbackAsPromise(cb, 'https://anything.com');
    expect(err).toBeNull();
    expect(allow).toBe(true);
  });

  it('same-origin (no Origin header): always allowed', async () => {
    const cb = buildCorsOriginCallback('https://vitalcv.com', 'production');
    const { err, allow } = await callbackAsPromise(cb, undefined);
    expect(err).toBeNull();
    expect(allow).toBe(true);
  });

  it('production: accepts apex', async () => {
    const cb = buildCorsOriginCallback('https://vitalcv.com', 'production');
    const { err, allow } = await callbackAsPromise(cb, 'https://vitalcv.com');
    expect(err).toBeNull();
    expect(allow).toBe(true);
  });

  it('production: accepts www', async () => {
    const cb = buildCorsOriginCallback('https://vitalcv.com', 'production');
    const { err, allow } = await callbackAsPromise(cb, 'https://www.vitalcv.com');
    expect(err).toBeNull();
    expect(allow).toBe(true);
  });

  it('production: rejects localhost', async () => {
    const cb = buildCorsOriginCallback('https://vitalcv.com', 'production');
    const { err, allow } = await callbackAsPromise(cb, 'http://localhost:3000');
    expect(err).toBeNull();
    expect(allow).toBe(false);
  });

  it('dev: accepts localhost', async () => {
    const cb = buildCorsOriginCallback('https://vitalcv.com', 'development');
    const { err, allow } = await callbackAsPromise(cb, 'http://localhost:3000');
    expect(err).toBeNull();
    expect(allow).toBe(true);
  });

  it('multi-origin comma list: accepts all listed', async () => {
    const cb = buildCorsOriginCallback('https://vitalcv.com,https://app.vitalcv.com', 'production');
    const r1 = await callbackAsPromise(cb, 'https://vitalcv.com');
    const r2 = await callbackAsPromise(cb, 'https://app.vitalcv.com');
    expect(r1.allow).toBe(true);
    expect(r2.allow).toBe(true);
  });
});
