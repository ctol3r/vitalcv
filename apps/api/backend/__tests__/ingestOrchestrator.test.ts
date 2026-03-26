const mockClaimCount = jest.fn();
const mockCredentialFindMany = jest.fn();

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    claimRecord: {
      count: (...args: unknown[]) => mockClaimCount(...args),
    },
    vcvCredential: {
      findMany: (...args: unknown[]) => mockCredentialFindMany(...args),
    },
  },
}));

const mockBuildPassport = jest.fn();
const mockResolveEntityFromNpi = jest.fn();
const mockIngestClinicianIdentity = jest.fn();
const mockExtractPracticeStates = jest.fn();
const mockLoadClaimRecordsForNpi = jest.fn();
const mockResolvePhysicianLicensureLaunchLane = jest.fn();
const mockFetchNursysClaim = jest.fn();
const mockUpsertVcvCredential = jest.fn();
const mockEnv = jest.fn();

const mockAppendIngestEvent = jest.fn();
const mockCompleteIngestRun = jest.fn();
const mockCreateIngestRun = jest.fn();
const mockFindOpenIngestRunByNpi = jest.fn();
const mockGetIngestRun = jest.fn();
const mockGetIngestSourceRunSummary = jest.fn();
const mockStoreStartIngestRun = jest.fn();
const mockUpdateIngestRun = jest.fn();
const mockUpdateIngestSourceRun = jest.fn();

jest.mock('../src/services/entity/passportService', () => ({
  buildPassport: (...args: unknown[]) => mockBuildPassport(...args),
}));

jest.mock('../src/services/entity/entityResolutionService', () => ({
  resolveEntityFromNpi: (...args: unknown[]) => mockResolveEntityFromNpi(...args),
}));

jest.mock('../src/services/identity/identityIngestionPipeline', () => ({
  ingestClinicianIdentity: (...args: unknown[]) => mockIngestClinicianIdentity(...args),
}));

jest.mock('../src/services/identity/phase3Sources', () => ({
  extractPracticeStates: (...args: unknown[]) => mockExtractPracticeStates(...args),
}));

jest.mock('../src/services/identity/identityStore', () => ({
  loadClaimRecordsForNpi: (...args: unknown[]) => mockLoadClaimRecordsForNpi(...args),
}));

jest.mock('../src/services/identity/physicianLicensureLaunchLane', () => ({
  resolvePhysicianLicensureLaunchLane: (...args: unknown[]) => mockResolvePhysicianLicensureLaunchLane(...args),
}));

jest.mock('../src/services/identity/nursysClaimMapper', () => ({
  fetchNursysClaim: (...args: unknown[]) => mockFetchNursysClaim(...args),
}));

jest.mock('../src/services/entity/upsertVcvCredential', () => ({
  upsertVcvCredential: (...args: unknown[]) => mockUpsertVcvCredential(...args),
}));

jest.mock('../src/config/env', () => ({
  env: () => mockEnv(),
}));

jest.mock('../src/services/ingest/ingestEventStore', () => ({
  appendIngestEvent: (...args: unknown[]) => mockAppendIngestEvent(...args),
  completeIngestRun: (...args: unknown[]) => mockCompleteIngestRun(...args),
  createIngestRun: (...args: unknown[]) => mockCreateIngestRun(...args),
  findOpenIngestRunByNpi: (...args: unknown[]) => mockFindOpenIngestRunByNpi(...args),
  getIngestRun: (...args: unknown[]) => mockGetIngestRun(...args),
  getIngestSourceRunSummary: (...args: unknown[]) => mockGetIngestSourceRunSummary(...args),
  startIngestRun: (...args: unknown[]) => mockStoreStartIngestRun(...args),
  updateIngestRun: (...args: unknown[]) => mockUpdateIngestRun(...args),
  updateIngestSourceRun: (...args: unknown[]) => mockUpdateIngestSourceRun(...args),
}));

