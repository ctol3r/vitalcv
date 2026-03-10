/**
 * Wave 197 — Trust Anchor Registry
 *
 * In-memory registry with TTL-aware validity checks.
 * Supports AAMVA VICAL, Apple IACA, EU LOTL, VitalCV-native anchors.
 */

export type AnchorRootType =
  | 'AAMVA_VICAL'
  | 'APPLE_IACA'
  | 'EU_LOTL'
  | 'NATIONAL'
  | 'VITALCV';

export type AnchorStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'PENDING';

export interface TrustAnchor {
  id: string;
  name: string;
  issuerUri: string;
  publicKey: string;
  keyFormat: 'jwk' | 'pem' | 'der';
  rootType: AnchorRootType;
  status: AnchorStatus;
  validFrom: string;        // ISO-8601
  validUntil?: string;      // ISO-8601
  crl?: string;             // CRL distribution point URL
  ocsp?: string;            // OCSP responder URL
  chainHash: string;        // SHA-256 of PEM chain bytes
  metadata: Record<string, unknown>;
  lastVerifiedAt?: string;  // ISO-8601
  ttlSeconds: number;       // how long before re-verification is needed
}

const registry = new Map<string, TrustAnchor>();
const revokeReasons = new Map<string, string>();

function isExpiredByTtl(anchor: TrustAnchor): boolean {
  if (!anchor.lastVerifiedAt) return true;
  const lastVerified = new Date(anchor.lastVerifiedAt).getTime();
  return Date.now() - lastVerified > anchor.ttlSeconds * 1_000;
}

export function registerAnchor(anchor: TrustAnchor): void {
  registry.set(anchor.id, { ...anchor });
}

export function getAnchor(id: string): TrustAnchor | undefined {
  const anchor = registry.get(id);
  if (!anchor) return undefined;
  // Mark as PENDING if TTL expired
  if (anchor.status === 'ACTIVE' && isExpiredByTtl(anchor)) {
    const updated: TrustAnchor = { ...anchor, status: 'PENDING' };
    registry.set(id, updated);
    return updated;
  }
  return anchor;
}

export function listAnchors(filter?: { rootType?: AnchorRootType; status?: AnchorStatus }): TrustAnchor[] {
  const all = Array.from(registry.values()).map((anchor) => {
    // Apply TTL check on read
    if (anchor.status === 'ACTIVE' && isExpiredByTtl(anchor)) {
      const updated: TrustAnchor = { ...anchor, status: 'PENDING' };
      registry.set(anchor.id, updated);
      return updated;
    }
    return anchor;
  });

  return all.filter((a) => {
    if (filter?.rootType && a.rootType !== filter.rootType) return false;
    if (filter?.status && a.status !== filter.status) return false;
    return true;
  });
}

export function revokeAnchor(id: string, reason: string): boolean {
  const anchor = registry.get(id);
  if (!anchor) return false;
  registry.set(id, { ...anchor, status: 'REVOKED' });
  revokeReasons.set(id, reason);
  return true;
}

export function isAnchorValid(id: string): boolean {
  const anchor = getAnchor(id);
  if (!anchor) return false;
  if (anchor.status !== 'ACTIVE') return false;
  if (anchor.validUntil && new Date(anchor.validUntil).getTime() < Date.now()) return false;
  return true;
}

export function getRevokeReason(id: string): string | undefined {
  return revokeReasons.get(id);
}

export function refreshAnchorVerification(id: string): boolean {
  const anchor = registry.get(id);
  if (!anchor) return false;
  registry.set(id, {
    ...anchor,
    status: 'ACTIVE',
    lastVerifiedAt: new Date().toISOString(),
  });
  return true;
}
