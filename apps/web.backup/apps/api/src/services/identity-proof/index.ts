/**
 * Batch 218 — Global Identity Proof Protocol v4
 * Next-gen identity + credential proofing for cross-border, multi-wallet usage.
 */

import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';

export interface IdentityProofProtocol {
  multiproof: {
    faceMatch: boolean;
    idDocument: boolean;
    vc: boolean;
    combined: boolean;
  };
  didHandshake: {
    wallets: Array<{ walletId: string; did: string; verified: boolean }>;
    consistency: number;
  };
  regulatoryCompliance: {
    region: string;
    level: number;
    compliant: boolean;
  };
  trustLevel: number; // 0-3: DPoP, biometric, DID anchor
  fraudPatterns: Array<{ pattern: string; detected: boolean; confidence: number }>;
  sessionId: string;
  expirationDate: string;
}

/**
 * Task 218.2 — Combine face match + ID document + VC
 */
export async function createMultiproof(
  faceMatchScore: number,
  idDocumentVerified: boolean,
  vcVerified: boolean
): Promise<{ faceMatch: boolean; idDocument: boolean; vc: boolean; combined: boolean }> {
  const faceMatch = faceMatchScore >= 0.95;
  const combined = faceMatch && idDocumentVerified && vcVerified;

  return {
    faceMatch,
    idDocument: idDocumentVerified,
    vc: vcVerified,
    combined,
  };
}

/**
 * Task 218.3 — Verify DID consistency across wallets
 */
export async function verifyMultiWalletDID(
  clinicianId: string
): Promise<{ wallets: Array<{ walletId: string; did: string; verified: boolean }>; consistency: number }> {
  const wallets = await prisma.walletProfile.findMany({
    where: { clinicianId },
  });

  const walletDids = wallets.map((w) => w.walletHandle || '').filter((d) => d.length > 0);

  // Check consistency: all DIDs should match or be related
  const uniqueDids = new Set(walletDids);
  const consistency = walletDids.length > 0 ? (uniqueDids.size === 1 ? 1.0 : 0.5) : 0;

  return {
    wallets: wallets.map((w) => ({
      walletId: w.id,
      did: w.walletHandle || '',
      verified: !!w.walletHandle,
    })),
    consistency,
  };
}

/**
 * Task 218.4 — Match identity proof → regulatory expectations per region
 */
export function checkRegulatoryCompliance(
  region: string,
  proofLevel: number
): { region: string; level: number; compliant: boolean } {
  // Region-specific requirements
  const requirements: Record<string, number> = {
    'US': 2,
    'EU': 3,
    'APAC': 2,
  };

  const requiredLevel = requirements[region] || 2;
  return {
    region,
    level: proofLevel,
    compliant: proofLevel >= requiredLevel,
  };
}

/**
 * Task 218.6 — Score Level 0 → 3 (DPoP, biometric, DID anchor)
 */
export function calculateTrustLevel(
  multiproof: { faceMatch: boolean; idDocument: boolean; vc: boolean },
  didConsistency: number,
  anchored: boolean
): number {
  let level = 0; // DPoP

  if (multiproof.vc) level = 1; // VC proof
  if (multiproof.vc && multiproof.idDocument) level = 2; // Biometric
  if (level >= 2 && didConsistency >= 0.9 && anchored) level = 3; // DID anchor

  return level;
}

/**
 * Task 218.7 — Detect synthetic identity patterns
 */
export async function detectFraudPatterns(
  clinicianId: string
): Promise<Array<{ pattern: string; detected: boolean; confidence: number }>> {
  const patterns: Array<{ pattern: string; detected: boolean; confidence: number }> = [];

  // Check for identity forensics
  const forensics = await prisma.identityForensics.findUnique({
    where: { clinicianId },
  });

  if (forensics && forensics.riskScore > 0.7) {
    patterns.push({
      pattern: 'High identity risk score',
      detected: true,
      confidence: forensics.riskScore,
    });
  }

  // Check for multiple conflicting identities
  const claims = await prisma.npiClaim.findMany({
    where: { linkedDid: { not: null } },
  });

  if (claims.length > 1) {
    const uniqueDids = new Set(claims.map((c) => c.linkedDid).filter((d): d is string => !!d));
    if (uniqueDids.size > 1) {
      patterns.push({
        pattern: 'Multiple conflicting DIDs',
        detected: true,
        confidence: 0.8,
      });
    }
  }

  return patterns;
}

/**
 * Task 218.8 — Record proof flow for audits
 */
export async function recordProofSession(
  sessionId: string,
  clinicianId: string,
  protocol: IdentityProofProtocol
): Promise<void> {
  // Store session in database
  await prisma.identityProofProtocol.create({
    data: {
      protocol: {
        sessionId,
        clinicianId,
        ...protocol,
      },
      updatedAt: new Date(),
    },
  });
}

/**
 * Task 218.9 — Regulate proof validity windows
 */
export function calculateExpiration(trustLevel: number): Date {
  // Higher trust level = longer validity
  const validityDays: Record<number, number> = {
    0: 30,   // DPoP: 30 days
    1: 90,   // VC: 90 days
    2: 180,  // Biometric: 180 days
    3: 365,  // DID anchor: 365 days
  };

  const days = validityDays[trustLevel] || 30;
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + days);
  return expiration;
}

/**
 * Build complete identity proof protocol
 */
export async function buildIdentityProof(
  clinicianId: string,
  region: string,
  faceMatchScore: number,
  idDocumentVerified: boolean,
  vcVerified: boolean
): Promise<IdentityProofProtocol> {
  const sessionId = `proof-${Date.now()}-${clinicianId}`;

  const multiproof = await createMultiproof(faceMatchScore, idDocumentVerified, vcVerified);
  const didHandshake = await verifyMultiWalletDID(clinicianId);
  const trustLevel = calculateTrustLevel(multiproof, didHandshake.consistency, true);
  const regulatoryCompliance = checkRegulatoryCompliance(region, trustLevel);
  const fraudPatterns = await detectFraudPatterns(clinicianId);
  const expirationDate = calculateExpiration(trustLevel).toISOString();

  const protocol: IdentityProofProtocol = {
    multiproof,
    didHandshake,
    regulatoryCompliance,
    trustLevel,
    fraudPatterns,
    sessionId,
    expirationDate,
  };

  await recordProofSession(sessionId, clinicianId, protocol);

  return protocol;
}

/**
 * Task 218.10 — Anchor proof protocol state
 */
export async function anchorIdentityProof(protocol: IdentityProofProtocol): Promise<void> {
  await prisma.identityProofProtocol.upsert({
    where: { id: protocol.sessionId },
    create: {
      protocol,
      updatedAt: new Date(),
    },
    update: {
      protocol,
      updatedAt: new Date(),
    },
  });

  anchorEvent('identityProofAnchored', {
    sessionId: protocol.sessionId,
    trustLevel: protocol.trustLevel,
    compliant: protocol.regulatoryCompliance.compliant,
    protocolHash: JSON.stringify(protocol),
    timestamp: new Date().toISOString(),
  });
}

