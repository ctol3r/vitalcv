/**
 * B160A-RISK-006: High-value endpoint risk middleware (login, /apply-with-vc, payer enroll)
 *
 * For configured routes, compute RiskScore.
 * If score>threshold, require additional challenge (HTTP 429/403 with reason='HIGH_RISK').
 * Logs incidents; tests for low vs high risk.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { computeRiskScore, storeRiskScore } from '../../../services/risk/engine';
import { getRiskThreshold, exceedsThreshold } from '../config/riskThresholds';
import { recordRiskEvent, RiskDecision } from '../../../services/audit/riskEvents';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Request history cache (in-memory, replace with Redis in production)
const requestHistoryCache = new Map<string, Array<{
  timestamp: Date;
  route: string;
  userId?: string;
}>>();

// Cleanup old entries every 10 minutes
setInterval(() => {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  for (const [key, history] of requestHistoryCache.entries()) {
    const filtered = history.filter((req) => req.timestamp >= tenMinutesAgo);
    if (filtered.length === 0) {
      requestHistoryCache.delete(key);
    } else {
      requestHistoryCache.set(key, filtered);
    }
  }
}, 10 * 60 * 1000);

/**
 * Risk gate middleware factory
 * @param routeKey - Route identifier for threshold lookup (e.g., 'login', 'applyWithVC')
 */
export function riskGate(routeKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get deviceId from request (header, body, or cookie)
      const deviceId =
        req.headers['x-device-id'] ||
        (req.body as any)?.deviceId ||
        (req.cookies as any)?.deviceId ||
        null;

      if (!deviceId) {
        // If no deviceId, allow but log
        console.warn('[RISK_GATE] No deviceId provided for route:', routeKey);
        return next();
      }

      // Get IP address
      const ipAddress =
        req.ip ||
        req.socket.remoteAddress ||
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        'unknown';

      // Get user ID if authenticated
      const userId = (req as any).user?.id;

      // Get user agent
      const userAgent = req.headers['user-agent'] || '';

      // Get request history for this device
      const requestHistory = requestHistoryCache.get(deviceId) || [];

      // Add current request to history
      requestHistory.push({
        timestamp: new Date(),
        route: routeKey,
        userId,
      });
      requestHistoryCache.set(deviceId, requestHistory);

      // Compute risk score
      const riskResult = await computeRiskScore({
        deviceId,
        ipAddress,
        userId,
        userAgent,
        route: routeKey,
        requestHistory: requestHistory.slice(-50), // Last 50 requests
      });

      // Store risk score
      await storeRiskScore(deviceId, ipAddress, riskResult);

      // Get threshold for this route
      const threshold = getRiskThreshold(routeKey);

      // Check if score exceeds threshold
      const decision = exceedsThreshold(riskResult.score, threshold);

      // Hash IP for audit logging
      const ipHash = crypto
        .createHash('sha256')
        .update(ipAddress)
        .digest('hex');

      // Record risk event
      let auditDecision: RiskDecision = 'RISK_EVAL';
      if (decision === 'block') {
        auditDecision = 'RISK_BLOCK';
      } else if (decision === 'allow') {
        auditDecision = 'RISK_ALLOW';
      }

      await recordRiskEvent({
        deviceId,
        ipHash,
        score: riskResult.score,
        route: routeKey,
        decision: auditDecision,
        reasonTags: riskResult.reasonTags,
        threshold: threshold.block,
        metadata: riskResult.details,
      });

      // If score exceeds block threshold, block request
      if (decision === 'block') {
        console.warn('[RISK_GATE] Request blocked', {
          deviceId,
          route: routeKey,
          score: riskResult.score,
          threshold: threshold.block,
          reasonTags: riskResult.reasonTags,
        });

        return res.status(403).json({
          error: 'HIGH_RISK',
          error_description: 'Request blocked due to high risk score',
          reason: 'HIGH_RISK',
          retryAfter: 60, // Suggest retry after 60 seconds
        });
      }

      // If score exceeds warn threshold, log warning but allow
      if (decision === 'warn') {
        console.warn('[RISK_GATE] High risk score (warning)', {
          deviceId,
          route: routeKey,
          score: riskResult.score,
          threshold: threshold.warn,
          reasonTags: riskResult.reasonTags,
        });
      }

      // Add risk score to response headers for monitoring
      res.setHeader('X-Risk-Score', riskResult.score.toString());
      res.setHeader('X-Risk-Reasons', riskResult.reasonTags.join(','));

      // Allow request to proceed
      next();
    } catch (error: any) {
      console.error('[RISK_GATE] Error in risk evaluation:', error);
      // On error, allow request but log
      // In production, you might want to fail closed for high-value routes
      next();
    }
  };
}
