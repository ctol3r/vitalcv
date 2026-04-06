const mockLookupByNpi = jest.fn();

jest.mock('@vitalcv/psv-adapters', () => ({
  NpiRegistryAdapter: jest.fn().mockImplementation(() => ({
    lookupByNpi: mockLookupByNpi,
  })),
}));

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      upsert: jest.fn(),
    },
  },
}));

import prisma from '../src/graphql/prisma_client';
import {
  fetchAndPersistNppesProviderRecord,
  fetchNppesProviderRecord,
  persistNppesProviderRecord,
} from '../src/services/identity/nppesApi';

const prismaMock = prisma as unknown as {
  provider: {
    upsert: jest.Mock;
  };
};

function buildNpiBatch(rawResponseHash = 'npi-hash-1', state = 'CA') {
  return {
    retrievalTime: '2026-04-06T12:00:00.000Z',
    rawResponseHash,
    rawResponse: {
      result_count: 1,
      results: [
        {
          number: '1234567893',
          enumeration_type: 'NPI-1',
          basic: {
            first_name: 'JANE',
            last_name: 'DOE',
            status: 'A',
          },
          taxonomies: [
            {
              code: '207Q00000X',
              desc: 'Family Medicine',
            },
          ],
          addresses: [
            {
              address_purpose: 'LOCATION',
              state,
            },
          ],
        },
      ],
    },
    summary: {
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1234567893',
      factCount: 3,
    },
    facts: [
      {
        fact: {
          factType: 'IdentityClaim',
          fullName: 'JANE DOE',
          enumerationType: 'NPI-1',
          taxonomies: ['Family Medicine'],
          practiceStates: [state],
          firstName: 'JANE',
          lastName: 'DOE',
        },
      },
    ],
  };
}

describe('nppes api wrapper', () => {
  beforeEach(() => {
    mockLookupByNpi.mockReset();
    prismaMock.provider.upsert.mockReset();
  });

  it('maps a CMS NPPES lookup onto the internal Provider shape', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch());

    const result = await fetchNppesProviderRecord('1234567893');

    expect(result).toEqual(expect.objectContaining({
      npi: '1234567893',
      fullName: 'JANE DOE',
      providerType: 'INDIVIDUAL',
      npiType: 'TYPE_1',
      taxonomyCode: '207Q00000X',
      taxonomyDescription: 'Family Medicine',
      stateOfPractice: 'CA',
      firstName: 'JANE',
      lastName: 'DOE',
      sourceStatus: 'ACTIVE',
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1234567893',
    }));
  });

  it('persists the mapped Provider record through Prisma', async () => {
    prismaMock.provider.upsert.mockResolvedValue({ id: 'provider-1' });

    const result = await persistNppesProviderRecord({
      npi: '1234567893',
      fullName: 'JANE DOE',
      providerType: 'INDIVIDUAL',
      npiType: 'TYPE_1',
      enumerationType: 'NPI-1',
      taxonomyCode: '207Q00000X',
      taxonomyDescriptions: ['Family Medicine'],
      taxonomyDescription: 'Family Medicine',
      stateOfPractice: 'CA',
      practiceStates: ['CA'],
      firstName: 'JANE',
      lastName: 'DOE',
      sourceStatus: 'ACTIVE',
      retrievedAt: '2026-04-06T12:00:00.000Z',
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1234567893',
      factCount: 3,
      rawResponseHash: 'npi-hash-1',
      rawResponse: { results: [] },
    });

    expect(prismaMock.provider.upsert).toHaveBeenCalledWith({
      where: { npi: '1234567893' },
      create: {
        npi: '1234567893',
        fullName: 'JANE DOE',
        providerType: 'INDIVIDUAL',
        taxonomyCode: '207Q00000X',
        stateOfPractice: 'CA',
      },
      update: {
        fullName: 'JANE DOE',
        providerType: 'INDIVIDUAL',
        taxonomyCode: '207Q00000X',
        stateOfPractice: 'CA',
      },
      select: {
        id: true,
      },
    });
    expect(result.providerId).toBe('provider-1');
  });

  it('fetches and persists in one step for bootstrap flows', async () => {
    mockLookupByNpi.mockResolvedValue(buildNpiBatch('npi-hash-2', 'TX'));
    prismaMock.provider.upsert.mockResolvedValue({ id: 'provider-2' });

    const result = await fetchAndPersistNppesProviderRecord('1234567893');

    expect(result.providerId).toBe('provider-2');
    expect(result.stateOfPractice).toBe('TX');
    expect(prismaMock.provider.upsert).toHaveBeenCalledTimes(1);
  });
});
