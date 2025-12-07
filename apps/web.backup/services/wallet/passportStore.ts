import { PrismaClient, type WalletCredential } from '@prisma/client';
import type { PassportAnchor } from '../passport/signPassport';

export interface StorePassportInput {
  passportId: string;
  clinicianId: string;
  deviceId: string;
  version: string;
  hash: string;
  issuedAt: string;
  ciphertext?: string;
  iv?: string;
  authTag?: string;
  envelopeSummary: Record<string, unknown>;
  signature: PassportAnchor;
  metadata?: Record<string, unknown>;
  channel?: 'device' | 'system';
}

export interface MarkPassportRevokedInput {
  passportId: string;
  reason?: string;
}

export class PassportStore {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async save(input: StorePassportInput): Promise<WalletCredential> {
    return this.prisma.walletCredential.upsert({
      where: { credentialId: input.passportId },
      update: {
        clinicianId: input.clinicianId,
        type: 'PassportV3',
        payload: this.buildPayload(input),
        issuedAt: new Date(input.issuedAt),
        updatedAt: new Date(),
      },
      create: {
        credentialId: input.passportId,
        clinicianId: input.clinicianId,
        type: 'PassportV3',
        payload: this.buildPayload(input),
        issuedAt: new Date(input.issuedAt),
      },
    });
  }

  async revokeOlderVersions(clinicianId: string, keepPassportId: string, reason?: string) {
    await this.prisma.walletCredential.updateMany({
      where: {
        clinicianId,
        type: 'PassportV3',
        credentialId: { not: keepPassportId },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        payload: {
          reason: reason ?? 'superseded',
        },
      },
    });
  }

  async markRevoked(input: MarkPassportRevokedInput): Promise<WalletCredential | null> {
    return this.prisma.walletCredential.update({
      where: { credentialId: input.passportId },
      data: {
        revokedAt: new Date(),
        payload: {
          reason: input.reason ?? 'revoked',
        },
      },
    });
  }

  async getPassport(passportId: string): Promise<WalletCredential | null> {
    return this.prisma.walletCredential.findUnique({
      where: { credentialId: passportId },
    });
  }

  private buildPayload(input: StorePassportInput): Record<string, unknown> {
    return {
      version: input.version,
      deviceId: input.deviceId,
      hash: input.hash,
      issuedAt: input.issuedAt,
      ciphertext: input.ciphertext,
      iv: input.iv,
      authTag: input.authTag,
      signature: input.signature,
      summary: input.envelopeSummary,
      channel: input.channel ?? 'device',
      metadata: input.metadata ?? {},
    };
  }
}

export const passportStore = new PassportStore();

