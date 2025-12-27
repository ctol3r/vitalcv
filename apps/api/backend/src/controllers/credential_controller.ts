import { loadVcContext } from '../credential_registry';
import { PolkadotService } from '../blockchain/polkadot_service';
import { AuditScrapbook } from '../blockchain/audit_scrapbook';
import { confirmBiometric } from '../utils/biometric_auth';
import { issueSignedCredential } from '../issuer/issueCredential';
import { logAuditEvent } from '../audit/auditScrapbook';

// credential_controller.ts - demonstrates how the credential registry pallet
// integrates the W3C VC Data Model 1.0 schema.

const polkadot = new PolkadotService();
const scrapbook = new AuditScrapbook(polkadot);

export interface Credential {
  id: string;
  data?: string;
  status: string;
}

let credentials: Record<string, Credential> = {};
let nextId = 1;

export function getCredentialContext() {
  return loadVcContext();
}

export function requestCredential(data: string): Credential {
  const id = String(nextId++);
  const credential: Credential = { id, data, status: 'requested' };
  credentials[id] = credential;
  return credential;
}

export function verifyCredential(id: string): Credential {
  const credential = credentials[id];
  if (!credential) {
    throw new Error('Credential not found');
  }
  credential.status = 'verified';
  return credential;
}

export function revokeCredential(id: string): Credential {
  const credential = credentials[id];
  if (!credential) {
    throw new Error('Credential not found');
  }
  credential.status = 'revoked';
  return credential;
}

export async function issueCredential(userId: string, credential: any) {
  const subjectDid =
    credential?.subjectDid ||
    credential?.subjectId ||
    `did:key:subject-${userId}`;
  const claims =
    (credential?.claims as Record<string, unknown> | undefined) ||
    (credential?.credentialSubject as Record<string, unknown> | undefined) ||
    {};
  const issued = await issueSignedCredential({ subjectDid, claims });
  await scrapbook.recordIdentityAction(userId, 'ISSUE_CREDENTIAL');
  await logAuditEvent('ISSUE_CREDENTIAL', {
    subjectId: subjectDid,
    credentialId: issued.id,
    issuerDid: issued.credential.issuer as string,
  });
  return { userId, credential: issued.credential, jwt: issued.jwt };
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
