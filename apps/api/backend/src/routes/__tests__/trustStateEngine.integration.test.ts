import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    vcvEntity: {
      findFirst: jest.fn(),
    },
    vcvCredential: {
      findMany: jest.fn(),
    },
    candidateCredential: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../services/audit/auditLedger', () => ({
  appendAuditEvent: jest.fn().mockResolvedValue({ eventId: 'audit-1' }),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { registerTrustStateEngineRoutes } from '../trustStateEngine';
import { resetPilotTelemetry } from '../../services/system/pilotTelemetry';
import { resetTrustStateMemoryCache } from '../../services/trust/trustStateCache';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
  };
  vcvEntity: {
    findFirst: jest.Mock;
  };
  vcvCredential: {
    findMany: jest.Mock;
  };
  candidateCredential: {
    findMany: jest.Mock;
  };
};

function buildApp() {
  const app = express();
  app.use(express.json());
  registerTrustStateEngineRoutes(app);
  return app;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function waitForCall(mockFn: jest.Mock, minimumCalls = 1): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (mockFn.mock.calls.length >= minimumCalls) {
      return;
    }

    await flushPromises();
  }

  throw new Error(`Expected mock to be called at least ${minimumCalls} time(s).`);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return { promise, resolve, reject };
}

describe('trustStateEngine route integration', () => {
  beforeEach(() => {
    process.env.FEATURE_CREDENTIAL_INGESTION = 'true';
    resetPilotTelemetry();
    resetTrustStateMemoryCache();
    prismaMock.verificationArtifact.findFirst.mockReset();
    prismaMock.verificationArtifact.findMany.mockReset();
    prismaMock.verificationArtifact.create.mockReset();
    prismaMock.vcvEntity.findFirst.mockReset();
    prismaMock.vcvCredential.findMany.mockReset();
    prismaMock.candidateCredential.findMany.mockReset();

    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    prismaMock.verificationArtifact.findMany.mockResolvedValue([
      {
        source: 'NPPES',
        status: 'ACTIVE',
        verifiedAt: new Date('2026-03-13T12:00:00.000Z'),
        expiresAt: new Date('2099-04-12T12:00:00.000Z'),
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
          source_url: 'https://oig.hhs.gov/exclusions/search.asp',
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
    ]);
    prismaMock.vcvEntity.findFirst.mockResolvedValue(null);
    prismaMock.vcvCredential.findMany.mockResolvedValue([]);
    prismaMock.candidateCredential.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.FEATURE_CREDENTIAL_INGESTION;
  });

  it('persists a snapshot on GET miss before returning and serves the second GET from cache', async () => {
    const createWrite = deferred<{ id: string }>();
    prismaMock.verificationArtifact.create.mockImplementation(() => createWrite.promise);
    const app = buildApp();

    let settled = false;
    const firstRequest = request(app)
      .get('/api/trust-state/1234567893')
      .then((response) => {
        settled = true;
        return response;
      });

    await waitForCall(prismaMock.verificationArtifact.create);

    expect(settled).toBe(false);

    const createCall = prismaMock.verificationArtifact.create.mock.calls[0][0];
    expect(createCall.data.source).toBe('TRUST_STATE_ENGINE');
    // The snapshot must be persisted with npi + trust_state_snapshot wrapper.
    // readiness_level is intentionally not asserted here — methodology version changes
    // affect scoring and PECOS absence caps at L1 under methodology 243.3.
    expect(createCall.data.rawPayload).toEqual(expect.objectContaining({
      npi: '1234567893',
      trust_state_snapshot: expect.objectContaining({
        npi: '1234567893',
      }),
    }));

    createWrite.resolve({ id: 'artifact-1' });

    const first = await firstRequest;
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);

    const second = await request(app)
      .get('/api/trust-state/1234567893')
      .expect(200);

    expect(second.body.cached).toBe(true);
    expect(prismaMock.verificationArtifact.findFirst).toHaveBeenCalledTimes(1);
    expect(prismaMock.verificationArtifact.create).toHaveBeenCalledTimes(1);
  });
});
