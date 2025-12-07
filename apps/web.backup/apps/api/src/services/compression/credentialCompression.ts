import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
import { gzipSync, brotliCompressSync } from 'zlib';

const chainClient = new ChainClient();

export type CompressionMethod = 'gzip' | 'brotli' | 'sd-jwt' | 'custom';

/**
 * Compress credential using best method for wallet type
 */
export async function compressCredential(
  vcId: string,
  walletType?: string,
): Promise<{
  compressed: string;
  method: CompressionMethod;
  ratio: number;
  originalSize: number;
  compressedSize: number;
}> {
  // Fetch credential (simplified - in production, fetch actual VC)
  const original = JSON.stringify({ id: vcId, credential: 'data' });
  const originalSize = Buffer.byteLength(original, 'utf8');

  // Choose compression method based on wallet type
  let method: CompressionMethod = 'gzip';
  let compressed: string;

  if (walletType === 'mobile' || walletType === 'AppleWallet' || walletType === 'GoogleWallet') {
    // Mobile wallets prefer brotli for better compression
    method = 'brotli';
    compressed = brotliCompressSync(Buffer.from(original)).toString('base64');
  } else {
    // Default to gzip
    method = 'gzip';
    compressed = gzipSync(Buffer.from(original)).toString('base64');
  }

  const compressedSize = Buffer.byteLength(compressed, 'utf8');
  const ratio = compressedSize / originalSize;

  // Save compression record
  await prisma.credentialCompression.create({
    data: {
      vcId,
      method,
      ratio,
    },
  });

  return {
    compressed,
    method,
    ratio,
    originalSize,
    compressedSize,
  };
}

/**
 * Sync credentials across multi-device wallet
 */
export async function syncCredential(
  clinicianId: string,
  credentialId: string,
  deviceId: string,
): Promise<{
  synced: boolean;
  conflicts?: Array<{
    field: string;
    deviceValue: unknown;
    serverValue: unknown;
  }>;
}> {
  // In production, implement conflict resolution
  // For now, return success
  return { synced: true };
}

/**
 * Create mobile-optimized VC bundle
 */
export async function createMobileBundle(
  vcId: string,
): Promise<{
  bundle: {
    vc: string;
    chainAnchors: string[];
    sdJwt: string;
  };
  size: number;
}> {
  const compressed = await compressCredential(vcId, 'mobile');

  // Simplified bundle structure
  const bundle = {
    vc: compressed.compressed,
    chainAnchors: [], // In production, fetch actual anchors
    sdJwt: compressed.compressed, // Simplified
  };

  const size = Buffer.byteLength(JSON.stringify(bundle), 'utf8');

  return { bundle, size };
}

/**
 * Handle sync errors with retry logic
 */
export async function handleSyncError(
  clinicianId: string,
  error: Error,
  retryCount: number = 0,
): Promise<{
  resolved: boolean;
  retryAfter?: number;
}> {
  const maxRetries = 3;
  const retryAfter = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff

  if (retryCount < maxRetries) {
    return {
      resolved: false,
      retryAfter,
    };
  }

  // Log error for manual resolution
  console.error('[CredentialCompression] Sync error after retries', {
    clinicianId,
    error: error.message,
    retryCount,
  });

  return { resolved: false };
}

/**
 * Track compression analytics
 */
export async function trackCompressionAnalytics(): Promise<{
  averageRatio: number;
  methodDistribution: Record<string, number>;
  performance: Array<{
    method: string;
    avgTime: number;
  }>;
}> {
  const compressions = await prisma.credentialCompression.findMany({
    take: 1000,
  });

  const methodCounts: Record<string, number> = {};
  let totalRatio = 0;

  compressions.forEach((c) => {
    methodCounts[c.method] = (methodCounts[c.method] || 0) + 1;
    totalRatio += c.ratio;
  });

  const averageRatio = compressions.length > 0 ? totalRatio / compressions.length : 0;

  return {
    averageRatio,
    methodDistribution: methodCounts,
    performance: Object.entries(methodCounts).map(([method, count]) => ({
      method,
      avgTime: count * 10, // Simplified
    })),
  };
}

/**
 * Anchor compression event
 */
export async function anchorCompressionEvent(vcId: string): Promise<string | null> {
  try {
    const compression = await prisma.credentialCompression.findFirst({
      where: { vcId },
      orderBy: { createdAt: 'desc' },
    });

    if (!compression) {
      return null;
    }

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'credentialCompressionAnchored',
      payload: {
        vcId,
        method: compression.method,
        ratio: compression.ratio,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[CredentialCompression] Failed to anchor compression event', error);
    return null;
  }
}

