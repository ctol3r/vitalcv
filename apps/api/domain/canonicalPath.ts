import {
  CanonicalPrimitiveError,
  type PsvReceiptSnapshot,
} from '../../../packages/domain-core';
import {
  EmployerAcceptance,
  type EmployerAcceptanceInput,
  RecognitionEvent,
  type RecognitionEventInput,
  StartAttestation,
  type StartAttestationInput,
} from '../../../packages/domain-events';

export class CanonicalPathService {
  private readonly recognitions = new Map<string, RecognitionEvent>();
  private readonly acceptances = new Map<string, EmployerAcceptance>();
  private readonly acceptanceByRecognitionId = new Map<string, EmployerAcceptance>();
  private readonly startsByAcceptanceId = new Map<string, StartAttestation>();
  private readonly startByRecognitionId = new Map<string, StartAttestation>();

  createRecognition(input: RecognitionEventInput): RecognitionEvent {
    const recognition = new RecognitionEvent(input);

    if (this.recognitions.has(recognition.recognitionId)) {
      throw new CanonicalPrimitiveError('RecognitionEvent already exists', 'INVALID_REFERENCE', {
        recognitionId: recognition.recognitionId,
      });
    }

    this.recognitions.set(recognition.recognitionId, recognition);
    return recognition;
  }

  createAcceptance(
    input: Omit<EmployerAcceptanceInput, 'recognition'> & { recognitionId: string },
  ): EmployerAcceptance {
    const recognition = this.recognitions.get(input.recognitionId);
    if (!recognition) {
      throw new CanonicalPrimitiveError(
        'EmployerAcceptance requires an existing RecognitionEvent',
        'INVALID_REFERENCE',
        { recognitionId: input.recognitionId },
      );
    }

    const acceptance = new EmployerAcceptance({
      acceptanceId: input.acceptanceId,
      recognition,
      facilityId: input.facilityId,
      acceptedAt: input.acceptedAt,
      countersignedAt: input.countersignedAt,
      countersignedByEmployer: input.countersignedByEmployer,
    });

    if (this.acceptanceByRecognitionId.has(recognition.recognitionId)) {
      throw new CanonicalPrimitiveError(
        'Parallel acceptance paths are not allowed for a recognition',
        'INVALID_REFERENCE',
        { recognitionId: recognition.recognitionId },
      );
    }

    if (this.acceptances.has(acceptance.acceptanceId)) {
      throw new CanonicalPrimitiveError('EmployerAcceptance already exists', 'INVALID_REFERENCE', {
        acceptanceId: acceptance.acceptanceId,
      });
    }

    this.acceptances.set(acceptance.acceptanceId, acceptance);
    this.acceptanceByRecognitionId.set(acceptance.recognitionId, acceptance);
    return acceptance;
  }

  createStart(
    input: Omit<StartAttestationInput, 'acceptance'> & { acceptanceId: string },
  ): StartAttestation {
    const acceptance = this.acceptances.get(input.acceptanceId);
    if (!acceptance) {
      throw new CanonicalPrimitiveError(
        'StartAttestation requires an existing EmployerAcceptance',
        'INVALID_REFERENCE',
        { acceptanceId: input.acceptanceId },
      );
    }

    if (this.startsByAcceptanceId.has(input.acceptanceId)) {
      throw new CanonicalPrimitiveError('StartAttestation already exists for acceptance', 'START_EXISTS', {
        acceptanceId: input.acceptanceId,
      });
    }

    if (this.startByRecognitionId.has(acceptance.recognitionId)) {
      throw new CanonicalPrimitiveError(
        'Parallel start paths are not allowed for a recognition',
        'START_EXISTS',
        { recognitionId: acceptance.recognitionId },
      );
    }

    const start = new StartAttestation({
      startId: input.startId,
      acceptance,
      attestedAt: input.attestedAt,
      crsScore: input.crsScore,
    });

    this.startsByAcceptanceId.set(input.acceptanceId, start);
    this.startByRecognitionId.set(start.recognitionId, start);
    return start;
  }

  getRecognition(recognitionId: string): RecognitionEvent | null {
    return this.recognitions.get(recognitionId) ?? null;
  }

  getAcceptance(acceptanceId: string): EmployerAcceptance | null {
    return this.acceptances.get(acceptanceId) ?? null;
  }

  getStartForAcceptance(acceptanceId: string): StartAttestation | null {
    return this.startsByAcceptanceId.get(acceptanceId) ?? null;
  }

  static createPsvReceiptSnapshot(input: {
    receiptId: string;
    fetchedAt: string;
    ttlSeconds: number;
    revoked?: boolean;
  }): PsvReceiptSnapshot {
    return Object.freeze({
      receiptId: input.receiptId,
      fetchedAt: input.fetchedAt,
      ttlSeconds: input.ttlSeconds,
      revoked: Boolean(input.revoked),
    });
  }
}
