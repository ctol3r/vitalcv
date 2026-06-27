import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { SOLUTIONS, solutionFor, type SharedLayer } from '../lib/solutions/solutions';
import { buildSolutionEvent, isSolutionEvent } from '../lib/solutions/analytics';

const ALL_LAYERS: SharedLayer[] = ['Evidence', 'Trust', 'Timeline', 'Mobility', 'Organization', 'Career Intelligence'];

// Existing surfaces (no new engine per role) — every solution must route to one of these.
const EXISTING_SURFACE = [/^\/ecosystem\//, /^\/recruiter\/candidate\//, /^\/network\//, /^\/demo$/];

describe('Solutions platform (W700-C6)', () => {
  it('covers the four customer segments', () => {
    expect(SOLUTIONS.map((s) => s.role).sort()).toEqual(['clinician', 'enterprise', 'organization', 'recruiter']);
  });

  it('every solution reuses ONLY the shared layers and routes to an EXISTING surface (no duplicated engine)', () => {
    for (const s of SOLUTIONS) {
      expect(s.reuses.length).toBeGreaterThan(0);
      for (const layer of s.reuses) expect(ALL_LAYERS).toContain(layer);
      const path = s.primaryPath('demo-clinician');
      expect(EXISTING_SURFACE.some((re) => re.test(path))).toBe(true);
    }
  });

  it('the platform spans every shared layer across its solutions', () => {
    const union = new Set(SOLUTIONS.flatMap((s) => s.reuses));
    for (const layer of ALL_LAYERS) expect(union.has(layer)).toBe(true);
  });

  it('solutionFor resolves and rejects unknown roles', () => {
    expect(solutionFor('clinician').role).toBe('clinician');
    // @ts-expect-error unknown role
    expect(() => solutionFor('astronaut')).toThrow();
  });
});

describe('solution analytics (W700-C5)', () => {
  it('builds and validates the funnel events; rejects malformed', () => {
    const e = buildSolutionEvent('role_selected', 'recruiter', '2026-06-01T00:00:00.000Z');
    expect(e.schema).toBe('vitalcv.solution-event.v1');
    expect(isSolutionEvent(e)).toBe(true);
    expect(isSolutionEvent({ schema: 'vitalcv.solution-event.v1', type: 'nope', role: null, occurredAt: null })).toBe(false);
    expect(isSolutionEvent(null)).toBe(false);
  });

  it('ingestion route accepts a valid event (204) and rejects an invalid one (400)', async () => {
    const { POST } = await import('../app/api/solution-analytics/route');
    const ok = await POST(new NextRequest('http://localhost/api/solution-analytics', { method: 'POST', body: JSON.stringify(buildSolutionEvent('demo_requested', 'enterprise', '2026-06-01T00:00:00.000Z')) }));
    expect(ok.status).toBe(204);
    const bad = await POST(new NextRequest('http://localhost/api/solution-analytics', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) }));
    expect(bad.status).toBe(400);
  });
});
