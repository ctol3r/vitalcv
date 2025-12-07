import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface AttestationRequest {
  npi: string;
  userId: number;
  requestedBy: string;
}

export interface AttestationReceipt {
  npi: string;
  issuerDid: string;
  credentialHash: string;
  holderDid: string;
}

/**
 * Level3ClaimService handles issuer attestation workflow.
 */
export class Level3ClaimService {
  /**
   * Request attestation from an issuer (enqueue for issuer portal).
   */
  async requestAttestation(
    request: AttestationRequest,
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    const { npi, userId } = request;

    // Verify user has Level 2 claim
    const claim = await prisma.npiClaim.findFirst({
      where: { npi, userId, level: { gte: 2 } },
    });

    if (!claim) {
      return {
        success: false,
        error: 'No Level 2 claim found. Complete Level 2 verification first.',
      };
    }

    // In production, enqueue this request for the issuer portal
    const requestId = crypto.randomBytes(16).toString('hex');

    // Create audit event for attestation request
    await prisma.auditEvent.create({
      data: {
        type: 'CLAIM_L3_REQUESTED',
        subjectNpi: npi,
        userId,
        data: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    console.log(`[Level3] Attestation requested for NPI ${npi}, request ID: ${requestId}`);

    return {
      success: true,
      requestId,
    };
  }

  /**
   * Process attestation receipt from issuer.
   * This would be called by a webhook or callback when the issuer signs the VC.
   */
  async processAttestationReceipt(
    receipt: AttestationReceipt,
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const { npi, issuerDid, credentialHash, holderDid } = receipt;

    try {
      // Step 1: Verify issuer DID is in TrustRegistry
      const isTrustedIssuer = await this.verifyIssuerInTrustRegistry(issuerDid);
      if (!isTrustedIssuer) {
        return {
          success: false,
          error: 'Issuer DID not found in TrustRegistry',
        };
      }

      // Step 2: Find the claim
      const claim = await prisma.npiClaim.findUnique({
        where: { npi },
        include: { user: true },
      });

      if (!claim) {
        return {
          success: false,
          error: 'Claim not found',
        };
      }

      // Step 3: Anchor credential hash to CredentialRegistry pallet (Active status)
      const txHash = await this.anchorCredentialToChain(credentialHash, issuerDid, holderDid);

      // Step 4: Link NPI to DID mapping on-chain
      await this.mapNpiToDid(npi, holderDid);

      // Step 5: Update claim to level 3
      await prisma.npiClaim.update({
        where: { npi },
        data: {
          level: 3,
          issuerAttestationTx: txHash,
          lastVerifiedAt: new Date(),
          evidence: {
            ...(claim.evidence as any),
            issuerDid,
            credentialHash,
            attestationDate: new Date().toISOString(),
          },
        },
      });

      // Step 6: Create audit event
      await prisma.auditEvent.create({
        data: {
          type: 'CLAIM_L3_OK',
          subjectNpi: npi,
          userId: claim.userId,
          data: {
            issuer: issuerDid,
            txHash,
            credentialHash,
          },
          chainTxHash: txHash,
        },
      });

      console.log(`[Level3] Attestation processed for NPI ${npi}, txHash: ${txHash}`);

      return {
        success: true,
        txHash,
      };
    } catch (error: any) {
      console.error('Level 3 attestation processing error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify issuer DID exists in TrustRegistry.
   */
  private async verifyIssuerInTrustRegistry(issuerDid: string): Promise<boolean> {
    // TODO: Implement actual TrustRegistry lookup via PolkadotService or smart contract
    // For now, accept any issuer DID that matches expected format
    console.log(`[Level3] Verifying issuer ${issuerDid} in TrustRegistry`);

    // Mock: accept DIDs from known issuers
    const trustedIssuers = [
      'did:key:platform-issuer',
      'did:web:medical-board.example.com',
      'did:ethr:0x1234567890abcdef',
    ];

    return (
      issuerDid.startsWith('did:') &&
      (trustedIssuers.includes(issuerDid) || issuerDid.includes('issuer'))
    );
  }

  /**
   * Anchor credential hash to blockchain via CredentialRegistry pallet.
   */
  private async anchorCredentialToChain(
    credentialHash: string,
    issuerDid: string,
    holderDid: string,
  ): Promise<string> {
    // TODO: Implement actual PolkadotService.addCredentialRecord(hash, issuer, holder, 'Active')
    console.log(`[Level3] Anchoring credential hash ${credentialHash} to chain`);

    // Mock transaction hash
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;

    // In production, call PolkadotService:
    // const txHash = await polkadotService.addCredentialRecord(credentialHash, issuerDid, holderDid, 'Active');

    return txHash;
  }

  /**
   * Map NPI to DID on-chain.
   */
  private async mapNpiToDid(npi: string, did: string): Promise<void> {
    // TODO: Implement actual PolkadotService.mapNpiToDid(npi, did)
    console.log(`[Level3] Mapping NPI ${npi} to DID ${did} on-chain`);

    // In production, call PolkadotService:
    // await polkadotService.mapNpiToDid(npi, did);
  }

  /**
   * Get attestation status for a claim.
   */
  async getAttestationStatus(npi: string): Promise<any> {
    const claim = await prisma.npiClaim.findUnique({
      where: { npi },
      include: { user: true },
    });

    if (!claim) {
      return null;
    }

    return {
      npi: claim.npi,
      level: claim.level,
      attestationTx: claim.issuerAttestationTx,
      lastVerified: claim.lastVerifiedAt,
      evidence: claim.evidence,
    };
  }
}

export const level3ClaimService = new Level3ClaimService();
