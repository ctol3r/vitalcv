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
  truncateUserAgent,
  validateLeadInput,
} from '@/lib/leads/persistLead';

const TMP_DIR = mkdtempSync(join(tmpdir(), 'vitalcv-leads-test-'));
const LOG_PATH = join(TMP_DIR, 'leads.jsonl');

const validBody = {
  email: 'alex@example-cvo.com',
  intent: 'pilot' as const,
  source: 'launch_page',
  message: 'Want to talk about a 10-clinician pilot.',
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/leads', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
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

  it('validateLeadInput surfaces per-field errors', () => {
    const r = validateLeadInput({ email: 'no-at', intent: 'sneak' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBeTruthy();
      expect(r.errors.intent).toBeTruthy();
    }
  });

  it('validateLeadInput rejects over-long fields', () => {
    const r = validateLeadInput({
      email: 'a@b.co',
      intent: 'pilot',
      message: 'x'.repeat(2001),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.message).toBeTruthy();
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

  it('persists a JSONL row and returns leadId on success', async () => {
    slackMock.mockResolvedValueOnce({ delivered: false, reason: 'unconfigured' });
    const res = await POST(makeRequest(validBody, { 'x-forwarded-for': '203.0.113.42' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.leadId).toMatch(/^[0-9a-f-]{36}$/);
    expect(json.persisted).toBe(true);
    expect(json.slackDelivered).toBe(false);
    expect(json.slackReason).toBe('unconfigured');

    const line = readFileSync(LOG_PATH, 'utf8').trim();
    const row = JSON.parse(line);
    expect(row.email).toBe(validBody.email);
    expect(row.intent).toBe('pilot');
    expect(row.source).toBe('launch_page');
    expect(row.leadId).toBe(json.leadId);
    expect(row.ipHash).toMatch(/^[0-9a-f]{16}$/);
    // Raw IP must NOT appear in the persisted row.
    expect(line).not.toContain('203.0.113.42');
  });

  it('reports slack delivery success', async () => {
    slackMock.mockResolvedValueOnce({ delivered: true });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.slackDelivered).toBe(true);
    expect(json.slackReason).toBeNull();
    expect(slackMock).toHaveBeenCalledTimes(1);
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
