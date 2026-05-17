import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('server-only', () => ({}));

const slackMock = vi.fn();
vi.mock('@/lib/leads/slack', () => ({
  deliverLeadToSlack: (...args: unknown[]) => slackMock(...args),
  isSlackConfigured: () => false,
}));

import { POST } from '@/app/api/leads/route';
import {
  _resetRateBuckets,
  isValidEmail,
  isValidIntent,
  hashIp,
  resolveLeadLogPath,
  sanitizeNpiList,
  truncateUserAgent,
  validateLeadInput,
  MAX_SAMPLE_NPIS,
} from '@/lib/leads/persistLead';

const TMP_DIR = mkdtempSync(join(tmpdir(), 'vitalcv-leads-test-'));
const LOG_PATH = join(TMP_DIR, 'leads.jsonl');

const validBody = {
  email: 'alex@example-cvo.com',
  intent: 'pilot' as const,
  source: 'launch_page',
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: bodyText,
  });
}

beforeEach(() => {
  process.env.LEAD_LOG_PATH = LOG_PATH;
  delete process.env.SLACK_LEAD_CAPTURE_WEBHOOK_URL;
  slackMock.mockReset();
  _resetRateBuckets();
  if (existsSync(LOG_PATH)) rmSync(LOG_PATH);
});

afterEach(() => {
  slackMock.mockReset();
});

describe('lead-capture helpers', () => {
  it('isValidEmail accepts well-formed addresses and rejects malformed', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('  ')).toBe(false);
    expect(isValidEmail('no-at')).toBe(false);
    expect(isValidEmail('two@@signs.com')).toBe(false);
  });

  it('isValidIntent narrows the union safely', () => {
    expect(isValidIntent('pilot')).toBe(true);
    expect(isValidIntent('waitlist')).toBe(true);
    expect(isValidIntent('walkthrough')).toBe(true);
    expect(isValidIntent('early_access')).toBe(true);
    expect(isValidIntent('production_access')).toBe(false);
    expect(isValidIntent(undefined)).toBe(false);
  });

  it('hashIp is deterministic per day and bounded to 16 hex chars', () => {
    const now = new Date('2026-05-12T00:00:00Z');
    const a = hashIp('203.0.113.7', now);
    const b = hashIp('203.0.113.7', now);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    const otherDay = hashIp('203.0.113.7', new Date('2026-05-13T00:00:00Z'));
    expect(otherDay).not.toBe(a);
  });

  it('truncateUserAgent clamps at 200 chars and returns undefined for empty', () => {
    expect(truncateUserAgent(undefined)).toBeUndefined();
    expect(truncateUserAgent(null)).toBeUndefined();
    expect(truncateUserAgent('Mozilla/5.0')).toBe('Mozilla/5.0');
    const long = 'x'.repeat(500);
    expect(truncateUserAgent(long)?.length).toBe(200);
  });

  it('resolveLeadLogPath honours $LEAD_LOG_PATH override', () => {
    expect(resolveLeadLogPath()).toBe(LOG_PATH);
  });

  it('validateLeadInput surfaces per-field errors for email + intent', () => {
    const r = validateLeadInput({ email: 'no-at', intent: 'sneak' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.intent).toBeTruthy();
    }
  });

  it('validateLeadInput rejects npiList strings longer than 2000 chars', () => {
    const r = validateLeadInput({
      email: 'a@b.co',
      intent: 'pilot',
      npiList: 'x'.repeat(2001),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.npiList).toBeTruthy();
  });

  it('validateLeadInput rejects sampleNpis that is not an array', () => {
    const r = validateLeadInput({
      email: 'a@b.co',
      intent: 'pilot',
      sampleNpis: '1234567890',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.sampleNpis).toBeTruthy();
  });

  it('validateLeadInput drops free-text "message" silently — never persisted', () => {
    const r = validateLeadInput({
      email: 'a@b.co',
      intent: 'pilot',
      message: 'Patient Jane Doe DOB 1980-01-01 needs credentials.',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.value as Record<string, unknown>).message).toBeUndefined();
      expect(JSON.stringify(r.value)).not.toContain('Patient');
      expect(JSON.stringify(r.value)).not.toContain('Jane Doe');
    }
  });
});

describe('sanitizeNpiList', () => {
  it('returns [] for non-string or empty inputs', () => {
    expect(sanitizeNpiList(undefined)).toEqual([]);
    expect(sanitizeNpiList(null)).toEqual([]);
    expect(sanitizeNpiList(123)).toEqual([]);
    expect(sanitizeNpiList('')).toEqual([]);
  });

  it('extracts only 10-digit runs from surrounding free text', () => {
    const raw =
      'Hi team, my colleagues are NPI 1234567890 and 0987654321. ' +
      'My phone is 555-1212 and SSN 123-45-6789 should be ignored. ' +
      'Patient ID 999 is too short, 12345678901 is too long.';
    expect(sanitizeNpiList(raw)).toEqual(['1234567890', '0987654321']);
    // Sensitive surrounding text is gone.
    const out = JSON.stringify(sanitizeNpiList(raw));
    expect(out).not.toContain('SSN');
    expect(out).not.toContain('Patient');
    expect(out).not.toContain('Hi team');
  });

  it('deduplicates and caps at MAX_SAMPLE_NPIS', () => {
    const npis = Array.from({ length: 60 }, (_, i) =>
      String(1000000000 + i).padStart(10, '0'),
    );
    const raw = [...npis, ...npis].join(', '); // duplicated input
    const out = sanitizeNpiList(raw);
    expect(out.length).toBe(MAX_SAMPLE_NPIS);
    expect(new Set(out).size).toBe(MAX_SAMPLE_NPIS); // unique
  });
});

