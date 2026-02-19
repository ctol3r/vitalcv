export { DomainError } from '@vitalcv/domain-common';
export { EmployerAcceptance, type EmployerAcceptanceInput } from './events/EmployerAcceptance';
export {
  RecognitionEvent,
  type RecognitionEventInput,
  type RecognitionRevocation,
  type RecognitionVerification,
} from './events/RecognitionEvent';
export { StartAttestation, type StartAttestationInput } from './events/StartAttestation';
export { assertCanAccept } from './guards/assertCanAccept';
export { assertCanStart } from './guards/assertCanStart';
export { subjectStatus, type SubjectStatus } from './projections/subjectStatus';
