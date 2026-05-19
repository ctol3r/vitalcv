import { describe, expect, it } from 'vitest';

describe('employer-pipeline route · marketRisk enrichment', () => {
  it('returns a cohort with marketRisk per entry', async () => {
    const { GET } = await import('@/app/api/employer-pipeline/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cohort).toBeInstanceOf(Array);
    expect(body.cohort.length).toBeGreaterThan(0);
    expect(body.meta.count).toBe(body.cohort.length);
    expect(body.meta.riskEngineSource).toMatch(/OpenEvidence/);
    for (const entry of body.cohort) {
      expect(entry.npi).toMatch(/^\d{10}$/);
      // marketRisk is null for unknown taxonomies; every demo entry uses a known one.
      expect(entry.marketRisk).not.toBeNull();
      expect(entry.marketRisk.attritionRiskMultiplier).toBeGreaterThan(0);
      expect(entry.marketRisk.replacementCost.midpoint).toBeGreaterThan(0);
      expect(entry.marketRisk.source).toMatch(/OpenEvidence/);
    }
  });

  it('rural orthopedic surgery entry escalates to the severe band', async () => {
    const { GET } = await import('@/app/api/employer-pipeline/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req);
    const body = await res.json();
    const connor = body.cohort.find(
      (c: { name: string }) => c.name === 'Connor Kilch, DO',
    );
    expect(connor).toBeTruthy();
    expect(connor.isRural).toBe(true);
    expect(connor.marketRisk.geography).toBe('rural');
    expect(connor.marketRisk.riskBand).toBe('severe');
    expect(connor.marketRisk.replacementCost.high).toBeGreaterThan(1_000_000);
  });

  it('urban internal medicine entry sits in the low band', async () => {
    const { GET } = await import('@/app/api/employer-pipeline/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req);
    const body = await res.json();
    const mira = body.cohort.find(
      (c: { name: string }) => c.name === 'Mira Chen, MD',
    );
    expect(mira.marketRisk.geography).toBe('urban');
    expect(mira.marketRisk.riskBand).toBe('low');
  });
});

describe('truth-contract · pipeline route copy', () => {
  it('riskEngineSource cites OpenEvidence and has no marketing puffery', async () => {
    const { GET } = await import('@/app/api/employer-pipeline/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req);
    const body = await res.json();
    expect(body.meta.riskEngineSource).toMatch(/OpenEvidence/);
    const banned = ['seamless', 'magical', 'instant', 'effortless', 'automatically'];
    for (const b of banned) {
      expect(body.meta.riskEngineSource.toLowerCase()).not.toContain(b);
    }
  });
});
