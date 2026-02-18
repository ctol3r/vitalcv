import request from 'supertest';
import app from '../src/app';
import prisma from '../src/graphql/prisma_client';

const EMPLOYER_DID = 'did:example:employer';
const PRACTITIONER_DID = 'did:example:practitioner';
const ROLE_ID = 'role:registered-nurse';
const FACILITY_ID = 'facility:alpha';

type CanonicalEventType =
  | 'RECOGNITION_EMITTED'
  | 'RECOGNITION_REVOKED'
  | 'ACCEPTANCE_EMITTED'
  | 'START_EMITTED';

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(',')}}`;
}

function canonicalEventHash(
  eventType: CanonicalEventType,
  payload: Record<string, unknown>,
): string {
  return require('crypto')
    .createHash('sha256')
    .update(stableStringify({ eventType, payload }))
    .digest('hex');
}

function extractEventTimestamp(
  eventType: CanonicalEventType,
  payload: Record<string, unknown>,
): string {
  switch (eventType) {
    case 'RECOGNITION_EMITTED':
      return String(payload.recognizedAt || '');
    case 'ACCEPTANCE_EMITTED':
      return String(payload.acceptedAt || '');
    case 'START_EMITTED':
      return String(payload.attestedAt || '');
    case 'RECOGNITION_REVOKED':
      return String(payload.revokedAt || '');
    default:
      return '';
  }
}

function extractSubjectDid(payload: Record<string, unknown>): string {
  const subjectDid =
    (payload.practitionerDid as string | undefined) ||
    (payload.subjectDid as string | undefined) ||
    '';
  return String(subjectDid || '').trim();
}

function buildCanonicalMetadata(eventType: CanonicalEventType, payload: Record<string, unknown>) {
  const eventTimestamp = extractEventTimestamp(eventType, payload);
  const subjectDid = extractSubjectDid(payload);
  const eventHash = canonicalEventHash(eventType, payload);

  return {
    eventTimestamp,
    subjectDid,
    eventHash,
    recognitionId: payload.recognitionId ?? null,
    acceptanceId: payload.acceptanceId ?? null,
    attestationId: payload.attestationId ?? null,
    facilityId: payload.facilityId ?? null,
    roleId: payload.roleId ?? null,
    payload,
  };
}

async function insertCanonicalEvent(
  eventType: CanonicalEventType,
  payload: Record<string, unknown>,
  credentialId: string,
) {
  const metadata = buildCanonicalMetadata(eventType, payload);
  await prisma.auditEvent.create({
    data: {
      type: eventType,
      hash: metadata.eventHash,
      clinicianId: credentialId,
      metadata: JSON.parse(JSON.stringify(metadata)),
      createdAt: new Date(),
    },
  });
}

function createProof(did: string, created: string) {
  return {
    type: 'Ed25519Signature2020',
    created,
    verificationMethod: `${did}#key-1`,
    proofPurpose: 'assertionMethod',
    proofValue: `proof-${did}`,
  };
}

function createRecognition(overrides: Record<string, unknown> = {}) {
  return {
    recognitionId: 'rec-001',
    employerDid: EMPLOYER_DID,
    practitionerDid: PRACTITIONER_DID,
    roleId: ROLE_ID,
    recognizedAt: '2025-01-01T10:00:00.000Z',
    verification: {
      verifiedAt: '2025-01-01T09:55:00.000Z',
      verificationRef: 'verification-ref-001',
    },
    proof: createProof(EMPLOYER_DID, '2025-01-01T10:00:00.000Z'),
    hashAnchor: 'hash-recognition',
    ...overrides,
  };
}

