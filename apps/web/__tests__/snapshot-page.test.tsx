/**
 * Wave M — public readiness-snapshot viewer.
 *
 * Pins the honesty contract on the surface: content renders AS ISSUED with
 * the stable content hash, stale sources are labeled with a re-verify
 * recommendation (never silently current), revoked snapshots fail closed
 * with no content, and the copy never claims live verification or a
 * credentialing decision.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SnapshotPage from '../app/snapshot/[id]/page';

const SNAPSHOT_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const HAPPY_PAYLOAD = {
  ok: true,
  snapshotId: SNAPSHOT_ID,
  npi: '1003000126',
  issuedAt: '2026-07-01T00:00:00.000Z',
  contentHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  snapshot: {
    readiness: { level: 'L2', score: 78, status: 'PARTIAL', checkedAt: '2026-07-01T00:00:00.000Z' },
    sourceCoverage: {
      checks: [
        { sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-07-01T00:00:00.000Z' },
        { sourceId: 'PECOS', state: 'checked', checkedAt: '2026-07-04T00:00:00.000Z' },
      ],
    },
  },
  scope: { organizationName: 'Mercy General', purposeOfUse: 'Employment consideration' },
  freshness: {
    evaluatedAt: '2026-07-05T00:00:00.000Z',
    staleSources: [{ sourceId: 'NPPES_API', checkedAt: '2026-07-01T00:00:00.000Z', freshnessWindowHours: 24 }],
    unevaluatedSources: [],
    reverifyRecommended: true,
    note: '1 source check is past the refresh window. This snapshot shows evidence as issued — request a refreshed share before relying on the stale items.',
  },
};

async function renderPage() {
  return renderToStaticMarkup(await SnapshotPage({ params: Promise.resolve({ id: SNAPSHOT_ID }) }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.BACKEND_URL = 'http://backend.test';
});

describe('/snapshot/[id] — as-issued rendering with read-time staleness', () => {
  it('renders the snapshot as issued: hash pin, readiness, per-source last-checked, stale labels', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(HAPPY_PAYLOAD)));

    const markup = await renderPage();

    expect(markup).toContain('Readiness snapshot — as issued');
    expect(markup).toContain('NPI 1003000126');
    expect(markup).toContain('identical on every read');
    expect(markup).toContain('L2 · 78/100');
    expect(markup).toContain('NPPES_API');
    expect(markup).toContain('stale — re-verify before relying on this');
    expect(markup).toContain('request a refreshed share');
    // PECOS is current — exactly one stale badge.
    expect(markup.match(/re-verify before relying on this/g)).toHaveLength(1);
    expect(markup).toContain('not a live verification');
    expect(markup).toContain('recorded in the audit log');
  });

  it('fails closed on revoked snapshots — no content, honest copy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ error: 'snapshot_revoked' }, 410)),
    );

    const markup = await renderPage();

    expect(markup).toContain('This snapshot was revoked');
    expect(markup).toContain('fail closed');
    expect(markup).not.toContain('NPPES_API');
    expect(markup).not.toContain('L2');
  });

  it('renders an honest system-state panel when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const markup = await renderPage();

    expect(markup).toContain('temporarily unavailable');
    expect(markup).toContain('nothing about the snapshot changed');
  });
});

describe('snapshot surface — truth-contract source pins', () => {
  it('keeps banned claims out of the viewer and the backend snapshot service', () => {
    for (const relPath of [
      '../app/snapshot/[id]/page.tsx',
      '../../api/backend/src/services/distribution/readinessSnapshotService.ts',
      '../../api/backend/src/routes/readinessSnapshot.ts',
    ]) {
      const source = readFileSync(join(__dirname, relPath), 'utf8');
      expect(source).not.toMatch(
        /automatically verified|guaranteed verification|complete credentialing|instant credentialing|certified compliant|legally accepted/i,
      );
      expect(source).not.toMatch(/label:\s*['"]Verified['"]/);
    }
  });
});
