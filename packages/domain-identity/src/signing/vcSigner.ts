/**
 * VC signing service wrapper
 * Provides unified interface for signing verifiable credentials
 */

import { signVerifiableCredential, VerifiableCredential } from '../crypto/ed25519';

const ISSUER_SECRET_KEY = process.env.ISSUER_SECRET_KEY || '';
const ISSUER_VERIFICATION_METHOD = process.env.ISSUER_VERIFICATION_METHOD || 'did:key:vitalcv-issuer#key-1';

/**
 * Sign a verifiable credential with Ed25519
 */
export async function signVc(vc: VerifiableCredential) {
  if (!ISSUER_SECRET_KEY) {
    throw new Error('ISSUER_SECRET_KEY not configured');
  }

  return signVerifiableCredential(vc, ISSUER_SECRET_KEY, ISSUER_VERIFICATION_METHOD);
}

