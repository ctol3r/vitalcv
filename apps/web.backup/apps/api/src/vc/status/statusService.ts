/**
 * VC Status Service - StatusList v2.0 Implementation
 *
 * Manages credential revocation status using W3C StatusList v2.0 bitstring-based approach.
 * Supports allocation of status positions, marking revoked, and fetching current status.
 *
 * References:
 * - https://www.w3.org/TR/vc-status-list-2021/
 * - https://www.w3.org/TR/vc-data-model-2.0/#status
 */

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

export interface StatusListAllocation {
  statusListId: string;
  bitIndex: number;
  statusListIndex: number;
  statusListCredential: string; // URL to the status list credential
}

export interface StatusCheckResult {
  revoked: boolean;
  statusListId: string;
  bitIndex: number;
  revokedAt?: Date;
  reason?: string;
}

/**
 * Allocate a status position for a new credential
 */
export async function allocateStatusPosition(
  issuerId: string,
  purpose: 'revocation' | 'suspension' = 'revocation',
): Promise<StatusListAllocation> {
  // Find or create a status list for this issuer and purpose
  let statusList = await prisma.credentialStatusList.findFirst({
    where: {
      issuerId,
      purpose,
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
    },
    orderBy: { createdAt: 'desc' },
  });

  // If no active list exists or current list is full, create a new one
  if (!statusList || statusList.size >= 131072) {
    // StatusList v2 supports up to 131,072 entries per list
    statusList = await prisma.credentialStatusList.create({
      data: {
        issuerId,
        purpose,
        statusListIndex: await getNextStatusListIndex(issuerId, purpose),
        bitstring: '', // Empty bitstring, will be populated as entries are added
        size: 0,
        validFrom: new Date(),
      },
    });
  }

  // Allocate next available bit index
  const bitIndex = statusList.size;
  const newSize = bitIndex + 1;

  // Update bitstring (simplified - in production, use proper bit manipulation)
  const updatedBitstring = updateBitstring(statusList.bitstring, bitIndex, false);

  await prisma.credentialStatusList.update({
    where: { id: statusList.id },
    data: {
      size: newSize,
      bitstring: updatedBitstring,
      updatedAt: new Date(),
    },
  });

  // Build status list credential URL
  const statusListCredential = buildStatusListCredentialUrl(statusList.id);

  return {
    statusListId: statusList.id,
    bitIndex,
    statusListIndex: statusList.statusListIndex,
    statusListCredential,
  };
}

/**
 * Mark a credential as revoked
 */
export async function markRevoked(
  credentialId: string,
  statusListId: string,
  bitIndex: number,
  reason?: string,
): Promise<void> {
  // Update or create status entry
  await prisma.credentialStatusEntry.upsert({
    where: {
      credentialId_statusListId: {
        credentialId,
        statusListId,
      },
    },
    create: {
      credentialId,
      statusListId,
      bitIndex,
      revoked: true,
      revokedAt: new Date(),
      reason,
    },
    update: {
      revoked: true,
      revokedAt: new Date(),
      reason,
      updatedAt: new Date(),
    },
  });

  // Update bitstring in status list
  const statusList = await prisma.credentialStatusList.findUnique({
    where: { id: statusListId },
  });

  if (statusList) {
    const updatedBitstring = updateBitstring(statusList.bitstring, bitIndex, true);
    await prisma.credentialStatusList.update({
      where: { id: statusListId },
      data: {
        bitstring: updatedBitstring,
        updatedAt: new Date(),
      },
    });
  }
}

/**
 * Check if a credential is revoked
 */