describe('POST /api/leads', () => {
  it('returns 400 invalid_json when body is not JSON', async () => {
    const res = await POST(makeRequest('not json'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: 'invalid_json' });
    expect(slackMock).not.toHaveBeenCalled();
  });

  it('returns 413 payload_too_large when body exceeds 8KB', async () => {
    const huge = { email: 'a@b.co', intent: 'pilot', npiList: 'x'.repeat(9 * 1024) };
    const res = await POST(makeRequest(huge));
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json).toEqual({ ok: false, error: 'payload_too_large' });
    expect(slackMock).not.toHaveBeenCalled();
    // Nothing persisted.
    expect(existsSync(LOG_PATH)).toBe(false);
  });

  it('returns 413 payload_too_large when Content-Length declares oversize', async () => {
    const req = new Request('http://localhost/api/leads', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(9 * 1024),
      },
      body: JSON.stringify(validBody), // body itself is small; header declares more
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toBe('payload_too_large');
  });

  it('returns 400 with field errors when email malformed', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'no-at' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors.email).toBeTruthy();
    expect(slackMock).not.toHaveBeenCalled();
  });

  it('returns 400 with field errors when intent is unknown', async () => {
    const res = await POST(makeRequest({ ...validBody, intent: 'production_access' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors.intent).toBeTruthy();
  });

  it('persists a JSONL row with sampleNpis but no raw message or npiList free text', async () => {
    slackMock.mockResolvedValueOnce({ delivered: false, reason: 'unconfigured' });
    const res = await POST(
      makeRequest(
        {
          ...validBody,
          // Free-text message — should be silently dropped.
          message: 'Patient Jane Doe DOB 1980-01-01 is being onboarded.',
          // NPI list with surrounding sensitive prose — only digits should survive.
          npiList:
            'Roster: NPI 1234567890 (Dr Smith — diagnosis: hypertension), ' +
            '0987654321 (Dr Lee). SSN 123-45-6789. Phone 555-1212.',
        },
        { 'x-forwarded-for': '203.0.113.42' },
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.leadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.persisted).toBe(true);
    expect(json.slackDelivered).toBe(false);
    expect(json.slackReason).toBe('unconfigured');

    const line = readFileSync(LOG_PATH, 'utf8').trim();
    const row = JSON.parse(line);

    // Sanitized NPIs are persisted; sensitive free text is not.
    expect(row.sampleNpis).toEqual(['1234567890', '0987654321']);
    expect(row.sampleNpiCount).toBe(2);
    expect(row.email).toBe(validBody.email);
    expect(row.intent).toBe('pilot');
    expect(row.source).toBe('launch_page');
    expect(row.leadId).toBe(json.leadId);
    expect(row.ipHash).toMatch(/^[0-9a-f]{16}$/);

    // Free-text fields and raw surrounding text must not appear anywhere in the row.
    expect(row.message).toBeUndefined();
    expect(row.npiList).toBeUndefined();
    expect(line).not.toContain('Patient');
    expect(line).not.toContain('Jane Doe');
    expect(line).not.toContain('hypertension');
    expect(line).not.toContain('SSN');
    expect(line).not.toContain('Phone');
    expect(line).not.toContain('203.0.113.42'); // raw IP absent
  });

  it('reports slack delivery success and forwards only sanitized fields', async () => {
    slackMock.mockResolvedValueOnce({ delivered: true });
    const res = await POST(
      makeRequest({
        ...validBody,
        message: 'sensitive note',
        npiList: 'Dr Smith 1234567890 has SSN 111-22-3333',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slackDelivered).toBe(true);
    expect(json.slackReason).toBeNull();
    expect(slackMock).toHaveBeenCalledTimes(1);

    // The PersistedLead passed to Slack must contain no raw free text.
    const [persistedArg] = slackMock.mock.calls[0] as [Record<string, unknown>];
    expect(persistedArg.message).toBeUndefined();
    expect(persistedArg.npiList).toBeUndefined();
    expect(persistedArg.sampleNpis).toEqual(['1234567890']);
    expect(persistedArg.sampleNpiCount).toBe(1);
    const serialized = JSON.stringify(persistedArg);
    expect(serialized).not.toContain('sensitive note');
    expect(serialized).not.toContain('Dr Smith');
    expect(serialized).not.toContain('SSN');
  });

  it('returns 200 even when slack fetch fails (lead is already persisted)', async () => {
    slackMock.mockResolvedValueOnce({ delivered: false, reason: 'fetch_failed' });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.persisted).toBe(true);
    expect(json.slackDelivered).toBe(false);
    expect(json.slackReason).toBe('fetch_failed');
  });

  it('rate-limits at >3 submissions / 5 min per ip-hash and emits Retry-After', async () => {
    slackMock.mockResolvedValue({ delivered: false, reason: 'unconfigured' });
    const headers = { 'x-forwarded-for': '198.51.100.7' };
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest(validBody, headers));
      expect(res.status).toBe(200);
    }
    const fourth = await POST(makeRequest(validBody, headers));
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get('retry-after')).toBeTruthy();
    const json = await fourth.json();
    expect(json.error).toBe('rate_limited');
    expect(typeof json.retryAfterSeconds).toBe('number');
  });
});
