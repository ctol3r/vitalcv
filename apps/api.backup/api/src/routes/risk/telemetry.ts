/**
 * B160A-BOT-002: JS telemetry endpoint for client fingerprint collection
 *
 * POST /risk/telemetry accepts JSON {deviceId, signals}.
 * Upserts ClientFingerprint; rate-limited; logs only aggregate fields (no PII).
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { RateLimiter } from '../../../../../backend/src/middleware/rateLimiter';
import {
  ClientTelemetryBodySchema,
  normalizeSignals,
} from '../../../../../services/risk/models/ClientFingerprint';

const router = Router();
const prisma = new PrismaClient();

// Rate limiter: 10 requests per minute per device
const rateLimiter = new RateLimiter(60000, 10);

/**
 * POST /risk/telemetry
 * Accepts telemetry data from client and upserts ClientFingerprint
 */
router.post(
  '/telemetry',
  rateLimiter.middleware((req) => {
    // Rate limit by deviceId if provided, otherwise by IP
    return (req.body?.deviceId as string) || req.ip || 'unknown';
  }),
  async (req: Request, res: Response) => {
    try {
      const validation = ClientTelemetryBodySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid telemetry payload',
          details: validation.error.flatten(),
        });
      }

      const { deviceId, signals } = validation.data;
      const normalizedSignals = normalizeSignals(signals);

      // Extract userId if authenticated (optional)
      const userId = (req as any).user?.id;

      // Upsert ClientFingerprint
      const fingerprint = await prisma.clientFingerprint.upsert({
        where: {
          deviceId,
        },
        create: {
          deviceId,
          userId: userId ?? null,
          signals: normalizedSignals,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
        update: {
          ...(userId ? { userId } : {}),
          signals: normalizedSignals,
          lastSeenAt: new Date(),
        },
      });

      // Log aggregate metrics only (no PII)
      console.info('[TELEMETRY]', {
        hasUserId: !!fingerprint.userId,
        signalsCaptured: Object.keys(normalizedSignals),
        languagesCount: normalizedSignals.languages?.length ?? 0,
        timestamp: new Date().toISOString(),
      });

      return res.status(200).json({
        success: true,
        deviceId: fingerprint.deviceId,
        // Don't return sensitive data
      });
    } catch (error: any) {
      console.error('Telemetry endpoint error:', error);
      return res.status(500).json({
        error: 'internal_error',
        error_description: 'Failed to process telemetry data',
      });
    }
  }
);

export default router;
