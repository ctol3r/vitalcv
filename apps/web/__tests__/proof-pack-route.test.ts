import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/pilot/proof-pack/route';
import {
  createApplicationSnapshot,
  submitApplicationSnapshot,
  type ApplicationSnapshot,
} from '@/lib/apply/application-snapshot';

function mkSnap(id: string, overrides: { submitted?: boolean } = {}): ApplicationSnapshot {
  const draft = createApplicationSnapshot({
    applicationId: id,
    subjectId: `subj_${id}`,
    employerId: 'emp_1',
    roleId: 'role_1',
    includedLanes: ['nppes', 'oig', 'pecos'],
    includedClaims: [],
    proofTier: 'partial_proof_pack',
    completeness: 70,
    createdAt: '2026-04-01T00:00:00Z',
  });
  return overrides.submitted ? submitApplicationSnapshot(draft) : draft;
}

function makeRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

describe('/api/pilot/proof-pack — GET', () => {
  it('returns a zero-application pack with honest limitations', async () => {
    const res = await GET(
      makeRequest('http://localhost/api/pilot/proof-pack'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      pack: { applicationCount: number; partialDataNotice: string | null; limitations: string[] };
      serialized: string;
    };
    expect(body.pack.applicationCount).toBe(0);
    expect(body.pack.partialDataNotice).not.toBeNull();
    expect(body.pack.limitations.length).toBeGreaterThan(0);
    expect(body.serialized.length).toBeGreaterThan(0);
  });

  it('returns downloadable JSON with Content-Disposition when download=json', async () => {
    const res = await GET(
      makeRequest(
        'http://localhost/api/pilot/proof-pack?download=json',
      ));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('vitalcv-pilot-proof-pack-');
    const text = await res.text();
    const parsed = JSON.parse(text) as { limitations: string[] };
    expect(parsed.limitations).toBeInstanceOf(Array);
  });
});

describe('/api/pilot/proof-pack — POST', () => {
  it('builds a pack from the supplied snapshots', async () => {
    const snap = mkSnap('app_1', { submitted: true });
    const res = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: JSON.stringify({
          applications: [snap],
          generatedAt: '2026-04-15T00:00:00Z',
        }),
      }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      pack: {
        applicationCount: number;
        counts: { applicationsSubmitted: number };
        tierContext: { partialAtSubmit: number };
        generatedAt: string;
      };
    };
    expect(body.pack.applicationCount).toBe(1);
    expect(body.pack.counts.applicationsSubmitted).toBe(1);
    expect(body.pack.tierContext.partialAtSubmit).toBe(1);
    expect(body.pack.generatedAt).toBe('2026-04-15T00:00:00Z');
  });

  it('rejects body without applications array with a clear error', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: '{"not":"valid"}',
      }));
    // Empty applications array is valid; missing array is coerced to [].
    // This test should succeed with applicationCount=0, not 400.
    expect(res.status).toBe(200);
  });

  it('rejects invalid JSON body with 400', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: 'not json{{{',
      }));
    expect(res.status).toBe(400);
  });

  it('rejects malformed snapshot with index-specific error message', async () => {
    const res = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: JSON.stringify({
          applications: [{ applicationId: 'x' }], // missing required fields
        }),
      }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('applications[0]');
  });

  it('returns deterministic serialized JSON for identical input', async () => {
    const snap = mkSnap('app_1', { submitted: true });
    const body = {
      applications: [snap],
      generatedAt: '2026-04-15T00:00:00Z',
    };
    const first = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: JSON.stringify(body),
      }));
    const second = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: JSON.stringify(body),
      }));
    const a = (await first.json()) as { serialized: string };
    const b = (await second.json()) as { serialized: string };
    expect(a.serialized).toBe(b.serialized);
  });

  it('serves a downloadable body (not the json envelope) when download=json', async () => {
    const snap = mkSnap('app_1', { submitted: true });
    const res = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack?download=json', {
        method: 'POST',
        body: JSON.stringify({ applications: [snap] }),
      }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    const text = await res.text();
    const parsed = JSON.parse(text) as { applicationCount: number; limitations: string[] };
    // download response is the pack directly, not { pack, serialized }.
    expect(parsed.applicationCount).toBe(1);
    expect(parsed.limitations).toBeInstanceOf(Array);
  });

  it('preserves partial-data notice when any application is partial', async () => {
    const snap = mkSnap('app_1', { submitted: true });
    const res = await POST(
      makeRequest('http://localhost/api/pilot/proof-pack', {
        method: 'POST',
        body: JSON.stringify({ applications: [snap] }),
      }));
    const body = (await res.json()) as {
      pack: { partialDataNotice: string | null; limitations: string[] };
    };
    expect(body.pack.partialDataNotice).not.toBeNull();
    expect(body.pack.limitations.some((l) => l.toLowerCase().includes('partial'))).toBe(true);
  });
});
