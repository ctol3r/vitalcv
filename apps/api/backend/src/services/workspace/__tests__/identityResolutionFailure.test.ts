// /api/identity/bootstrap/:npi reported every upstream outcome as the single
// state `identitySource: 'UNAVAILABLE'` at HTTP 200: an NPI that does not exist
// in NPPES, a CMS outage, a CMS rate limit and a malformed CMS payload were
// indistinguishable to every consumer. These tests pin the repaired contract —
// `identityFailure` names the outcome, `identitySource` stays coarse for
// backwards compatibility, and an unrecognised error shape degrades to the
// always-true `source_unavailable` rather than inventing a claim about the NPI.
const prismaMock = {
  personProfile: { findUnique: jest.fn() },
  organizationProfile: { findFirst: jest.fn() },
};

const identityMock = {
  fetchNpiFromCMS: jest.fn(),
  normalizeProvider: jest.fn(),
};

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../../modules/identity', () => identityMock);

import {
  bootstrapFromNpi,
  classifyIdentityResolutionFailure,
  type IdentityResolutionFailure,
} from '../workspaceService';
import { HttpError } from '../../../utils/httpError';

const NPI = '1003000126';

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.personProfile.findUnique.mockResolvedValue(null);
  prismaMock.organizationProfile.findFirst.mockResolvedValue(null);
});

/**
 * Every error shape the NPPES read path can raise, quoted from its thrower.
 * If a thrower's wording or status changes, the matching case here must be
 * updated — that is the point: this table is the contract.
 */
const cases: Array<{
  name: string;
  thrower: string;
  error: unknown;
  expected: IdentityResolutionFailure;
}> = [
  {
    name: 'NPI absent from the registry (result_count === 0)',
    thrower: 'nppes.service.fetchNpiFromCMS',
    error: new HttpError(404, `NPI ${NPI} not found in CMS NPPES Registry`),
    expected: 'not_found',
  },
  {
    name: 'empty results array',
    thrower: 'nppes.validator.normalizeProvider',
    error: new HttpError(404, 'No results in NPPES response'),
    expected: 'not_found',
  },
  {
    name: 'CMS rate limit (429 echoed into the 502 message)',
    thrower: 'nppes.service.fetchNpiFromCMS',
    error: new HttpError(502, 'CMS NPPES returned status 429'),
    expected: 'rate_limited',
  },
  {
    name: 'rate limit that kept its own 429 status',
    thrower: 'utils/fetchWithRetry.UpstreamError',
    error: Object.assign(new Error('nppes HTTP 429'), { status: 429 }),
    expected: 'rate_limited',
  },
  {
    name: 'unreachable registry (DNS / reset / timeout)',
    thrower: 'nppes.service.fetchNpiFromCMS',
    error: new HttpError(502, 'Failed to reach CMS NPPES Registry'),
    expected: 'source_unavailable',
  },
  {
    name: 'upstream 503',
    thrower: 'nppes.service.fetchNpiFromCMS',
    error: new HttpError(502, 'CMS NPPES returned status 503'),
    expected: 'source_unavailable',
  },
  {
    name: 'body was not JSON',
    thrower: 'nppes.service.fetchNpiFromCMS',
    error: new HttpError(502, 'Invalid JSON from CMS NPPES Registry'),
    expected: 'invalid_response',
  },
  {
    name: 'body was JSON but not an NPPES envelope',
    thrower: 'nppes.service.fetchNpiFromCMS',
    error: new HttpError(502, 'Invalid NPPES response shape from CMS registry'),
    expected: 'invalid_response',
  },
  {
    name: 'record missing the basic information block',
    thrower: 'nppes.validator.normalizeProvider',
    error: new HttpError(422, 'NPPES result missing basic information block'),
    expected: 'invalid_response',
  },
  {
    name: 'record missing enumeration_type',
    thrower: 'nppes.validator.normalizeProvider',
    error: new HttpError(422, 'NPPES result missing enumeration_type', 'INVALID_NPPES_DATA'),
    expected: 'invalid_response',
  },
];

describe('classifyIdentityResolutionFailure — one kind per upstream outcome', () => {
  it.each(cases)('$thrower: $name → $expected', ({ error, expected }) => {
    expect(classifyIdentityResolutionFailure(error)).toBe(expected);
  });

  it('does not read an upstream HTTP 404 as "this NPI does not exist"', () => {
    // NPPES answers 200 with result_count:0 for an unknown NPI. An HTTP 404
    // from the endpoint means the endpoint moved — an outage, not a finding.
    expect(
      classifyIdentityResolutionFailure(new HttpError(502, 'CMS NPPES returned status 404')),
    ).toBe('source_unavailable');
  });
});

describe('classifyIdentityResolutionFailure — degrades instead of guessing', () => {
  it.each([
    ['a bare Error', new Error('boom')],
    ['a plain string', 'boom'],
    ['null', null],
    ['undefined', undefined],
    ['an object with no status', { detail: 'boom' }],
    ['an unfamiliar 502 wording', new HttpError(502, 'something new upstream')],
  ])('%s → source_unavailable', (_label, error) => {
    expect(classifyIdentityResolutionFailure(error)).toBe('source_unavailable');
  });
});

describe('bootstrapFromNpi — surfaces the failure kind', () => {
  it.each(cases)('$name → identityFailure $expected', async ({ error, expected }) => {
    identityMock.fetchNpiFromCMS.mockRejectedValue(error);

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe(expected);
    // Coarse provenance is unchanged for every existing consumer.
    expect(result.identitySource).toBe('UNAVAILABLE');
    expect(result.firstName).toBeUndefined();
    expect(result.lastName).toBeUndefined();
  });

  it('classifies a normalizeProvider failure even when the fetch succeeded', async () => {
    identityMock.fetchNpiFromCMS.mockResolvedValue({ rawPayload: {}, payloadHash: 'hash' });
    identityMock.normalizeProvider.mockImplementation(() => {
      throw new HttpError(422, 'NPPES result missing provider status', 'INVALID_NPPES_DATA');
    });

    const result = await bootstrapFromNpi(NPI);

    expect(result.identitySource).toBe('UNAVAILABLE');
    expect(result.identityFailure).toBe('invalid_response');
  });

  it('omits identityFailure entirely when the registry resolves', async () => {
    identityMock.fetchNpiFromCMS.mockResolvedValue({ rawPayload: {}, payloadHash: 'hash' });
    identityMock.normalizeProvider.mockReturnValue({
      npi: NPI,
      enumeration_type: 'NPI-1',
      first_name: 'ARDALAN',
      last_name: 'ENKESHAFI',
      primary_taxonomy: 'Hospitalist',
      practice_address: { state: 'MD' },
    } as never);

    const result = await bootstrapFromNpi(NPI);

    expect(result.identitySource).toBe('NPPES_API');
    expect(result.identityFailure).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty('identityFailure');
  });

  it('keeps registration-derived routing metadata for a not_found NPI', async () => {
    // not_found is a finding about the NPI, not an outage — the rest of the
    // payload must still behave exactly as before.
    prismaMock.personProfile.findUnique.mockResolvedValue({ id: 'pp-1', npi: NPI } as never);
    identityMock.fetchNpiFromCMS.mockRejectedValue(
      new HttpError(404, `NPI ${NPI} not found in CMS NPPES Registry`),
    );

    const result = await bootstrapFromNpi(NPI);

    expect(result.identityFailure).toBe('not_found');
    expect(result.npiType).toBe('TYPE_1');
    expect(result.inferredPersona).toBe('CLINICIAN');
    expect(result.alreadyRegistered).toBe(true);
  });
});