export async function checkStatus(
  credentialId: string,
  statusListId?: string,
): Promise<StatusCheckResult | null> {
  const where: any = { credentialId };

  if (statusListId) {
    where.statusListId = statusListId;
  }

  const entry = await prisma.credentialStatusEntry.findFirst({
    where,
    include: {
      statusList: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!entry) {
    return null;
  }

  return {
    revoked: entry.revoked,
    statusListId: entry.statusListId,
    bitIndex: entry.bitIndex,
    revokedAt: entry.revokedAt || undefined,
    reason: entry.reason || undefined,
  };
}

/**
 * Get status list credential (for embedding in VC)
 */
export async function getStatusListCredential(statusListId: string): Promise<{
  id: string;
  type: string;
  statusPurpose: string;
  encodedList: string; // Base64-encoded compressed bitstring
  statusListIndex: number;
}> {
  const statusList = await prisma.credentialStatusList.findUnique({
    where: { id: statusListId },
  });

  if (!statusList) {
    throw new Error(`Status list not found: ${statusListId}`);
  }

  // Compress bitstring (StatusList v2 uses GZIP compression)
  const encodedList = compressBitstring(statusList.bitstring);

  return {
    id: buildStatusListCredentialUrl(statusListId),
    type: 'StatusList2021Entry',
    statusPurpose: statusList.purpose,
    encodedList,
    statusListIndex: statusList.statusListIndex,
  };
}

/**
 * Get next status list index for an issuer
 */
async function getNextStatusListIndex(issuerId: string, purpose: string): Promise<number> {
  const lastList = await prisma.credentialStatusList.findFirst({
    where: { issuerId, purpose },
    orderBy: { statusListIndex: 'desc' },
  });

  return (lastList?.statusListIndex ?? -1) + 1;
}

/**
 * Update bitstring at a specific bit index
 */
function updateBitstring(bitstring: string, bitIndex: number, value: boolean): string {
  // Simplified implementation - in production, use proper bit manipulation
  // StatusList v2 uses a bitstring where 1 = revoked, 0 = not revoked
  const bits = bitstring ? Buffer.from(bitstring, 'base64').toString('binary') : '';
  const byteIndex = Math.floor(bitIndex / 8);
  const bitOffset = bitIndex % 8;

  // Pad if necessary
  const neededBytes = byteIndex + 1;
  const currentBytes = Math.ceil(bits.length / 8);
  let paddedBits = bits.padEnd(currentBytes * 8, '0');

  if (neededBytes > currentBytes) {
    paddedBits = paddedBits.padEnd(neededBytes * 8, '0');
  }

  // Set the bit
  const byte = paddedBits.charCodeAt(byteIndex) || 0;
  const mask = 1 << (7 - bitOffset);
  const newByte = value ? byte | mask : byte & ~mask;
  const newBits = paddedBits.split('');
  newBits[byteIndex] = String.fromCharCode(newByte);
  const newBitstring = newBits.join('');

  // Convert back to base64
  return Buffer.from(newBitstring, 'binary').toString('base64');
}

/**
 * Compress bitstring using GZIP (StatusList v2 requirement)
 */
function compressBitstring(bitstring: string): string {
  // In production, use zlib.gzipSync() or similar
  // For now, return base64-encoded (simplified)
  const { gzipSync } = require('zlib');
  const compressed = gzipSync(Buffer.from(bitstring, 'base64'));
  return compressed.toString('base64url');
}

/**
 * Build status list credential URL
 */
function buildStatusListCredentialUrl(statusListId: string): string {
  const baseUrl = process.env.VC_STATUS_LIST_BASE_URL || 'https://api.vitalcv.com/vc/status';
  return `${baseUrl}/${statusListId}`;
}

/**
 * Prepare hooks for future on-chain anchoring to Substrate AuditScrapbook pallet
 */
export async function prepareChainAnchor(
  statusListId: string,
  action: 'created' | 'updated' | 'entry_revoked',
): Promise<{
  ready: boolean;
  anchorData?: {
    statusListId: string;
    action: string;
    merkleRoot?: string;
  };
}> {
  // This is a placeholder for future Substrate integration
  // The actual anchoring would be done via the ChainClient
  const statusList = await prisma.credentialStatusList.findUnique({
    where: { id: statusListId },
  });

  if (!statusList) {
    return { ready: false };
  }

  // Compute merkle root of status list (for on-chain anchoring)
  const merkleRoot = computeMerkleRoot(statusList.bitstring);

  return {
    ready: true,
    anchorData: {
      statusListId,
      action,
      merkleRoot,
    },
  };
}

/**
 * Compute merkle root of status list (simplified)
 */
function computeMerkleRoot(bitstring: string): string {
  const hash = createHash('sha256');
  hash.update(bitstring);
  return hash.digest('hex');
}
