import { confirmBiometric } from '../utils/biometric_auth';

/**
 * Signs a verifiable credential after confirming device biometrics.
 * This is a stub implementation for the Chai VC platform.
 */
export async function signCredential(vcData: unknown): Promise<unknown> {
  const confirmed = await confirmBiometric();
  if (!confirmed) {
    throw new Error('Biometric confirmation failed');
  }
  // TODO: integrate actual VC signing logic here
  console.log('VC signed');
  return vcData;
}
