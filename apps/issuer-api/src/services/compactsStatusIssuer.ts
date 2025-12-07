/**
 * B138A-COMPACT-013: CompactsStatus VC Issuer Service
 *
 * Issues Verifiable Credentials for clinician compact eligibility status.
 * Integrates with blockchain anchoring and stores credential reference on clinician record.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import type { CompactsStatusData } from '../../../../services/compacts/models/CompactsStatus.js';

const prisma = new PrismaClient();

// VC context URLs
const VC_CONTEXT_V1 = 'https://www.w3.org/2018/credentials/v1';
const COMPACTS_STATUS_CONTEXT = 'https://vitalcv.com/contexts/CompactsStatus/v1';

// Issuer DID (should be loaded from configuration)
const ISSUER_DID = process.env.ISSUER_DID || 'did:example:vitalcv-platform';

/**
 * Verifiable Credential structure for CompactsStatus
 */
export interface CompactsStatusVC {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string; // clinicianDid
    imlc: {
      status: string;
      homeState?: string;
      compactStates: string[];
      lastCheckedAt: string;
    };
    psypact: {
      status: string;
      primaryState?: string;
      participatingStates: string[];
      ePassportId?: string;
      lastCheckedAt: string;
    };
    counselingCompact: {
      status: string;
      homeState?: string;
      compactStates: string[];
      licenseType?: string;
      lastCheckedAt: string;
    };
    metadata: {
      lastComputedAt: string;
      version: string;
      anchoredTxHash?: string;
    };
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws?: string;
  };
}

/**
 * Issue a CompactsStatus Verifiable Credential
 */
export async function issueCompactsStatusVC(
  clinicianDid: string,
  compactsStatus: CompactsStatusData
): Promise<CompactsStatusVC> {
  // Fetch individual compact statuses for detailed data
  const [imlcStatus, psypactStatus, counselingStatus] = await Promise.all([
    prisma.iMLCEligibility.findUnique({ where: { clinicianDid } }),
    prisma.pSYPACTCompact.findUnique({ where: { clinicianDid } }),
    prisma.counselingCompact.findUnique({ where: { clinicianDid } }),
  ]);

  // Generate credential ID
  const credentialId = `urn:uuid:${crypto.randomUUID()}`;

  // Set expiration (90 days from issuance)
  const issuanceDate = new Date();
  const expirationDate = new Date(issuanceDate);
  expirationDate.setDate(expirationDate.getDate() + 90);

  // Build credential
  const credential: CompactsStatusVC = {
    '@context': [VC_CONTEXT_V1, COMPACTS_STATUS_CONTEXT],
    id: credentialId,
    type: ['VerifiableCredential', 'CompactsStatusCredential'],
    issuer: ISSUER_DID,
    issuanceDate: issuanceDate.toISOString(),
    expirationDate: expirationDate.toISOString(),
    credentialSubject: {
      id: clinicianDid,
      imlc: {
        status: compactsStatus.imlcStatus,
        homeState: compactsStatus.imlcHomeState,
        compactStates: compactsStatus.imlcCompactStates,
        lastCheckedAt: imlcStatus?.lastCheckedAt.toISOString() || new Date().toISOString(),
      },
      psypact: {
        status: compactsStatus.psypactStatus,
        primaryState: psypactStatus?.primaryState,
        participatingStates: compactsStatus.psypactStates,
        ePassportId: psypactStatus?.ePassportId,
        lastCheckedAt: psypactStatus?.lastCheckedAt.toISOString() || new Date().toISOString(),
      },
      counselingCompact: {
        status: compactsStatus.counselingStatus,
        homeState: compactsStatus.counselingHomeState,
        compactStates: compactsStatus.counselingStates,
        licenseType: counselingStatus?.licenseType,
        lastCheckedAt: counselingStatus?.lastCheckedAt.toISOString() || new Date().toISOString(),
      },
      metadata: {
        lastComputedAt: typeof compactsStatus.lastComputedAt === 'string'
          ? compactsStatus.lastComputedAt
          : new Date().toISOString(),
        version: '1.0',
        anchoredTxHash: compactsStatus.anchoredTxHash,
      },
    },
  };

  // Compute credential hash for anchoring
  const credentialHash = hashCredential(credential);

  // Anchor hash on blockchain (mock implementation)
  const txHash = await anchorCredentialHash(credentialHash);

  // Update metadata with anchored tx hash
  credential.credentialSubject.metadata.anchoredTxHash = txHash;

  // Sign credential (simplified - in production, use proper DID signing)
  const proof = await signCredential(credential);
  credential.proof = proof;

  // Update CompactsStatus record with VC reference
  await prisma.compactsStatus.update({
    where: { clinicianDid },
    data: {
      vcHash: credentialHash,
      vcCredentialId: credentialId,
      anchoredTxHash: txHash,
    },
  });

  // Record audit event
  const { recordCompactVCIssuedEvent } = await import('../../../../services/audit/compactsEvents.js');
  await recordCompactVCIssuedEvent(prisma, clinicianDid, credentialId, credentialHash, txHash);

  return credential;
}

/**
 * Revoke a CompactsStatus VC
 */
export async function revokeCompactsStatusVC(
  clinicianDid: string,
  vcCredentialId: string,
  reason: string
): Promise<void> {
  // Update CompactsStatus to mark VC as revoked
  await prisma.compactsStatus.update({
    where: { clinicianDid },
    data: {
      metadata: {
        revokedAt: new Date().toISOString(),
        revocationReason: reason,
      },
    },
  });

  // Record audit event
  const { recordCompactVCRevokedEvent } = await import('../../../../services/audit/compactsEvents.js');
  await recordCompactVCRevokedEvent(prisma, clinicianDid, vcCredentialId, reason);

  // In production, publish revocation to blockchain or revocation registry
  console.log(`CompactsStatus VC ${vcCredentialId} revoked for ${clinicianDid}: ${reason}`);
}

