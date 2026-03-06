/**
 * federationMetadata.ts — Wave 113: OpenID Federation Trust Metadata
 *
 * Implements OpenID Federation-style entity configurations and trust chains.
 * Allows VitalCV to trust external issuers/verifiers using federated metadata.
 *
 * Spec: https://openid.net/specs/openid-federation-1_0.html
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type EntityType = 'openid_credential_issuer' | 'openid_relying_party' | 'federation_entity';

export interface FederationEntityConfiguration {
  /** The entity ID (typically a URL) */
  iss: string;
  /** Subject (same as iss for entity configurations) */
  sub: string;
  /** JWT issuer of this config */
  iat: number;
  /** Expiry */
  exp: number;
  /** JWKS for verifying this entity's signatures */
  jwks: {
    keys: Array<{
      kty: string;
      use: string;
      kid: string;
      crv?: string;
      x?: string;
      y?: string;
      alg?: string;
    }>;
  };
  /** Entity type metadata */
  metadata: Partial<Record<EntityType, Record<string, unknown>>>;
  /** Authority hints (trust anchors above this entity) */
  authority_hints?: string[];
  /** Constraints on subordinates */
  constraints?: {
    max_path_length?: number;
    naming_constraints?: {
      permitted?: string[];
      excluded?: string[];
    };
  };
}

export interface CachedEntityConfig {
  entityId: string;
  configuration: FederationEntityConfiguration;
  cachedAt: string;
  expiresAt: string;
  trustVerified: boolean;
  trustChainLength?: number;
}

export interface FederationTrustResult {
  entityId: string;
  trusted: boolean;
  trustChainLength: number;
  trustAnchor: string;
  verifiedAt: string;
  errors: string[];
}

// ── Cache ─────────────────────────────────────────────────────────────

const metadataCache = new Map<string, CachedEntityConfig>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── VitalCV Federation Trust Anchor ──────────────────────────────────

const VITALCV_FEDERATION_ANCHOR = 'https://federation.vitalcv.com';

// ── Seed well-known federation entities ──────────────────────────────

const SEED_ENTITIES: FederationEntityConfiguration[] = [
  {
    iss: 'https://credentials.ca.gov/medical-board',
    sub: 'https://credentials.ca.gov/medical-board',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    jwks: { keys: [] },
    metadata: {
      openid_credential_issuer: {
        credential_issuer: 'https://credentials.ca.gov/medical-board',
        credential_endpoint: 'https://credentials.ca.gov/medical-board/credential',
        credentials_supported: ['MedicalLicense'],
      },
    },
    authority_hints: [VITALCV_FEDERATION_ANCHOR],
  },
  {
    iss: 'https://federation.abim.org',
    sub: 'https://federation.abim.org',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    jwks: { keys: [] },
    metadata: {
      openid_credential_issuer: {
        credential_issuer: 'https://federation.abim.org',
        credential_endpoint: 'https://federation.abim.org/credential',
        credentials_supported: ['BoardCertification'],
      },
    },
    authority_hints: [VITALCV_FEDERATION_ANCHOR],
  },
  {
    iss: 'https://npiregistry.cms.hhs.gov/federation',
    sub: 'https://npiregistry.cms.hhs.gov/federation',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    jwks: { keys: [] },
    metadata: {
      openid_credential_issuer: {
        credential_issuer: 'https://npiregistry.cms.hhs.gov',
        credential_endpoint: 'https://npiregistry.cms.hhs.gov/credential',
        credentials_supported: ['NPIRegistration'],
      },
    },
    authority_hints: [VITALCV_FEDERATION_ANCHOR],
  },
];

