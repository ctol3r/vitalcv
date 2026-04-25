/**
 * Wave LIVE-101 — NPPES public-registry fallback unit tests.
 */

import { describe, expect, it, vi } from 'vitest';
import { fetchNppesIdentityFallback } from '../lib/sources/nppes-fallback';

const SAMPLE_BODY = {
  result_count: 1,
  results: [
    {
      enumeration_type: 'NPI-1',
      basic: {
        first_name: 'Test',
        last_name: 'Clinician',
        organization_name: '',
        status: 'A',
        enumeration_date: '2010-01-01',
        last_updated: '2026-01-01',
      },
      taxonomies: [
        { code: '207R00000X', desc: 'Internal Medicine', primary: true },
      ],
      addresses: [
        { address_purpose: 'LOCATION', state: 'CA' },
      ],
    },
  ],
};

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchNppesIdentityFallback', () => {
  it('returns ok with a tight identity projection on a valid response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok(SAMPLE_BODY));
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity.displayName).toBe('Test Clinician');
    expect(result.identity.enumerationType).toBe('NPI-1');
    expect(result.identity.taxonomy).toBe('Internal Medicine (207R00000X)');
    expect(result.identity.enumerationDate).toBe('2010-01-01');
    expect(result.identity.lastUpdated).toBe('2026-01-01');
    expect(result.identity.nppesStatus).toBe('A');
    expect(result.identity.practiceState).toBe('CA');
    expect(result.sourceUrl).toContain('1003000126');
  });

  it('returns not_found when the NPPES result list is empty', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ result_count: 0, results: [] }));
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('not_found');
  });

  it('returns invalid_shape for a non-NPI string and never fetches', async () => {
    const fetchImpl = vi.fn();
    const result = await fetchNppesIdentityFallback('not-an-npi', { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('invalid_shape');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns timeout when the fetch is aborted', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('timeout');
  });

  it('returns network when fetch rejects for any other reason', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('network');
  });

  it('returns upstream_error on non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('upstream_error');
  });

  it('returns non_json when the response body is not parseable JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('<html>oops</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('non_json');
  });

  it('prefers organization_name over first/last name for NPI-2', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      ok({
        results: [
          {
            enumeration_type: 'NPI-2',
            basic: { organization_name: 'VitalCV Test Group', status: 'A' },
            taxonomies: [],
            addresses: [],
          },
        ],
      }),
    );
    const result = await fetchNppesIdentityFallback('1003000126', { fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.identity.displayName).toBe('VitalCV Test Group');
    expect(result.identity.enumerationType).toBe('NPI-2');
  });
});
