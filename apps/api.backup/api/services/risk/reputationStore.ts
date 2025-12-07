/**
 * B160A-RISK-008: Device reputation cache (blocklist of known bad deviceIds/IPs)
 *
 * Stores deviceIds & ipHash with attributes (reason, expiresAt).
 * Risk engine upscores or blocks if match.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReputationEntry {
  deviceId?: string;
  ipHash?: string;
  reason: string;
  expiresAt?: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCK';
}

/**
 * Add a device or IP to the reputation store (blocklist)
 */
export async function addToReputationStore(entry: ReputationEntry): Promise<void> {
  // In production, this would use a Redis cache or similar
  // For now, we'll use an in-memory store with expiration
  // In a real implementation, you'd want:
  // - Redis with TTL for expiration
  // - Persistent storage for audit trail
  // - Distributed cache for multi-instance deployments

  const key = entry.deviceId ? `device:${entry.deviceId}` : `ip:${entry.ipHash}`;

  // Store in a simple in-memory Map for now
  // In production, use Redis: await redis.setex(key, ttlSeconds, JSON.stringify(entry))
  reputationCache.set(key, {
    ...entry,
    addedAt: new Date(),
  });

  // Also log to audit for compliance
  await prisma.auditEvent.create({
    data: {
      type: 'REPUTATION_BLOCKLIST_ADDED',
      data: {
        deviceId: entry.deviceId,
        ipHash: entry.ipHash,
        reason: entry.reason,
        severity: entry.severity,
        expiresAt: entry.expiresAt,
      },
    },
  });
}

/**
 * Check if a device or IP is in the reputation store
 */
export async function checkReputation(
  deviceId?: string,
  ipHash?: string
): Promise<ReputationEntry | null> {
  if (deviceId) {
    const deviceEntry = reputationCache.get(`device:${deviceId}`);
    if (deviceEntry && !isExpired(deviceEntry)) {
      return deviceEntry;
    }
    // Clean up expired entry
    if (deviceEntry) {
      reputationCache.delete(`device:${deviceId}`);
    }
  }

  if (ipHash) {
    const ipEntry = reputationCache.get(`ip:${ipHash}`);
    if (ipEntry && !isExpired(ipEntry)) {
      return ipEntry;
    }
    // Clean up expired entry
    if (ipEntry) {
      reputationCache.delete(`ip:${ipHash}`);
    }
  }

  return null;
}

/**
 * Remove a device or IP from the reputation store
 */
export async function removeFromReputationStore(
  deviceId?: string,
  ipHash?: string
): Promise<void> {
  if (deviceId) {
    reputationCache.delete(`device:${deviceId}`);
  }
  if (ipHash) {
    reputationCache.delete(`ip:${ipHash}`);
  }

  // Log removal
  await prisma.auditEvent.create({
    data: {
      type: 'REPUTATION_BLOCKLIST_REMOVED',
      data: {
        deviceId,
        ipHash,
      },
    },
  });
}

/**
 * Check if an entry is expired
 */
function isExpired(entry: ReputationEntry & { addedAt: Date }): boolean {
  if (!entry.expiresAt) {
    return false; // No expiration
  }
  return new Date() > entry.expiresAt;
}

/**
 * Get all active reputation entries (for admin/debugging)
 */
export async function getAllReputationEntries(): Promise<
  Array<ReputationEntry & { addedAt: Date; key: string }>
> {
  const entries: Array<ReputationEntry & { addedAt: Date; key: string }> = [];

  for (const [key, entry] of reputationCache.entries()) {
    if (!isExpired(entry)) {
      entries.push({
        ...entry,
        key,
      });
    }
  }

  return entries;
}

// In-memory cache (replace with Redis in production)
const reputationCache = new Map<
  string,
  ReputationEntry & { addedAt: Date }
>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  for (const [key, entry] of reputationCache.entries()) {
    if (isExpired(entry)) {
      reputationCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

