import { checkCredentialStatus, CredentialStatus } from '../blockchain/blockchain_integration';

export async function getCredentialStatus(credentialId: string): Promise<CredentialStatus> {
  return checkCredentialStatus(credentialId);
}
