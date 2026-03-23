jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: jest.fn(),
    },
    candidateCredential: {
      findMany: jest.fn(),
    },
    vcvEntity: {
      findFirst: jest.fn(),
    },
    vcvCredential: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/services/psv/oigLeieChecker', () => ({
  checkExclusion: jest.fn(),
}));

import prisma from '../src/graphql/prisma_client';
import { checkExclusion } from '../src/services/psv/oigLeieChecker';
import { computeClinicianTrustState } from '../src/services/trust/trustStateEngine';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findMany: jest.Mock;
  };
  candidateCredential: {
    findMany: jest.Mock;
  };
  vcvEntity: {
    findFirst: jest.Mock;
  };
  vcvCredential: {
    findMany: jest.Mock;
  };
};

const checkExclusionMock = checkExclusion as jest.MockedFunction<typeof checkExclusion>;

describe('trust state engine with credential ingestion artifacts', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.candidateCredential.findMany.mockReset();
    prismaMock.vcvEntity.findFirst.mockReset();
    prismaMock.vcvCredential.findMany.mockReset();
    checkExclusionMock.mockReset();
    fetchSpy = jest.spyOn(globalThis, 'fetch');

    prismaMock.vcvEntity.findFirst.mockResolvedValue(null);
    prismaMock.vcvCredential.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.FEATURE_CREDENTIAL_INGESTION;
    fetchSpy.mockRestore();
  });

  test('preserves legacy behavior when credential ingestion flag is off', async () => {
    process.env.FEATURE_CREDENTIAL_INGESTION = 'false';
    prismaMock.verificationArtifact.findMany.mockResolvedValue([]);
    prismaMock.candidateCredential.findMany.mockResolvedValue([]);
    checkExclusionMock.mockResolvedValue({
      excluded: false,
      matchType: 'NONE',
      matchConfidence: 'HIGH',
      status: 'CLEAR',
      details: 'clear',
      checkedAt: '2026-03-13T12:00:00.000Z',
      source: 'OIG_LEIE',
      leieVersionDate: '2026-03-10',
      dataVersion: '2026-03',
    });
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            basic: {
              first_name: 'Jane',
              last_name: 'Doe',
              status: 'A',
            },
            enumeration_type: 'NPI-1',
            taxonomies: [],
          },
        ],
      }),
    } as Response);

    const state = await computeClinicianTrustState('1234567893');

    expect(fetchSpy).toHaveBeenCalled();
    expect(checkExclusionMock).toHaveBeenCalled();
    expect(state.identityVerified).toBe(true);
  });

  test('uses ingested artifacts only when feature flag is enabled', async () => {
    process.env.FEATURE_CREDENTIAL_INGESTION = 'true';
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        source: 'NPPES',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T12:00:00.000Z'),
        expiresAt: new Date('2026-04-12T12:00:00.000Z'),
        psvWindowDeadline: new Date('2099-04-12T12:00:00.000Z'),
        rawPayload: {
          provider_name: 'Jane Doe',
        },
      },
      {
        source: 'OIG',
        status: 'CLEAR',
        verifiedAt: new Date('2026-03-13T13:00:00.000Z'),
        expiresAt: new Date('2099-03-14T13:00:00.000Z'),
        psvWindowDeadline: new Date('2099-03-14T13:00:00.000Z'),
        rawPayload: {
          source_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
        },
      },
      {
        source: 'STATE_BOARD',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T14:00:00.000Z'),
        expiresAt: new Date('2099-05-01T00:00:00.000Z'),
        psvWindowDeadline: new Date('2099-06-11T14:00:00.000Z'),
        rawPayload: {
          board_name: 'Medical Board of California',
          state: 'CA',
          license_number: 'CA-MD-1234',
        },
      },
      {
        source: 'PECOS_PUBLIC',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T15:00:00.000Z'),
        expiresAt: new Date('2099-06-13T15:00:00.000Z'),
        psvWindowDeadline: new Date('2099-06-13T15:00:00.000Z'),
        rawPayload: {
          _claims: [
            {
              claimType: 'ENROLLMENT_STATUS',
              value: { enrolled: true },
            },
          ],
          statusLabel: 'Medicare enrolled — as of Q1 2026',
          dataVersion: '2026-Q1',
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567893');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(checkExclusionMock).not.toHaveBeenCalled();
    expect(state.identityVerified).toBe(true);
    expect(state.exclusionClear).toBe(true);
    expect(state.licensureStatus).toBe('verified');
    expect(state.readiness_level).toBe('L3');
  });

  test('marks stale OIG evidence as a blocking gap in ingested mode', async () => {
    process.env.FEATURE_CREDENTIAL_INGESTION = 'true';
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        source: 'NPPES',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T12:00:00.000Z'),
        expiresAt: new Date('2099-04-12T12:00:00.000Z'),
        psvWindowDeadline: new Date('2099-04-12T12:00:00.000Z'),
        rawPayload: {},
      },
      {
        source: 'OIG',
        status: 'CLEAR',
        verifiedAt: new Date('2026-03-13T13:00:00.000Z'),
        expiresAt: new Date('2026-03-12T13:00:00.000Z'),
        psvWindowDeadline: new Date('2026-03-12T13:00:00.000Z'),
        rawPayload: {},
      },
      {
        source: 'STATE_BOARD',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T14:00:00.000Z'),
        expiresAt: new Date('2099-05-01T00:00:00.000Z'),
        psvWindowDeadline: new Date('2099-06-11T14:00:00.000Z'),
        rawPayload: {},
      },
      {
        source: 'PECOS_PUBLIC',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T15:00:00.000Z'),
        expiresAt: new Date('2099-06-13T15:00:00.000Z'),
        psvWindowDeadline: new Date('2099-06-13T15:00:00.000Z'),
        rawPayload: {
          _claims: [
            {
              claimType: 'ENROLLMENT_STATUS',
              value: { enrolled: true },
            },
          ],
        },
      },
    ]);

    const state = await computeClinicianTrustState('1234567893');

    expect(state.exclusionClear).toBe(false);
    expect(state.exclusionStatus).toBe('UNCHECKED');
    expect(state.readiness_level).toBe('L1');
    expect(state.gap_summary).toContain('OIG exclusion check stale');
  });

  test('marks expired state license as a blocking gap in ingested mode', async () => {
    process.env.FEATURE_CREDENTIAL_INGESTION = 'true';
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        source: 'NPPES',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T12:00:00.000Z'),
        expiresAt: new Date('2099-04-12T12:00:00.000Z'),
        psvWindowDeadline: new Date('2099-04-12T12:00:00.000Z'),
        rawPayload: {},
      },
      {
        source: 'OIG',
        status: 'CLEAR',
        verifiedAt: new Date('2026-03-13T13:00:00.000Z'),
        expiresAt: new Date('2099-03-14T13:00:00.000Z'),
        psvWindowDeadline: new Date('2099-03-14T13:00:00.000Z'),
        rawPayload: {},
      },
      {
        source: 'STATE_BOARD',
        status: 'EXPIRED',
        verifiedAt: new Date('2026-03-13T14:00:00.000Z'),
        expiresAt: new Date('2026-03-12T00:00:00.000Z'),
        psvWindowDeadline: new Date('2099-06-11T14:00:00.000Z'),
        rawPayload: {},
      },
    ]);

    const state = await computeClinicianTrustState('1234567893');

    expect(state.licensureStatus).toBe('expired');
    expect(state.readiness_level).toBe('L0');
    expect(state.gap_summary).toContain('State license expired');
  });
});
