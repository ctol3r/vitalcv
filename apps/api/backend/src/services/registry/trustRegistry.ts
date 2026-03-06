/**
 * trustRegistry.ts — Wave 95: Trust Registry
 *
 * Maintains a registry of trusted credential issuers with their
 * public keys and trust levels. In-memory with seed data.
 */

import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type IssuerStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
export type TrustLevel = 'AUTHORITATIVE' | 'TRUSTED' | 'PROVISIONAL' | 'UNTRUSTED';

export interface TrustedIssuer {
  issuerId: string;
  issuerName: string;
  publicKey: string;       // SPKI PEM
  trustLevel: TrustLevel;
  status: IssuerStatus;
  registeredAt: string;
  metadata?: Record<string, unknown>;
}

// ── Storage ───────────────────────────────────────────────────────────

const issuers = new Map<string, TrustedIssuer>();

// ── Seed data ─────────────────────────────────────────────────────────

const SEED_ISSUERS: TrustedIssuer[] = [
  {
    issuerId: 'did:vitalcv:issuer:ca-medical-board',
    issuerName: 'California Medical Board',
    publicKey: '', // Populated at runtime or via registration
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    metadata: { jurisdiction: 'CA', type: 'state_medical_board' },
  },
  {
    issuerId: 'did:vitalcv:issuer:abim',
    issuerName: 'American Board of Internal Medicine',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    metadata: { type: 'specialty_board' },
  },
  {
    issuerId: 'did:vitalcv:issuer:npi-registry',
    issuerName: 'NPI Registry (CMS)',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    metadata: { type: 'federal_registry' },
  },
  {
    issuerId: 'did:vitalcv:issuer:dea',
    issuerName: 'Drug Enforcement Administration',
    publicKey: '',
    trustLevel: 'AUTHORITATIVE',
    status: 'ACTIVE',
    registeredAt: '2025-01-15T00:00:00Z',
    metadata: { type: 'federal_agency' },
  },
  {
    issuerId: 'did:vitalcv:issuer:vitalcv-psv',
    issuerName: 'VitalCV PSV Engine',
    publicKey: '',
    trustLevel: 'TRUSTED',
    status: 'ACTIVE',
    registeredAt: '2025-06-01T00:00:00Z',
    metadata: { type: 'automated_verifier' },
  },
];

// Initialize seed data
for (const issuer of SEED_ISSUERS) {
  issuers.set(issuer.issuerId, issuer);
}

// ── Public API ────────────────────────────────────────────────────────

/** Get a single issuer by ID. */
export function getIssuer(issuerId: string): TrustedIssuer | null {
  return issuers.get(issuerId) ?? null;
}

/** List all registered issuers. */
export function listIssuers(): TrustedIssuer[] {
  return Array.from(issuers.values());
}

/** Register or update an issuer. */
export function registerIssuer(issuer: TrustedIssuer): void {
  issuers.set(issuer.issuerId, issuer);
  log('info', 'registry_issuer_registered', {
    issuerId: issuer.issuerId,
    trustLevel: issuer.trustLevel,
  });
}

/** Update issuer status. */
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

/** Check if an issuer is trusted (ACTIVE + not UNTRUSTED). */
export function isIssuerTrusted(issuerId: string): boolean {
  const issuer = issuers.get(issuerId);
  return issuer != null && issuer.status === 'ACTIVE' && issuer.trustLevel !== 'UNTRUSTED';
}

/** Registry size. */
export function registrySize(): number {
  return issuers.size;
}
