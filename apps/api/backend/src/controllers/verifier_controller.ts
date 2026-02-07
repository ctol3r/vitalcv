/**
 * Legacy verifier controller.
 * Disabled for MVP and YC demo.
 */
export type CredentialStatus = 'valid' | 'revoked';

export async function getCredentialStatus(_credentialId: string): Promise<CredentialStatus> {
  throw new Error('Legacy verifier controller is disabled for MVP and YC demo');
}