import { getIngestRun, startIngestRun } from '../src/services/ingest/ingestOrchestrator';

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ingestOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockClaimCount.mockResolvedValue(1);
    mockCredentialFindMany.mockResolvedValue([{ domain: 'IDENTITY' }]);

    mockFindOpenIngestRunByNpi.mockResolvedValue(null);
    mockCreateIngestRun.mockResolvedValue({
      id: 'run-1',
      npi: '1558302470',
      status: 'PENDING',
      entityId: null,
      lastError: null,
      startedAt: '2026-03-22T12:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z',
    });
    mockStoreStartIngestRun.mockResolvedValue(undefined);
    mockResolveEntityFromNpi.mockResolvedValue({
      entity: {
        id: 'entity-1',
        displayName: 'Ada Lovelace',
        entityType: 'PERSON',
        npiType: 'TYPE_1',
        metadata: {
          status: 'ACTIVE',
        },
      },
    });
    mockUpdateIngestRun.mockResolvedValue(undefined);
    mockUpdateIngestSourceRun.mockResolvedValue(undefined);
    mockAppendIngestEvent.mockResolvedValue(undefined);
    mockExtractPracticeStates.mockReturnValue(['CA']);
    mockLoadClaimRecordsForNpi.mockResolvedValue([]);
    mockResolvePhysicianLicensureLaunchLane.mockResolvedValue({
      route: 'manual',
      launchState: 'CA',
      claims: [],
    });
    mockFetchNursysClaim.mockResolvedValue(null);
    mockUpsertVcvCredential.mockResolvedValue(null);
    mockEnv.mockReturnValue({
      REAL_NURSYS_ENABLED: false,
    });
    mockBuildPassport.mockResolvedValue({
      entityId: 'entity-1',
      identity: {
        displayName: 'Ada Lovelace',
        specialty: 'Family Medicine',
        entityType: 'PERSON',
        status: 'ACTIVE',
      },
      standing: {
        exclusionClear: true,
        exclusionStatus: 'CLEAR',
        pecosEnrollmentStatus: 'ENROLLED',
      },
      readiness: {
        status: 'READY',
        score: 91,
        level: 'L3',
        blockers: [],
      },
      authority: {
        credentials: [{ id: 'cred-1' }, { id: 'cred-2' }],
      },
      lastCheckedAt: '2026-03-22T12:05:00.000Z',
    });
    mockGetIngestSourceRunSummary.mockResolvedValue([
      { sourceId: 'nppes', status: 'DONE', claimCount: 1, credentialCount: 1 },
      { sourceId: 'oig', status: 'DONE', claimCount: 1, credentialCount: 1 },
      { sourceId: 'pecos', status: 'DONE', claimCount: 1, credentialCount: 1 },
      { sourceId: 'fsmb', status: 'DONE', claimCount: 0, credentialCount: 0 },
    ]);
    mockCompleteIngestRun.mockResolvedValue(undefined);
    mockGetIngestRun.mockResolvedValue({
      id: 'run-1',
      npi: '1558302470',
      status: 'DONE',
      entityId: 'entity-1',
      lastError: null,
      startedAt: '2026-03-22T12:00:00.000Z',
      completedAt: '2026-03-22T12:05:00.000Z',
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:05:00.000Z',
    });
  });

  it('emits ordered source, claim, passport, and done events for a successful run', async () => {
    mockIngestClinicianIdentity.mockResolvedValue({
      results: [
        {
          npi: '1558302470',
          source: 'NPPES_API',
          artifactId: 'artifact-nppes',
          sourceRunId: 'source-run-nppes',
          claimIds: ['claim-1'],
          credentialIds: ['cred-1'],
          claimsEmitted: 1,
          deltaEvents: [],
          status: 'SUCCESS',
          latencyMs: 15,
        },
        {
          npi: '1558302470',
          source: 'OIG_LEIE',
          artifactId: 'artifact-oig',
          sourceRunId: 'source-run-oig',
          claimIds: ['claim-2'],
          credentialIds: ['cred-2'],
          claimsEmitted: 1,
          deltaEvents: [],
          status: 'SUCCESS',
          latencyMs: 15,
        },
        {
          npi: '1558302470',
          source: 'PECOS_PUBLIC',
          artifactId: 'artifact-pecos',
          sourceRunId: 'source-run-pecos',
          claimIds: ['claim-3'],
          credentialIds: ['cred-3'],
          claimsEmitted: 1,
          deltaEvents: [],
          status: 'SUCCESS',
          latencyMs: 15,
        },
      ],
      sourcesFailed: 0,
    });

    const run = await startIngestRun('1558302470');
    expect(run.id).toBe('run-1');

    await flushAsyncWork();
    await flushAsyncWork();

    const emittedEvents = mockAppendIngestEvent.mock.calls.map(
      ([event]) => event as {
        type: string;
        sourceId?: string;
        payload?: Record<string, unknown>;
      },
    );
    const emittedTypes = emittedEvents.map((event) => event.type);

    expect(emittedTypes).toEqual([
      'source_start',
      'source_start',
      'source_start',
      'source_complete',
      'claim_update',
      'source_complete',
      'claim_update',
      'source_complete',
      'claim_update',
      'source_start',
      'source_complete',
      'passport_ready',
      'done',
    ]);
    expect(mockCompleteIngestRun).toHaveBeenCalledWith('run-1', {
      status: 'DONE',
      entityId: 'entity-1',
    });
    expect(mockCompleteIngestRun.mock.invocationCallOrder[0]).toBeLessThan(
      mockAppendIngestEvent.mock.invocationCallOrder.at(-1) ?? Number.MAX_SAFE_INTEGER,
    );

    const nppesComplete = emittedEvents.find(
      (event) => event.type === 'source_complete' && event.sourceId === 'nppes',
    );
    expect(nppesComplete?.payload).toMatchObject({
      resultStatus: 'SUCCESS',
      identityStatus: 'ACTIVE',
    });

    const passportReady = emittedEvents.find((event) => event.type === 'passport_ready');
    expect(passportReady?.payload).toMatchObject({
      entityId: 'entity-1',
      displayName: 'Ada Lovelace',
      readinessStatus: 'READY',
      readinessScore: 91,
      readinessLevel: 'L3',
      exclusionStatus: 'CLEAR',
      enrollmentStatus: 'ENROLLED',
      checkedAt: '2026-03-22T12:05:00.000Z',
    });
    const fsmbComplete = emittedEvents.find(
      (event) => event.type === 'source_complete' && event.sourceId === 'fsmb',
    );
    expect(fsmbComplete?.payload).toMatchObject({
      status: 'SKIPPED',
      route: 'manual',
      launchState: 'CA',
      candidateStates: ['CA'],
    });
    expect(emittedTypes.indexOf('passport_ready')).toBeLessThan(emittedTypes.indexOf('done'));
  });

  it('reuses an open run instead of starting a second one for the same NPI', async () => {
    mockFindOpenIngestRunByNpi.mockResolvedValue({
      id: 'run-existing',
      npi: '1558302470',
      status: 'RUNNING',
      entityId: null,
      lastError: null,
      startedAt: '2026-03-22T12:00:00.000Z',
      completedAt: null,
      createdAt: '2026-03-22T12:00:00.000Z',
      updatedAt: '2026-03-22T12:00:00.000Z',
    });

    const run = await startIngestRun('1558302470');

    expect(run.id).toBe('run-existing');
    expect(mockCreateIngestRun).not.toHaveBeenCalled();
    expect(mockIngestClinicianIdentity).not.toHaveBeenCalled();
  });

  it('preserves run integrity and emits an error event when the pipeline fails', async () => {
    mockResolveEntityFromNpi.mockRejectedValue(new Error('entity resolution failed'));

    await startIngestRun('1558302470');
    await flushAsyncWork();
    await flushAsyncWork();

    expect(mockUpdateIngestSourceRun).toHaveBeenCalledTimes(4);
    expect(mockCompleteIngestRun).toHaveBeenCalledWith('run-1', {
      status: 'ERROR',
      lastError: 'entity resolution failed',
    });
    expect(mockAppendIngestEvent).toHaveBeenLastCalledWith({
      runId: 'run-1',
      type: 'error',
      dedupeKey: 'error:run:entity resolution failed',
      payload: {
        code: 'INGEST_RUN_FAILED',
        message: 'entity resolution failed',
      },
    });
    expect(
      mockAppendIngestEvent.mock.calls.some(
        ([event]) => (event as { type: string }).type === 'done',
      ),
    ).toBe(false);
  });

  it('loads a persisted run by id', async () => {
    const run = await getIngestRun('run-1');
    expect(run?.id).toBe('run-1');
    expect(mockGetIngestRun).toHaveBeenCalledWith('run-1');
  });
});
