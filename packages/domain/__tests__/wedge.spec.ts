import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { EmployerAcceptance, type EmployerAcceptanceInput } from '../events/EmployerAcceptance';
import { RecognitionEvent, type RecognitionEventInput } from '../events/RecognitionEvent';
import { StartAttestation, type StartAttestationInput } from '../events/StartAttestation';
import { assertCanAccept } from '../guards/assertCanAccept';
import { assertCanStart } from '../guards/assertCanStart';
import { subjectStatus } from '../projections/subjectStatus';

const SUBJECT_ID = 'did:example:subject';
const EMPLOYER_ID = 'did:example:employer';
const FACILITY_ID = 'facility:alpha';

function createRecognition(overrides: Partial<RecognitionEventInput> = {}) {
  return new RecognitionEvent({
    subjectId: SUBJECT_ID,
    employerId: EMPLOYER_ID,
    recognizedAt: '2025-01-01T10:00:00.000Z',
    verification: {
      verifiedAt: '2025-01-01T09:55:00.000Z',
      verificationRef: 'verification-ref-001',
    },
    expiresAt: null,
    revocation: null,
    ...overrides,
  });
}

function createAcceptance(
  recognition: RecognitionEvent,
  overrides: Partial<EmployerAcceptanceInput> = {},
) {
  assertCanAccept(recognition);
  return new EmployerAcceptance({
    recognitionId: recognition.recognitionId,
    subjectId: recognition.subjectId,
    employerId: recognition.employerId,
    facilityId: FACILITY_ID,
    acceptedAt: '2025-01-02T10:00:00.000Z',
    ...overrides,
  });
}

function createStart(
  acceptance: EmployerAcceptance,
  overrides: Partial<StartAttestationInput> = {},
  priorStarts: StartAttestation[] = [],
) {
  assertCanStart(acceptance, priorStarts);
  return new StartAttestation({
    acceptanceId: acceptance.acceptanceId,
    subjectId: acceptance.subjectId,
    employerId: acceptance.employerId,
    attestedAt: '2025-01-03T10:00:00.000Z',
    ...overrides,
  });
}

describe('Wedge domain invariants', () => {
  it('Start without Recognition → throws', () => {
    expect(() => {
      const missingRecognition = undefined as unknown as RecognitionEvent;
      const acceptance = createAcceptance(missingRecognition);
      createStart(acceptance);
    }).toThrow(DomainError);
  });

  it('Acceptance without Recognition → throws', () => {
    expect(() => assertCanAccept(undefined)).toThrow(DomainError);
  });

  it('Start without Acceptance → throws', () => {
    expect(() => assertCanStart(undefined, [])).toThrow(DomainError);
  });

  it('Recognition without verification → throws', () => {
    expect(
      () =>
        new RecognitionEvent({
          subjectId: SUBJECT_ID,
          employerId: EMPLOYER_ID,
          recognizedAt: '2025-01-01T10:00:00.000Z',
          verification: undefined as unknown as RecognitionEventInput['verification'],
          expiresAt: null,
          revocation: null,
        }),
    ).toThrow(DomainError);
  });

  it('Acceptance without facilityId → throws', () => {
    const recognition = createRecognition();
    expect(
      () =>
        new EmployerAcceptance({
          recognitionId: recognition.recognitionId,
          subjectId: recognition.subjectId,
          employerId: recognition.employerId,
          facilityId: '',
          acceptedAt: '2025-01-02T10:00:00.000Z',
        }),
    ).toThrow(DomainError);
  });

  it('Event replay produces same status', () => {
    const recognition1 = createRecognition({ recognizedAt: '2025-01-01T10:00:00.000Z' });
    const recognition2 = createRecognition({ recognizedAt: '2025-02-01T10:00:00.000Z' });
    const acceptance = new EmployerAcceptance({
      recognitionId: recognition2.recognitionId,
      subjectId: recognition2.subjectId,
      employerId: recognition2.employerId,
      facilityId: FACILITY_ID,
      acceptedAt: '2025-02-02T10:00:00.000Z',
    });
    const start = new StartAttestation({
      acceptanceId: acceptance.acceptanceId,
      subjectId: acceptance.subjectId,
      employerId: acceptance.employerId,
      attestedAt: '2025-02-03T10:00:00.000Z',
    });

    const statusA = subjectStatus({
      recognitions: [recognition1, recognition2],
      acceptances: [acceptance],
      starts: [start],
    });
    const statusB = subjectStatus({
      recognitions: [recognition2, recognition1],
      acceptances: [acceptance],
      starts: [start],
    });

    expect(statusA).toEqual(statusB);
    expect(statusA).toMatchObject({
      recognized: true,
      accepted: true,
      started: true,
      recognitionId: recognition2.recognitionId,
      acceptanceId: acceptance.acceptanceId,
      startId: start.startId,
    });
  });
});
