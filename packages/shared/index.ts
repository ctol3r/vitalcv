export * from './recognition';
export * from './receipts';
export * from './crs';
export * from './roles';
export * from './credentials';
export * from './onchain';
export * from './legacy';
export * from './pricing';

export {
  RecognitionEvent as CanonicalRecognitionEvent,
  type RecognitionEventInput as CanonicalRecognitionEventInput,
  EmployerAcceptance as CanonicalEmployerAcceptance,
  type EmployerAcceptanceInput as CanonicalEmployerAcceptanceInput,
  StartAttestation as CanonicalStartAttestation,
  type StartAttestationInput as CanonicalStartAttestationInput,
  type SignatureProof,
  buildHashAnchor,
} from '@vitalcv/domain-events';

export {
  type PsvReceiptSnapshot as CanonicalPsvReceiptSnapshot,
  CanonicalPrimitiveError,
  type CanonicalPrimitiveErrorCode,
} from '@vitalcv/domain-core';
