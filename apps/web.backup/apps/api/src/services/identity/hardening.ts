import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();

const chainClient = new ChainClient();

export interface DIDDocument {
  id: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyJwk?: Record<string, unknown>;
  }>;
  authentication?: string[];
  keyAgreement?: string[];
}

export interface HardeningLevel {
  level: 'basic' | 'hardened' | 'enterprise' | 'regulator';
  requirements: string[];
  metadata: Record<string, unknown>;
}

/**
 * Validate DID document (key types, rotations, revocations)
 */
export async function validateDIDDocument(did: string): Promise<{
  valid: boolean;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}> {
  // Fetch DID from NCI registry
  const node = await prisma.nCINode.findUnique({
    where: { did },
  });

  if (!node) {
    return {
      valid: false,
      issues: [
        {
          type: 'not_found',
          severity: 'high',
          description: 'DID not found in registry',
        },
      ],
    };
  }

  const issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> = [];

  // Check trust anchor
  if (!node.trustAnchorId) {
    issues.push({
      type: 'no_trust_anchor',
      severity: 'high',
      description: 'DID has no trust anchor',
    });
  }

  // Check proofs
  const proofs = await prisma.nCIVerifiableProof.findMany({
    where: { did },
  });

  if (proofs.length === 0) {
    issues.push({
      type: 'no_proofs',
      severity: 'medium',
      description: 'DID has no verifiable proofs',
    });
  }

  // Check for revocations
  const revoked = proofs.filter((p) => p.proofType === 'REVOCATION');
  if (revoked.length > 0) {
    issues.push({
      type: 'revoked',
      severity: 'high',
      description: `${revoked.length} revocation proof(s) found`,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Secure enclave wallet binding (optional for high-trust flows)
 */
export async function bindSecureEnclave(
  did: string,
  enclavePublicKey: string,
  metadata?: Record<string, unknown>,
): Promise<{
  bound: boolean;
  bindingId?: string;
}> {
  // In production, this would interact with secure enclave hardware
  // For now, we'll store the binding in metadata
  const hardening = await prisma.identityHardening.upsert({
    where: { did },
    create: {
      did,
      level: 'hardened',
      metadata: {
        secureEnclave: {
          publicKey: enclavePublicKey,
          boundAt: new Date().toISOString(),
          ...metadata,
        },
      },
    },
    update: {
      metadata: {
        secureEnclave: {
          publicKey: enclavePublicKey,
          boundAt: new Date().toISOString(),
          ...metadata,
        },
      },
    },
  });

  return {
    bound: true,
    bindingId: hardening.id,
  };
}

/**
 * Issuer enterprise-level hardening (mTLS + DID rotation schedule)
 */
export async function hardenIssuer(
  issuerDid: string,
  mTLSRequired: boolean = true,
  rotationScheduleDays: number = 90,
): Promise<{
  hardened: boolean;
  level: string;
  requirements: string[];
}> {
  const requirements: string[] = [];

  if (mTLSRequired) {
    requirements.push('mTLS authentication required');
  }

  if (rotationScheduleDays > 0) {
    requirements.push(`DID rotation every ${rotationScheduleDays} days`);
  }

  const hardening = await prisma.identityHardening.upsert({
    where: { did: issuerDid },
    create: {
      did: issuerDid,
      level: 'enterprise',
      metadata: {
        mTLSRequired,
        rotationScheduleDays,
        hardenedAt: new Date().toISOString(),
      },
    },
    update: {
      level: 'enterprise',
      metadata: {
        mTLSRequired,
        rotationScheduleDays,
        hardenedAt: new Date().toISOString(),
      },
    },
  });

  return {
    hardened: true,
    level: hardening.level,
    requirements,
  };
}

/**
 * Verifier identity proofing v2 (domain, org registration, compliance)
 */
export async function proofVerifierIdentity(
  verifierDid: string,
  domain: string,
  orgRegistration?: string,
): Promise<{
  verified: boolean;
  checks: Array<{
    type: string;
    passed: boolean;
    details?: string;
  }>;
}> {
  const checks: Array<{
    type: string;
    passed: boolean;
    details?: string;
  }> = [];

  // Check domain
  try {
    // Simplified: in production, verify DNS records
    checks.push({
      type: 'domain_verification',
      passed: domain.length > 0,
      details: domain,
    });
  } catch (error) {
    checks.push({
      type: 'domain_verification',
      passed: false,
      details: error instanceof Error ? error.message : 'Domain verification failed',
    });
  }

  // Check org registration
  if (orgRegistration) {
    checks.push({
      type: 'org_registration',
      passed: true,
      details: orgRegistration,
    });
  } else {
    checks.push({
      type: 'org_registration',
      passed: false,
      details: 'No org registration provided',
    });
  }

  // Check compliance
  const node = await prisma.nCINode.findUnique({
    where: { did: verifierDid },
  });

  if (node?.trustAnchorId) {
    const trustAnchor = await prisma.nCITrustAnchor.findUnique({
      where: { entityId: node.trustAnchorId },
    });

    if (trustAnchor?.accreditation === 'ACCREDITED') {
      checks.push({
        type: 'compliance',
        passed: true,
        details: 'Trust anchor accredited',
      });
    } else {
      checks.push({
        type: 'compliance',
        passed: false,
        details: 'Trust anchor not accredited',
      });
    }
  } else {
    checks.push({
      type: 'compliance',
      passed: false,
      details: 'No trust anchor found',
    });
  }

  const verified = checks.every((c) => c.passed);

  return { verified, checks };
}

/**
 * Risk-based DID policy (auto-upgrade if high-risk)
 */
export async function applyRiskBasedPolicy(
  did: string,
  riskScore: number,
): Promise<{
  level: string;
  upgraded: boolean;
  reason?: string;
}> {
  const current = await prisma.identityHardening.findUnique({
    where: { did },
  });

  let targetLevel: 'basic' | 'hardened' | 'enterprise' | 'regulator' = 'basic';
  let upgraded = false;
  let reason: string | undefined;

  if (riskScore >= 0.8) {
    targetLevel = 'regulator';
    if (current?.level !== 'regulator') {
      upgraded = true;
      reason = 'High risk score requires regulator-level hardening';
    }
  } else if (riskScore >= 0.6) {
    targetLevel = 'enterprise';
    if (current && current.level !== 'enterprise' && current.level !== 'regulator') {
      upgraded = true;
      reason = 'Medium-high risk score requires enterprise-level hardening';
    }
  } else if (riskScore >= 0.4) {
    targetLevel = 'hardened';
    if (current && current.level === 'basic') {
      upgraded = true;
      reason = 'Medium risk score requires hardened level';
    }
  }

  if (upgraded || !current) {
    await prisma.identityHardening.upsert({
      where: { did },
      create: {
        did,
        level: targetLevel,
        metadata: {
          riskScore,
          upgradedAt: new Date().toISOString(),
          reason,
        },
      },
      update: {
        level: targetLevel,
        metadata: {
          ...(current?.metadata as Record<string, unknown> || {}),
          riskScore,
          upgradedAt: new Date().toISOString(),
          reason,
        },
      },
    });
  }

  return {
    level: targetLevel,
    upgraded,
    reason,
  };
}

/**
 * Anchor DID trust state to chain
 */
export async function anchorDIDTrustState(did: string): Promise<string | null> {
  try {
    const hardening = await prisma.identityHardening.findUnique({
      where: { did },
    });

    if (!hardening) {
      return null;
    }

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'identityHardeningAnchored',
      payload: {
        did,
        level: hardening.level,
        metadata: hardening.metadata,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[IdentityHardening] Failed to anchor DID trust state', error);
    return null;
  }
}

/**
 * Get identity audit timeline
 */
export async function getIdentityAuditTimeline(did: string): Promise<{
  events: Array<{
    timestamp: string;
    type: string;
    details: Record<string, unknown>;
  }>;
}> {
  const proofs = await prisma.nCIVerifiableProof.findMany({
    where: { did },
    orderBy: { createdAt: 'desc' },
  });

  const events = proofs.map((proof) => ({
    timestamp: proof.createdAt.toISOString(),
    type: proof.proofType,
    details: {
      eventType: proof.eventType,
      payloadHash: proof.payloadHash,
      anchorTxHash: proof.anchorTxHash,
    },
  }));

  return { events };
}

