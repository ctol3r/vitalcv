/**
 * npiIngest.test.ts — fix/nppes-full-hydration (2026-04-10)
 *
 * Guards the three hydration behaviors on the legacy `ingestNpiIdentity`
 * path in `packages/ingest/npi.ts`:
 *
 *   1. Credentials are extracted from `basic.credential` verbatim
 *      (e.g. "PA-C" → `credentials: "PA-C"`), preserving casing and
 *      punctuation, no splitting.
 *   2. Full taxonomy records are surfaced with `code`, `desc`, `state`,
 *      `license`, and `primary` — not just flattened strings — so
 *      downstream role mappers can identify the primary taxonomy.
 *   3. Transient fetch failures (5xx, network errors) are retried with
 *      exponential backoff. 404-equivalents and invalid checksums are
 *      not retried.
 *
 * Matches the Macie expect spec:
 *   EXPECT: name present, PA-C present, taxonomy present.
 */

import {
  ingestNpiIdentity,
  NpiIngestError,
  type NppesFetcher,
} from '@vitalcv/ingest';

// ── Fixtures ──────────────────────────────────────────────────────────────

/**
 * A valid NPI with a correct Luhn checksum over `80840 + npi`.
 * 1234567893 passes: sum(80840-prefixed Luhn) = 70 ≡ 0 (mod 10).
 * Same fixture used by nppesApi.test.ts for consistency across the suite.
 */
const VALID_NPI = '1234567893';

function buildRawResponse(overrides: {
  credential?: string;
  first_name?: string;
  last_name?: string;
  taxonomies?: Array<{
    code?: string;
    desc?: string;
    state?: string;
    license?: string;
    primary?: boolean;
  }>;
} = {}): Record<string, unknown> {
  return {
    result_count: 1,
    results: [
      {
        number: VALID_NPI,
        enumeration_type: 'NPI-1',
        basic: {
          first_name: overrides.first_name ?? 'Macie',
          last_name: overrides.last_name ?? 'Chen',
          credential: overrides.credential ?? 'PA-C',
          status: 'A',
          enumeration_date: '2016-04-01',
          last_updated: '2026-03-01',
        },
        taxonomies: overrides.taxonomies ?? [
          {
            code: '363A00000X',
            desc: 'Physician Assistant',
            state: 'CA',
            license: 'CA-PA-99821',
            primary: true,
          },
        ],
        addresses: [
          {
            address_1: '500 Parnassus Ave',
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94143',
            country_code: 'US',
            address_purpose: 'LOCATION',
          },
        ],
        identifiers: [],
        endpoints: [],
        other_names: [],
      },
    ],
  };
}

