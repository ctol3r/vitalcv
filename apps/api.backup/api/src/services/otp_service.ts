import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface OtpIssuanceResult {
  success: boolean;
  expiresAt: Date;
  channel: string;
  target: string;
}

/**
 * OtpService handles OTP generation, storage, and verification.
 */
export class OtpService {
  private readonly otpLength: number;
  private readonly otpExpiryMinutes: number;
  private readonly maxAttempts: number;

  constructor(otpLength: number = 6, otpExpiryMinutes: number = 10, maxAttempts: number = 5) {
    this.otpLength = otpLength;
    this.otpExpiryMinutes = otpExpiryMinutes;
    this.maxAttempts = maxAttempts;
  }

  /**
   * Generate and store an OTP for the given NPI.
   */
  async issueOtp(npi: string, channel: 'email' | 'sms', target: string): Promise<OtpIssuanceResult> {
    // Generate a random OTP
    const code = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

    // Store in database
    await prisma.otpChallenge.create({
      data: {
        npi,
        channel,
        target,
        code,
        expiresAt,
      },
    });

    // In production, send the OTP via email or SMS
    await this.sendOtp(channel, target, code);

    return {
      success: true,
      expiresAt,
      channel,
      target,
    };
  }

  /**
   * Verify the OTP for the given NPI.
   */
  async verifyOtp(npi: string, code: string): Promise<{ success: boolean; error?: string }> {
    // Find all unconsumed OTPs for this NPI
    const challenges = await prisma.otpChallenge.findMany({
      where: {
        npi,
        consumedAt: null,
        expiresAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (challenges.length === 0) {
      return { success: false, error: 'No valid OTP found' };
    }

    // Check if the code matches
    const validChallenge = challenges.find((c) => c.code === code);

    if (!validChallenge) {
      // Check for brute force attempts
      const recentAttempts = await prisma.otpChallenge.findMany({
        where: {
          npi,
          createdAt: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      });

      if (recentAttempts.length >= this.maxAttempts) {
        return { success: false, error: 'Too many attempts. Please try again later.' };
      }

      return { success: false, error: 'Invalid OTP' };
    }

    // Mark as consumed
    await prisma.otpChallenge.update({
      where: { id: validChallenge.id },
      data: { consumedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Generate a random numeric OTP.
   */
  private generateOtp(): string {
    const max = Math.pow(10, this.otpLength) - 1;
    const otp = crypto.randomInt(0, max + 1);
    return otp.toString().padStart(this.otpLength, '0');
  }

  /**
   * Send OTP via email or SMS.
   * In production, integrate with email/SMS providers.
   */
  private async sendOtp(channel: 'email' | 'sms', target: string, code: string): Promise<void> {
    // Stub implementation - in production, use SendGrid, Twilio, etc.
    console.log(`[OTP] Sending ${code} to ${target} via ${channel}`);
    // TODO: Integrate with actual email/SMS provider
  }

  /**
   * Clean up expired OTPs.
   */
  async cleanupExpired(): Promise<number> {
    const result = await prisma.otpChallenge.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}

export const otpService = new OtpService();

