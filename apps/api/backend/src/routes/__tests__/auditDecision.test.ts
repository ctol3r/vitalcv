import request from 'supertest';
import express from 'express';
import { registerAuditDecisionRoutes } from '../auditDecision';
import prisma from '../../graphql/prisma_client';

// $transaction([...]) is faked by awaiting each entry — the mocks for
// auditEvent.create and decisionLearningCapsule.create already return
// promises, so this faithfully models the all-or-nothing semantics
// the route relies on (a reject inside either entry propagates via
// Promise.all and prevents both side-effects from committing).
jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    auditEvent: {
      create: jest.fn(),
    },
    decisionLearningCapsule: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => {
      return Promise.all(operations);
    }),
  },
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

const CLINICIAN_ID = 'a0000000-0000-4000-a000-000000000001';
const EMPLOYER_ID = 'a0000000-0000-4000-a000-000000000002';

const validBody = {
  clinicianId: CLINICIAN_ID,
  employerId: EMPLOYER_ID,
  role: 'Family Medicine',
  decisionOutcome: 'ACCEPTED_HEAD_START',
  timeToDecision: 47,
  passportSnapshot: {
    readinessBand: 'L2',
    readinessScore: 78,
    credentialTypes: ['STATE_BOARD_LICENSE', 'DEA'],
    gaps: [],
    state: 'CA',
    specialty: 'Family Medicine',
  },
};

const app = express();
app.use(express.json());
registerAuditDecisionRoutes(app);

describe('POST /api/audit/decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.auditEvent.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });
    (prisma.decisionLearningCapsule.create as jest.Mock).mockResolvedValue({
      id: 'capsule-1',
      timestamp: new Date('2026-04-18T00:00:00Z'),
    });
  });

  it('records a learning capsule and a standard audit event', async () => {
    const res = await request(app).post('/api/audit/decision').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.capsuleId).toBe('capsule-1');
    expect(res.body.auditEventId).toBe('audit-1');
    expect(res.body.decisionOutcome).toBe('ACCEPTED_HEAD_START');
    expect(res.body.passportSnapshotHash).toMatch(/^[a-f0-9]{64}$/);

    // Both side-effects must fire (in any order)
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.decisionLearningCapsule.create).toHaveBeenCalledTimes(1);

    const capsuleArgs = (prisma.decisionLearningCapsule.create as jest.Mock).mock.calls[0][0];
    expect(capsuleArgs.data.clinicianId).toBe(CLINICIAN_ID);
    expect(capsuleArgs.data.employerId).toBe(EMPLOYER_ID);
    expect(capsuleArgs.data.decisionOutcome).toBe('ACCEPTED_HEAD_START');
    expect(capsuleArgs.data.timeToDecision).toBe(47);
    expect(capsuleArgs.data.passportSnapshot.credentialTypes).toContain('STATE_BOARD_LICENSE');
  });

  it('accepts all four decisionOutcome values', async () => {
    const outcomes = ['ACCEPTED_HEAD_START', 'REQUESTED_INFO', 'ROUTED_MANUAL', 'REJECTED'];
    for (const outcome of outcomes) {
      const res = await request(app)
        .post('/api/audit/decision')
        .send({ ...validBody, decisionOutcome: outcome });
      expect(res.status).toBe(201);
    }
  });

  it('rejects an invalid decisionOutcome', async () => {
    const res = await request(app)
      .post('/api/audit/decision')
      .send({ ...validBody, decisionOutcome: 'YOLO' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/decisionOutcome/);
    expect(prisma.decisionLearningCapsule.create).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID clinicianId', async () => {
    const res = await request(app)
      .post('/api/audit/decision')
      .send({ ...validBody, clinicianId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/clinicianId/);
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it('rejects missing timeToDecision', async () => {
    const { timeToDecision: _ignored, ...withoutTime } = validBody;
    const res = await request(app).post('/api/audit/decision').send(withoutTime);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/timeToDecision/);
  });

  it('rejects missing passportSnapshot', async () => {
    const { passportSnapshot: _ignored, ...withoutSnap } = validBody;
    const res = await request(app).post('/api/audit/decision').send(withoutSnap);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/passportSnapshot/);
  });

  it('hashes the passport snapshot deterministically', async () => {
    const res1 = await request(app).post('/api/audit/decision').send(validBody);
    const res2 = await request(app).post('/api/audit/decision').send(validBody);
    expect(res1.body.passportSnapshotHash).toBe(res2.body.passportSnapshotHash);
  });

  it('returns 500 when the capsule write fails, not a partial success', async () => {
    (prisma.decisionLearningCapsule.create as jest.Mock).mockRejectedValueOnce(
      new Error('DB down'),
    );
    const res = await request(app).post('/api/audit/decision').send(validBody);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed/);
  });
});
