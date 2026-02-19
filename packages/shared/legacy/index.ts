export { DomainError } from '../../domain-common/src/errors/DomainError';

export {
  RecognitionEvent as LegacyRecognitionEvent,
  type RecognitionEventInput as LegacyRecognitionEventInput,
  type RecognitionRevocation as LegacyRecognitionRevocation,
  type RecognitionVerification as LegacyRecognitionVerification,
} from '../../domain/events/RecognitionEvent';

export {
  EmployerAcceptance as LegacyEmployerAcceptance,
  type EmployerAcceptanceInput as LegacyEmployerAcceptanceInput,
} from '../../domain/events/EmployerAcceptance';

export {
  StartAttestation as LegacyStartAttestation,
  type StartAttestationInput as LegacyStartAttestationInput,
} from '../../domain/events/StartAttestation';
