/**
 * export-bundle.test.ts
 *
 * Tests the /api/export/bundle route and bundleGenerator.
 *
 * Truth contracts verified:
 *   1. Unauthenticated GET → 401
 *   2. Authenticated GET → 200 application/zip with valid ZIP bytes
 *   3. manifest.json inside the ZIP has the required schema fields
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

describe('/api/export/bundle', () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
  });

  it('returns 401 for unauthenticated requests', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { GET } = await import('../app/api/export/bundle/route');
    const res = await GET(new NextRequest('http://localhost/api/export/bundle'));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('unauthorized');
  });

  it('returns 200 application/zip for authenticated requests', async () => {
    authMock.mockResolvedValue({ userId: 'user-abc' });
    const { GET } = await import('../app/api/export/bundle/route');
    const res = await GET(new NextRequest('http://localhost/api/export/bundle'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/zip');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="vitalcv-bundle-.+\.zip"/);

    const bytes = Buffer.from(await res.arrayBuffer());
    // ZIP files begin with the local file header signature 0x04034b50 (PK\x03\x04)
    expect(bytes.slice(0, 4).toString('hex')).toBe('504b0304');
  });

  it('zip contains a manifest.json with required schema fields', async () => {
    authMock.mockResolvedValue({ userId: 'user-abc' });
    const { generateBundle } = await import('../lib/export/bundleGenerator');

    const zip = generateBundle({
      passportSummary: {
        entityType: 'PERSON',
        specialty: 'Cardiology',
        sourcesChecked: ['NPPES_API'],
        trustBand: 'L2',
        readinessScore: 75,
        lastCheckedAt: '2026-05-04T00:00:00.000Z',
      },
      receiptCandidateSummary: {
        totalCount: 2,
        byProofTier: { receipt_candidate: 2 },
        byReviewState: { pending_review: 1, ready_for_policy_review: 1 },
      },
      auditEventSummary: {
        eventCount: 5,
        dateRange: { earliest: '2026-04-01T00:00:00.000Z', latest: '2026-05-04T00:00:00.000Z' },
      },
    });

    // Extract manifest.json from the ZIP by finding the file data.
    // The manifest is the first entry; its data starts after the local header.
    // Local header: 30 bytes fixed + name length + extra length
    const nameLen = zip.readUInt16LE(26);
    const extraLen = zip.readUInt16LE(28);
    const dataOffset = 30 + nameLen + extraLen;
    const compressedSize = zip.readUInt32LE(18);
    const manifestJson = zip.slice(dataOffset, dataOffset + compressedSize).toString('utf-8');
    const manifest = JSON.parse(manifestJson) as {
      schemaVersion: string;
      bundleTier: string;
      generatedAt: string;
      disclaimer: string;
      files: string[];
    };

    expect(manifest.schemaVersion).toBe('1');
    expect(manifest.bundleTier).toBe('foundation');
    expect(typeof manifest.generatedAt).toBe('string');
    expect(typeof manifest.disclaimer).toBe('string');
    expect(manifest.files).toContain('manifest.json');
    expect(manifest.files).toContain('passport-summary.json');
    expect(manifest.files).toContain('receipt-candidates-summary.json');
    expect(manifest.files).toContain('audit-events-summary.json');
    // Disclaimer must not assert this IS a signed proof pack
    expect(manifest.disclaimer).not.toMatch(/\bis a signed proof pack\b/i);
  });
});
