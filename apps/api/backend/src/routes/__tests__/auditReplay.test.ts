import type { Request, Response } from 'express';

jest.mock('../../services/audit/replayEngine', () => {
  class MockDecisionAttestationError extends Error {
    constructor(
      public readonly code: string,
      public readonly statusCode: number,
      message: string,
    ) {
      super(message);
      this.name = 'DecisionAttestationError';
    }
  }

  return {
    replayDecision: jest.fn(),
    buildAuditBundle: jest.fn(),
    addAttestation: jest.fn(),
    DecisionAttestationError: MockDecisionAttestationError,
  };
});

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

import { registerAuditReplayRoutes } from '../auditReplay';
import { addAttestation, DecisionAttestationError } from '../../services/audit/replayEngine';

const addAttestationMock = addAttestation as jest.MockedFunction<typeof addAttestation>;

function buildPostHandler() {
  const post = jest.fn();
  const app = {
    get: jest.fn(),
    post,
  };

  registerAuditReplayRoutes(app as never);
  const attestCall = post.mock.calls.find((call) => call[0] === '/api/decisions/:id/attest');
  if (!attestCall) {
    throw new Error('attest route was not registered');
  }

  return attestCall[1] as (req: Request, res: Response) => Promise<void>;
}

function buildResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };

  res.status.mockReturnValue(res);
  return res;
}

function buildRequest(): Request {
  return {
    params: { id: '123e4567-e89b-12d3-a456-426614174000' },
    body: {
      attesterId: 'user-1',
      attesterRole: 'Credentialing Lead',
      statement: 'Reviewed and confirmed.',
    },
  } as unknown as Request;
}

describe('POST /api/decisions/:id/attest', () => {
  beforeEach(() => {
    addAttestationMock.mockReset();
  });

  it('returns 201 only after attestation is persisted successfully', async () => {
    addAttestationMock.mockResolvedValue({
      capsuleId: '123e4567-e89b-12d3-a456-426614174000',
      attestationCount: 1,
      attestedAt: '2026-04-11T09:30:00.000Z',
      created: true,
    });

    const handler = buildPostHandler();
    const res = buildResponse();

    await handler(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      capsuleId: '123e4567-e89b-12d3-a456-426614174000',
      attestationCount: 1,
      attestedAt: '2026-04-11T09:30:00.000Z',
      created: true,
    });
  });

  it('does not create an attestation response for a rejected capsule', async () => {
    addAttestationMock.mockRejectedValue(
      new DecisionAttestationError(
        'ACTION_NOT_ATTESTABLE',
        409,
        'Cannot attest an invalid decision capsule.',
      ),
    );

    const handler = buildPostHandler();
    const res = buildResponse();

    await handler(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'action_not_attestable',
      error_description: 'Cannot attest an invalid decision capsule.',
    });
  });

  it('returns 200 for a duplicate attestation retry', async () => {
    addAttestationMock.mockResolvedValue({
      capsuleId: '123e4567-e89b-12d3-a456-426614174000',
      attestationCount: 1,
      attestedAt: '2026-04-11T09:30:00.000Z',
      created: false,
    });

    const handler = buildPostHandler();
    const res = buildResponse();

    await handler(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      capsuleId: '123e4567-e89b-12d3-a456-426614174000',
      attestationCount: 1,
      attestedAt: '2026-04-11T09:30:00.000Z',
      created: false,
    });
  });
});
