import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';
import crypto from 'crypto';
import { resetIntakeStore } from '../../ingest';

const CLINICIAN_ID = 'did:vitalcv:clinician-guard-1';

function recognitionPayload() {
  return {
    recognition: {
      subjectId: CLINICIAN_ID,
      employerId: 'did:vitalcv:employer-guard-1',
      recognizedAt: '2026-02-08T10:00:00.000Z',
      verification: {
        verifiedAt: '2026-02-08T09:59:00.000Z',
        verificationRef: 'verification-ref-guard-1',
      },
      expiresAt: null,
    },
  };
}

const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('acceptance/start guards', () => {
  const originalFetch = (globalThis as unknown as { fetch?: unknown }).fetch;

  beforeEach(async () => {
    resetIntakeStore();
    await prisma.auditEvent.deleteMany();
    (globalThis as unknown as { fetch?: jest.Mock }).fetch = jest.fn();
  });

  afterEach(() => {
    if (typeof originalFetch === 'function') {
      (globalThis as unknown as { fetch?: unknown }).fetch = originalFetch;
    } else {
      delete (globalThis as unknown as { fetch?: unknown }).fetch;
    }
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects EmployerAcceptance when psvReportId is missing', async () => {
    const recognition = await request(app).post('/recognitions').send(recognitionPayload());
    expect(recognition.status).toBe(201);

    const acceptance = await request(app).post('/acceptances').send({
      acceptance: {
        recognitionId: recognition.body.recognitionId,
        employerId: 'did:vitalcv:employer-guard-1',
        facilityId: 'facility:guard-1',
        acceptedAt: '2026-02-08T10:05:00.000Z',
      },
    });

    expect(acceptance.status).toBe(409);
    expect(String(acceptance.body.error)).toContain('Acceptance requires completed PSV');
    expect(acceptance.body.code).toBe('MISSING_PSV');

    const rejectionEvents = await prisma.auditEvent.findMany({
      where: { type: 'EMPLOYER_ACCEPTANCE_REJECTED' },
      orderBy: { id: 'desc' },
    });
    expect(rejectionEvents.length).toBeGreaterThanOrEqual(1);
    expect(rejectionEvents[0].metadata).toEqual(
      expect.objectContaining({
        reason: 'MISSING_PSV_REPORT_ID',
      }),
    );
  });

  it('rejects EmployerAcceptance when unresolved identity conflicts exist', async () => {
    await prisma.auditEvent.create({
      data: {
        type: 'INGEST_CONFLICT_DETECTED',
        hash: crypto.createHash('sha256').update('conflict').digest('hex'),
        clinicianId: CLINICIAN_ID,
        metadata: {
          conflict_type: 'NAME_MISMATCH',
          status: 'UNRESOLVED',
        },
        createdAt: new Date(),
      },
    });

    const recognition = await request(app).post('/recognitions').send(recognitionPayload());
    expect(recognition.status).toBe(201);

    const acceptance = await request(app).post('/acceptances').send({
      acceptance: {
        recognitionId: recognition.body.recognitionId,
        employerId: 'did:vitalcv:employer-guard-1',
        facilityId: 'facility:guard-1',
        acceptedAt: '2026-02-08T10:06:00.000Z',
        psvReportId: 'psv-report-guard-1',
      },
    });

    expect(acceptance.status).toBe(400);
    expect(acceptance.body.code).toBe('IDENTITY_CONFLICT');
  });

  it('blocks start when PSV has expired and emits START_REJECTED audit', async () => {
    const now = Date.now();
    const recognition = await request(app).post('/recognitions').send({
      recognition: {
        subjectId: CLINICIAN_ID,
        employerId: 'did:vitalcv:employer-guard-1',
        recognizedAt: new Date(now - 1_000).toISOString(),
        verification: {
          verifiedAt: new Date(now - 2_000).toISOString(),
          verificationRef: 'verification-ref-expiring-guard-1',
        },
        expiresAt: new Date(now + 2_000).toISOString(),
      },
    });
    expect(recognition.status).toBe(201);

    const acceptance = await request(app).post('/acceptances').send({
      acceptance: {
        recognitionId: recognition.body.recognitionId,
        employerId: 'did:vitalcv:employer-guard-1',
        facilityId: 'facility:guard-1',
        acceptedAt: new Date(now + 100).toISOString(),
        psvReportId: 'psv-report-expiring-guard-1',
      },
    });
    expect(acceptance.status).toBe(201);

    await new Promise((resolve) => setTimeout(resolve, 2_200));

    const start = await request(app).post('/starts').send({
      start: {
        acceptanceId: acceptance.body.acceptanceId,
        attestedAt: new Date().toISOString(),
      },
    });

    expect(start.status).toBe(409);
    expect(start.body.code).toBe('EXPIRED_PSV');
    expect(String(start.body.error)).toContain('expired');

    const rejectionEvents = await prisma.auditEvent.findMany({
      where: { type: 'START_REJECTED' },
      orderBy: { id: 'desc' },
    });
    expect(rejectionEvents.length).toBeGreaterThanOrEqual(1);
    expect(rejectionEvents[0].metadata).toEqual(
      expect.objectContaining({
        reason: 'EXPIRED_PSV',
      }),
    );
  });

  it('never returns \"Verified\" labels in trust-state timeline before PSV exists', async () => {
    const trustState = await request(app).get('/trust-state').query({
      clinician_id: CLINICIAN_ID,
    });

    expect(trustState.status).toBe(200);
    const timeline = Array.isArray(trustState.body.timeline_preview)
      ? trustState.body.timeline_preview
      : [];
    const labels = timeline.map((event: { label?: unknown }) =>
      String(event.label ?? '').toLowerCase(),
    );
    const types = timeline.map((event: { type?: unknown }) => String(event.type ?? ''));

    expect(labels.some((label: string) => label.includes('verified'))).toBe(false);
    expect(types.includes('VERIFIED')).toBe(false);
  });
});
