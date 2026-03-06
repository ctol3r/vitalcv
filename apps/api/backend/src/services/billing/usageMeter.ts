/**
 * usageMeter.ts — Wave 115: API Usage Metering
 */

import { PrismaClient } from '@prisma/client';
import { log } from '../../obs/logger';

const prisma = new PrismaClient();

const TIER_LIMITS: Record<string, number> = {
  STARTER: 100,
  GROWTH: 1000,
  ENTERPRISE: -1, // unlimited
};

export async function trackRequest(apiKeyId: string): Promise<void> {
  await prisma.subscriptionApiKey.update({
    where: { id: apiKeyId },
    data: { requestCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}

export async function getMonthlyUsage(apiKeyId: string): Promise<{ total: number; limit: number; remaining: number }> {
  const apiKey = await prisma.subscriptionApiKey.findUnique({ where: { id: apiKeyId } });
  if (!apiKey) return { total: 0, limit: 0, remaining: 0 };

  const limit = TIER_LIMITS[apiKey.tier] ?? 100;
  const total = apiKey.requestCount;

  return {
    total,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - total),
  };
}

export async function isOverLimit(apiKeyId: string, tier: string): Promise<boolean> {
  const limit = TIER_LIMITS[tier] ?? 100;
  if (limit === -1) return false;

  const apiKey = await prisma.subscriptionApiKey.findUnique({ where: { id: apiKeyId } });
  if (!apiKey) return true;

  const over = apiKey.requestCount >= limit;
  if (over) {
    log('warn', 'api_key_over_limit', { apiKeyId, requestCount: apiKey.requestCount, limit });
  }
  return over;
}
