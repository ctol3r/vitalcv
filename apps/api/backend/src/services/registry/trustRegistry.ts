/**
 * trustRegistry.ts — Wave 95 + 105: Trust Registry + Reputation
 *
 * Maintains a registry of trusted credential issuers with their
 * public keys, trust levels, and Wave 105 reputation scores.
 * In-memory with seed data.
 */

import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type IssuerStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type TrustLevel = 'AUTHORITATIVE' | 'TRUSTED' | 'PROVISIONAL' | 'UNTRUSTED';

export interface TrustedIssuer {
  issuerId: string;
  issuerName: string;
  publicKey: string;         // SPKI PEM
  trustLevel: TrustLevel;
  status: IssuerStatus;
  registeredAt: string;
  // Wave 105: Reputation fields
  trustScore?: number;        // 0–100 calculated score
  verificationCount?: number; // Total verifications processed
  revocationCount?: number;   // Total revocations issued
  lastScoredAt?: string;      // ISO-8601 last reputation calculation
  // Wave 112: HAIP Trust Profile fields
  assuranceProfile?: string;  // e.g. 'IAL2', 'IAL3'
  algorithmPolicy?: string[]; // Allowed signing algorithms
  haipCompliant?: boolean;    // Explicitly HAIP-compliant flag
  // Wave 113: OpenID Federation
  federationEntityId?: string; // OpenID Federation entity ID
  federationTrustChain?: string[]; // Trust chain JWT strings
  federatedAt?: string;           // ISO-8601 when federated
  metadata?: Record<string, unknown>;
}

// ── Storage ───────────────────────────────────────────────────────────

const issuers = new Map<string, TrustedIssuer>();

// ── Seed data ─────────────────────────────────────────────────────────

const SEED_ISSUERS: TrustedIssuer[] = [
  {
    issuerId: 'did:vitalcv:issuer:ca-medical-board',
    issuerName: 'California Medical Board',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    trustScore: 95,
    verificationCount: 12450,
    revocationCount: 42,
    assuranceProfile: 'IAL2',
    algorithmPolicy: ['ES256', 'ES384'],
    haipCompliant: true,
    metadata: { jurisdiction: 'CA', type: 'state_medical_board', assuranceLevel: 'IAL2' },
  },
  {
    issuerId: 'did:vitalcv:issuer:abim',
    issuerName: 'American Board of Internal Medicine',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    trustScore: 97,
    verificationCount: 8320,
    revocationCount: 11,
    assuranceProfile: 'IAL3',
    algorithmPolicy: ['ES256', 'ES384'],
    haipCompliant: true,
    metadata: { type: 'specialty_board', assuranceLevel: 'IAL3' },
  },
  {
    issuerId: 'did:vitalcv:issuer:npi-registry',
    issuerName: 'NPI Registry (CMS)',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    trustScore: 99,
    verificationCount: 98000,
    revocationCount: 120,
    assuranceProfile: 'IAL3',
    algorithmPolicy: ['ES256'],
    haipCompliant: true,
    metadata: { type: 'federal_registry', assuranceLevel: 'IAL3' },
  },
  {
    issuerId: 'did:vitalcv:issuer:dea',
    issuerName: 'Drug Enforcement Administration',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    trustScore: 96,
    verificationCount: 3200,
    revocationCount: 28,
    assuranceProfile: 'IAL2',
    algorithmPolicy: ['ES256', 'ES384'],
    haipCompliant: true,
    metadata: { type: 'federal_agency', assuranceLevel: 'IAL2' },
  },
  {
    issuerId: 'did:vitalcv:issuer:vitalcv-psv',
    issuerName: 'VitalCV PSV Engine',
    publicKey: '',
    trustLevel: 'TRUSTED',
    status: 'ACTIVE',
    registeredAt: '2025-06-01T00:00:00Z',
    trustScore: 82,
    verificationCount: 1100,
    revocationCount: 5,
    assuranceProfile: 'IAL1',
    algorithmPolicy: ['ES256'],
    haipCompliant: false,
    metadata: { type: 'automated_verifier', assuranceLevel: 'IAL1' },
  },
  {
    issuerId: 'did:vitalcv:issuer:unverified-org',
    issuerName: 'Unverified Org (Demo)',
    publicKey: '',
    trustLevel: 'PROVISIONAL',
    status: 'ACTIVE',
    registeredAt: '2025-12-01T00:00:00Z',
    trustScore: 35,
    verificationCount: 12,
    revocationCount: 2,
    metadata: { type: 'provisional' },
  },
];

for (const issuer of SEED_ISSUERS) {
  issuers.set(issuer.issuerId, issuer);
}

// ── Public API ────────────────────────────────────────────────────────

export function getIssuer(issuerId: string): TrustedIssuer | null {
  return issuers.get(issuerId) ?? null;
}

export function listIssuers(): TrustedIssuer[] {
  return Array.from(issuers.values());
}

export function registerIssuer(issuer: TrustedIssuer): void {
  issuers.set(issuer.issuerId, issuer);
  log('info', 'registry_issuer_registered', {
    issuerId: issuer.issuerId,
    trustLevel: issuer.trustLevel,
  });
}

export function updateIssuerStatus(
  issuerId: string,
  status: IssuerStatus,
): TrustedIssuer | null {
  const issuer = issuers.get(issuerId);
  if (!issuer) return null;
  const updated = { ...issuer, status };
  issuers.set(issuerId, updated);
  log('info', 'registry_issuer_status_updated', { issuerId, status });
  return updated;
}

/**
 * Wave 105: Update reputation fields for an issuer.
 */
export function updateIssuerReputation(
  issuerId: string,
  reputation: { trustScore: number; verificationCount: number; revocationCount: number },
): TrustedIssuer | null {
  const issuer = issuers.get(issuerId);
  if (!issuer) return null;
  const updated: TrustedIssuer = {
    ...issuer,
    trustScore: reputation.trustScore,
    verificationCount: reputation.verificationCount,
    revocationCount: reputation.revocationCount,
    lastScoredAt: new Date().toISOString(),
  };
  issuers.set(issuerId, updated);
  return updated;
}

export function isIssuerTrusted(issuerId: string): boolean {
  const issuer = issuers.get(issuerId);
  return issuer != null && issuer.status === 'ACTIVE' && issuer.trustLevel !== 'UNTRUSTED';
}

export function registrySize(): number {
  return issuers.size;
}
