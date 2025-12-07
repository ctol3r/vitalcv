/**
 * S72-D1-B-007: Simple 'anchor' stub: hash & fake block height
 *
 * Computes SHA256 of manifest and stores with fake block height
 * No real chain required - this is a stub for testing
 *
 * In production, this would integrate with actual blockchain anchoring
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export interface AnchorResult {
  anchorId: string;
  evidenceId: string;
  hash: string;
  blockHeight: number;
  timestamp: string;
  chainType: 'stub';
}

/**
 * Compute SHA-256 hash of JSON data
 *
 * @param data - Data to hash (will be JSON.stringify'd)
 * @returns SHA-256 hash as hex string
 */
export function computeHash(data: any): string {
  const jsonString = JSON.stringify(data);
  const hash = crypto.createHash('sha256');
  hash.update(jsonString);
  return hash.digest('hex');
}

/**
 * Generate fake block height
 * For stub purposes only - simulates blockchain block number
 *
 * @returns Random block height between 1000000 and 9999999
 */
function generateFakeBlockHeight(): number {
  return Math.floor(Math.random() * 9000000) + 1000000;
}

/**
 * Generate random anchor ID
 *
 * @returns Random anchor ID string
 */
function generateAnchorId(): string {
  return `anchor-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Anchor evidence bundle to stub chain
 *
 * Computes SHA-256 hash of manifest and stores with fake block height
 *
 * @param evidenceId - Evidence bundle ID
 * @returns Anchor result with hash and fake block height
 */
export async function anchorEvidence(evidenceId: string): Promise<AnchorResult> {
  // Fetch evidence bundle
  const evidenceBundle = await prisma.pSVEvidenceBundle.findUnique({
    where: { id: evidenceId },
  });

  if (!evidenceBundle) {
    throw new Error(`Evidence bundle not found: ${evidenceId}`);
  }

  // Compute hash of manifest
  const hash = computeHash(evidenceBundle.bundleJson);

  // Generate fake block height
  const blockHeight = generateFakeBlockHeight();

  // Generate anchor ID
  const anchorId = generateAnchorId();

  // Store anchor information
  const timestamp = new Date().toISOString();

  await prisma.pSVEvidenceBundle.update({
    where: { id: evidenceId },
    data: {
      anchorId,
      anchorHash: hash,
      blockHeight,
    },
  });

  return {
    anchorId,
    evidenceId,
    hash,
    blockHeight,
    timestamp,
    chainType: 'stub',
  };
}

/**
 * Verify anchor hash matches evidence bundle
 *
 * @param evidenceId - Evidence bundle ID
 * @returns true if hash matches, false otherwise
 */
export async function verifyAnchor(evidenceId: string): Promise<boolean> {
  const evidenceBundle = await prisma.pSVEvidenceBundle.findUnique({
    where: { id: evidenceId },
  });

  if (!evidenceBundle) {
    throw new Error(`Evidence bundle not found: ${evidenceId}`);
  }

  if (!evidenceBundle.anchorHash) {
    throw new Error(`Evidence bundle not anchored: ${evidenceId}`);
  }

  // Recompute hash and compare
  const computedHash = computeHash(evidenceBundle.bundleJson);

  return computedHash === evidenceBundle.anchorHash;
}

/**
 * Get anchor information for evidence bundle
 *
 * @param evidenceId - Evidence bundle ID
 * @returns Anchor result, or null if not anchored
 */
export async function getAnchorInfo(evidenceId: string): Promise<AnchorResult | null> {
  const evidenceBundle = await prisma.pSVEvidenceBundle.findUnique({
    where: { id: evidenceId },
  });

  if (!evidenceBundle) {
    throw new Error(`Evidence bundle not found: ${evidenceId}`);
  }

  if (!evidenceBundle.anchorId || !evidenceBundle.anchorHash || !evidenceBundle.blockHeight) {
    return null;
  }

  return {
    anchorId: evidenceBundle.anchorId,
    evidenceId: evidenceBundle.id,
    hash: evidenceBundle.anchorHash,
    blockHeight: evidenceBundle.blockHeight,
    timestamp: evidenceBundle.createdAt.toISOString(),
    chainType: 'stub',
  };
}

/**
 * Batch anchor multiple evidence bundles
 *
 * @param evidenceIds - Array of evidence bundle IDs
 * @returns Array of anchor results
 */
export async function batchAnchorEvidence(evidenceIds: string[]): Promise<AnchorResult[]> {
  const results: AnchorResult[] = [];

  for (const evidenceId of evidenceIds) {
    try {
      const result = await anchorEvidence(evidenceId);
      results.push(result);
    } catch (error) {
      console.error(`Failed to anchor evidence ${evidenceId}:`, error);
      // Continue with other evidence bundles
    }
  }

  return results;
}

/**
 * Get anchor statistics
 *
 * @returns Statistics about anchored evidence bundles
 */
export async function getAnchorStatistics(): Promise<{
  totalBundles: number;
  anchoredBundles: number;
  unanchoredBundles: number;
  averageBlockHeight: number;
}> {
  const allBundles = await prisma.pSVEvidenceBundle.findMany({
    select: {
      anchorHash: true,
      blockHeight: true,
    },
  });

  const totalBundles = allBundles.length;
  const anchoredBundles = allBundles.filter((b) => b.anchorHash !== null).length;
  const unanchoredBundles = totalBundles - anchoredBundles;

  const blockHeights = allBundles
    .filter((b) => b.blockHeight !== null)
    .map((b) => b.blockHeight as number);

  const averageBlockHeight = blockHeights.length > 0
    ? Math.floor(blockHeights.reduce((sum, h) => sum + h, 0) / blockHeights.length)
    : 0;

  return {
    totalBundles,
    anchoredBundles,
    unanchoredBundles,
    averageBlockHeight,
  };
}

/**
 * Test hash format validation
 *
 * @param hash - Hash string to validate
 * @returns true if valid SHA-256 hash format
 */
export function isValidHashFormat(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

