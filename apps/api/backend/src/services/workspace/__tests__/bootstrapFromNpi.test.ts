// Truth pin for /api/identity/bootstrap/:npi (public, unauthenticated).
//
// Every consumer renders this result's identity fields under registry framing
// — the homepage card literally captions them "located in NPPES". The legacy
// implementation short-circuited for a registered NPI and echoed the account's
// self-entered PersonProfile values in those fields, which is how a seeded
// "Sarah Chen" test profile rendered as the NPPES identity of a real
// provider's NPI (1003000126 → ARDALAN ENKESHAFI) in production. These tests
// pin the repaired contract: identity fields are NPPES-derived or absent,
// never account-entered — registration may only inform `alreadyRegistered`,
// `inferredPersona`, and the npiType fallback.
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

import { bootstrapFromNpi } from '../workspaceService';

const NPI = '1003000126';

/** A registered account whose self-entered display identity diverges from the registry. */
const registeredProfile = {
  id: 'pp-1',
  userId: 'user-1',
  npi: NPI,
  firstName: 'Sarah',
  lastName: 'Chen',
  specialty: 'Internal Medicine',
  stateOfPractice: 'CA',
} as never;

/** What NPPES actually says this NPI is. */
const registryProvider = {
  npi: NPI,
  enumeration_type: 'NPI-1',
  status: 'A',
  first_name: 'ARDALAN',
  last_name: 'ENKESHAFI',
  primary_taxonomy: 'Hospitalist',
  practice_address: { state: 'MD' },
} as never;

function registryResolves() {
  identityMock.fetchNpiFromCMS.mockResolvedValue({ rawPayload: {}, payloadHash: 'hash' });
  identityMock.normalizeProvider.mockReturnValue(registryProvider);
}

function registryDown() {
  identityMock.fetchNpiFromCMS.mockRejectedValue(new Error('CMS unreachable'));
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.personProfile.findUnique.mockResolvedValue(null);
  prismaMock.organizationProfile.findFirst.mockResolvedValue(null);
});

describe('bootstrapFromNpi — registered profile diverging from the registry', () => {
  it('returns the NPPES identity, never the self-entered profile identity', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue(registeredProfile);
    registryResolves();

    const result = await bootstrapFromNpi(NPI);

    expect(result.identitySource).toBe('NPPES_API');
    expect(result.firstName).toBe('ARDALAN');
    expect(result.lastName).toBe('ENKESHAFI');
    expect(result.specialty).toBe('Hospitalist');
    expect(result.state).toBe('MD');
    expect(result.alreadyRegistered).toBe(true);
    expect(result.inferredPersona).toBe('CLINICIAN');

    // The self-entered values must not appear ANYWHERE in the public payload.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('Sarah');
    expect(serialized).not.toContain('Chen');
  });

  it('omits identity fields (rather than substituting profile values) when the registry is unreachable', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue(registeredProfile);
    registryDown();

    const result = await bootstrapFromNpi(NPI);

    expect(result.identitySource).toBe('UNAVAILABLE');
    expect(result.firstName).toBeUndefined();
    expect(result.lastName).toBeUndefined();
    expect(result.specialty).toBeUndefined();
    expect(result.state).toBeUndefined();
    expect(result.alreadyRegistered).toBe(true);
    // Registration still informs routing metadata — that part is not identity.
    expect(result.npiType).toBe('TYPE_1');
    expect(result.inferredPersona).toBe('CLINICIAN');
  });
});

describe('bootstrapFromNpi — unregistered NPIs (regression guard)', () => {
  it('serves the registry identity with provenance labeled', async () => {
    registryResolves();

    const result = await bootstrapFromNpi(NPI);

    expect(result).toMatchObject({
      npi: NPI,
      npiType: 'TYPE_1',
      inferredPersona: 'CLINICIAN',
      identitySource: 'NPPES_API',
      firstName: 'ARDALAN',
      lastName: 'ENKESHAFI',
      alreadyRegistered: false,
    });
  });

  it('degrades to the labeled stub when the registry is unreachable', async () => {
    registryDown();

    const result = await bootstrapFromNpi(NPI);

    expect(result).toMatchObject({
      npi: NPI,
      npiType: 'TYPE_1',
      inferredPersona: 'UNKNOWN',
      identitySource: 'UNAVAILABLE',
      alreadyRegistered: false,
    });
    expect(result.firstName).toBeUndefined();
  });
});

describe('bootstrapFromNpi — registered organization', () => {
  it('keeps TYPE_2/VERIFIER routing when the registry is unreachable', async () => {
    prismaMock.organizationProfile.findFirst.mockResolvedValue({ id: 'op-1', npi: NPI } as never);
    registryDown();

    const result = await bootstrapFromNpi(NPI);

    expect(result.npiType).toBe('TYPE_2');
    expect(result.inferredPersona).toBe('VERIFIER');
    expect(result.identitySource).toBe('UNAVAILABLE');
    expect(result.alreadyRegistered).toBe(true);
  });

  it('lets the registry decide npiType when it responds', async () => {
    prismaMock.organizationProfile.findFirst.mockResolvedValue({ id: 'op-1', npi: NPI } as never);
    identityMock.fetchNpiFromCMS.mockResolvedValue({ rawPayload: {}, payloadHash: 'hash' });
    identityMock.normalizeProvider.mockReturnValue({
      ...(registryProvider as object),
      enumeration_type: 'NPI-2',
      first_name: '',
      last_name: '',
    } as never);

    const result = await bootstrapFromNpi(NPI);

    expect(result.npiType).toBe('TYPE_2');
    expect(result.inferredPersona).toBe('VERIFIER');
    expect(result.identitySource).toBe('NPPES_API');
    // NPI-2 records have no personal name — empty strings must collapse to absent.
    expect(result.firstName).toBeUndefined();
    expect(result.lastName).toBeUndefined();
  });
});
