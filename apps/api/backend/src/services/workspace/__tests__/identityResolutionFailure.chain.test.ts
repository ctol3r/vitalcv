// Closure test for the identity-failure contract.
//
// identityResolutionFailure.test.ts feeds the classifier hand-written errors,
// which proves the mapping but not that the NPPES read path still PRODUCES
// those shapes. This suite mocks only the network boundary (`fetchWithRetry`)
// and runs the real fetchNpiFromCMS → normalizeProvider → bootstrapFromNpi
// chain, so a reworded or restatused thrower turns it red.
//
// It also pins the one place the upstream status can be observed at all:
// fetchWithRetry THROWS on a non-ok response and never returns one, so
// nppes.service's `!response.ok` branch cannot see it — a CMS 429 is only
// distinguishable because the network catch echoes the status into its message.
const prismaMock = {
  personProfile: { findUnique: jest.fn() },
  organizationProfile: { findFirst: jest.fn() },
};

const fetchWithRetryMock = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../../utils/fetchWithRetry', () => ({
  fetchWithRetry: (...args: unknown[]) => fetchWithRetryMock(...args),
}));

// Keep the REAL nppes.service and nppes.validator, but bypass the identity
// barrel (it pulls in Express controllers, storage and the artifact signer,
// none of which this path uses).
jest.mock('../../../modules/identity', () => ({
  fetchNpiFromCMS: jest.requireActual('../../../modules/identity/nppes.service')
    .fetchNpiFromCMS,
  normalizeProvider: jest.requireActual('../../../modules/identity/nppes.validator')
    .normalizeProvider,
}));

import { bootstrapFromNpi } from '../workspaceService';
import { resetNppesCacheForTests } from '../../../modules/identity/nppes.service';

const NPI = '1003000126';

/** Minimal stand-in for the parts of Response that nppes.service reads. */
function okResponse(body: string) {
  return { ok: true, status: 200, text: async () => body } as unknown as Response;
}

/** What fetchWithRetry throws for a non-ok upstream response. */
function upstreamError(status: number) {
  return Object.assign(new Error(`nppes HTTP ${status}`), {
    name: 'UpstreamError',
    status,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // fetchNpiFromCMS caches ANY envelope that clears its guards for 15 minutes,
  // including one that normalizeProvider later rejects — without this reset a
  // malformed payload from an earlier case is replayed into the next one.
  resetNppesCacheForTests();
  prismaMock.personProfile.findUnique.mockResolvedValue(null);
  prismaMock.organizationProfile.findFirst.mockResolvedValue(null);
});

describe('bootstrapFromNpi — real NPPES chain, network boundary mocked', () => {
  it('an NPI absent from the registry reports not_found, not an outage', async () => {
    fetchWithRetryMock.mockResolvedValue(
      okResponse(JSON.stringify({ result_count: 0, results: [] })),
    );

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('not_found');
    expect(result.identitySource).toBe('UNAVAILABLE');
  });

  it('a CMS 429 reports rate_limited', async () => {
    fetchWithRetryMock.mockRejectedValue(upstreamError(429));

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('rate_limited');
  });

  it('a CMS 503 reports source_unavailable, not rate_limited', async () => {
    fetchWithRetryMock.mockRejectedValue(upstreamError(503));

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('source_unavailable');
  });

  it('an unreachable registry reports source_unavailable', async () => {
    // fetchWithRetry surfaces DNS failures / resets / aborted timeouts with no
    // status attached.
    fetchWithRetryMock.mockRejectedValue(new TypeError('fetch failed'));

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('source_unavailable');
  });

  it('a non-JSON body reports invalid_response', async () => {
    fetchWithRetryMock.mockResolvedValue(okResponse('<html>gateway timeout</html>'));

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('invalid_response');
  });

  it('JSON that is not an NPPES envelope reports invalid_response', async () => {
    fetchWithRetryMock.mockResolvedValue(okResponse(JSON.stringify({ foo: 1 })));

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('invalid_response');
  });

  it('a record missing its basic block reports invalid_response', async () => {
    // Passes fetchNpiFromCMS's envelope guards; normalizeProvider rejects it.
    fetchWithRetryMock.mockResolvedValue(
      okResponse(JSON.stringify({ result_count: 1, results: [{ number: NPI }] })),
    );

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('invalid_response');
  });

  it('a resolvable NPI carries no identityFailure', async () => {
    fetchWithRetryMock.mockResolvedValue(
      okResponse(
        JSON.stringify({
          result_count: 1,
          results: [
            {
              number: NPI,
              enumeration_type: 'NPI-1',
              basic: { status: 'A', first_name: 'ARDALAN', last_name: 'ENKESHAFI' },
            },
          ],
        }),
      ),
    );

    const result = await bootstrapFromNpi(NPI);

    expect(result.identitySource).toBe('NPPES_API');
    expect(result.identityFailure).toBeUndefined();
    expect(result.firstName).toBe('ARDALAN');
  });
});
