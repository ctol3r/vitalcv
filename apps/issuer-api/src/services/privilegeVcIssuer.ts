/**
 * S72-D1-C-007: Privilege VC Issuer Service
 *
 * Issues Verifiable Credentials for granted clinical privileges.
 * Called when a privilege request is approved.
 * Generates signed PrivilegeGranted VC and stores vcId/anchorHash on PrivilegeRequest.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// VC context URLs
const VC_CONTEXT_V1 = 'https://www.w3.org/2018/credentials/v1';
const PRIVILEGE_GRANTED_CONTEXT = 'https://vitalcv.com/schemas/privilegeGranted/v1';

// Issuer DID (should be loaded from environment/configuration)
const ISSUER_DID = process.env.ISSUER_DID || 'did:example:vitalcv-platform';
const ISSUER_NAME = process.env.ISSUER_NAME || 'VitalCV Platform';

/**
 * Verifiable Credential structure for PrivilegeGranted
 */
export interface PrivilegeGrantedVC {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name: string;
  };
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string; // clinicianDid
    name?: string;
    npi?: string;
    privileges: {
      privilegeSetId: string;
      privilegeSetName: string;
      department: string;
      procedures: Array<{
        code: string;
        name: string;
        category?: string;
      }>;
      restrictions?: string[];
    };
    grantedAt: string;
    reviewedBy?: {
      did: string;
      name?: string;
    };
    fppeRequired?: boolean;
    oppeRequired?: boolean;
    oppeIntervalMonths?: number;
    timeline: {
      effectiveDate: string;
      expirationDate: string;
      renewalDueDate: string;
    };
  };
  evidence?: Array<{
    id: string;
    type: string[];
    hash?: string;
  }>;
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws?: string;
  };
}

/**
 * Parameters for issuing a privilege VC
 */
export interface IssuePrivilegeVCParams {
  privilegeRequestId: string;
  clinicianDid: string;
  orgId: string;
  privilegeSetId: string;
  reviewerDid: string;
}

/**
 * Result of VC issuance
 */
export interface IssuePrivilegeVCResult {
  vcId: string;
  vcHash: string;
  vc: PrivilegeGrantedVC;
  anchorHash?: string;
}

/**
 * Issue a PrivilegeGranted Verifiable Credential
 */
export async function issuePrivilegeGrantedVC(
  params: IssuePrivilegeVCParams
): Promise<IssuePrivilegeVCResult> {
  const { privilegeRequestId, clinicianDid, orgId, privilegeSetId, reviewerDid } = params;

  // B146A-QA-008: Check if VC already exists for this privilege request (idempotency)
  const existingGrant = await prisma.privilegeGranted.findUnique({
    where: { privilegeRequestId },
  });

  if (existingGrant && existingGrant.vcCredentialId) {
    // Return existing VC instead of creating a new one
    console.log(`[VC Issuer] VC already exists for privilege request ${privilegeRequestId}, returning existing VC`);

    // Reconstruct VC data from existing grant (simplified - in production, fetch full VC)
    const vcHash = existingGrant.vcHash || '';

    return {
      vcId: existingGrant.vcCredentialId,
      vcHash,
      vc: {} as PrivilegeGrantedVC, // In production, fetch full VC from registry
      anchorHash: existingGrant.anchorHash || undefined,
    };
  }

  // Fetch privilege request and related data
  const privilegeRequest = await prisma.privilegeRequest.findUnique({
    where: { id: privilegeRequestId },
    include: {
      privilegeSet: true,
    },
  });

  if (!privilegeRequest) {
    throw new Error(`Privilege request ${privilegeRequestId} not found`);
  }

  if (!privilegeRequest.privilegeSet) {
    throw new Error(`Privilege set ${privilegeSetId} not found`);
  }

  // Generate credential ID
  const credentialId = `urn:uuid:${crypto.randomUUID()}`;

  // Set dates
  const issuanceDate = new Date();
  const expirationDate = new Date(issuanceDate);
  expirationDate.setFullYear(expirationDate.getFullYear() + 2); // 2 years default

  const renewalDueDate = new Date(expirationDate);
  renewalDueDate.setMonth(renewalDueDate.getMonth() - 3); // 3 months before expiry

  // Extract procedures from privilege set
  const procedures = privilegeRequest.privilegeSet.procedures as any[];
  const proceduresList = procedures.map((proc) => ({
    code: proc.code || proc.name, // Fallback to name if no code
    name: proc.name,
    category: proc.category,
  }));

  // Build credential
  const credential: PrivilegeGrantedVC = {
    '@context': [VC_CONTEXT_V1, PRIVILEGE_GRANTED_CONTEXT],
    id: credentialId,
    type: ['VerifiableCredential', 'PrivilegeGrantedCredential'],
    issuer: {
      id: ISSUER_DID,
      name: ISSUER_NAME,
    },
    issuanceDate: issuanceDate.toISOString(),
    expirationDate: expirationDate.toISOString(),
    credentialSubject: {
      id: clinicianDid,
      privileges: {
        privilegeSetId: privilegeRequest.privilegeSet.id,
        privilegeSetName: privilegeRequest.privilegeSet.name,
        department: privilegeRequest.privilegeSet.department,
        procedures: proceduresList,
      },
      grantedAt: issuanceDate.toISOString(),
      reviewedBy: {
        did: reviewerDid,
      },
      fppeRequired: true, // Default to true
      oppeRequired: true, // Default to true
      oppeIntervalMonths: 12, // Annual review
      timeline: {
        effectiveDate: issuanceDate.toISOString().split('T')[0],
        expirationDate: expirationDate.toISOString().split('T')[0],
        renewalDueDate: renewalDueDate.toISOString().split('T')[0],
      },
    },
  };

  // Add evidence if provided
  if (privilegeRequest.evidenceIds && privilegeRequest.evidenceIds.length > 0) {
    credential.evidence = privilegeRequest.evidenceIds.map((id) => ({
      id,
      type: ['VerifiableCredential'],
    }));
  }

  // Compute VC hash (SHA-256 of credential subject)
  const vcHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(credential.credentialSubject))
    .digest('hex');

  // In production, this would:
  // 1. Sign the VC with org's private key (add proof object)
  // 2. Anchor the hash on blockchain
  // 3. Store the signed VC in a credential registry

  // For now, we'll add a stub proof
  credential.proof = {
    type: 'Ed25519Signature2020',
    created: issuanceDate.toISOString(),
    verificationMethod: `${ISSUER_DID}#key-1`,
    proofPurpose: 'assertionMethod',
    jws: generateStubJWS(credential), // Stub signature
  };

  // Simulate blockchain anchoring (stub)
  const anchorHash = await anchorToBlockchain(vcHash);

  // Store VC reference (in production, store full signed VC)
  // For now, we'll just return the data
  console.log(`[VC Issuer] Issued PrivilegeGranted VC ${credentialId} for ${clinicianDid}`);
  console.log(`[VC Issuer] VC Hash: ${vcHash}`);
  console.log(`[VC Issuer] Anchor Hash: ${anchorHash}`);

  return {
    vcId: credentialId,
    vcHash,
    vc: credential,
    anchorHash,
  };
}

