/**
 * CredentialRepository
 * Handles credential data fetching and caching
 */

import { getJSON } from '@/components/api/http';
import type { CredentialDetail } from '@/lib/wallet-api';

export interface Credential {
  id: string;
  type: string;
  issuer: {
    id: string;
    name: string;
    trustTier?: 'verified' | 'trusted' | 'unverified';
    trustBadge?: string;
  };
  subject: {
    id: string;
    claims: Record<string, any>;
  };
  status: 'valid' | 'expiring' | 'revoked' | 'expired';
  issuedAt: string;
  expiresAt?: string;
  proofLink?: string;
  schemaId?: string;
  metadata?: {
    issuerLogo?: string;
    description?: string;
    icon?: string;
  };
  riskScore?: number;
  trustScore?: number;
  sensitiveFields?: string[];
  fieldCategories?: {
    id?: string[];
    license?: string[];
    cert?: string[];
    practice?: string[];
  };
}

export class CredentialRepository {
  private cache = new Map<string, { data: Credential; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getCredential(id: string): Promise<Credential> {
    // Check cache first
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const data = await getJSON<CredentialDetail>(`/api/wallet/credentials/${id}`);

      // Transform to our enhanced Credential type
      const credential: Credential = {
        ...data,
        issuer: {
          ...data.issuer,
          trustTier: this.inferTrustTier(data),
          trustBadge: this.getTrustBadge(data),
        },
        sensitiveFields: this.identifySensitiveFields(data),
        fieldCategories: this.categorizeFields(data),
      };

      // Cache the result
      this.cache.set(id, { data: credential, timestamp: Date.now() });
      return credential;
    } catch (error) {
      console.error(`[CredentialRepository] Failed to fetch credential ${id}:`, error);
      throw error;
    }
  }

  clearCache(id?: string): void {
    if (id) {
      this.cache.delete(id);
    } else {
      this.cache.clear();
    }
  }

  private inferTrustTier(credential: CredentialDetail): 'verified' | 'trusted' | 'unverified' {
    // Logic to determine issuer trust tier
    if (credential.proofData) return 'verified';
    if (credential.issuer.name.includes('Board') || credential.issuer.name.includes('Medical')) {
      return 'trusted';
    }
    return 'unverified';
  }

  private getTrustBadge(credential: CredentialDetail): string | undefined {
    if (credential.proofData) return 'Anchored';
    if (credential.issuer.name.includes('Board')) return 'Verified Issuer';
    return undefined;
  }

  private identifySensitiveFields(credential: CredentialDetail): string[] {
    const sensitive: string[] = [];
    const claims = credential.subject.claims;

    // Common sensitive field patterns
    const sensitivePatterns = [
      /ssn|social.*security/i,
      /dob|date.*birth/i,
      /passport|drivers.*license/i,
      /address|street|city/i,
      /phone|email/i,
    ];

    Object.keys(claims).forEach((key) => {
      if (sensitivePatterns.some((pattern) => pattern.test(key))) {
        sensitive.push(key);
      }
    });

    return sensitive;
  }

  private categorizeFields(credential: CredentialDetail): {
    id?: string[];
    license?: string[];
    cert?: string[];
    practice?: string[];
  } {
    const categories: {
      id?: string[];
      license?: string[];
      cert?: string[];
      practice?: string[];
    } = {};

    const claims = credential.subject.claims;
    const idFields = ['npi', 'id', 'identifier', 'memberId'];
    const licenseFields = ['license', 'licenseNumber', 'licenseType', 'state'];
    const certFields = ['certification', 'certificationNumber', 'board', 'specialty'];
    const practiceFields = ['practice', 'facility', 'organization', 'employer'];

    Object.keys(claims).forEach((key) => {
      const lowerKey = key.toLowerCase();
      if (idFields.some((f) => lowerKey.includes(f))) {
        categories.id = categories.id || [];
        categories.id.push(key);
      } else if (licenseFields.some((f) => lowerKey.includes(f))) {
        categories.license = categories.license || [];
        categories.license.push(key);
      } else if (certFields.some((f) => lowerKey.includes(f))) {
        categories.cert = categories.cert || [];
        categories.cert.push(key);
      } else if (practiceFields.some((f) => lowerKey.includes(f))) {
        categories.practice = categories.practice || [];
        categories.practice.push(key);
      }
    });

    return categories;
  }
}

export const credentialRepository = new CredentialRepository();

