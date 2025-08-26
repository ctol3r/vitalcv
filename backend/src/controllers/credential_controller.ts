import { loadVcContext } from '../credential_registry';
import { PolkadotService } from '../blockchain/polkadot_service';
import { AuditScrapbook } from '../blockchain/audit_scrapbook';
import { confirmBiometric } from '../utils/biometric_auth';

// credential_controller.ts - demonstrates how the credential registry pallet
// integrates the W3C VC Data Model 1.0 schema.

const polkadot = new PolkadotService();
const scrapbook = new AuditScrapbook(polkadot);

export function getCredentialContext() {
  return loadVcContext();
}

export async function issueCredential(userId: string, credential: any) {
    // Placeholder for logic that would issue a credential
    await scrapbook.recordIdentityAction(userId, 'ISSUE_CREDENTIAL');
    return { userId, credential };
}

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
