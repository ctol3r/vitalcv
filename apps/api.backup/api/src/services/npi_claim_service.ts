import { PrismaClient } from '@prisma/client';
import { nppesClient } from './nppes_client';
import { otpService } from './otp_service';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface ClaimLevel1Request {
  npi: string;
  email: string;
}

export interface ClaimLevel1VerifyRequest {
  npi: string;
  pin: string;
}

export interface ClaimResult {
  success: boolean;
  level: number;
  userId?: number;
  did?: string;
  roles?: string[];
  error?: string;
}

/**
 * NpiClaimService manages the multi-level NPI claim verification process.
 */
export class NpiClaimService {
  /**
   * Start Level 1 claim: Issue OTP for email/SMS verification.
   */
  async startLevel1Claim(request: ClaimLevel1Request): Promise<{ success: boolean; expiresAt?: Date; error?: string }> {
    const { npi, email } = request;

    // Validate NPI exists in NPPES
    const npiDetails = await nppesClient.fetch(npi);
    if (!npiDetails) {
      return { success: false, error: 'NPI not found in NPPES registry' };
    }

    // Issue OTP
    const result = await otpService.issueOtp(npi, 'email', email);

    return {
      success: result.success,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Verify Level 1 claim: Verify OTP and create/update claim.
   */
  async verifyLevel1Claim(request: ClaimLevel1VerifyRequest): Promise<ClaimResult> {
    const { npi, pin } = request;

    // Verify OTP
    const otpResult = await otpService.verifyOtp(npi, pin);
    if (!otpResult.success) {
      return { success: false, level: 0, error: otpResult.error };
    }

    // Fetch NPI details to determine roles
    const npiDetails = await nppesClient.fetch(npi);
    if (!npiDetails) {
      return { success: false, level: 0, error: 'NPI not found' };
    }

    // Find the OTP challenge to get the email
    const challenge = await prisma.otpChallenge.findFirst({
      where: { npi, code: pin },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      return { success: false, level: 0, error: 'OTP challenge not found' };
    }

    // Find or create user by email
    let user = await prisma.user.findUnique({
      where: { email: challenge.target },
    });

    if (!user) {
      // Create new user with provisional DID
      const provisionalDid = `did:key:${crypto.randomBytes(16).toString('hex')}`;
      const roles = this.inferRoles(npiDetails);

      user = await prisma.user.create({
        data: {
          email: challenge.target,
          name: npiDetails.basic.firstName && npiDetails.basic.lastName
            ? `${npiDetails.basic.firstName} ${npiDetails.basic.lastName}`
            : npiDetails.basic.organizationName || 'Unknown',
          did: provisionalDid,
          roles,
        },
      });
    } else {
      // Update existing user with roles if not already set
      const roles = this.inferRoles(npiDetails);
      const updatedRoles = Array.from(new Set([...user.roles, ...roles]));

      if (!user.did) {
        const provisionalDid = `did:key:${crypto.randomBytes(16).toString('hex')}`;
        user = await prisma.user.update({
          where: { id: user.id },
          data: { did: provisionalDid, roles: updatedRoles },
        });
      } else {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { roles: updatedRoles },
        });
      }
    }

    // Create or update NPI claim
    const existingClaim = await prisma.npiClaim.findUnique({
      where: { npi },
    });

    if (existingClaim) {
      await prisma.npiClaim.update({
        where: { npi },
        data: {
          userId: user.id,
          level: Math.max(existingClaim.level, 1),
          lastVerifiedAt: new Date(),
        },
      });
    } else {
      await prisma.npiClaim.create({
        data: {
          npi,
          userId: user.id,
          level: 1,
          lastVerifiedAt: new Date(),
        },
      });
    }

    // Create audit event
    await prisma.auditEvent.create({
      data: {
        type: 'CLAIM_L1_OK',
        subjectNpi: npi,
        userId: user.id,
        data: {
          npiType: npiDetails.type,
          roles: user.roles,
        },
      },
    });

    return {
      success: true,
      level: 1,
      userId: user.id,
      did: user.did,
      roles: user.roles,
    };
  }

  /**
   * Infer roles based on NPI type.
   * Type 1 (Individual): 'holder'
   * Type 2 (Organization): 'verifier', potentially 'issuer'
   */
  private inferRoles(npiDetails: any): string[] {
    const roles: string[] = [];

    if (npiDetails.type === 1) {
      roles.push('holder');
    } else if (npiDetails.type === 2) {
      roles.push('verifier');

      // Add 'issuer' if organization matches certain criteria
      // This is a placeholder - implement actual domain/org rules
      const orgName = npiDetails.basic.organizationName?.toLowerCase() || '';
      if (
        orgName.includes('hospital') ||
        orgName.includes('university') ||
        orgName.includes('medical center') ||
        orgName.includes('board')
      ) {
        roles.push('issuer');
      }
    }

    return roles;
  }

  /**
   * Get claim details for a given NPI.
   */
  async getClaimByNpi(npi: string) {
    return prisma.npiClaim.findUnique({
      where: { npi },
      include: { user: true },
    });
  }

  /**
   * Get all claims for a user.
   */
  async getClaimsByUserId(userId: number) {
    return prisma.npiClaim.findMany({
      where: { userId },
      orderBy: { level: 'desc' },
    });
  }
}

export const npiClaimService = new NpiClaimService();

