export type {
  CredentialAuditEvent,
  CredentialEnvelope,
  CredentialIssueRequest,
  CredentialRecord,
  CredentialStatus,
  CredentialVerificationResult,
} from '@domain/credentials';
export type { Credential } from '../../controllers/credential_controller';
export {
  getCredentialContext,
  requestCredential,
  verifyCredential,
  revokeCredential,
  issueCredential,
  signCredential,
} from '../../controllers/credential_controller';
