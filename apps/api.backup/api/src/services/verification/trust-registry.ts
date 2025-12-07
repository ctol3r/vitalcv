/**
 * Trust Registry Service
 * Tagged: cursor-batch-1105 (Task 0004)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Manages trusted issuers per credential schema type
 */

import { IssuerTrustError } from '../../lib/http/errors';

export interface TrustedIssuer {
  did: string;
  name: string;
  schemaTypes: string[]; // Which credential types this issuer can issue
  addedAt: Date;
  addedBy?: string;
  metadata?: Record<string, any>;
}

/**
 * In-memory trust registry (will be replaced with DB in Task 0013)
 */
class TrustRegistry {
  private trustedIssuers: Map<string, TrustedIssuer> = new Map();
  private schemaTypeIndex: Map<string, Set<string>> = new Map(); // schemaType -> Set<issuerDid>

  /**
   * Add a trusted issuer for specific schema types
   */
  addIssuer(issuer: TrustedIssuer): void {
    this.trustedIssuers.set(issuer.did, issuer);

    // Update schema type index
    for (const schemaType of issuer.schemaTypes) {
      if (!this.schemaTypeIndex.has(schemaType)) {
        this.schemaTypeIndex.set(schemaType, new Set());
      }
      this.schemaTypeIndex.get(schemaType)!.add(issuer.did);
    }
  }

  /**
   * Remove a trusted issuer
   */
  removeIssuer(issuerDid: string): boolean {
    const issuer = this.trustedIssuers.get(issuerDid);
    if (!issuer) {
      return false;
    }

    // Remove from schema type index
    for (const schemaType of issuer.schemaTypes) {
      const issuers = this.schemaTypeIndex.get(schemaType);
      if (issuers) {
        issuers.delete(issuerDid);
        if (issuers.size === 0) {
          this.schemaTypeIndex.delete(schemaType);
        }
      }
    }

    this.trustedIssuers.delete(issuerDid);
    return true;
  }

  /**
   * Check if an issuer is trusted for a specific schema type
   */
  isTrusted(issuerDid: string, schemaType: string): boolean {
    const issuers = this.schemaTypeIndex.get(schemaType);
    return issuers ? issuers.has(issuerDid) : false;
  }

  /**
   * Get all trusted issuers for a schema type
   */
  getIssuersForSchemaType(schemaType: string): TrustedIssuer[] {
    const issuerDids = this.schemaTypeIndex.get(schemaType);
    if (!issuerDids) {
      return [];
    }

    return Array.from(issuerDids)
      .map((did) => this.trustedIssuers.get(did))
      .filter((issuer): issuer is TrustedIssuer => issuer !== undefined);
  }

  /**
   * Get issuer info
   */
  getIssuer(issuerDid: string): TrustedIssuer | undefined {
    return this.trustedIssuers.get(issuerDid);
  }

  /**
   * List all trusted issuers
   */
  listIssuers(): TrustedIssuer[] {
    return Array.from(this.trustedIssuers.values());
  }
}

// Global registry instance
const registry = new TrustRegistry();

// Seed with default trusted issuers (TODO: load from DB)
registry.addIssuer({
  did: 'did:chai:issuer',
  name: 'Chai Platform Default Issuer',
  schemaTypes: ['NPICredential', 'LicenseCredential'],
  addedAt: new Date(),
});

/**
 * Verify that an issuer is trusted for a schema type
 *
 * @throws IssuerTrustError if issuer is not trusted
 */
export function verifyIssuerTrust(
  issuerDid: string,
  schemaType: string,
  policyId?: string,
): void {
  if (!registry.isTrusted(issuerDid, schemaType)) {
    throw new IssuerTrustError(
      `Issuer ${issuerDid} is not trusted for credential type ${schemaType}`,
      {
        issuerDid,
        schemaType,
        policyId,
      },
    );
  }
}

/**
 * Check if issuer is trusted (non-throwing)
 */
export function isIssuerTrusted(issuerDid: string, schemaType: string): boolean {
  return registry.isTrusted(issuerDid, schemaType);
}

/**
 * Get the trust registry instance
 */
export function getTrustRegistry(): TrustRegistry {
  return registry;
}

export { TrustRegistry };

