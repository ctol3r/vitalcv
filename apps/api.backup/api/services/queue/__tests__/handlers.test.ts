import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EhrSyncConcurrencyError } from '../../ehr/workers/ehrSyncLock.js';
import { QueueConcurrencyError } from '../handlers/concurrency.js';
import { createHandlerHarness } from './handlers.harness.js';

const runPSVMock = jest.fn();
const runDriftSweepMock = jest.fn().mockResolvedValue({
  totalSignals: 0,
  createdEvents: 0,
  resolvedEvents: 0,
  notificationsSent: 0,
});
const issuePrivilegeGrantedVCMock = jest.fn();
const privilegeGrantedUpdateMock = jest.fn();
const privilegeGrantedFindUniqueMock = jest.fn();
const runCredentialAgentTaskMock = jest.fn();
const runEhrSyncJobMock = jest.fn();
const publishProofsHandlerMock = jest.fn();
const fusionUpdateHandlerMock = jest.fn();
const safetySweepHandlerMock = jest.fn();
const mobilityEvaluateHandlerMock = jest.fn();

jest.mock('../../psv/psvOrchestrator.js', () => ({
  runPSV: runPSVMock,
}));

jest.mock('../../drift/orchestrator.js', () => ({
  runDriftSweep: runDriftSweepMock,
}));

jest.mock('../../notifications/emailSenderStub.js', () => ({
  runEmailSenderJob: jest.fn(),
}));

jest.mock('../../../apps/api/src/services/pilotSmoke.js', () => ({
  runPilotSmoke: jest.fn(),
}));

jest.mock('../../../apps/api/src/services/demoMetrics.js', () => ({
  getDemoMetrics: jest.fn().mockResolvedValue({ issuedVCs: 1 }),
}));

jest.mock('../../../apps/issuer-api/src/services/privilegeVcIssuer.js', () => ({
  issuePrivilegeGrantedVC: issuePrivilegeGrantedVCMock,
}));

jest.mock('../../agent/executor/agentExecutor.js', () => ({
  runCredentialAgentTask: runCredentialAgentTaskMock,
}));

jest.mock('../../ehr/workers/ehrSyncWorker.js', () => ({
  runEhrSyncJob: runEhrSyncJobMock,
}));

jest.mock('../../nci/handlers/publishProofsHandler.js', () => ({
  handleNciPublishProofsJob: publishProofsHandlerMock,
}));

jest.mock('../../qualityFusion/handlers/fusionHandler.js', () => ({
  runFusionUpdateHandler: fusionUpdateHandlerMock,
}));

jest.mock('../../safety/handlers/safetySweepHandler.js', () => ({
  runSafetySweepHandler: safetySweepHandlerMock,
}));

jest.mock('../../mobility/handlers/evaluateMobilityHandler.js', () => ({
  runMobilityEvaluateHandler: mobilityEvaluateHandlerMock,
}));

const jobQueueStatusMock = {
  RUNNING: 'RUNNING',
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  FAILED_FINAL: 'FAILED_FINAL',
  COMPLETED: 'COMPLETED',
};

const nciProofTypeMock = {
  ISSUANCE: 'ISSUANCE',
  VERIFICATION: 'VERIFICATION',
  REVOCATION: 'REVOCATION',
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    privilegeGranted: {
      update: privilegeGrantedUpdateMock,
      findUnique: privilegeGrantedFindUniqueMock,
    },
  })),
  JobQueueStatus: jobQueueStatusMock,
  NCIVerifiableProofType: nciProofTypeMock,
}));

