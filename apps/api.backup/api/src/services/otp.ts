import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class OtpService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate a 6-digit OTP
   */
  private generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Issue an OTP challenge for an NPI
   */
  async issueOTP(npi: string, target: string, channel: 'email' | 'sms'): Promise<string> {
    // Check for existing active OTP
    const existing = await this.prisma.otpChallenge.findFirst({
      where: {
        npi,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      // Reuse existing OTP if still valid
      return existing.code;
    }

    // Generate new OTP
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.prisma.otpChallenge.create({
      data: {
        npi,
        target,
        channel,
        code,
        expiresAt,
        attempts: 0,
      },
    });

    // In development, log the OTP to console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${npi}: ${code}`);
    }

    // TODO: In production, send via email/SMS
    // await emailService.sendOTP(target, code);

    return code;
  }

  /**
   * Verify an OTP code
   */
  async verifyOTP(
    npi: string,
    code: string,
  ): Promise<{ success: boolean; remainingAttempts: number }> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: {
        npi,
        code,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      // Increment attempt counter for failed attempts
      const recent = await this.prisma.otpChallenge.findFirst({
        where: { npi, consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (recent) {
        await this.prisma.otpChallenge.update({
          where: { id: recent.id },
          data: { attempts: { increment: 1 } },
        });
      }

      return { success: false, remainingAttempts: 4 - (recent?.attempts || 0) };
    }

    // Check attempt limit (max 5 attempts)
    if (challenge.attempts >= 5) {
      return { success: false, remainingAttempts: 0 };
    }

    // Mark as consumed
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return { success: true, remainingAttempts: 5 };
  }

  /**
   * Check if NPI is locked due to too many failed attempts
   */
  async isLocked(npi: string): Promise<boolean> {
    const recent = await this.prisma.otpChallenge.findFirst({
      where: {
        npi,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 minutes
      },
      orderBy: { createdAt: 'desc' },
    });

    return recent ? recent.attempts >= 5 : false;
  }

  /**
   * Clean up expired OTPs
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.otpChallenge.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return result.count;
  }
}
