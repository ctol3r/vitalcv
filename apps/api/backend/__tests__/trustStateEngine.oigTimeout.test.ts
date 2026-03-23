jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: jest.fn(),
    },
    candidateCredential: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/services/audit/auditLedger', () => ({
  appendAuditEvent: jest.fn().mockResolvedValue({ eventId: 'audit-1' }),
}));

jest.mock('../src/obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../src/graphql/prisma_client';
import { computeClinicianTrustState } from '../src/services/trust/trustStateEngine';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findMany: jest.Mock;
  };
  candidateCredential: {
    findMany: jest.Mock;
  };
};

describe('trust state engine OIG timeout safeguard', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.FEATURE_CREDENTIAL_INGESTION = 'false';
    process.env.OIG_LEIE_ENABLED = 'true';
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.candidateCredential.findMany.mockReset();

    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        source: 'STATE_BOARD',
        status: 'ACTIVE',
        trustState: 'verified',
        verifiedAt: new Date('2026-03-13T14:00:00.000Z'),
        expiresAt: new Date('2099-05-01T00:00:00.000Z'),
        rawPayload: {},
      },
      {
        source: 'DEA',
        status: 'ACTIVE',
        trustState: 'verified',
        verifiedAt: new Date('2026-03-13T15:00:00.000Z'),
        expiresAt: new Date('2099-06-01T00:00:00.000Z'),
        rawPayload: {},
      },
    ]);
    prismaMock.candidateCredential.findMany.mockResolvedValue([
      {
        data: { type: 'Board Certification' },
        status: 'VERIFIED',
        createdAt: new Date('2026-03-13T16:00:00.000Z'),
      },
      {
        data: { type: 'Malpractice Insurance' },
        status: 'VERIFIED',
        createdAt: new Date('2026-03-13T17:00:00.000Z'),
      },
    ]);

    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.includes('npiregistry.cms.hhs.gov')) {
        return Promise.resolve({
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
      }

      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_, reject) => {
        const abort = () => {
          reject(signal?.reason ?? Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
        };

        if (!signal) {
          abort();
          return;
        }

        if (signal.aborted) {
          abort();
          return;
        }

        signal.addEventListener('abort', abort, { once: true });
      });
    });
  });

  afterEach(() => {
    delete process.env.FEATURE_CREDENTIAL_INGESTION;
    delete process.env.OIG_LEIE_ENABLED;
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it('returns once the OIG timeout fires and caps trust state at L1 with UNCHECKED exclusion status', async () => {
    let settled = false;
    const statePromise = computeClinicianTrustState('1234567893').then((state) => {
      settled = true;
      return state;
    });

    await jest.advanceTimersByTimeAsync(3999);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const state = await statePromise;

    expect(state.exclusionStatus).toBe('UNCHECKED');
    expect(state.exclusionClear).toBe(false);
    expect(state.readiness_score).toBe(50);
    expect(state.readiness_level).toBe('L1');
    expect(state.gap_summary).toContain('OIG/LEIE exclusion check unchecked');
    expect(state.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        factType: 'Sanction',
        status: 'UNCHECKED',
      }),
    ]));
  });
});