function makeJsonResponse(body: unknown, status = 200): {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function makeFetcher(
  responses: Array<
    | { kind: 'ok'; body: unknown }
    | { kind: 'status'; status: number; body?: unknown }
    | { kind: 'throw'; error: Error }
  >,
): NppesFetcher & { calls: number } {
  let call = 0;
  const impl = async () => {
    const response = responses[call];
    call += 1;
    if (!response) {
      throw new Error(`fetcher called more than ${responses.length} times`);
    }
    if (response.kind === 'throw') throw response.error;
    if (response.kind === 'status') {
      return makeJsonResponse(response.body ?? {}, response.status);
    }
    return makeJsonResponse(response.body);
  };
  const fetcher = impl as unknown as NppesFetcher & { calls: number };
  Object.defineProperty(fetcher, 'calls', { get: () => call });
  return fetcher;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ingestNpiIdentity — fix/nppes-full-hydration', () => {
  describe('credentials', () => {
    it('extracts PA-C credential verbatim from basic.credential', async () => {
      const fetcher = makeFetcher([{ kind: 'ok', body: buildRawResponse() }]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:macie',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.first_name).toBe('Macie');
      expect(identity.last_name).toBe('Chen');
      expect(identity.credentials).toBe('PA-C');
    });

    it('preserves compound credentials ("DO, FACC") without splitting', async () => {
      const fetcher = makeFetcher([
        { kind: 'ok', body: buildRawResponse({ credential: 'DO, FACC' }) },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.credentials).toBe('DO, FACC');
    });

    it('preserves punctuation ("M.D." stays "M.D.")', async () => {
      const fetcher = makeFetcher([
        { kind: 'ok', body: buildRawResponse({ credential: 'M.D.' }) },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.credentials).toBe('M.D.');
    });

    it('trims whitespace but preserves casing', async () => {
      const fetcher = makeFetcher([
        { kind: 'ok', body: buildRawResponse({ credential: '  Pa-C  ' }) },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.credentials).toBe('Pa-C');
    });

    it('omits credentials field entirely when source is empty string', async () => {
      const fetcher = makeFetcher([
        { kind: 'ok', body: buildRawResponse({ credential: '' }) },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.credentials).toBeUndefined();
    });
  });

  describe('taxonomy', () => {
    it('exposes full taxonomy records with code, state, license, and primary flag', async () => {
      const fetcher = makeFetcher([{ kind: 'ok', body: buildRawResponse() }]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:macie',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.taxonomies).toHaveLength(1);
      expect(identity.taxonomies[0]).toEqual({
        code: '363A00000X',
        desc: 'Physician Assistant',
        state: 'CA',
        license: 'CA-PA-99821',
        primary: true,
      });
    });

    it('retains the deprecated flattened taxonomy[] for backward compat', async () => {
      const fetcher = makeFetcher([{ kind: 'ok', body: buildRawResponse() }]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:macie',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.taxonomy).toContain('Physician Assistant');
    });

    it('identifies the primary taxonomy when multiple are present', async () => {
      const fetcher = makeFetcher([
        {
          kind: 'ok',
          body: buildRawResponse({
            taxonomies: [
              { code: '207R00000X', desc: 'Internal Medicine', state: 'CA', license: 'A1', primary: false },
              { code: '363A00000X', desc: 'Physician Assistant', state: 'CA', license: 'PA1', primary: true },
            ],
          }),
        },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
      });

      expect(identity.taxonomies).toHaveLength(2);
      const primary = identity.taxonomies.find((t) => t.primary);
      expect(primary?.code).toBe('363A00000X');
      expect(primary?.desc).toBe('Physician Assistant');
    });
  });

  describe('reliability / retry', () => {
    it('retries on a 503 and returns the eventual successful response', async () => {
      const fetcher = makeFetcher([
        { kind: 'status', status: 503 },
        { kind: 'ok', body: buildRawResponse() },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
        retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
      });

      expect(identity.first_name).toBe('Macie');
      expect(fetcher.calls).toBe(2);
    });

    it('retries on thrown network errors', async () => {
      const fetcher = makeFetcher([
        { kind: 'throw', error: new Error('ECONNRESET') },
        { kind: 'ok', body: buildRawResponse() },
      ]);

      const identity = await ingestNpiIdentity({
        clinician_id: 'clinician:test',
        npi: VALID_NPI,
        fetcher,
        retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
      });

      expect(identity.credentials).toBe('PA-C');
      expect(fetcher.calls).toBe(2);
    });

    it('does NOT retry on 400 (client error — fatal)', async () => {
      const fetcher = makeFetcher([{ kind: 'status', status: 400 }]);

      await expect(
        ingestNpiIdentity({
          clinician_id: 'clinician:test',
          npi: VALID_NPI,
          fetcher,
          retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
        }),
      ).rejects.toMatchObject({
        name: 'NpiIngestError',
        code: 'NPPES_UNAVAILABLE',
      });
      expect(fetcher.calls).toBe(1);
    });

    it('exhausts retries and surfaces NPPES_UNAVAILABLE after 3 attempts', async () => {
      const fetcher = makeFetcher([
        { kind: 'status', status: 500 },
        { kind: 'status', status: 502 },
        { kind: 'status', status: 503 },
      ]);

      await expect(
        ingestNpiIdentity({
          clinician_id: 'clinician:test',
          npi: VALID_NPI,
          fetcher,
          retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
        }),
      ).rejects.toMatchObject({
        name: 'NpiIngestError',
        code: 'NPPES_UNAVAILABLE',
      });
      expect(fetcher.calls).toBe(3);
    });

    it('rejects invalid NPI checksums before any fetch is attempted', async () => {
      const fetcher = makeFetcher([]);

      // 1234567890 has a valid format but fails the Luhn check over 80840 + npi.
      await expect(
        ingestNpiIdentity({
          clinician_id: 'clinician:test',
          npi: '1234567890',
          fetcher,
        }),
      ).rejects.toMatchObject({
        name: 'NpiIngestError',
        code: 'INVALID_NPI_CHECKSUM',
      });
      expect(fetcher.calls).toBe(0);
    });

    it('returns NPPES_NOT_FOUND when CMS responds 200 with result_count 0', async () => {
      const fetcher = makeFetcher([
        { kind: 'ok', body: { result_count: 0, results: [] } },
      ]);

      await expect(
        ingestNpiIdentity({
          clinician_id: 'clinician:test',
          npi: VALID_NPI,
          fetcher,
        }),
      ).rejects.toMatchObject({
        name: 'NpiIngestError',
        code: 'NPPES_NOT_FOUND',
      });
    });
  });

  describe('structured error contract', () => {
    it('exposes NpiIngestError with .code for downstream error rendering', async () => {
      const fetcher = makeFetcher([{ kind: 'status', status: 500 }, { kind: 'status', status: 500 }, { kind: 'status', status: 500 }]);

      try {
        await ingestNpiIdentity({
          clinician_id: 'clinician:test',
          npi: VALID_NPI,
          fetcher,
          retryPolicy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1 },
        });
        throw new Error('expected to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(NpiIngestError);
        expect((err as NpiIngestError).code).toBe('NPPES_UNAVAILABLE');
      }
    });
  });
});
