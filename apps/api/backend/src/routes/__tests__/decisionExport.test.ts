import type { Request, Response } from 'express';

jest.mock('../../orchestrator/vcv-omega', () => ({
  orchestrateOmega: jest.fn(),
}));

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    decisionCapsule: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../services/integration/webhookSystem', () => ({
  enqueueIntegrationWebhookEvent: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import { orchestrateOmega } from '../../orchestrator/vcv-omega';
import { registerDecisionExportRoutes } from '../decisionExport';
import { verifyDecisionAttestation } from '../../services/audit/replayEngine';
import { enqueueIntegrationWebhookEvent } from '../../services/integration/webhookSystem';

const prismaMock = prisma as unknown as {
  decisionCapsule: {
    findMany: jest.Mock;
  };
};

const orchestrateOmegaMock = orchestrateOmega as jest.MockedFunction<typeof orchestrateOmega>;
const enqueueIntegrationWebhookEventMock =
  enqueueIntegrationWebhookEvent as jest.MockedFunction<typeof enqueueIntegrationWebhookEvent>;

function buildGetHandler() {
  const get = jest.fn();
  const app = {
    get,
  };

  registerDecisionExportRoutes(app as never);
  const exportCall = get.mock.calls.find((call) => call[0] === '/api/export/:npi');
  if (!exportCall) {
    throw new Error('decision export route was not registered');
  }

  return exportCall[1] as (req: Request, res: Response) => Promise<void>;
}

function buildResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('GET /api/export/:npi', () => {
  beforeEach(() => {
    orchestrateOmegaMock.mockReset();
    prismaMock.decisionCapsule.findMany.mockReset();
    enqueueIntegrationWebhookEventMock.mockReset().mockResolvedValue(0);
  });

  it('includes verified decision attestation records in the export payload', async () => {
    const snapshot = {
      artifactHash: 'artifact-hash-1',
      capsuleId: 'capsule-1',
      decisionAction: 'APPROVE',
      decisionTimestamp: '2026-04-10T12:00:00.000Z',
      decisionType: 'HIRING',
      methodologyVersion: 'decision_capsule.v262',
      sourceReferenceId: 'acceptance-1',
      status: 'VALID',
      subjectDid: 'did:vitalcv:1234567890',
      subjectNpi: '1234567890',
      triggerEvent: 'employment_acceptance',
      verifierOrgId: 'org-1',
    } as const;
    const verification = verifyDecisionAttestation({
      attesterId: 'user-1',
      attesterRole: 'Credentialing Lead',
      statement: 'Reviewed and confirmed.',
      timestamp: '2026-04-11T09:30:00.000Z',
      hash: null,
      snapshot,
    });

    orchestrateOmegaMock.mockResolvedValue({
      status: 'ok',
      generatedAt: '2026-04-14T18:00:00.000Z',
      decision: { decision: 'READY' },
      coverage: { checks: [] },
      reuse_signal: null,
      drift: null,
      acceptance: null,
      activation: null,
      recent_actions: [],
      nextBestAction: null,
    } as never);
    prismaMock.decisionCapsule.findMany.mockResolvedValue([
      {
        id: 'capsule-1',
        subjectDid: 'did:vitalcv:1234567890',
        subjectNpi: '1234567890',
        decisionType: 'HIRING',
        decisionTimestamp: new Date('2026-04-10T12:00:00.000Z'),
        status: 'VALID',
        methodology: 'decision_capsule.v262',
        artifactHash: 'artifact-hash-1',
        metadata: {
          triggerEvent: 'employment_acceptance',
          sourceReferenceId: 'acceptance-1',
          attestations: [
            {
              attesterId: 'user-1',
              attesterRole: 'Credentialing Lead',
              statement: 'Reviewed and confirmed.',
              timestamp: '2026-04-11T09:30:00.000Z',
              hash: verification.computedHash,
              snapshot,
            },
          ],
        },
      },
    ]);

    const handler = buildGetHandler();
    const res = buildResponse();

    await handler({
      params: { npi: '1234567890' },
      query: {},
    } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = JSON.parse(res.send.mock.calls[0]?.[0] as string) as {
      decisionAttestations: Array<{ verification: { hashMatch: boolean } }>;
    };
    expect(body.decisionAttestations).toHaveLength(1);
    expect(body.decisionAttestations[0]?.verification.hashMatch).toBe(true);
    expect(enqueueIntegrationWebhookEventMock).toHaveBeenCalledWith({
      eventType: 'manifest.generated',
      subjectNpi: '1234567890',
      manifestId: expect.any(String),
      timestamp: '2026-04-14T18:00:00.000Z',
      dedupeKey: expect.any(String),
    });
  });
});
