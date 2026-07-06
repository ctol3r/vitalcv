import { describe, it, expect } from 'vitest';
import { scrubEvent } from '../lib/observability/sentryScrub';

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
});
