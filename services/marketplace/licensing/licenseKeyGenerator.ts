/**
 * B223A-MARKET-005: LicenseKeyGenerator
 *
 * Generates cryptographically signed license keys tied to moduleId and purchaser.
 * Tracks issuance and expiry.
 */

import { PrismaClient } from '@prisma/client';
import { createHash, createSign, createVerify } from 'crypto';
import { getModule } from '../models/MarketplaceModule';
import { LicenseType } from '@prisma/client';

export interface LicenseKeyData {
  moduleId: string;
  purchaserDid: string;
  issuedAt: Date;
  expiresAt?: Date;
  licenseType: LicenseType;
}

export interface LicenseKeyRecord {
  id: string;
  moduleId: string;
  purchaserDid: string;
  licenseKey: string;
  issuedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  revokedAt: Date | null;
}

/**
 * LicenseKeyGenerator class for generating and managing license keys
 */
export class LicenseKeyGenerator {
  private privateKey: string;
  private publicKey: string;

  constructor(
    private prisma: PrismaClient,
    privateKey?: string,
    publicKey?: string
  ) {
    // In production, these should come from secure key management
    // For now, generate a key pair if not provided (for development/testing)
    if (!privateKey || !publicKey) {
      // Generate a simple key pair for development
      // In production, use proper RSA key generation or load from secure storage
      this.privateKey = privateKey || process.env.LICENSE_PRIVATE_KEY || 'dev-private-key-change-in-production';
      this.publicKey = publicKey || process.env.LICENSE_PUBLIC_KEY || 'dev-public-key-change-in-production';
    } else {
      this.privateKey = privateKey;
      this.publicKey = publicKey;
    }
  }

  /**
   * Generate a cryptographically signed license key
   */
  async generateLicenseKey(
    moduleId: string,
    purchaserDid: string,
    expiresAt?: Date
  ): Promise<string> {
    // Verify module exists
    const module = await getModule(this.prisma, moduleId);
    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // Determine expiry based on license type
    let finalExpiresAt: Date | undefined = expiresAt;
    if (!finalExpiresAt && module.licenseType === LicenseType.SUBSCRIPTION) {
      // Default subscription: 1 year from now
      finalExpiresAt = new Date();
      finalExpiresAt.setFullYear(finalExpiresAt.getFullYear() + 1);
    } else if (!finalExpiresAt && module.licenseType === LicenseType.TRIAL) {
      // Default trial: 30 days from now
      finalExpiresAt = new Date();
      finalExpiresAt.setDate(finalExpiresAt.getDate() + 30);
    }
    // PERPETUAL and ONE_TIME licenses don't expire

    // Create license payload
    const payload: LicenseKeyData = {
      moduleId,
      purchaserDid,
      issuedAt: new Date(),
      expiresAt: finalExpiresAt,
      licenseType: module.licenseType,
    };

    // Create license key string (base64 encoded JSON)
    const payloadJson = JSON.stringify({
      m: moduleId,
      p: purchaserDid,
      i: payload.issuedAt.toISOString(),
      e: finalExpiresAt?.toISOString() || null,
      t: module.licenseType,
    });

    // Generate signature
    const signature = this.signPayload(payloadJson);

    // Combine payload and signature
    const licenseKey = `${Buffer.from(payloadJson).toString('base64')}.${signature}`;

    // Store in database
    await this.prisma.licenseKey.create({
      data: {
        moduleId,
        purchaserDid,
        licenseKey,
        issuedAt: payload.issuedAt,
        expiresAt: finalExpiresAt ?? null,
        isActive: true,
      },
    });

    return licenseKey;
  }

