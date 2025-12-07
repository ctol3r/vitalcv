/**
 * B133B-SBX-002: Sandbox API keys issue/rotate for partners
 *
 * Endpoints for managing sandbox API keys:
 * - POST /sandbox/keys - Issue new sandbox key
 * - GET /sandbox/keys - List all sandbox keys for partner
 * - DELETE /sandbox/keys/:keyId - Revoke a sandbox key
 *
 * All keys are sandbox-scoped and never work in production.
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { isSandboxMode } from '../../config/env';

const router = Router();

// In-memory storage for sandbox keys (in production, use database)
interface SandboxKey {
  id: string;
  partnerId: string;
  keyPrefix: string; // For display (e.g., "sk_sandbox_abc...xyz")
  keyHash: string;   // SHA-256 hash of full key
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  isActive: boolean;
  metadata?: Record<string, any>;
}

// Store for sandbox keys (keyed by keyId)
const sandboxKeys = new Map<string, SandboxKey>();

// Store for quick hash lookup (keyed by keyHash)
const keyHashIndex = new Map<string, string>(); // keyHash -> keyId

/**
 * Generate a new sandbox API key
 * Format: sk_sandbox_<random_32_chars>
 */
function generateSandboxKey(): { key: string; keyHash: string; keyPrefix: string } {
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  const key = `sk_sandbox_${randomBytes}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = `${key.substring(0, 15)}...${key.substring(key.length - 6)}`;

  return { key, keyHash, keyPrefix };
}

/**
 * Validate that we're in sandbox mode
 */
function requireSandboxMode(req: Request, res: Response, next: Function) {
  if (!isSandboxMode()) {
    return res.status(403).json({
      error: 'forbidden',
      message: 'Sandbox key management is only available in sandbox mode',
    });
  }
  next();
}

/**
 * POST /sandbox/keys
 * Issue a new sandbox API key
 */
router.post('/keys', requireSandboxMode, async (req: Request, res: Response) => {
  try {
    const { partnerId, name, metadata } = req.body;

    if (!partnerId) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'partnerId is required',
      });
    }

    if (!name) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'name is required',
      });
    }

    // Generate new key
    const { key, keyHash, keyPrefix } = generateSandboxKey();
    const keyId = crypto.randomUUID();

    // Store key
    const sandboxKey: SandboxKey = {
      id: keyId,
      partnerId,
      keyPrefix,
      keyHash,
      name,
      createdAt: new Date(),
      lastUsedAt: null,
      isActive: true,
      metadata,
    };

    sandboxKeys.set(keyId, sandboxKey);
    keyHashIndex.set(keyHash, keyId);

    console.log(`✅ Issued sandbox key for partner ${partnerId}: ${keyPrefix}`);

    // Return the full key ONLY on creation (never again)
    return res.status(201).json({
      id: keyId,
      partnerId,
      key, // ⚠️ ONLY returned on creation
      keyPrefix,
      name,
      createdAt: sandboxKey.createdAt,
      isActive: true,
      message: 'Store this key securely - it will not be shown again',
      scope: 'sandbox',
      baseUrl: process.env.SANDBOX_BASE_URL || 'https://sandbox-api.vitalcv.com',
    });
  } catch (error: any) {
    console.error('[sandboxKeys] Error issuing key:', error);
    return res.status(500).json({
      error: 'key_generation_failed',
      message: error.message,
    });
  }
});

/**
 * GET /sandbox/keys
 * List all sandbox keys for a partner
 */
router.get('/keys', requireSandboxMode, async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.query;

    if (!partnerId) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'partnerId query parameter is required',
      });
    }

    // Get all keys for this partner
    const partnerKeys = Array.from(sandboxKeys.values())
      .filter(key => key.partnerId === partnerId)
      .map(key => ({
        id: key.id,
        partnerId: key.partnerId,
        keyPrefix: key.keyPrefix, // Never return full key
        name: key.name,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        isActive: key.isActive,
        metadata: key.metadata,
      }));

    return res.json({
      keys: partnerKeys,
      total: partnerKeys.length,
      scope: 'sandbox',
    });
  } catch (error: any) {
    console.error('[sandboxKeys] Error listing keys:', error);
    return res.status(500).json({
      error: 'list_failed',
      message: error.message,
    });
  }
});

/**
 * DELETE /sandbox/keys/:keyId
 * Revoke a sandbox key
 */
router.delete('/keys/:keyId', requireSandboxMode, async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;

    const key = sandboxKeys.get(keyId);

    if (!key) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Sandbox key not found',
      });
    }

    // Mark as inactive (soft delete)
    key.isActive = false;
    sandboxKeys.set(keyId, key);

    // Remove from hash index
    keyHashIndex.delete(key.keyHash);

    console.log(`🗑️  Revoked sandbox key: ${key.keyPrefix}`);

    return res.json({
      id: keyId,
      keyPrefix: key.keyPrefix,
      revoked: true,
      revokedAt: new Date(),
    });
  } catch (error: any) {
    console.error('[sandboxKeys] Error revoking key:', error);
    return res.status(500).json({
      error: 'revocation_failed',
      message: error.message,
    });
  }
});

/**
 * POST /sandbox/keys/:keyId/rotate
 * Rotate a sandbox key (revoke old, issue new)
 */
router.post('/keys/:keyId/rotate', requireSandboxMode, async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;

    const oldKey = sandboxKeys.get(keyId);

    if (!oldKey) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Sandbox key not found',
      });
    }

    // Generate new key
    const { key, keyHash, keyPrefix } = generateSandboxKey();
    const newKeyId = crypto.randomUUID();

    // Create new key with same partner and name
    const newKey: SandboxKey = {
      id: newKeyId,
      partnerId: oldKey.partnerId,
      keyPrefix,
      keyHash,
      name: `${oldKey.name} (rotated)`,
      createdAt: new Date(),
      lastUsedAt: null,
      isActive: true,
      metadata: {
        ...oldKey.metadata,
        rotatedFrom: keyId,
      },
    };

    // Revoke old key
    oldKey.isActive = false;
    sandboxKeys.set(keyId, oldKey);
    keyHashIndex.delete(oldKey.keyHash);

    // Store new key
    sandboxKeys.set(newKeyId, newKey);
    keyHashIndex.set(keyHash, newKeyId);

    console.log(`🔄 Rotated sandbox key: ${oldKey.keyPrefix} -> ${keyPrefix}`);

    return res.json({
      oldKey: {
        id: keyId,
        keyPrefix: oldKey.keyPrefix,
        revoked: true,
      },
      newKey: {
        id: newKeyId,
        partnerId: newKey.partnerId,
        key, // ⚠️ ONLY returned on creation/rotation
        keyPrefix,
        name: newKey.name,
        createdAt: newKey.createdAt,
        isActive: true,
      },
      message: 'Store the new key securely - it will not be shown again',
    });
  } catch (error: any) {
    console.error('[sandboxKeys] Error rotating key:', error);
    return res.status(500).json({
      error: 'rotation_failed',
      message: error.message,
    });
  }
});

/**
 * Validate a sandbox API key
 * This is used by middleware to authenticate requests
 */
export function validateSandboxKey(apiKey: string): SandboxKey | null {
  if (!apiKey || !apiKey.startsWith('sk_sandbox_')) {
    return null;
  }

  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const keyId = keyHashIndex.get(keyHash);

  if (!keyId) {
    return null;
  }

  const key = sandboxKeys.get(keyId);

  if (!key || !key.isActive) {
    return null;
  }

  // Update last used timestamp
  key.lastUsedAt = new Date();
  sandboxKeys.set(keyId, key);

  return key;
}

export default router;

