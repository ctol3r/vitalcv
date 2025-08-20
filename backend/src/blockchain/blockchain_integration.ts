export type CredentialStatus = 'valid' | 'revoked';

/**
 * Placeholder blockchain check implementation.
 * In a real system this would query the on-chain credential registry.
 */
export async function checkCredentialStatus(
  credentialId: string
): Promise<CredentialStatus> {
  // TODO: Integrate with actual Polkadot or other blockchain service.
  // For now always return 'valid'.
  return 'valid';
}
