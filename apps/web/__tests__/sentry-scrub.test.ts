import { describe, it, expect } from 'vitest';
import { scrubEvent, resolveSentryRelease } from '../lib/observability/sentryScrub';

describe('scrubEvent — M5-1 PII scrubbing', () => {
  it('redacts email / NPI / SSN / bearer token in message + exception', () => {
    const ev = scrubEvent({
      message: 'failed for jane@example.com NPI 1457128589',
      exception: { values: [{ value: 'SSN 123-45-6789 with Bearer abc.def.ghi' }] },
    });
    expect(ev.message).not.toMatch(/jane@example\.com/);
    expect(ev.message).not.toMatch(/1457128589/);
    expect(ev.exception.values[0].value).not.toMatch(/123-45-6789/);
    expect(ev.exception.values[0].value).not.toMatch(/Bearer abc/);
    expect(ev.message).toMatch(/redacted/);
  });

  it('drops sensitive request headers + cookies', () => {
    const ev = scrubEvent({
      request: {
        headers: {
          authorization: 'Bearer secret',
          'x-clerk-user-id': 'user_123',
          'x-org-id': 'org_abc',
          'user-agent': 'Mozilla',
        },
        cookies: '__session=abc; other=1',
      },
    });
    expect(ev.request.headers.authorization).toBe('[redacted]');
    expect(ev.request.headers['x-clerk-user-id']).toBe('[redacted]');
    expect(ev.request.headers['x-org-id']).toBe('[redacted]');
    expect(ev.request.headers['user-agent']).toBe('Mozilla'); // non-sensitive preserved
    expect(ev.request.cookies).toBe('[redacted]');
  });

  it('reduces user to a bare id (no email/ip)', () => {
    const ev = scrubEvent({ user: { id: 'u1', email: 'j@x.com', ip_address: '1.2.3.4' } });
    expect(ev.user).toEqual({ id: 'u1' });
  });

  it('scrubs PII nested in extra + request data', () => {
    const ev = scrubEvent({
      extra: { note: 'contact bob@hospital.org' },
      request: { data: { npi: '1457128589', ok: 'value' } },
    });
    expect(JSON.stringify(ev.extra)).not.toMatch(/bob@hospital\.org/);
    expect(JSON.stringify(ev.request.data)).not.toMatch(/1457128589/);
    expect(ev.request.data.ok).toBe('value');
  });

  // MS-1: the backend routes NPIs in the path, so URL and the Express
  // transaction name are PII carriers before any body is considered.
  it('scrubs the NPI out of request.url and the transaction name', () => {
    const ev = scrubEvent({
      transaction: 'GET /api/passport/1457128589',
      request: {
        url: 'https://api.vitalcv.com/api/passport/1457128589?email=jane@example.com',
        query_string: 'email=jane@example.com',
      },
    });
    expect(ev.request.url).not.toMatch(/1457128589/);
    expect(ev.request.url).not.toMatch(/jane@example\.com/);
    expect(ev.transaction).not.toMatch(/1457128589/);
    expect(ev.transaction).toMatch(/redacted/);
    expect(ev.request.query_string).not.toMatch(/jane@example\.com/);
  });

  it('scrubs tags and breadcrumbs', () => {
    const ev = scrubEvent({
      tags: { npi: '1457128589', route: 'passport' },
      breadcrumbs: [{ message: 'looked up jane@example.com', data: { authorization: 'Bearer x' } }],
    });
    expect(JSON.stringify(ev.tags)).not.toMatch(/1457128589/);
    expect(ev.tags.route).toBe('passport');
    expect(JSON.stringify(ev.breadcrumbs)).not.toMatch(/jane@example\.com/);
    expect(ev.breadcrumbs[0].data.authorization).toBe('[redacted]');
  });

  it('resolves an honest release tag — undefined rather than a placeholder', () => {
    expect(resolveSentryRelease({ RAILWAY_GIT_COMMIT_SHA: 'abc123' })).toBe('abc123');
    expect(resolveSentryRelease({ GIT_SHA: 'def456' })).toBe('def456');
    expect(resolveSentryRelease({ RAILWAY_GIT_COMMIT_SHA: '  ' })).toBeUndefined();
    expect(resolveSentryRelease({})).toBeUndefined();
  });
});