function createAcceptance(recognitionId: string, overrides: Record<string, unknown> = {}) {
  return {
    acceptanceId: 'acc-001',
    recognitionId,
    employerDid: EMPLOYER_DID,
    practitionerDid: PRACTITIONER_DID,
    roleId: ROLE_ID,
    facilityId: FACILITY_ID,
    acceptedAt: '2025-01-02T10:00:00.000Z',
    countersignedAt: '2025-01-02T11:00:00.000Z',
    agreedStartDate: '2025-01-15T00:00:00.000Z',
    practitionerProof: createProof(PRACTITIONER_DID, '2025-01-02T10:00:00.000Z'),
    employerProof: createProof(EMPLOYER_DID, '2025-01-02T11:00:00.000Z'),
    hashAnchor: 'hash-acceptance',
    validity: {
      validFrom: '2025-01-02T10:00:00.000Z',
      validUntil: '2025-02-01T10:00:00.000Z',
    },
    terms: {
      roleTitle: 'Registered Nurse',
      schedule: 'full-time',
    },
    psvReportId: 'psv-report-001',
    ...overrides,
  };
}

function createStart(
  recognitionId: string,
  acceptanceId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    attestationId: 'start-001',
    recognitionId,
    acceptanceId,
    employerDid: EMPLOYER_DID,
    practitionerDid: PRACTITIONER_DID,
    roleId: ROLE_ID,
    facilityId: FACILITY_ID,
    actualStartDate: '2025-01-15T08:00:00.000Z',
    attestedAt: '2025-01-15T09:00:00.000Z',
    proof: createProof(EMPLOYER_DID, '2025-01-15T09:00:00.000Z'),
    hashAnchor: 'hash-start',
    employmentDetails: {
      roleTitle: 'Registered Nurse',
      schedule: 'full-time',
    },
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.auditEvent.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('canonical wedge API', () => {
  it('Acceptance without Recognition fails', async () => {
    const acceptance = createAcceptance('rec-missing');
    const res = await request(app).post('/acceptances').send({ acceptance });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('RecognitionEvent not found');
  });

  it('Start without Acceptance fails', async () => {
    const recognition = createRecognition();
    await request(app).post('/recognitions').send({ recognition });

    const start = createStart(recognition.recognitionId, 'acc-missing');
    const res = await request(app).post('/starts').send({ start });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('EmployerAcceptance not found');
  });

  it('Start without Recognition fails', async () => {
    const acceptance = createAcceptance('rec-missing');
    await insertCanonicalEvent('ACCEPTANCE_EMITTED', acceptance, acceptance.acceptanceId);

    const start = createStart(acceptance.recognitionId, acceptance.acceptanceId);
    const res = await request(app).post('/starts').send({ start });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('RecognitionEvent not found');
  });

  it('Revoked Recognition blocks Acceptance', async () => {
    const recognition = createRecognition();
    await request(app).post('/recognitions').send({ recognition });

    await insertCanonicalEvent(
      'RECOGNITION_REVOKED',
      {
        recognitionId: recognition.recognitionId,
        revokedAt: '2025-01-02T12:00:00.000Z',
        revocationRef: 'revocation-ref-001',
        subjectDid: recognition.practitionerDid,
      },
      recognition.recognitionId,
    );

    const acceptance = createAcceptance(recognition.recognitionId);
    const res = await request(app).post('/acceptances').send({ acceptance });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('revoked');
  });

  it('Event replay is deterministic', async () => {
    const recognition = createRecognition({ recognitionId: 'rec-010' });
    const acceptance = createAcceptance(recognition.recognitionId, { acceptanceId: 'acc-010' });
    const start = createStart(recognition.recognitionId, acceptance.acceptanceId, {
      attestationId: 'start-010',
    });

    await insertCanonicalEvent('START_EMITTED', start, start.attestationId);
    await insertCanonicalEvent('ACCEPTANCE_EMITTED', acceptance, acceptance.acceptanceId);
    await insertCanonicalEvent('RECOGNITION_EMITTED', recognition, recognition.recognitionId);

    const first = await request(app).get(`/status/${PRACTITIONER_DID}`);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe('started');
    const firstHash = first.body.eventReplayHash;

    await prisma.auditEvent.deleteMany();
    await insertCanonicalEvent('RECOGNITION_EMITTED', recognition, recognition.recognitionId);
    await insertCanonicalEvent('ACCEPTANCE_EMITTED', acceptance, acceptance.acceptanceId);
    await insertCanonicalEvent('START_EMITTED', start, start.attestationId);

    const second = await request(app).get(`/status/${PRACTITIONER_DID}`);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe('started');
    expect(second.body.eventReplayHash).toBe(firstHash);
  });
});
