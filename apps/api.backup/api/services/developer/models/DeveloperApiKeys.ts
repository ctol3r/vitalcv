/**
 * B227A-DEV-005: DeveloperApiKeys Model
 *
 * Model for managing developer API keys with security features
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface DeveloperApiKeyInput {
  developerId: string;
}

export interface DeveloperApiKeys {
  id: string;
  developerId: string;
  key: string; // Hashed key
  createdAt: Date;
  lastUsedAt: Date | null;
  revoked: boolean;
  revokedAt: Date | null;
}

/**
 * Generate a new API key
 */
export function generateApiKey(): { key: string; hashedKey: string } {
  const key = `vitalcv_${crypto.randomBytes(32).toString('hex')}`;
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
  return { key, hashedKey };
}

/**
 * Hash an API key
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key input
 */
export function validateApiKeyInput(input: DeveloperApiKeyInput): void {
  if (!input.developerId || input.developerId.trim().length === 0) {
    throw new Error('developerId is required');
  }
}

/**
 * Create a new API key for a developer
 */
export async function createApiKey(
  prisma: PrismaClient,
  input: DeveloperApiKeyInput
): Promise<{ apiKey: DeveloperApiKeys; plainKey: string }> {
  validateApiKeyInput(input);

  const { key: plainKey, hashedKey } = generateApiKey();

  const apiKey = await prisma.developerApiKeys.create({
    data: {
      developerId: input.developerId,
      key: hashedKey,
      revoked: false,
    },
  });

  return { apiKey, plainKey };
}

/**
 * Get API key by ID
 */
export async function getApiKey(
  prisma: PrismaClient,
  id: string
): Promise<DeveloperApiKeys | null> {
  return prisma.developerApiKeys.findUnique({
    where: { id },
  });
}

/**
 * Get API keys for a developer
 */
export async function getApiKeysByDeveloper(
  prisma: PrismaClient,
  developerId: string
): Promise<DeveloperApiKeys[]> {
  return prisma.developerApiKeys.findMany({
    where: { developerId, revoked: false },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Verify API key
 */
export async function verifyApiKey(
  prisma: PrismaClient,
  key: string
): Promise<DeveloperApiKeys | null> {
  const hashedKey = hashApiKey(key);

  const apiKey = await prisma.developerApiKeys.findUnique({
    where: { key: hashedKey },
  });

  if (!apiKey || apiKey.revoked) {
    return null;
  }

  // Update lastUsedAt
  await prisma.developerApiKeys.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return apiKey;
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(
  prisma: PrismaClient,
  id: string
): Promise<DeveloperApiKeys> {
  return prisma.developerApiKeys.update({
    where: { id },
    data: {
      revoked: true,
      revokedAt: new Date(),
    },
  });
}

/**
 * Revoke all API keys for a developer
 */
export async function revokeAllApiKeys(
  prisma: PrismaClient,
  developerId: string
): Promise<number> {
  const result = await prisma.developerApiKeys.updateMany({
    where: {
      developerId,
      revoked: false,
    },
    data: {
      revoked: true,
      revokedAt: new Date(),
    },
  });

  return result.count;
}