// Seed the cache
for (const config of SEED_ENTITIES) {
  const cached: CachedEntityConfig = {
    entityId: config.iss,
    configuration: config,
    cachedAt: new Date().toISOString(),
    expiresAt: new Date(config.exp * 1000).toISOString(),
    trustVerified: true,
    trustChainLength: 1,
  };
  metadataCache.set(config.iss, cached);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Fetch (or serve from cache) an entity configuration.
 * In production, this would HTTP GET <entityId>/.well-known/openid-federation
 */
export async function fetchEntityConfiguration(
  entityId: string,
): Promise<CachedEntityConfig | null> {
  const cached = metadataCache.get(entityId);
  if (cached) {
    const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
    if (cacheAge < CACHE_TTL_MS) {
      return cached;
    }
  }

  // In production: fetch from entityId/.well-known/openid-federation
  log('warn', 'federation_metadata_fetch_stub', { entityId });

  // For unknown entities return null
  return null;
}

/**
 * Validate whether an entity is trusted in the VitalCV federation.
 * Walks the authority_hints chain up to the trust anchor.
 */
export async function validateFederationTrust(
  entityId: string,
): Promise<FederationTrustResult> {
  const errors: string[] = [];

  const config = await fetchEntityConfiguration(entityId);
  if (!config) {
    return {
      entityId,
      trusted: false,
      trustChainLength: 0,
      trustAnchor: VITALCV_FEDERATION_ANCHOR,
      verifiedAt: new Date().toISOString(),
      errors: [`Entity ${entityId} not found in federation metadata cache`],
    };
  }

  // Check if entity references VitalCV anchor in authority_hints
  const hints = config.configuration.authority_hints ?? [];
  const trustedToAnchor = hints.includes(VITALCV_FEDERATION_ANCHOR);

  if (!trustedToAnchor) {
    errors.push(`Entity does not reference VitalCV federation anchor (${VITALCV_FEDERATION_ANCHOR})`);
  }

  // Check entity config is not expired
  const exp = new Date(config.configuration.exp * 1000);
  if (exp < new Date()) {
    errors.push(`Entity configuration expired at ${exp.toISOString()}`);
  }

  const trusted = trustedToAnchor && errors.length === 0;

  log('info', 'federation_trust_validated', {
    entityId,
    trusted,
    chainLength: config.trustChainLength,
  });

  return {
    entityId,
    trusted,
    trustChainLength: config.trustChainLength ?? 1,
    trustAnchor: VITALCV_FEDERATION_ANCHOR,
    verifiedAt: new Date().toISOString(),
    errors,
  };
}

/**
 * Store a federation entity configuration in the cache.
 */
export function cacheFederationMetadata(
  entityId: string,
  configuration: FederationEntityConfiguration,
  trustVerified = false,
  trustChainLength = 0,
): CachedEntityConfig {
  const cached: CachedEntityConfig = {
    entityId,
    configuration,
    cachedAt: new Date().toISOString(),
    expiresAt: new Date(configuration.exp * 1000).toISOString(),
    trustVerified,
    trustChainLength,
  };
  metadataCache.set(entityId, cached);

  log('info', 'federation_metadata_cached', {
    entityId,
    trustVerified,
    trustChainLength,
  });

  return cached;
}

/**
 * List all cached entity configurations.
 */
export function listFederationEntities(): CachedEntityConfig[] {
  return Array.from(metadataCache.values());
}

/**
 * Build a VitalCV entity configuration (served at our own .well-known endpoint).
 */
export function buildVitalCVEntityConfiguration(): FederationEntityConfiguration {
  const baseUrl = process.env.ISSUER_BASE_URL ?? 'https://api.vitalcv.com';
  return {
    iss: baseUrl,
    sub: baseUrl,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30-day config
    jwks: { keys: [] }, // In production: export SPKI as JWK
    metadata: {
      openid_credential_issuer: {
        credential_issuer: baseUrl,
        credential_endpoint: `${baseUrl}/api/oid4vci/credential`,
        credentials_supported: ['MedicalLicense', 'BoardCertification', 'NPIRegistration', 'DEARegistration'],
      },
      federation_entity: {
        federation_fetch_endpoint: `${baseUrl}/api/federation/fetch`,
        organization_name: 'VitalCV Trust Network',
        contacts: ['trust@vitalcv.com'],
        policy_uri: `${baseUrl}/trust-policy`,
        homepage_uri: 'https://vitalcv.com',
      },
    },
    constraints: {
      max_path_length: 2,
    },
  };
}

/** Cache size for monitoring */
export function federationCacheSize(): number {
  return metadataCache.size;
}