/**
 * Get CompactsStatus VC for a clinician
 */
export async function getCompactsStatusVC(clinicianDid: string): Promise<CompactsStatusVC | null> {
  const compactsStatus = await prisma.compactsStatus.findUnique({
    where: { clinicianDid },
  });

  if (!compactsStatus || !compactsStatus.vcCredentialId) {
    return null;
  }

  // Rebuild VC from stored data
  const [imlcStatus, psypactStatus, counselingStatus] = await Promise.all([
    prisma.iMLCEligibility.findUnique({ where: { clinicianDid } }),
    prisma.pSYPACTCompact.findUnique({ where: { clinicianDid } }),
    prisma.counselingCompact.findUnique({ where: { clinicianDid } }),
  ]);

  const credential: CompactsStatusVC = {
    '@context': [VC_CONTEXT_V1, COMPACTS_STATUS_CONTEXT],
    id: compactsStatus.vcCredentialId,
    type: ['VerifiableCredential', 'CompactsStatusCredential'],
    issuer: ISSUER_DID,
    issuanceDate: compactsStatus.createdAt.toISOString(),
    credentialSubject: {
      id: clinicianDid,
      imlc: {
        status: compactsStatus.imlcStatus,
        homeState: compactsStatus.imlcHomeState,
        compactStates: compactsStatus.imlcCompactStates,
        lastCheckedAt: imlcStatus?.lastCheckedAt.toISOString() || compactsStatus.lastComputedAt.toISOString(),
      },
      psypact: {
        status: compactsStatus.psypactStatus,
        primaryState: psypactStatus?.primaryState,
        participatingStates: compactsStatus.psypactStates,
        ePassportId: psypactStatus?.ePassportId,
        lastCheckedAt: psypactStatus?.lastCheckedAt.toISOString() || compactsStatus.lastComputedAt.toISOString(),
      },
      counselingCompact: {
        status: compactsStatus.counselingStatus,
        homeState: compactsStatus.counselingHomeState,
        compactStates: compactsStatus.counselingStates,
        licenseType: counselingStatus?.licenseType,
        lastCheckedAt: counselingStatus?.lastCheckedAt.toISOString() || compactsStatus.lastComputedAt.toISOString(),
      },
      metadata: {
        lastComputedAt: compactsStatus.lastComputedAt.toISOString(),
        version: '1.0',
        anchoredTxHash: compactsStatus.anchoredTxHash,
      },
    },
  };

  return credential;
}

/**
 * Verify a CompactsStatus VC
 */
export async function verifyCompactsStatusVC(credential: CompactsStatusVC): Promise<boolean> {
  // 1. Verify credential structure
  if (!credential['@context'] || !credential.type || !credential.credentialSubject) {
    return false;
  }

  // 2. Verify issuer
  if (credential.issuer !== ISSUER_DID) {
    return false;
  }

  // 3. Check expiration
  if (credential.expirationDate && new Date(credential.expirationDate) < new Date()) {
    return false;
  }

  // 4. Verify proof signature (simplified - in production, verify actual signature)
  if (!credential.proof) {
    return false;
  }

  // 5. Check if credential is revoked
  const compactsStatus = await prisma.compactsStatus.findUnique({
    where: { clinicianDid: credential.credentialSubject.id },
  });

  if (!compactsStatus || compactsStatus.vcCredentialId !== credential.id) {
    return false;
  }

  const metadata = compactsStatus.metadata as any;
  if (metadata?.revokedAt) {
    return false;
  }

  return true;
}

/**
 * Hash credential for blockchain anchoring
 */
function hashCredential(credential: CompactsStatusVC): string {
  const credentialString = JSON.stringify(credential, Object.keys(credential).sort());
  return crypto.createHash('sha256').update(credentialString).digest('hex');
}

/**
 * Anchor credential hash on blockchain
 * (Mock implementation - in production, use actual blockchain service)
 */
async function anchorCredentialHash(hash: string): Promise<string> {
  // Mock transaction hash
  const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
  console.log(`Anchored credential hash ${hash} with txHash: ${txHash}`);
  return txHash;
}

/**
 * Sign credential with issuer's private key
 * (Simplified implementation - in production, use proper DID signing)
 */
async function signCredential(credential: CompactsStatusVC): Promise<any> {
  const credentialString = JSON.stringify(credential);
  const signature = crypto.createHash('sha256').update(credentialString).digest('hex');

  return {
    type: 'Ed25519Signature2020',
    created: new Date().toISOString(),
    verificationMethod: `${ISSUER_DID}#key-1`,
    proofPurpose: 'assertionMethod',
    jws: signature,
  };
}

/**
 * Batch issue CompactsStatus VCs for multiple clinicians
 */
export async function batchIssueCompactsStatusVCs(
  clinicianDids: string[]
): Promise<Map<string, CompactsStatusVC>> {
  const results = new Map<string, CompactsStatusVC>();

  for (const clinicianDid of clinicianDids) {
    try {
      const compactsStatus = await prisma.compactsStatus.findUnique({
        where: { clinicianDid },
      });

      if (compactsStatus) {
        const vc = await issueCompactsStatusVC(clinicianDid, compactsStatus as any);
        results.set(clinicianDid, vc);
      }
    } catch (error) {
      console.error(`Error issuing VC for ${clinicianDid}:`, error);
    }
  }

  return results;
}

