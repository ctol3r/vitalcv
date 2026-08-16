import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';
import {
  hasUnresolvedIntakeConflicts,
  intakeSummaryForTrustState,
  resetIntakeStore,
} from '../../ingest';

const CLINICIAN_ID = 'clinician:intake:001';
const VALID_NPI = '1234567893';

function nppesResponse() {
  return {
    result_count: 1,
    results: [
      {
        number: VALID_NPI,
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Avery',
          last_name: 'Stone',
        },
        taxonomies: [
          {
            desc: 'Nurse Practitioner',
          },
        ],
        addresses: [
          {
            address_purpose: 'LOCATION',
            address_1: '100 Main St',
            city: 'Boston',
            state: 'MA',
            postal_code: '02110',
            country_code: 'US',
          },
        ],
      },
    ],
  };
}

function asBase64(content: string): string {
  return Buffer.from(content, 'utf8').toString('base64');
}

const suite = process.env.DATABASE_URL ? describe : describe.skip;

suite('ingest routes', () => {
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

  it('hydrates clinician identity from valid NPI and emits NPI_INGESTED audit', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nppesResponse(),
    });

    const response = await request(app).post('/ingest/npi').send({
      clinician_id: CLINICIAN_ID,
      npi: VALID_NPI,
    });

    expect(response.status).toBe(200);
    expect(response.body.clinician_identity).toEqual(
      expect.objectContaining({
        clinician_id: CLINICIAN_ID,
        npi: VALID_NPI,
        first_name: 'Avery',
        last_name: 'Stone',
        status: 'UNVERIFIED',
        source: 'NPPES',
        licenses: expect.any(Array),
      }),
    );
    expect(typeof response.body.audit_ref).toBe('string');

    const auditEvents = await prisma.auditEvent.findMany({
      where: { type: 'NPI_INGESTED' },
    });
    expect(auditEvents).toHaveLength(1);
  });

  it('rejects invalid NPI checksum and emits NPI_VALIDATION_FAILED audit', async () => {
    const response = await request(app).post('/ingest/npi').send({
      clinician_id: CLINICIAN_ID,
      npi: '1234567890',
    });

    expect(response.status).toBe(400);
    expect(String(response.body.error)).toContain('checksum');

    const checksumEvents = await prisma.auditEvent.findMany({
      where: { type: 'NPI_VALIDATION_FAILED' },
      orderBy: { id: 'desc' },
    });
    expect(checksumEvents.length).toBeGreaterThanOrEqual(1);
    expect(checksumEvents[0].metadata).toEqual(
      expect.objectContaining({
        npi: '1234567890',
        reason: 'INVALID_NPI_CHECKSUM',
      }),
    );

    const errorEvents = await prisma.auditEvent.findMany({
      where: { type: 'INGEST_ERROR' },
      orderBy: { id: 'desc' },
    });
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].metadata).toEqual(
      expect.objectContaining({
        route: '/ingest/npi',
      }),
    );
  });

  it('parses resume upload and returns UNVERIFIED candidate credentials with multi-license support', async () => {
    const resumeText = [
      'Taylor Wrong',
      'Education: University of Example',
      'Training: Internal Medicine Residency',
      'Licensure: Active RN license MA LICENSE #RN12345',
      'Licensure: Active RN license NY LICENSE #RN67890',
      'Employment: 2020-2024 Example Hospital',
    ].join('\n');

    const response = await request(app).post('/ingest/files').send({
      clinician_id: CLINICIAN_ID,
      files: [
        {
          filename: 'resume.pdf',
          mime_type: 'application/pdf',
          content_base64: asBase64(resumeText),
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.candidate_credentials)).toBe(true);
    expect(response.body.candidate_credentials).toHaveLength(1);
    expect(response.body.candidate_credentials[0]).toEqual(
      expect.objectContaining({
        clinician_id: CLINICIAN_ID,
        status: 'UNVERIFIED',
        source: 'resume_upload',
        licenses: expect.arrayContaining([
          expect.objectContaining({ state: 'MA', source: 'resume', status: 'UNVERIFIED' }),
          expect.objectContaining({ state: 'NY', source: 'resume', status: 'UNVERIFIED' }),
        ]),
      }),
    );

    const fileEvents = await prisma.auditEvent.findMany({
      where: { type: 'FILE_INGESTED' },
    });
    expect(fileEvents).toHaveLength(1);

    const summaryEvents = await prisma.auditEvent.findMany({
      where: { type: 'INGEST_PARSE_SUMMARY' },
    });
    expect(summaryEvents).toHaveLength(1);

    const conflictEvents = await prisma.auditEvent.findMany({
      where: { type: 'INGEST_CONFLICT_DETECTED' },
    });
    expect(conflictEvents.length).toBeGreaterThanOrEqual(1);

    const replay = await request(app).post('/ingest/files').send({
      clinician_id: CLINICIAN_ID,
      files: [
        {
          filename: 'resume.pdf',
          mime_type: 'application/pdf',
          content_base64: asBase64(resumeText),
        },
      ],
    });
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    expect(replay.body.total_candidate_credentials).toBe(1);
  });

  // Ingestion is intake only, never a trust mutation. These two cases used to
  // observe that through the wedge lane's GET /trust-state read (retired with
  // routes/wedge.ts under ADR 0007); the invariant outlives the surface, so
  // they now observe the intake reflection directly and assert that no trust
  // or decision record of any kind is written by ingest.
  it('adds intake reflection after ingestion without writing any trust or decision record', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => nppesResponse(),
    });

    await request(app).post('/ingest/npi').send({
      clinician_id: CLINICIAN_ID,
      npi: VALID_NPI,
    });

    await request(app).post('/ingest/files').send({
      clinician_id: CLINICIAN_ID,
      files: [
        {
          filename: 'resume.docx',
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          content_base64: asBase64('Education: School\nEmployment: 2021 Clinic'),
        },
      ],
    });

    // Intake reflection recorded the ingest…
    expect(intakeSummaryForTrustState(CLINICIAN_ID)).toEqual(
      expect.objectContaining({
        clinician_id: CLINICIAN_ID,
        identities_count: 1,
        candidate_credentials_count: 1,
      }),
    );
    // …including the name mismatch between NPPES and the resume, which must
    // surface as an unresolved conflict, never be silently reconciled.
    expect(hasUnresolvedIntakeConflicts(CLINICIAN_ID)).toBe(true);

    // …and nothing was written to any trust or decision record: neither the
    // parallel wedge models nor the canonical decision rows.
    expect(await prisma.recognition.count({ where: { subjectId: CLINICIAN_ID } })).toBe(0);
    expect(await prisma.acceptance.count({ where: { subjectId: CLINICIAN_ID } })).toBe(0);
    expect(await prisma.start.count({ where: { subjectId: CLINICIAN_ID } })).toBe(0);
    expect(await prisma.employerAcceptance.count({ where: { clinicianNpi: VALID_NPI } })).toBe(0);
    expect(await prisma.startActivation.count({ where: { clinicianNpi: VALID_NPI } })).toBe(0);
    expect(await prisma.auditEvent.count({
      where: { type: { in: ['START_ATTESTED', 'START_RECORDED', 'EMPLOYER_REVIEW_ACCEPTED'] } },
    })).toBe(0);
  });

  it('ingest errors write no trust or decision record and return correct error codes', async () => {
    const unsupported = await request(app).post('/ingest/files').send({
      clinician_id: CLINICIAN_ID,
      files: [
        {
          filename: 'notes.txt',
          mime_type: 'text/plain',
          content_base64: asBase64('unsupported'),
        },
      ],
    });
    expect(unsupported.status).toBe(415);

    // The failed ingest left no intake reflection…
    expect(intakeSummaryForTrustState(CLINICIAN_ID)).toEqual(
      expect.objectContaining({
        identities_count: 0,
        candidate_credentials_count: 0,
      }),
    );
    // …and no trust or decision record of any kind.
    expect(await prisma.recognition.count({ where: { subjectId: CLINICIAN_ID } })).toBe(0);
    expect(await prisma.acceptance.count({ where: { subjectId: CLINICIAN_ID } })).toBe(0);
    expect(await prisma.start.count({ where: { subjectId: CLINICIAN_ID } })).toBe(0);
    expect(await prisma.auditEvent.count({
      where: { type: { in: ['START_ATTESTED', 'START_RECORDED', 'EMPLOYER_REVIEW_ACCEPTED'] } },
    })).toBe(0);

    const errorEvents = await prisma.auditEvent.findMany({
      where: { type: 'INGEST_ERROR' },
      orderBy: { id: 'desc' },
    });
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    expect(errorEvents[0].metadata).toEqual(
      expect.objectContaining({
        route: '/ingest/files',
      }),
    );
  });
});