describe('queue handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runPSVMock.mockResolvedValue({ overallStatus: 'PASS' });
    privilegeGrantedFindUniqueMock.mockResolvedValue({
      id: 'grant-1',
      vcCredentialId: null,
      vcHash: null,
    });
  });

  it('runs PSV handler with parsed payload', async () => {
    const harness = createHandlerHarness('PSV_RUN');
    const payload = {
      clinicianId: 'clinician-1',
      npi: '1234567890',
      state: 'CA',
      licenseNumber: 'LIC-1',
    };

    const result = await harness.run({ payload });

    expect(result.ok).toBe(true);
    expect(runPSVMock).toHaveBeenCalledWith(payload);
  });

  it('issues privilege VC and updates record', async () => {
    const harness = createHandlerHarness('PRIVILEGE_ISSUE');
    issuePrivilegeGrantedVCMock.mockResolvedValue({ vcId: 'vc-123', vcHash: 'hash-123' });

    const payload = {
      privilegeRequestId: 'req-1',
      privilegeGrantedId: 'grant-1',
      clinicianDid: 'did:key:123',
      orgId: 'org-1',
      privilegeSetId: 'set-1',
      reviewerDid: 'did:key:reviewer',
    };

    const result = await harness.run({ payload });

    expect(result.ok).toBe(true);
    expect(issuePrivilegeGrantedVCMock).toHaveBeenCalledWith({
      privilegeRequestId: 'req-1',
      clinicianDid: 'did:key:123',
      orgId: 'org-1',
      privilegeSetId: 'set-1',
      reviewerDid: 'did:key:reviewer',
    });
    expect(privilegeGrantedUpdateMock).toHaveBeenCalledWith({
      where: { id: 'grant-1' },
      data: {
        vcHash: 'hash-123',
        vcCredentialId: 'vc-123',
      },
    });
  });

  it('skips duplicate PRIVILEGE_ISSUE jobs when VC already exists', async () => {
    const harness = createHandlerHarness('PRIVILEGE_ISSUE');
    const payload = {
      privilegeRequestId: 'req-1',
      privilegeGrantedId: 'grant-1',
      clinicianDid: 'did:key:123',
      orgId: 'org-1',
      privilegeSetId: 'set-1',
      reviewerDid: 'did:key:reviewer',
    };

    privilegeGrantedFindUniqueMock
      .mockResolvedValueOnce({
        id: 'grant-1',
        vcCredentialId: null,
        vcHash: null,
      })
      .mockResolvedValueOnce({
        id: 'grant-1',
        vcCredentialId: 'existing-vc',
        vcHash: 'hash-xyz',
      });

    await harness.run({ payload });
    const duplicateResult = await harness.run({ payload });

    expect(duplicateResult.ok).toBe(true);
    expect(issuePrivilegeGrantedVCMock).toHaveBeenCalledTimes(1);
    expect(privilegeGrantedUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('runs drift sweep job', async () => {
    const harness = createHandlerHarness('DRIFT_SWEEP');
    const result = await harness.run({ payload: {} });
    expect(result.ok).toBe(true);
    expect(runDriftSweepMock).toHaveBeenCalled();
  });

  it('dispatches EHR sync jobs to the worker', async () => {
    const harness = createHandlerHarness('EHR_SYNC');
    const result = await harness.run({ payload: { syncId: 'sync-99' } });
    expect(result.ok).toBe(true);
    expect(runEhrSyncJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EHR_SYNC',
        payload: { syncId: 'sync-99' },
      })
    );
  });

  it('prevents concurrent EHR sync jobs with the same syncId', async () => {
    const harness = createHandlerHarness('EHR_SYNC');
    let releaseFirst: (() => void) | undefined;
    runEhrSyncJobMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        })
    );

    const firstRun = harness.run({ payload: { syncId: 'sync-lock' } });
    const secondResult = await harness.run({ payload: { syncId: 'sync-lock' } });

    expect(secondResult.ok).toBe(false);
    expect(secondResult.error).toBeInstanceOf(EhrSyncConcurrencyError);
    expect(runEhrSyncJobMock).toHaveBeenCalledTimes(1);

    releaseFirst?.();
    const firstResult = await firstRun;
    expect(firstResult.ok).toBe(true);
  });

  it('marks invalid payloads as DLQ candidates on final attempt', async () => {
    const harness = createHandlerHarness('PSV_RUN');
    const result = await harness.run({
      payload: { invalid: true },
      attempts: 5,
      maxAttempts: 5,
    });

    expect(result.ok).toBe(false);
    expect(result.finalAttempt).toBe(true);
    expect(runPSVMock).not.toHaveBeenCalled();
  });

  it('runs credential agent task handler', async () => {
    const harness = createHandlerHarness('CREDENTIAL_AGENT_TASK');
    const result = await harness.run({ payload: { taskId: 'task-123' } });
    expect(result.ok).toBe(true);
    expect(runCredentialAgentTaskMock).toHaveBeenCalledWith('task-123');
  });

  it('delegates fusion updates to the dedicated handler', async () => {
    const harness = createHandlerHarness('FUSION_UPDATE');
    const result = await harness.run({
      payload: { clinicianId: 'clin-200' },
    });

    expect(result.ok).toBe(true);
    expect(fusionUpdateHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'FUSION_UPDATE' })
    );
  });

  it('delegates safety sweeps to the dedicated handler', async () => {
    const harness = createHandlerHarness('SAFETY_SWEEP');
    const result = await harness.run({ payload: {} });

    expect(result.ok).toBe(true);
    expect(safetySweepHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SAFETY_SWEEP' })
    );
  });

  it('delegates mobility evaluations to the dedicated handler', async () => {
    const harness = createHandlerHarness('MOBILITY_EVALUATE_ORG');
    const result = await harness.run({
      payload: { onboardingRequestId: 'req-400' },
    });

    expect(result.ok).toBe(true);
    expect(mobilityEvaluateHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'MOBILITY_EVALUATE_ORG' })
    );
  });

  it('delegates NCI publish proofs to the dedicated handler', async () => {
    const harness = createHandlerHarness('NCI_PUBLISH_PROOFS');
    const result = await harness.run({
      payload: { clinicianId: 'clin-900', proofTypes: ['ISSUANCE'] },
    });

    expect(result.ok).toBe(true);
    expect(publishProofsHandlerMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'NCI_PUBLISH_PROOFS' })
    );
  });

  it('propagates fusion concurrency failures', async () => {
    const harness = createHandlerHarness('FUSION_UPDATE');
    fusionUpdateHandlerMock.mockRejectedValueOnce(new QueueConcurrencyError('limit'));

    const result = await harness.run({ payload: { clinicianId: 'clin-1' } });

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(QueueConcurrencyError);
  });

  it('propagates safety sweep concurrency failures', async () => {
    const harness = createHandlerHarness('SAFETY_SWEEP');
    safetySweepHandlerMock.mockRejectedValueOnce(new QueueConcurrencyError('running'));

    const result = await harness.run({ payload: {} });

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(QueueConcurrencyError);
  });

  it('propagates mobility evaluation concurrency failures', async () => {
    const harness = createHandlerHarness('MOBILITY_EVALUATE_ORG');
    mobilityEvaluateHandlerMock.mockRejectedValueOnce(new QueueConcurrencyError('org busy'));

    const result = await harness.run({
      payload: { onboardingRequestId: 'req-500' },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(QueueConcurrencyError);
  });

  it('propagates NCI publish concurrency failures', async () => {
    const harness = createHandlerHarness('NCI_PUBLISH_PROOFS');
    publishProofsHandlerMock.mockRejectedValueOnce(new QueueConcurrencyError('clin busy'));

    const result = await harness.run({
      payload: { clinicianId: 'clin-999', proofTypes: ['ISSUANCE'] },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(QueueConcurrencyError);
  });
});