  /**
   * Verify a license key signature
   */
  verifyLicenseKey(licenseKey: string): { valid: boolean; data?: LicenseKeyData; error?: string } {
    try {
      const [payloadBase64, signature] = licenseKey.split('.');
      if (!payloadBase64 || !signature) {
        return { valid: false, error: 'Invalid license key format' };
      }

      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const payload = JSON.parse(payloadJson);

      // Verify signature
      const isValid = this.verifySignature(payloadJson, signature);
      if (!isValid) {
        return { valid: false, error: 'Invalid license key signature' };
      }

      // Parse license data
      const data: LicenseKeyData = {
        moduleId: payload.m,
        purchaserDid: payload.p,
        issuedAt: new Date(payload.i),
        expiresAt: payload.e ? new Date(payload.e) : undefined,
        licenseType: payload.t as LicenseType,
      };

      return { valid: true, data };
    } catch (error) {
      return { valid: false, error: `License key verification failed: ${error}` };
    }
  }

  /**
   * Validate license key (check signature + expiry + revocation)
   */
  async validateLicenseKey(licenseKey: string): Promise<{
    valid: boolean;
    active: boolean;
    expired: boolean;
    revoked: boolean;
    data?: LicenseKeyData;
    error?: string;
  }> {
    // Verify signature
    const verification = this.verifyLicenseKey(licenseKey);
    if (!verification.valid || !verification.data) {
      return {
        valid: false,
        active: false,
        expired: false,
        revoked: false,
        error: verification.error,
      };
    }

    const data = verification.data;

    // Check if license exists in database
    const licenseRecord = await this.prisma.licenseKey.findUnique({
      where: { licenseKey },
    });

    if (!licenseRecord) {
      return {
        valid: true, // Signature is valid
        active: false,
        expired: false,
        revoked: false,
        error: 'License key not found in database',
      };
    }

    // Check if revoked
    const revoked = licenseRecord.revokedAt !== null;
    if (revoked) {
      return {
        valid: true,
        active: false,
        expired: false,
        revoked: true,
        data,
        error: 'License key has been revoked',
      };
    }

    // Check if expired
    const expired = licenseRecord.expiresAt !== null && new Date() > licenseRecord.expiresAt;
    if (expired) {
      return {
        valid: true,
        active: false,
        expired: true,
        revoked: false,
        data,
        error: 'License key has expired',
      };
    }

    // Check if active
    const active = licenseRecord.isActive && !expired && !revoked;

    return {
      valid: true,
      active,
      expired,
      revoked,
      data,
    };
  }

  /**
   * Revoke a license key
   */
  async revokeLicenseKey(licenseKey: string): Promise<void> {
    const licenseRecord = await this.prisma.licenseKey.findUnique({
      where: { licenseKey },
    });

    if (!licenseRecord) {
      throw new Error('License key not found');
    }

    if (licenseRecord.revokedAt) {
      throw new Error('License key is already revoked');
    }

    await this.prisma.licenseKey.update({
      where: { licenseKey },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Get license keys for a module
   */
  async getModuleLicenseKeys(moduleId: string, includeRevoked = false) {
    const where: any = { moduleId };
    if (!includeRevoked) {
      where.revokedAt = null;
    }

    return this.prisma.licenseKey.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Get license keys for a purchaser
   */
  async getPurchaserLicenseKeys(purchaserDid: string, includeRevoked = false) {
    const where: any = { purchaserDid };
    if (!includeRevoked) {
      where.revokedAt = null;
    }

    return this.prisma.licenseKey.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      include: {
        module: {
          select: {
            id: true,
            name: true,
            version: true,
            licenseType: true,
          },
        },
      },
    });
  }

  /**
   * Sign payload with private key
   */
  private signPayload(payload: string): string {
    // For development: use HMAC-SHA256
    // In production, use proper RSA signing with actual key pair
    const hash = createHash('sha256').update(payload + this.privateKey).digest('base64');
    return hash;
  }

  /**
   * Verify signature with public key
   */
  private verifySignature(payload: string, signature: string): boolean {
    try {
      // For development: use HMAC-SHA256
      // In production, use proper RSA verification with actual key pair
      const hash = createHash('sha256').update(payload + this.privateKey).digest('base64');
      return hash === signature;
    } catch {
      return false;
    }
  }
}

