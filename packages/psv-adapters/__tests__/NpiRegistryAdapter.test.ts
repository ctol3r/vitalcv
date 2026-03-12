import { describe, expect, it } from 'vitest';

import npiLookupFixture from '../fixtures/npiRegistry.lookupByNpi.json';
import npiNameStateFixture from '../fixtures/npiRegistry.lookupByNameState.json';
import { createJsonHttpTransport } from '../core/AdapterInterface';
import { NpiRegistryAdapter } from '../adapters/NpiRegistryAdapter';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      'content-type': 'application/json',
      ...headers,
    }),
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('NpiRegistryAdapter', () => {
  it('looks up a clinician by NPI and emits identity facts with provenance', async () => {
    const adapter = new NpiRegistryAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(npiLookupFixture),
      }),
    });

    const batch = await adapter.lookupByNpi('1234567893');

    expect(batch.summary.status).toBe('ACTIVE');
    expect(batch.facts.map((entry) => entry.fact.factType)).toEqual([
      'IdentityClaim',
      'EvidenceArtifact',
      'SourceProvenance',
    ]);
    const identity = batch.facts[0]?.fact;
    expect(identity.factType).toBe('IdentityClaim');
    if (identity.factType === 'IdentityClaim') {
      expect(identity.npi).toBe('1234567893');
      expect(identity.fullName).toBe('JANE DOE');
      expect(identity.practiceStates).toEqual(['CA', 'NV']);
    }
    expect(batch.events.map((event) => event.eventType)).toContain('TrustSignalRaised');
  });

  it('looks up a clinician by name and state', async () => {
    const adapter = new NpiRegistryAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse(npiNameStateFixture),
      }),
    });

    const batch = await adapter.lookupByNameState('Amy Pond', 'or');

    expect(batch.subjectId).toBe('1999999984');
    const identity = batch.facts.find((entry) => entry.fact.factType === 'IdentityClaim')?.fact;
    expect(identity?.factType).toBe('IdentityClaim');
    if (identity?.factType === 'IdentityClaim') {
      expect(identity.fullName).toBe('AMY POND');
      expect(identity.practiceStates).toEqual(['OR']);
    }
  });

  it('rejects an invalid NPI before any network call', async () => {
    const adapter = new NpiRegistryAdapter();
    await expect(adapter.lookupByNpi('123')).rejects.toThrow(/10-digit/);
  });

  it('fails closed to NOT_FOUND when CMS returns no results', async () => {
    const adapter = new NpiRegistryAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse({ result_count: 0, results: [] }),
      }),
    });

    const batch = await adapter.lookupByNpi('1234567893');

    expect(batch.summary.status).toBe('NOT_FOUND');
    expect(batch.facts.some((entry) => entry.fact.factType === 'IdentityClaim')).toBe(false);
    expect(batch.facts.map((entry) => entry.fact.factType)).toEqual([
      'EvidenceArtifact',
      'SourceProvenance',
    ]);
  });

  it('fails closed to ERROR for malformed upstream payloads', async () => {
    const adapter = new NpiRegistryAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => jsonResponse({ result_count: 1, results: ['bad-payload'] }),
      }),
    });

    const batch = await adapter.lookupByNpi('1234567893');

    expect(batch.summary.status).toBe('ERROR');
    expect(batch.facts.some((entry) => entry.fact.factType === 'IdentityClaim')).toBe(false);
  });

  it('retries on HTTP 429 with exponential backoff semantics', async () => {
    let calls = 0;
    const adapter = new NpiRegistryAdapter({
      transport: createJsonHttpTransport({
        fetcher: async () => {
          calls += 1;
          if (calls === 1) {
            return jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '0' });
          }

          return jsonResponse(npiLookupFixture);
        },
        retryPolicy: {
          maxRetries: 1,
          baseDelayMs: 0,
          maxDelayMs: 0,
        },
      }),
    });

    const batch = await adapter.lookupByNpi('1234567893');

    expect(calls).toBe(2);
    expect(batch.summary.status).toBe('ACTIVE');
  });
});
