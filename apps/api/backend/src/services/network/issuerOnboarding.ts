/**
 * issuerOnboarding.ts — Wave 106: Issuer Onboarding Protocol
 *
 * Allows new credential issuers to join the VitalCV trust network.
 * Validates request fields, generates a DID-based issuerId, and
 * registers the issuer in the trustRegistry.
 */

import { log } from '../../obs/logger';
import {
  registerIssuer,
  listIssuers,
  type TrustLevel,
  type TrustedIssuer,
} from '../registry/trustRegistry';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IssuerOnboardingRequest {
  issuerName: string;
  issuerDID: string;
  verificationEndpoint: string;
  trustLevel: TrustLevel;
}

export interface IssuerOnboardingResult {
  issuerId: string;
  status: 'REGISTERED' | 'ALREADY_EXISTS' | 'FAILED';
  message: string;
  registeredAt: string;
}

// ── Onboarding ─────────────────────────────────────────────────────────────────

/**
 * Onboard a new issuer into the VitalCV trust network.
 * Uses the issuerDID as the issuerId (normalized).
 */
export async function onboardIssuer(
  req: IssuerOnboardingRequest,
): Promise<IssuerOnboardingResult> {
  const { issuerName, issuerDID, verificationEndpoint, trustLevel } = req;

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
    },
  };

  try {
    await registerIssuer(issuerRecord);
    log('info', 'Wave 106: Issuer onboarded', { issuerId, issuerName, trustLevel });

    return {
      issuerId,
      status: 'REGISTERED',
      message: `Issuer "${issuerName}" successfully registered with trust level ${trustLevel}.`,
      registeredAt,
    };
  } catch (err) {
    log('error', 'Wave 106: Issuer onboarding failed', { issuerId, detail: String(err) });
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
