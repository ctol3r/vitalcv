/**
 * trustRegistry.ts — Wave 95 + 105 + 126: Trust Registry + Reputation
 *
 * Maintains the trusted issuer registry as a read-through cache backed by
 * durable persistence. Reads remain synchronous for existing callers, while
 * mutations are written through Prisma-backed repositories.
 */

import { log } from '../../obs/logger';
import {
  PrismaTrustRegistryRepository,
  type TrustRegistryRepository,
  type TrustRegistryReputationUpdate,
} from '../../../repositories/trustRegistry.repo';

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

// ── Cache + repository ────────────────────────────────────────────────

function cloneIssuer(issuer: TrustedIssuer): TrustedIssuer {
  return structuredClone(issuer);
}

function buildSeedCache(): Map<string, TrustedIssuer> {
  return new Map(SEED_ISSUERS.map((issuer) => [issuer.issuerId, cloneIssuer(issuer)]));
}

function replaceCache(issuers: readonly TrustedIssuer[]): void {
  issuerCache = new Map(issuers.map((issuer) => [issuer.issuerId, cloneIssuer(issuer)]));
}

let issuerRepository: TrustRegistryRepository = new PrismaTrustRegistryRepository();
let issuerCache = buildSeedCache();
let initializationPromise: Promise<void> | null = null;

function isTestFallbackEnabled(): boolean {
  return process.env.NODE_ENV === 'test';
}

// ── Repository management ────────────────────────────────────────────

export function setTrustRegistryRepository(repository: TrustRegistryRepository): void {
  issuerRepository = repository;
  issuerCache = buildSeedCache();
  initializationPromise = null;
}

export function resetTrustRegistryRepository(): void {
  setTrustRegistryRepository(new PrismaTrustRegistryRepository());
}

export async function initializeTrustRegistryPersistence(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      await issuerRepository.seedDefaults(SEED_ISSUERS);
      const persistedIssuers = await issuerRepository.listIssuers();
      replaceCache(persistedIssuers);
      log('info', 'trust_registry_initialized', {
        issuerCount: persistedIssuers.length,
      });
    } catch (error) {
      if (!isTestFallbackEnabled()) {
        initializationPromise = null;
        throw error;
      }

      log('warn', 'trust_registry_initialized_in_memory_fallback', {
        issuerCount: issuerCache.size,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();

  return initializationPromise;
}

// ── Public API ────────────────────────────────────────────────────────

export function getIssuer(issuerId: string): TrustedIssuer | null {
  const issuer = issuerCache.get(issuerId);
  return issuer ? cloneIssuer(issuer) : null;
}

export function listIssuers(): TrustedIssuer[] {
  return Array.from(issuerCache.values()).map(cloneIssuer);
}

export async function registerIssuer(issuer: TrustedIssuer): Promise<TrustedIssuer> {
  await initializeTrustRegistryPersistence();
  try {
    const persisted = await issuerRepository.upsertIssuer(issuer);
    issuerCache.set(persisted.issuerId, cloneIssuer(persisted));
    log('info', 'registry_issuer_registered', {
      issuerId: persisted.issuerId,
      trustLevel: persisted.trustLevel,
    });
    return cloneIssuer(persisted);
  } catch (error) {
    if (!isTestFallbackEnabled()) {
      throw error;
    }

    issuerCache.set(issuer.issuerId, cloneIssuer(issuer));
    log('warn', 'registry_issuer_registered_in_memory_fallback', {
      issuerId: issuer.issuerId,
      trustLevel: issuer.trustLevel,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return cloneIssuer(issuer);
  }
}

export async function updateIssuerStatus(
  issuerId: string,
  status: IssuerStatus,
): Promise<TrustedIssuer | null> {
  await initializeTrustRegistryPersistence();
  try {
    const updated = await issuerRepository.updateIssuerStatus(issuerId, status);
    if (!updated) {
      return null;
    }
    issuerCache.set(issuerId, cloneIssuer(updated));
    log('info', 'registry_issuer_status_updated', { issuerId, status });
    return cloneIssuer(updated);
  } catch (error) {
    if (!isTestFallbackEnabled()) {
      throw error;
    }

    const cached = issuerCache.get(issuerId);
    if (!cached) {
      return null;
    }

    const updated: TrustedIssuer = {
      ...cached,
      status,
    };
    issuerCache.set(issuerId, cloneIssuer(updated));
    log('warn', 'registry_status_updated_in_memory_fallback', {
      issuerId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return cloneIssuer(updated);
  }
}

/**
 * Wave 105: Update reputation fields for an issuer.
 */
export async function updateIssuerReputation(
  issuerId: string,
  reputation: TrustRegistryReputationUpdate,
): Promise<TrustedIssuer | null> {
  await initializeTrustRegistryPersistence();
  try {
    const updated = await issuerRepository.updateIssuerReputation(issuerId, reputation);
    if (!updated) {
      return null;
    }
    issuerCache.set(issuerId, cloneIssuer(updated));
    return cloneIssuer(updated);
  } catch (error) {
    if (!isTestFallbackEnabled()) {
      throw error;
    }

    const cached = issuerCache.get(issuerId);
    if (!cached) {
      return null;
    }

    const updated: TrustedIssuer = {
      ...cached,
      ...reputation,
    };
    issuerCache.set(issuerId, cloneIssuer(updated));
    log('warn', 'registry_reputation_updated_in_memory_fallback', {
      issuerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return cloneIssuer(updated);
  }
}

export function isIssuerTrusted(issuerId: string): boolean {
  const issuer = issuerCache.get(issuerId);
  return issuer != null && issuer.status === 'ACTIVE' && issuer.trustLevel !== 'UNTRUSTED';
}

export function registrySize(): number {
  return issuerCache.size;
}
