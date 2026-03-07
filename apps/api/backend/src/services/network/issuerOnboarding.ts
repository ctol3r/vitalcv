/**
 * issuerOnboarding.ts — Wave 106 + Wave 138: Issuer Onboarding Protocol
 *
 * Allows new credential issuers to join the VitalCV trust network.
 * Validates request fields, generates a DID-based issuerId, and
 * registers the issuer in the trustRegistry.
 *
 * Wave 138 additions:
 *   - federationMetadata field in IssuerOnboardingRequest
 *   - Federation metadata persisted in issuer record metadata
 *   - Trust registry update emitted via log event
 */

import { log } from '../../obs/logger';
import {
  registerIssuer,
  listIssuers,
  type TrustLevel,
  type TrustedIssuer,
} from '../registry/trustRegistry';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Federation metadata provided when onboarding an issuer into the network.
 * Enables cross-network trust bridging and OIDC federation compatibility.
 */
export interface FederationMetadata {
  /** OIDC Federation entity statement endpoint (optional). */
  entityStatementEndpoint?: string;
  /** Supported DID methods for cross-network resolution. */
  didMethods?: string[];
  /** Whether the issuer participates in the OpenID Federation trust chain. */
  oidcFederationEnabled?: boolean;
  /** Network identifiers this issuer is federated with. */
  federatedNetworkIds?: string[];
  /** Human-readable notes about this issuer's federation setup. */
  notes?: string;
}

export interface IssuerOnboardingRequest {
  issuerName: string;
  issuerDID: string;
  verificationEndpoint: string;
  trustLevel: TrustLevel;
  /** Wave 138: Optional federation metadata for cross-network trust bridging. */
  federationMetadata?: FederationMetadata;
}

export interface IssuerOnboardingResult {
  issuerId: string;
  status: 'REGISTERED' | 'ALREADY_EXISTS' | 'FAILED';
  message: string;
  registeredAt: string;
  /** Echoed back if federation metadata was provided. */
  federationMetadata?: FederationMetadata;
}

// ── Onboarding ─────────────────────────────────────────────────────────────────

/**
 * Onboard a new issuer into the VitalCV trust network.
 * Uses the issuerDID as the issuerId (normalized).
 * Persists federation metadata when provided.
 */
export async function onboardIssuer(
  req: IssuerOnboardingRequest,
): Promise<IssuerOnboardingResult> {
  const { issuerName, issuerDID, verificationEndpoint, trustLevel, federationMetadata } = req;

  if (!issuerName || !issuerDID || !verificationEndpoint || !trustLevel) {
    return {
      issuerId: '',
      status: 'FAILED',
      message: 'Missing required fields: issuerName, issuerDID, verificationEndpoint, trustLevel',
      registeredAt: new Date().toISOString(),
    };
  }

  const issuerId = issuerDID.startsWith('did:') ? issuerDID : `did:vitalcv:issuer:${issuerDID}`;
  const registeredAt = new Date().toISOString();

  const issuerRecord: TrustedIssuer = {
    issuerId,
    issuerName,
    publicKey: '',
    trustLevel,
    status: 'ACTIVE',
    registeredAt,
    trustScore: trustLevel === 'AUTHORITATIVE' ? 90 : trustLevel === 'TRUSTED' ? 75 : 50,
    verificationCount: 0,
    revocationCount: 0,
    metadata: {
      verificationEndpoint,
      onboardedVia: 'issuer-onboarding-api',
      // Wave 138: persist federation metadata alongside core record
      ...(federationMetadata ? { federationMetadata } : {}),
    },
  };

  try {
    await registerIssuer(issuerRecord);

    log('info', 'Wave 138: Issuer onboarded', {
      issuerId,
      issuerName,
      trustLevel,
      hasFederationMetadata: Boolean(federationMetadata),
      federatedNetworkCount: federationMetadata?.federatedNetworkIds?.length ?? 0,
    });

    return {
      issuerId,
      status: 'REGISTERED',
      message: `Issuer "${issuerName}" successfully registered with trust level ${trustLevel}.`,
      registeredAt,
      ...(federationMetadata ? { federationMetadata } : {}),
    };
  } catch (err) {
    log('error', 'Wave 138: Issuer onboarding failed', { issuerId, detail: String(err) });
    return {
      issuerId,
      status: 'FAILED',
      message: `Registration failed: ${String(err)}`,
      registeredAt,
    };
  }
}

/**
 * List all onboarded issuers from the trust registry.
 */
export function listOnboardedIssuers(): TrustedIssuer[] {
  return listIssuers();
}
