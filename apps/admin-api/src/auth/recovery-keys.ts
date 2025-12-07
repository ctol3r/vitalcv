/**
 * Recovery Keys Service
 *
 * Manages recovery keys for WebAuthn authenticators.
 * Recovery keys allow users to regain access if they lose their authenticators.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

/**
 * Generate a new recovery key
 * Returns the plaintext key (to be shown to user once) and the hash
 */
export async function generateRecoveryKey(
  userId: string,
  name?: string
): Promise<{ key: string; keyHash: string; id: string }> {
  // Generate a secure random recovery key (32 bytes = 256 bits)
  const keyBytes = crypto.randomBytes(32);
  const key = keyBytes.toString('base64url'); // Base64URL for URL-safe encoding

  // Hash the key before storing
  const keyHash = await bcrypt.hash(key, SALT_ROUNDS);

  // Store in database
  const recoveryKey = await prisma.recoveryKey.create({
    data: {
      userId,
      keyHash,
      name,
    },
  });

  return {
    key, // Return plaintext key (show to user once)
    keyHash: recoveryKey.keyHash,
    id: recoveryKey.id,
  };
}

/**
 * Verify a recovery key
 */
export async function verifyRecoveryKey(
  userId: string,
  key: string
): Promise<{ success: boolean; recoveryKeyId?: string; error?: string }> {
  // Get all active recovery keys for user
  const recoveryKeys = await prisma.recoveryKey.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  // Try to match against any recovery key
  for (const recoveryKey of recoveryKeys) {
    const isValid = await bcrypt.compare(key, recoveryKey.keyHash);
    if (isValid) {
      // Mark as used (one-time use recommended)
      await prisma.recoveryKey.update({
        where: { id: recoveryKey.id },
        data: { usedAt: new Date() },
      });

      return { success: true, recoveryKeyId: recoveryKey.id };
    }
  }

  return { success: false, error: 'Invalid recovery key' };
}

/**
 * List user's recovery keys (without exposing keys)
 */
export async function listRecoveryKeys(userId: string) {
  const recoveryKeys = await prisma.recoveryKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      usedAt: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return recoveryKeys;
}

/**
 * Revoke a recovery key
 */
export async function revokeRecoveryKey(
  userId: string,
  recoveryKeyId: string
): Promise<{ success: boolean; error?: string }> {
  const recoveryKey = await prisma.recoveryKey.findUnique({
    where: { id: recoveryKeyId },
  });

  if (!recoveryKey || recoveryKey.userId !== userId) {
    return { success: false, error: 'Recovery key not found' };
  }

  if (recoveryKey.revokedAt) {
    return { success: false, error: 'Recovery key already revoked' };
  }

  await prisma.recoveryKey.update({
    where: { id: recoveryKeyId },
    data: { revokedAt: new Date() },
  });

  return { success: true };
}

/**
 * Rename a recovery key
 */
export async function renameRecoveryKey(
  userId: string,
  recoveryKeyId: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  const recoveryKey = await prisma.recoveryKey.findUnique({
    where: { id: recoveryKeyId },
  });

  if (!recoveryKey || recoveryKey.userId !== userId) {
    return { success: false, error: 'Recovery key not found' };
  }

  await prisma.recoveryKey.update({
    where: { id: recoveryKeyId },
    data: { name },
  });

  return { success: true };
}

