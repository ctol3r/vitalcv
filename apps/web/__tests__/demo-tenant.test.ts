import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { DEMO_ENTITY_ID, buildDemoPassport, isDemoEntity } from '../lib/demo/demo-passport';
import { assertPassportData } from '../lib/trust/passport-contract';

// W500-C4 — demo tenant. The demo passport is a VALID, decision-grade snapshot, and
// the reserved demo id resolves end-to-end (no mocks) into a compelling ecosystem —
// what an accelerator / investor / enterprise demo sees.

describe('demo passport (W500-C4)', () => {
  it('is a valid passport with honest verification levels (only integrated sources are primary-source)', () => {
    const passport = assertPassportData(buildDemoPassport());
    expect(passport.identity.displayName).toBe('Dr. Maya Chen');
    // licensure is primary-source (STATE_BOARD is integrated); board cert is self-reported (ABMS not integrated)
    expect(passport.authority.credentials.find((c) => c.id === 'lic-ca')?.verificationLevel).toBe('PRIMARY_SOURCE');
    expect(passport.authority.credentials.find((c) => c.id === 'abim')?.verificationLevel).toBe('SELF_REPORTED');
    expect(passport.standing.deaStatus).toBe('unknown'); // DEA not integrated → not claimed
  });

  it('reserves a demo id that cannot collide with a real NPI or UUID', () => {
    expect(isDemoEntity(DEMO_ENTITY_ID)).toBe(true);
    expect(isDemoEntity('1700000000')).toBe(false); // a 10-digit NPI
    expect(isDemoEntity('550e8400-e29b-41d4-a716-446655440000')).toBe(false); // a UUID
  });
});

describe('demo tenant end-to-end (no mocks — real resolver)', () => {
  it('the demo entity resolves into a fully decision-grade ecosystem', async () => {
    const { GET } = await import('../app/api/ecosystem/[entityId]/route');
    const res = await GET(new NextRequest('http://localhost/x'), { params: Promise.resolve({ entityId: DEMO_ENTITY_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.subjectKey).toBe(DEMO_ENTITY_ID);
    // strong, source-backed snapshot
    expect(body.trust.overall.decisionGradeEvidence).toBeGreaterThanOrEqual(5); // NPPES, OIG, PECOS, CA, NV
    expect(['established', 'emerging']).toContain(body.timeline.reputation.standing); // honest: self-reported items keep it sub-established
    expect(body.readiness.readiness).toBe('ready'); // integrated spine (identity/exclusion/licensure) all checked
    // rich network: training institutions + credential issuers
    const kinds = body.organizations.organizations.map((o: any) => o.kind);
    expect(kinds).toContain('training_institution');
    expect(kinds).toContain('credential_issuer');
    // intelligence shows strengths (decision-grade dimensions), no fabricated risks-only view
    expect(body.intelligence.summary.strengths).toBeGreaterThan(0);
  });
});
