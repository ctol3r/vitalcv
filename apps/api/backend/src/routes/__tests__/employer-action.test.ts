/**
 * Pins the audit-chain hardening contract on `POST /api/employer-action`:
 *
 *  1. Anonymous requests (no x-clerk-user-id header) are rejected with
 *     401 BEFORE any Prisma mutation.
 *  2. Authenticated requests with a valid header create both the
 *     EmployerAcceptance row and the AuditEvent row.
 *  3. Every AuditEvent row carries `metadata.actorId === <Clerk user id>`
 *     — the operator who took the decision is attributable on replay.
 */
import request from 'supertest';
import express from 'express';
import { employerActionRouter } from '../employer-action';
import prisma from '../../graphql/prisma_client';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    employerAcceptance: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

const VALID_BODY = {
  npi: '1234567890',
  employerId: 'org-test-employer-1',
  action: 'accept_head_start' as const,
  loopId: 'loop-1',
  notes: null,
};

const app = express();
app.use(express.json());
app.use('/api/employer-action', employerActionRouter);

describe('POST /api/employer-action — audit-chain hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.employerAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.employerAcceptance.create as jest.Mock).mockResolvedValue({
      id: 'acc-1',
    });
    (prisma.auditEvent.create as jest.Mock).mockResolvedValue({
      id: 'audit-1',
    });
  });

  it('rejects anonymous requests with 401 before any DB write', async () => {
    const res = await request(app).post('/api/employer-action').send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
    expect(prisma.employerAcceptance.findFirst).not.toHaveBeenCalled();
    expect(prisma.employerAcceptance.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects requests with an empty x-clerk-user-id header (401)', async () => {
    const res = await request(app)
      .post('/api/employer-action')
      .set('x-clerk-user-id', '   ')
      .send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('writes the EmployerAcceptance and AuditEvent rows when authenticated', async () => {
    const res = await request(app)
      .post('/api/employer-action')
      .set('x-clerk-user-id', 'user_employer_actor_1')
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.auditWritten).toBe(true);
    expect(prisma.employerAcceptance.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('records the Clerk user id as metadata.actorId on the audit row', async () => {
    await request(app)
      .post('/api/employer-action')
      .set('x-clerk-user-id', 'user_employer_actor_1')
      .send(VALID_BODY);

    const auditArgs = (prisma.auditEvent.create as jest.Mock).mock.calls[0][0];
    expect(auditArgs.data.metadata.actorId).toBe('user_employer_actor_1');
    // organizationId still carries the employer id at the row level —
    // the actor is layered on top, not a replacement.
    expect(auditArgs.data.organizationId).toBe('org-test-employer-1');
    expect(auditArgs.data.metadata.actorId).not.toBe(auditArgs.data.organizationId);
  });

  it('records the Clerk user id as metadata.actorId on a refresh-request audit row', async () => {
    await request(app)
      .post('/api/employer-action')
      .set('x-clerk-user-id', 'user_employer_actor_2')
      .send({ ...VALID_BODY, action: 'request_refresh' });

    const auditArgs = (prisma.auditEvent.create as jest.Mock).mock.calls[0][0];
    expect(auditArgs.data.type).toBe('employer.request_refresh');
    expect(auditArgs.data.metadata.actorId).toBe('user_employer_actor_2');
  });

  it('still validates body fields (400 on missing required) AFTER auth passes', async () => {
    const res = await request(app)
      .post('/api/employer-action')
      .set('x-clerk-user-id', 'user_employer_actor_1')
      .send({ employerId: 'org-1', action: 'accept_head_start' }); // missing npi
    expect(res.status).toBe(400);
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });
});
