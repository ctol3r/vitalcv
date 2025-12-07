// B235B-API-011: APIKey model types and utilities

import { PrismaClient, APIKeyStatus } from '@prisma/client';
import crypto from 'crypto';

export interface APIKeyCreateInput {
  ownerOrgId: string;
  scopes: string[];
  metadata?: Record<string, any>;
}

export interface APIKeyResponse {
  id: string;
  keyPrefix: string;
  ownerOrgId: string;
  scopes: string[];
  status: APIKeyStatus;
  createdAt: Date;
  lastUsedAt: Date | null;
  metadata?: Record<string, any> | null;
}

export interface APIKeyWithPlaintext extends APIKeyResponse {
  key: string; // Only returned once on creation
}

/**
 * Hash an API key using SHA-256
 * Never store plaintext API keys in the database
 */
export function hashAPIKey(plaintextKey: string): string {
  return crypto.createHash('sha256').update(plaintextKey).digest('hex');
}

/**
 * Generate a new API key with format: sk_live_<random>
 * Returns both the plaintext key (to return to user once) and the hash
 */
export function generateAPIKey(): { plaintext: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const plaintext = `sk_live_${randomBytes}`;
  const hash = hashAPIKey(plaintext);
  const prefix = plaintext.substring(0, 8); // First 8 chars for identification

  return { plaintext, hash, prefix };
}

/**
 * Verify an API key against a hash
 */
export function verifyAPIKey(plaintextKey: string, hash: string): boolean {
  const computedHash = hashAPIKey(plaintextKey);
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
}

/**
 * Extract API key from Authorization header
 * Supports: "Bearer sk_live_..." or "sk_live_..."
 */
export function extractAPIKeyFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  // Remove "Bearer " prefix if present
  const key = authHeader.replace(/^Bearer\s+/i, '').trim();
  return key || null;
}

