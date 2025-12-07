import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface WalletCloneFinding {
  keyHash: string;
  collisions: number;
  accounts: Array<{
    clinicianId: string;
    deviceId: string;
    lastUsedAt: string | null;
  }>;
}

export interface WalletCloneSummary {
  findings: WalletCloneFinding[];
  totalDevices: number;
}

export async function detectWalletClones(
  prisma: PrismaClient | undefined,
  limit = 5,
): Promise<WalletCloneSummary> {
  if (!prisma) {
    return { findings: [], totalDevices: 0 };
  }

  const walletDelegate = (prisma as PrismaClient & { walletDevice?: { findMany?: Function } }).walletDevice;
  if (typeof walletDelegate?.findMany !== 'function') {
    return { findings: [], totalDevices: 0 };
  }

  const devices = await walletDelegate.findMany({
    select: {
      deviceId: true,
      clinicianId: true,
      publicKeyJwk: true,
      lastUsedAt: true,
    },
  });

  const buckets = new Map<
    string,
    Array<{
      clinicianId: string;
      deviceId: string;
      lastUsedAt: string | null;
    }>
  >();

  for (const device of devices) {
    const normalized = normalizeKey(device.publicKeyJwk);
    if (!normalized) continue;
    const hash = createHash('sha256').update(normalized).digest('hex');
    const bucket = buckets.get(hash) ?? [];
    bucket.push({
      clinicianId: device.clinicianId,
      deviceId: device.deviceId,
      lastUsedAt: device.lastUsedAt ? device.lastUsedAt.toISOString() : null,
    });
    buckets.set(hash, bucket);
  }

  const findings: WalletCloneFinding[] = [];
  buckets.forEach((accounts, keyHash) => {
    const uniqueClinicians = new Set(accounts.map((account) => account.clinicianId));
    if (uniqueClinicians.size > 1) {
      findings.push({
        keyHash,
        collisions: uniqueClinicians.size,
        accounts: accounts.slice(0, 8),
      });
    }
  });

  findings.sort((a, b) => b.collisions - a.collisions);

  return {
    findings: findings.slice(0, limit),
    totalDevices: devices.length,
  };
}

function normalizeKey(key: unknown): string | null {
  if (!key) return null;
  try {
    return JSON.stringify(key, Object.keys(key as Record<string, unknown>).sort());
  } catch {
    return null;
  }
}


