/**
 * federationDiscovery.ts — Wave 166: Credential Federation Discovery
 *
 * Discovers external credential issuers from known healthcare registries
 * and federation endpoints, validates their metadata, and registers them
 * in the trust registry automatically.
 *
 * Functions:
 *   discoverIssuers()              — probe known discovery endpoints, return candidates
 *   validateFederationMetadata()   — validate OpenID Federation entity config shape
 *   autoRegisterDiscoveredIssuers()— register validated issuers into trustRegistry
 */

import { randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import { listIssuers, registerIssuer, type TrustedIssuer } from '../registry/trustRegistry';

// ── Types ──────────────────────────────────────────────────────────────────────

export type DiscoverySource =
  | 'openid_federation'
  | 'well_known'
  | 'healthcare_registry'
  | 'manual';

export interface DiscoveredIssuer {
  discoveryId: string;
  issuerName: string;
  endpoint: string;
  source: DiscoverySource;
  metadataValid: boolean;
  validationErrors: string[];
  trustLevel: 'AUTHORITATIVE' | 'TRUSTED' | 'PROVISIONAL';
  /** Estimated trust score before registry verification (0–100) */
  estimatedTrustScore: number;
  discoveredAt: string;
  /** Whether this issuer was auto-registered in the trust registry */
  registered: boolean;
  registeredIssuerId?: string;
}

export interface FederationMetadataCandidate {
  /** Entity identifier (URL) */
  iss?: string;
  /** Subject — should match iss */
  sub?: string;
  /** JWKS for signature verification */
  jwks?: { keys?: unknown[] };
  /** Supported credential types */
  credential_configurations_supported?: Record<string, unknown>;
  /** OpenID credential issuer metadata */
  openid_credential_issuer?: {
    credential_issuer?: string;
    authorization_server?: string;
    credential_endpoint?: string;
  };
  /** Display metadata */
  display?: Array<{ name?: string; locale?: string }>;
}

export interface DiscoveryReport {
  discoveredAt: string;
  totalCandidates: number;
  validCandidates: number;
  autoRegistered: number;
  skippedExisting: number;
  issuers: DiscoveredIssuer[];
}

// ── Known discovery endpoints ─────────────────────────────────────────────────

interface DiscoveryEndpoint {
  name: string;
  endpoint: string;
  source: DiscoverySource;
  trustLevel: 'AUTHORITATIVE' | 'TRUSTED' | 'PROVISIONAL';
  estimatedScore: number;
  type: 'licensing_authority' | 'credential_network' | 'hospital_system' | 'government';
}

const KNOWN_ENDPOINTS: DiscoveryEndpoint[] = [
  {
    name: 'CA Medical Board',
    endpoint: 'https://www.mbc.ca.gov',
    source: 'healthcare_registry',
    trustLevel: 'AUTHORITATIVE',
    estimatedScore: 95,
    type: 'licensing_authority',
  },
  {
    name: 'American Board of Internal Medicine',
    endpoint: 'https://www.abim.org',
    source: 'healthcare_registry',
    trustLevel: 'AUTHORITATIVE',
    estimatedScore: 97,
    type: 'credential_network',
  },
  {
    name: 'DEA — Drug Enforcement Administration',
    endpoint: 'https://www.deadiversion.usdoj.gov',
    source: 'healthcare_registry',
    trustLevel: 'AUTHORITATIVE',
    estimatedScore: 99,
    type: 'government',
  },
  {
    name: 'Nursys — Nurse Licensure Compact',
    endpoint: 'https://api.nursys.com',
    source: 'healthcare_registry',
    trustLevel: 'TRUSTED',
    estimatedScore: 88,
    type: 'licensing_authority',
  },
  {
    name: 'CAQH ProView',
    endpoint: 'https://proview.caqh.org',
    source: 'healthcare_registry',
    trustLevel: 'TRUSTED',
    estimatedScore: 85,
    type: 'credential_network',
  },
  {
    name: 'ABMS — American Board of Medical Specialties',
    endpoint: 'https://www.abms.org',
    source: 'healthcare_registry',
    trustLevel: 'AUTHORITATIVE',
    estimatedScore: 96,
    type: 'credential_network',
  },
  {
    name: 'The Joint Commission',
    endpoint: 'https://www.jointcommission.org',
    source: 'healthcare_registry',
    trustLevel: 'TRUSTED',
    estimatedScore: 90,
    type: 'hospital_system',
  },
  {
    name: 'NCQA — National Committee for Quality Assurance',
    endpoint: 'https://www.ncqa.org',
    source: 'healthcare_registry',
    trustLevel: 'TRUSTED',
    estimatedScore: 87,
    type: 'credential_network',
  },
];

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate federation metadata candidate shape.
 * Follows OpenID Federation 1.0 entity configuration spec.
 */
export function validateFederationMetadata(candidate: FederationMetadataCandidate): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic entity configuration fields
  if (!candidate.iss) {
    errors.push('Missing required field: iss (entity identifier)');
  }

  if (candidate.iss && candidate.sub && candidate.iss !== candidate.sub) {
    errors.push('iss and sub must match for entity configurations');
  }

  if (!candidate.jwks) {
    warnings.push('No JWKS provided — signature verification not possible');
  } else if (!Array.isArray(candidate.jwks.keys) || candidate.jwks.keys.length === 0) {
    errors.push('JWKS must contain at least one key');
  }

  // OpenID credential issuer checks
  if (candidate.openid_credential_issuer) {
    if (!candidate.openid_credential_issuer.credential_issuer) {
      warnings.push('openid_credential_issuer.credential_issuer not specified');
    }
    if (!candidate.openid_credential_issuer.credential_endpoint) {
      warnings.push('No credential_endpoint specified');
    }
  } else {
    warnings.push('No openid_credential_issuer metadata — may not support OID4VCI');
  }

  if (!candidate.credential_configurations_supported) {
    warnings.push('No credential_configurations_supported — credential types unknown');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Discovery ─────────────────────────────────────────────────────────────────

/**
 * Discover external credential issuers from known healthcare registries.
 *
 * In production: would probe /.well-known/openid-federation on each endpoint.
 * Current implementation: validates known endpoints against existing registry
 * and returns discovery candidates with simulated metadata validation.
 */
export async function discoverIssuers(): Promise<DiscoveredIssuer[]> {
  const existingIssuers = listIssuers();
  const existingEndpoints = new Set(
    existingIssuers.map((i) => i.issuerId.toLowerCase()),
  );

  const candidates: DiscoveredIssuer[] = [];

  for (const ep of KNOWN_ENDPOINTS) {
    const discoveryId = `disc-${randomUUID().slice(0, 8)}`;

    // Simulate metadata probe — in production would fetch /.well-known/openid-federation
    const simulatedMetadata: FederationMetadataCandidate = {
      iss: ep.endpoint,
      sub: ep.endpoint,
      jwks: ep.trustLevel === 'AUTHORITATIVE' ? { keys: [{ kty: 'EC', use: 'sig' }] } : undefined,
      openid_credential_issuer:
        ep.type === 'credential_network'
          ? {
              credential_issuer: ep.endpoint,
              credential_endpoint: `${ep.endpoint}/credentials`,
            }
          : undefined,
      display: [{ name: ep.name, locale: 'en-US' }],
    };

    const { valid, errors } = validateFederationMetadata(simulatedMetadata);

    // Check if already in registry (by name match)
    const alreadyRegistered = existingIssuers.some(
      (i) => i.issuerName.toLowerCase() === ep.name.toLowerCase(),
    );

    candidates.push({
      discoveryId,
      issuerName: ep.name,
      endpoint: ep.endpoint,
      source: ep.source,
      metadataValid: valid,
      validationErrors: errors,
      trustLevel: ep.trustLevel,
      estimatedTrustScore: ep.estimatedScore,
      discoveredAt: new Date().toISOString(),
      registered: alreadyRegistered,
      registeredIssuerId: alreadyRegistered
        ? existingIssuers.find((i) => i.issuerName.toLowerCase() === ep.name.toLowerCase())?.issuerId
        : undefined,
    });
  }

  log('info', 'federation_discovery_complete', {
    total: candidates.length,
    valid: candidates.filter((c) => c.metadataValid).length,
    alreadyRegistered: candidates.filter((c) => c.registered).length,
  });

  return candidates;
}

/**
 * Auto-register validated discovered issuers into the trust registry.
 * Skips issuers already registered. Returns a discovery report.
 */
export async function autoRegisterDiscoveredIssuers(): Promise<DiscoveryReport> {
  const candidates = await discoverIssuers();
  let autoRegistered = 0;
  let skippedExisting = 0;

  for (const candidate of candidates) {
    if (candidate.registered) {
      skippedExisting++;
      continue;
    }

    if (!candidate.metadataValid) {
      log('warn', 'federation_discovery_skip_invalid', {
        issuerName: candidate.issuerName,
        errors: candidate.validationErrors,
      });
      continue;
    }

    try {
      const issuerId = `issuer-disc-${randomUUID().slice(0, 8)}`;
      const newIssuer: TrustedIssuer = {
        issuerId,
        issuerName: candidate.issuerName,
        publicKey: '',
        trustLevel: candidate.trustLevel,
        status: 'ACTIVE',
        registeredAt: new Date().toISOString(),
        trustScore: candidate.estimatedTrustScore,
        federationEntityId: candidate.endpoint,
        metadata: {
          discoveredAt: candidate.discoveredAt,
          discoverySource: candidate.source,
          endpoint: candidate.endpoint,
          autoDiscovered: true,
        },
      };

      await registerIssuer(newIssuer);
      candidate.registered = true;
      candidate.registeredIssuerId = issuerId;
      autoRegistered++;

      log('info', 'federation_discovery_registered', {
        issuerId,
        issuerName: candidate.issuerName,
        trustLevel: candidate.trustLevel,
      });
    } catch (err) {
      log('error', 'federation_discovery_register_error', {
        issuerName: candidate.issuerName,
        error: String(err),
      });
    }
  }

  return {
    discoveredAt: new Date().toISOString(),
    totalCandidates: candidates.length,
    validCandidates: candidates.filter((c) => c.metadataValid).length,
    autoRegistered,
    skippedExisting,
    issuers: candidates,
  };
}
