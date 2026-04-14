// @ts-nocheck
/**
 * apiKeyService.ts — Wave 115: API Key Management
 *
 * Generates, validates, and tracks API keys for VitalCV subscribers.
 * Keys are stored hashed (SHA-256). Raw key shown once on creation.
 * Uses SubscriptionApiKey model (distinct from org-level ApiKey).
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { normalizeBillingTier } from '@vitalcv/shared/pricing';
import { log } from '../../obs/logger';
import type { BillingTier } from './contracts';

const prisma = new PrismaClient();

function hashKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export async function generateApiKey(
  clinicianId: string,
  name: string,
  tier: BillingTier = 'STARTER',
): Promise<{ rawKey: string; keyId: string }> {
  const rawKey = `vk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashKey(rawKey);
  const normalizedTier = normalizeBillingTier(tier);

  const record = await prisma.subscriptionApiKey.create({
    data: { clinicianId, keyHash, name, tier: normalizedTier },
  });

  log('info', 'api_key_generated', { clinicianId, keyId: record.id, name });
  return { rawKey, keyId: record.id };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await prisma.subscriptionApiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });
  log('info', 'api_key_revoked', { keyId });
}

export async function validateApiKey(
  rawKey: string,
): Promise<{ valid: boolean; clinicianId?: string; tier?: BillingTier; keyId?: string }> {
  const keyHash = hashKey(rawKey);
  const record = await prisma.subscriptionApiKey.findUnique({ where: { keyHash } });

  if (!record || record.revokedAt) {
    return { valid: false };
  }

  // Update usage counters (fire-and-forget)
  prisma.subscriptionApiKey.update({
    where: { id: record.id },
    data: { requestCount: { increment: 1 }, lastUsedAt: new Date() },
  }).catch(() => { /* non-critical */ });

  return {
    valid: true,
    clinicianId: record.clinicianId,
    tier: normalizeBillingTier(record.tier),
    keyId: record.id,
  };
}

export async function getApiKeysByClinicianId(
  clinicianId: string,
): Promise<Array<{ id: string; name: string; tier: BillingTier; requestCount: number; lastUsedAt: Date | null; revokedAt: Date | null; createdAt: Date }>> {
  return prisma.subscriptionApiKey.findMany({
    where: { clinicianId },
    select: { id: true, name: true, tier: true, requestCount: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  }).then((records) => records.map((record) => ({
    ...record,
    tier: normalizeBillingTier(record.tier),
  })));
}

export async function getUsage(keyId: string): Promise<{ requests: number; lastUsed: Date | null }> {
  const record = await prisma.subscriptionApiKey.findUnique({
    where: { id: keyId },
    select: { requestCount: true, lastUsedAt: true },
  });
  return { requests: record?.requestCount ?? 0, lastUsed: record?.lastUsedAt ?? null };
}
