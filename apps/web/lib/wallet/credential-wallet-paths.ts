/**
 * Credential wallet API path builders (Wave 250 hardening).
 *
 * Centralizes + encodes the wallet API paths so user/credential identifiers can
 * never inject into the URL path (defense-in-depth) and the paths are unit
 * testable. Pure functions — no I/O.
 */

export function walletFetchPath(base: string, subject: string): string {
  return `${base}/api/credentials/wallet/${encodeURIComponent(subject)}`;
}

export function walletDeletePath(base: string, credentialId: string): string {
  return `${base}/api/credentials/${encodeURIComponent(credentialId)}`;
}