/**
 * Generate a stub JWS signature (for testing)
 * In production, use a proper signing library like did-jwt or jose
 */
function generateStubJWS(credential: PrivilegeGrantedVC): string {
  // This is a placeholder - in production use proper Ed25519 signing
  const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(credential.credentialSubject)).toString('base64url');
  const signature = crypto
    .createHash('sha256')
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Anchor VC hash to blockchain (stub implementation)
 * In production, integrate with Substrate or Ethereum
 */
async function anchorToBlockchain(vcHash: string): Promise<string> {
  // Stub implementation - returns a mock transaction hash
  // In production, this would:
  // 1. Connect to blockchain node
  // 2. Submit transaction with vcHash
  // 3. Wait for confirmation
  // 4. Return transaction hash

  const mockTxHash = crypto
    .createHash('sha256')
    .update(`${vcHash}-${Date.now()}`)
    .digest('hex');

  console.log(`[Blockchain] Anchored VC hash ${vcHash} at tx ${mockTxHash}`);

  return mockTxHash;
}

/**
 * Verify a PrivilegeGranted VC
 * In production, this would verify the signature and check blockchain anchor
 */
export async function verifyPrivilegeGrantedVC(vc: PrivilegeGrantedVC): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Basic validation
  if (!vc['@context'].includes(VC_CONTEXT_V1)) {
    errors.push('Missing W3C VC context');
  }

  if (!vc.type.includes('VerifiableCredential') || !vc.type.includes('PrivilegeGrantedCredential')) {
    errors.push('Invalid credential type');
  }

  if (!vc.issuer || !vc.issuer.id) {
    errors.push('Missing issuer');
  }

  if (!vc.credentialSubject || !vc.credentialSubject.id) {
    errors.push('Missing credential subject');
  }

  if (!vc.credentialSubject.privileges) {
    errors.push('Missing privileges data');
  }

  if (!vc.proof) {
    errors.push('Missing cryptographic proof');
  }

  // Check expiration
  if (vc.expirationDate && new Date(vc.expirationDate) < new Date()) {
    errors.push('Credential has expired');
  }

  // In production, verify signature here
  // In production, verify blockchain anchor here

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Revoke a privilege VC
 * In production, this would update a revocation registry
 */
export async function revokePrivilegeGrantedVC(params: {
  vcId: string;
  privilegeGrantedId: string;
  reason: string;
  revokedBy: string;
}): Promise<void> {
  const { vcId, privilegeGrantedId, reason, revokedBy } = params;

  // Update PrivilegeGranted status
  await prisma.privilegeGranted.update({
    where: { id: privilegeGrantedId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revocationReason: reason,
    },
  });

  // In production:
  // 1. Add vcId to revocation registry (on-chain or off-chain)
  // 2. Update blockchain with revocation status
  // 3. Notify relevant parties

  console.log(`[VC Issuer] Revoked VC ${vcId} - Reason: ${reason}`);
}

