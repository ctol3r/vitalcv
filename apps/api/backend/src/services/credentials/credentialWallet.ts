/**
 * credentialWallet.ts — Wave 94: In-Memory Credential Wallet
 *
 * Stores verifiable credentials per clinician (keyed by subject NPI/DID).
 * In-memory for now — swap to Prisma or Redis when persistence is needed.
 */

import { log } from '../../obs/logger';
import type { VerifiableCredential, CredentialStatus } from './credentialModel';

// ── Storage ───────────────────────────────────────────────────────────

/** credentialId → VerifiableCredential */
const credentialsById = new Map<string, VerifiableCredential>();

/** subject → Set<credentialId> */
const credentialsBySubject = new Map<string, Set<string>>();

// ── Public API ────────────────────────────────────────────────────────

/** Store a credential in the wallet. */
export function storeCredential(credential: VerifiableCredential): void {
  credentialsById.set(credential.credentialId, credential);

  let subjectSet = credentialsBySubject.get(credential.subject);
  if (!subjectSet) {
    subjectSet = new Set();
    credentialsBySubject.set(credential.subject, subjectSet);
  }
  subjectSet.add(credential.credentialId);

  log('info', 'wallet_store', {
    credentialId: credential.credentialId,
    subject: credential.subject,
  });
}

/** Retrieve a credential by ID. */
export function getCredential(credentialId: string): VerifiableCredential | null {
  return credentialsById.get(credentialId) ?? null;
}

/** List all credentials for a subject (clinician NPI/DID). */
export function getCredentialsForSubject(subject: string): VerifiableCredential[] {
  const ids = credentialsBySubject.get(subject);
  if (!ids) return [];
  return Array.from(ids)
    .map((id) => credentialsById.get(id))
    .filter((c): c is VerifiableCredential => c != null);
}

/** Update credential status (revoke, suspend, etc.). */
export function updateCredentialStatus(
  credentialId: string,
  status: CredentialStatus,
): VerifiableCredential | null {
  const credential = credentialsById.get(credentialId);
  if (!credential) return null;

  const updated: VerifiableCredential = { ...credential, status };
  credentialsById.set(credentialId, updated);

  log('info', 'wallet_status_update', { credentialId, status });
  return updated;
}

/** Total credential count (diagnostic). */
export function walletSize(): number {
  return credentialsById.size;
}

/** List all credentials (diagnostic / admin). */
export function listAllCredentials(): VerifiableCredential[] {
  return Array.from(credentialsById.values());
}
