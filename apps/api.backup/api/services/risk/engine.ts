/**
 * B160A-RISK-005: Risk scoring engine for bot/abuse detection
 *
 * Given deviceId+ip+telemetry+request history, outputs numeric score & reasons.
 * Rules: high velocity, multiple accounts per device, weird UA, Tor/known bad IP ranges stub.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { checkReputation } from './reputationStore';

const prisma = new PrismaClient();

export interface RiskScoreResult {
  score: number; // 0-100
  reasonTags: string[];
  details?: Record<string, any>;
}

export interface RiskEvaluationInput {
  deviceId: string;
  ipAddress: string;
  userId?: string;
  userAgent?: string;
  route?: string;
  requestHistory?: Array<{
    timestamp: Date;
    route: string;
    userId?: string;
  }>;
}

/**
 * Compute risk score for a request
 */
export async function computeRiskScore(
  input: RiskEvaluationInput
): Promise<RiskScoreResult> {
  const reasonTags: string[] = [];
  let score = 0;
  const details: Record<string, any> = {};

  // Hash IP address for privacy
  const ipHash = crypto
    .createHash('sha256')
    .update(input.ipAddress)
    .digest('hex');

  // 1. Check reputation store (blocklist)
  const reputation = await checkReputation(input.deviceId, ipHash);
  if (reputation) {
    score += reputation.severity === 'BLOCK' ? 100 :
             reputation.severity === 'HIGH' ? 80 :
             reputation.severity === 'MEDIUM' ? 50 : 30;
    reasonTags.push(`REPUTATION_${reputation.severity}`);
    details.reputation = {
      reason: reputation.reason,
      severity: reputation.severity,
    };
  }

  // 2. Check velocity (requests per time window)
  if (input.requestHistory && input.requestHistory.length > 0) {
    const velocityScore = await checkVelocity(input.requestHistory);
    if (velocityScore > 0) {
      score += velocityScore;
      reasonTags.push('HIGH_VELOCITY');
      details.velocity = {
        requestsInWindow: input.requestHistory.length,
        windowMinutes: 5,
      };
    }
  }

  // 3. Check multiple accounts per device
  if (input.deviceId) {
    const multiAccountScore = await checkMultipleAccountsPerDevice(
      input.deviceId,
      input.userId
    );
    if (multiAccountScore > 0) {
      score += multiAccountScore;
      reasonTags.push('MULTIPLE_ACCOUNTS');
      details.multipleAccounts = {
        deviceId: input.deviceId,
        accountCount: multiAccountScore / 20, // Rough estimate
      };
    }
  }

  // 4. Check suspicious user agent
  if (input.userAgent) {
    const uaScore = checkSuspiciousUserAgent(input.userAgent);
    if (uaScore > 0) {
      score += uaScore;
      reasonTags.push('SUSPICIOUS_UA');
      details.userAgent = {
        suspicious: true,
        userAgent: input.userAgent.substring(0, 100), // Truncate for logging
      };
    }
  }

  // 5. Check IP reputation (Tor, known bad ranges)
  const ipRepScore = await checkIpReputation(input.ipAddress);
  if (ipRepScore > 0) {
    score += ipRepScore;
    reasonTags.push('BAD_IP');
    details.ipReputation = {
      risk: 'HIGH',
    };
  }

  // 6. Check impossible travel (if we have location data)
  // This would require geolocation data from IP or telemetry
  // For now, stub implementation

  // Cap score at 100
  score = Math.min(100, score);

  return {
    score,
    reasonTags: [...new Set(reasonTags)], // Remove duplicates
    details,
  };
}

/**
 * Check request velocity (high frequency requests)
 */
async function checkVelocity(
  requestHistory: Array<{ timestamp: Date; route: string; userId?: string }>
): Promise<number> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const recentRequests = requestHistory.filter(
    (req) => req.timestamp >= fiveMinutesAgo
  );

  // More than 20 requests in 5 minutes = high velocity
  if (recentRequests.length > 20) {
    return 40; // High risk
  }

  // More than 10 requests in 5 minutes = medium velocity
  if (recentRequests.length > 10) {
    return 20; // Medium risk
  }

  return 0;
}

/**
 * Check if device is associated with multiple user accounts
 */
async function checkMultipleAccountsPerDevice(
  deviceId: string,
  currentUserId?: string
): Promise<number> {
  // Count distinct userIds for this deviceId
  const fingerprints = await prisma.clientFingerprint.findMany({
    where: {
      deviceId,
      userId: { not: null },
    },
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });

  const uniqueUserCount = fingerprints.length;

  // If device has 3+ different users, it's suspicious
  if (uniqueUserCount >= 3) {
    return 40; // High risk
  }

  // If device has 2 different users, it's moderately suspicious
  if (uniqueUserCount >= 2) {
    return 20; // Medium risk
  }

  return 0;
}

/**
 * Check for suspicious user agent strings
 */
function checkSuspiciousUserAgent(userAgent: string): number {
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /headless/i,
    /phantom/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,
    /^$/i, // Empty UA
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(userAgent)) {
      return 30; // Suspicious UA
    }
  }

  // Check for very short or very long UAs (often bots)
  if (userAgent.length < 10 || userAgent.length > 500) {
    return 20;
  }

  return 0;
}

/**
 * Check IP reputation (Tor, known bad IP ranges)
 * Stub implementation - in production, use IP reputation service
 */
async function checkIpReputation(ipAddress: string): Promise<number> {
  // Stub: Check if IP is in known Tor exit node ranges
  // In production, use a service like:
  // - AbuseIPDB
  // - MaxMind GeoIP2
  // - Tor exit node list

  // For now, return 0 (no risk detected)
  // In production, you'd check:
  // - Tor exit nodes
  // - Known VPN/proxy ranges
  // - Known malicious IP ranges
  // - Geographic anomalies

  return 0;
}

/**
 * Store or update risk score in database
 */
export async function storeRiskScore(
  deviceId: string,
  ipAddress: string,
  scoreResult: RiskScoreResult
): Promise<void> {
  const ipHash = crypto
    .createHash('sha256')
    .update(ipAddress)
    .digest('hex');

  await prisma.riskScore.upsert({
    where: {
      deviceId_ipHash: {
        deviceId,
        ipHash,
      },
    },
    create: {
      deviceId,
      ipHash,
      score: scoreResult.score,
      reasonTags: scoreResult.reasonTags,
    },
    update: {
      score: scoreResult.score,
      reasonTags: scoreResult.reasonTags,
      lastUpdatedAt: new Date(),
    },
  });
}

