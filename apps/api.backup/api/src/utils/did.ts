import crypto from 'crypto';

/**
 * Generate a mock DID for development
 * In production, this would generate a real DID using did-key or did-web
 */
export function generateDID(): string {
  const random = crypto.randomBytes(16).toString('hex');
  return `did:key:${random}`;
}

/**
 * Parse DID to extract the method-specific identifier
 */
export function parseDID(did: string): { method: string; identifier: string } | null {
  const match = did.match(/^did:([a-z]+):(.+)$/);
  if (!match) return null;

  return {
    method: match[1],
    identifier: match[2],
  };
}
