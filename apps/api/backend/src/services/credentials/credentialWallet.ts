/**
 * credentialWallet.ts — Wave 94 + 104: In-Memory Credential Wallet
 *
 * Stores verifiable credentials per clinician (keyed by subject NPI/DID).
 * Wave 104: adds listCredentials(), removeCredential(), plus expiration
 * awareness helpers for the CredentialWallet UI component.
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

// ── Wave 104 additions ────────────────────────────────────────────────

/**
 * List credentials with expiration metadata for wallet display.
 * Optionally filter by subject.
 */
export interface WalletCredentialRow {
  credential: VerifiableCredential;
  /** Days until expiration (null = no expiry set, negative = already expired) */
  daysUntilExpiry: number | null;
  /** Expiration warning level */
  expiryWarning: 'none' | 'warning' | 'critical' | 'expired';
}

export function listCredentials(subject?: string): WalletCredentialRow[] {
  const creds = subject ? getCredentialsForSubject(subject) : listAllCredentials();
  const now = Date.now();

  return creds.map((cred) => {
    if (!cred.expiresAt) {
      return { credential: cred, daysUntilExpiry: null, expiryWarning: 'none' };
    }
    const msUntil = new Date(cred.expiresAt).getTime() - now;
    const days = Math.ceil(msUntil / 86_400_000);
    let expiryWarning: WalletCredentialRow['expiryWarning'];
    if (days < 0) expiryWarning = 'expired';
    else if (days <= 7) expiryWarning = 'critical';
    else if (days <= 30) expiryWarning = 'warning';
    else expiryWarning = 'none';

    return { credential: cred, daysUntilExpiry: days, expiryWarning };
  });
}

/**
 * Remove a credential from the wallet.
 * Returns true if removed, false if not found.
 */
export function removeCredential(credentialId: string): boolean {
  const cred = credentialsById.get(credentialId);
  if (!cred) return false;

  credentialsById.delete(credentialId);

  // Also remove from subject index
  const subjectSet = credentialsBySubject.get(cred.subject);
  if (subjectSet) {
    subjectSet.delete(credentialId);
    if (subjectSet.size === 0) credentialsBySubject.delete(cred.subject);
  }

  log('info', 'wallet_remove', { credentialId, subject: cred.subject });
  return true;
}

/**
 * Wallet summary for a subject — credential counts by status and expiry.
 */
export interface WalletSummary {
  subject: string;
  total: number;
  active: number;
  expiring: number;
  expired: number;
  revoked: number;
}

export function getWalletSummary(subject: string): WalletSummary {
  const rows = listCredentials(subject);
  return {
    subject,
    total: rows.length,
    active: rows.filter((r) => r.credential.status === 'ACTIVE' && r.expiryWarning === 'none').length,
    expiring: rows.filter((r) => r.expiryWarning === 'warning' || r.expiryWarning === 'critical').length,
    expired: rows.filter((r) => r.expiryWarning === 'expired').length,
    revoked: rows.filter((r) => r.credential.status === 'REVOKED').length,
  };
}
