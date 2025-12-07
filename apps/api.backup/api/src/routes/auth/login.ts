import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { rateLimitLogin } from '../../middleware/rateLimitLogin';
import { riskGate } from '../../middleware/riskGate';
import { LoginAbuseGuard } from '../../../../../services/security/loginAbuseGuard';
import { createSecurityLogger, SecurityEventType, EventOutcome } from '../../../../../services/logging/securityLogger';
import { OtpService } from '../../../../../backend/src/services/otp';
import { generateToken } from '../../../../../backend/src/auth/jwt';

const router = Router();
const prisma = new PrismaClient();
const otpService = new OtpService(prisma);
const securityLogger = createSecurityLogger(console, 'api');

const loginAbuseGuard = new LoginAbuseGuard({
  maxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS || '5', 10),
  lockoutDurationSeconds: parseInt(process.env.LOGIN_LOCKOUT_SECONDS || `${15 * 60}`, 10),
  failureWindowSeconds: parseInt(process.env.LOGIN_FAILURE_WINDOW_SECONDS || `${15 * 60}`, 10),
  redisUrl: process.env.REDIS_URL,
  keyPrefix: 'login_abuse',
  enableLogging: true,
});

const loginSchema = z.object({
  npi: z.string().regex(/^\d{10}$/),
  otp: z.string().regex(/^\d{6}$/),
  deviceId: z.string().max(128).optional(),
});

function extractIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function resolveDeviceId(req: Request, explicit?: string): string | undefined {
  const cookies = (req as any).cookies;
  return explicit || (req.headers['x-device-id'] as string) || cookies?.deviceId;
}

function normalizeRole(roles: string[] | null | undefined): 'user' | 'clinician' {
  if (!roles || roles.length === 0) {
    return 'clinician';
  }
  if (roles.some((role) => ['admin', 'verifier', 'issuer'].includes(role))) {
    return 'user';
  }
  return 'clinician';
}

router.post(
  '/login',
  rateLimitLogin,
  riskGate('login'),
  async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'npi and otp are required',
        details: parsed.error.format(),
      });
    }

    const { npi, otp, deviceId } = parsed.data;
    const ip = extractIp(req);
    const agent = req.headers['user-agent'] || 'unknown';
    const resolvedDeviceId = resolveDeviceId(req, deviceId);

    const guardCheck = await loginAbuseGuard.checkAllowed({
      accountId: npi,
      ip,
      deviceId: resolvedDeviceId,
      success: false,
    });

    if (!guardCheck.allowed) {
      securityLogger.authFailure('login_abuse_lockout', ip, {
        reason: 'LOCKOUT_ACTIVE',
        identifiers: guardCheck.identifiers?.length,
      });

      return res.status(423).json({
        error: 'account_locked',
        message: guardCheck.reason || 'Too many failed attempts. Please try again later.',
        retryAfterSeconds: guardCheck.lockoutRemainingSeconds,
      });
    }

    const otpResult = await otpService.verifyOTP(npi, otp);

    if (!otpResult.success) {
      await loginAbuseGuard.recordAttempt({
        accountId: npi,
        ip,
        deviceId: resolvedDeviceId,
        success: false,
        metadata: { reason: 'INVALID_OTP' },
      });

      securityLogger.log({
        eventType: SecurityEventType.AUTH_FAILURE,
        outcome: EventOutcome.FAILURE,
        ipAddress: ip,
        reason: 'INVALID_OTP',
        endpoint: '/api/auth/login',
        method: 'POST',
        metadata: { npi },
      });

      return res.status(401).json({
        error: 'invalid_otp',
        message: 'Invalid or expired OTP code.',
        remainingAttempts: otpResult.remainingAttempts,
      });
    }

    const claim = await prisma.npiClaim.findUnique({
      where: { npi },
      include: { user: true },
    });

    if (!claim || !claim.user) {
      await loginAbuseGuard.recordAttempt({
        accountId: npi,
        ip,
        deviceId: resolvedDeviceId,
        success: false,
        metadata: { reason: 'CLAIM_NOT_FOUND' },
      });

      return res.status(404).json({
        error: 'claim_not_found',
        message: 'No verified claim found for this NPI.',
      });
    }

    await loginAbuseGuard.recordAttempt({
      accountId: npi,
      ip,
      deviceId: resolvedDeviceId,
      success: true,
    });

    const role = normalizeRole(claim.user.roles);
    const token = generateToken({ userId: claim.userId, role });
    const now = new Date();
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

    await prisma.auditEvent.create({
      data: {
        type: 'NPI_LOGIN',
        userId: claim.userId,
        subjectNpi: npi,
        data: {
          method: 'otp',
          deviceId: resolvedDeviceId || null,
          userAgent: agent,
          ipHash,
          loggedAt: now.toISOString(),
        },
      },
    });

    const traceSampled = Boolean((res.locals as any)?.traceSampled);

    securityLogger.log({
      eventType: SecurityEventType.AUTH_SUCCESS,
      outcome: EventOutcome.SUCCESS,
      actorId: claim.userId,
      actorType: 'user',
      endpoint: '/api/auth/login',
      method: 'POST',
      ipAddress: ip,
      metadata: {
        npi,
        claimLevel: claim.level,
        traceSampled,
      },
    });

    return res.json({
      token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: claim.user.id,
        did: claim.user.did,
        name: claim.user.name,
        roles: claim.user.roles,
      },
      claim: {
        id: claim.id,
        npi: claim.npi,
        level: claim.level,
        lastVerifiedAt: claim.lastVerifiedAt,
      },
    });
  }
);

export default router;


