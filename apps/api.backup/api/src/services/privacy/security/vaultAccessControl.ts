/**
 * VaultAccessControl
 * B237A-DP-004: VaultAccessControl
 *
 * Enforces access to vault and records based on owner and authorized sharing tokens.
 * Validates scopes, logs access events, and integrates with existing RBAC.
 */

import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../../middleware/accessGuards';
import { logVaultAccess } from '../audit/vaultAuditLog';

const prisma = new PrismaClient();

export type AccessScope =
  | 'read:all'
  | 'read:credentials'
  | 'read:contracts'
  | 'read:logs'
  | 'read:profile'
  | 'write:all'
  | 'write:credentials'
  | 'write:contracts'
  | 'write:logs'
  | 'write:profile'
  | 'delete:all'
  | 'delete:credentials'
  | 'delete:contracts'
  | 'delete:logs'
  | 'delete:profile'
  | 'export:all'
  | 'share:all';

export interface AccessContext {
  userId: string;
  roles: string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  scope?: AccessScope;
}

/**
 * Check if user has access to vault
 */
export async function checkVaultAccess(
  vaultId: string,
  context: AccessContext,
  requiredScope: AccessScope
): Promise<AccessResult> {
  // Get vault
  const vault = await prisma.personalDataVault.findUnique({
    where: { id: vaultId },
    include: {
      sharingTokens: {
        where: {
          isRevoked: false,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      },
    },
  });

  if (!vault) {
    return { allowed: false, reason: 'Vault not found' };
  }

  // Owner has full access
  if (vault.ownerId === context.userId) {
    await logVaultAccess({
      vaultId,
      actorId: context.userId,
      action: 'access',
      scope: requiredScope,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return { allowed: true, scope: requiredScope };
  }

  // Check sharing tokens
  const validToken = vault.sharingTokens.find((token) => {
    // Check if token is for this user or is public
    if (token.grantedTo && token.grantedTo !== context.userId) {
      return false;
    }

    // Check expiration
    if (token.expiresAt && token.expiresAt < new Date()) {
      return false;
    }

    // Check max uses
    if (token.maxUses && token.useCount >= token.maxUses) {
      return false;
    }

    // Check if scope is allowed
    return hasScope(token.scopes, requiredScope);
  });

  if (validToken) {
    // Update token usage
    await prisma.vaultSharingToken.update({
      where: { id: validToken.id },
      data: {
        useCount: { increment: 1 },
        usedAt: new Date(),
      },
    });

    await logVaultAccess({
      vaultId,
      actorId: context.userId,
      action: 'access',
      scope: requiredScope,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { tokenId: validToken.id },
    });

    return { allowed: true, scope: requiredScope };
  }

  // Check RBAC roles (admin, privacy-officer, etc.)
  if (hasAdminRole(context.roles)) {
    await logVaultAccess({
      vaultId,
      actorId: context.userId,
      action: 'admin_access',
      scope: requiredScope,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { roles: context.roles },
    });
    return { allowed: true, scope: requiredScope };
  }

  return { allowed: false, reason: 'Insufficient permissions' };
}

/**
 * Check if user has access to a specific record
 */
export async function checkRecordAccess(
  recordId: string,
  context: AccessContext,
  requiredScope: AccessScope
): Promise<AccessResult> {
  const record = await prisma.dataRecord.findUnique({
    where: { id: recordId },
    include: {
      vault: {
        include: {
          sharingTokens: {
            where: {
              isRevoked: false,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
              ],
            },
          },
        },
      },
    },
  });

  if (!record) {
    return { allowed: false, reason: 'Record not found' };
  }

  // Map record type to scope
  const recordTypeScope = `read:${record.type}` as AccessScope;
  const requiredRecordScope = requiredScope.replace('read:', '').replace('write:', '').replace('delete:', '') as string;

  // Check if scope matches record type
  if (requiredRecordScope !== 'all' && requiredRecordScope !== record.type) {
    return { allowed: false, reason: 'Scope does not match record type' };
  }

  // Check vault access
  return checkVaultAccess(record.vaultId, context, requiredScope);
}

/**
 * Create a sharing token
 */
export async function createSharingToken(
  vaultId: string,
  grantedBy: string,
  options: {
    scopes: AccessScope[];
    grantedTo?: string;
    expiresAt?: Date;
    maxUses?: number;
  }
): Promise<string> {
  // Verify grantor has access
  const vault = await prisma.personalDataVault.findUnique({
    where: { id: vaultId },
  });

  if (!vault) {
    throw new Error('Vault not found');
  }

  if (vault.ownerId !== grantedBy) {
    throw new Error('Only vault owner can create sharing tokens');
  }

  // Generate secure token
  const token = generateSecureToken();

  await prisma.vaultSharingToken.create({
    data: {
      vaultId,
      token,
      scopes: options.scopes,
      grantedBy,
      grantedTo: options.grantedTo,
      expiresAt: options.expiresAt,
      maxUses: options.maxUses,
    },
  });

  await logVaultAccess({
    vaultId,
    actorId: grantedBy,
    action: 'share',
    scope: 'share:all',
    metadata: {
      tokenId: token.substring(0, 8) + '...', // Log partial token only
      scopes: options.scopes,
      grantedTo: options.grantedTo,
    },
  });

  return token;
}

/**
 * Revoke a sharing token
 */
export async function revokeSharingToken(
  token: string,
  revokedBy: string
): Promise<void> {
  const sharingToken = await prisma.vaultSharingToken.findUnique({
    where: { token },
    include: { vault: true },
  });

  if (!sharingToken) {
    throw new Error('Sharing token not found');
  }

  // Verify revoker has permission
  if (sharingToken.vault.ownerId !== revokedBy && !hasAdminRole([revokedBy])) {
    throw new Error('Insufficient permissions to revoke token');
  }

  await prisma.vaultSharingToken.update({
    where: { token },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
    },
  });

  await logVaultAccess({
    vaultId: sharingToken.vaultId,
    actorId: revokedBy,
    action: 'revoke_share',
    scope: 'share:all',
    metadata: { tokenId: token.substring(0, 8) + '...' },
  });
}

/**
 * Check if scopes include required scope
 */
function hasScope(grantedScopes: string[], requiredScope: AccessScope): boolean {
  // Check for exact match
  if (grantedScopes.includes(requiredScope)) {
    return true;
  }

  // Check for wildcard scopes
  if (grantedScopes.includes('read:all') && requiredScope.startsWith('read:')) {
    return true;
  }
  if (grantedScopes.includes('write:all') && requiredScope.startsWith('write:')) {
    return true;
  }
  if (grantedScopes.includes('delete:all') && requiredScope.startsWith('delete:')) {
    return true;
  }
  if (grantedScopes.includes('export:all') && requiredScope.startsWith('export:')) {
    return true;
  }

  // Check for type-specific scopes
  const requiredType = requiredScope.split(':')[1];
  if (requiredType === 'all') {
    return true;
  }

  const grantedType = grantedScopes.find((s) => s.endsWith(`:${requiredType}`));
  if (grantedType && grantedType.startsWith(requiredScope.split(':')[0])) {
    return true;
  }

  return false;
}

/**
 * Check if user has admin role
 */
function hasAdminRole(roles: string[]): boolean {
  return roles.includes('admin') || roles.includes('privacy-officer') || roles.includes('security-officer');
}

/**
 * Generate secure random token
 */
function generateSecureToken(): string {
  const crypto = require('crypto');
  return 'vst_' + crypto.randomBytes(32).toString('base64url').replace(/[+/=]/g, '');
}

/**
 * Middleware to check vault access
 */
export function requireVaultAccess(requiredScope: AccessScope) {
  return async (req: AuthenticatedRequest, res: any, next: any) => {
    const vaultId = req.params.vaultId || req.body.vaultId;
    if (!vaultId) {
      return res.status(400).json({ error: 'Vault ID required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const context: AccessContext = {
      userId: String(req.user.id),
      roles: req.user.roles,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    const result = await checkVaultAccess(vaultId, context, requiredScope);
    if (!result.allowed) {
      return res.status(403).json({ error: result.reason || 'Access denied' });
    }

    (req as any).vaultAccess = result;
    next();
  };
}

/**
 * Middleware to check record access
 */
export function requireRecordAccess(requiredScope: AccessScope) {
  return async (req: AuthenticatedRequest, res: any, next: any) => {
    const recordId = req.params.recordId || req.body.recordId;
    if (!recordId) {
      return res.status(400).json({ error: 'Record ID required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const context: AccessContext = {
      userId: String(req.user.id),
      roles: req.user.roles,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    const result = await checkRecordAccess(recordId, context, requiredScope);
    if (!result.allowed) {
      return res.status(403).json({ error: result.reason || 'Access denied' });
    }

    (req as any).recordAccess = result;
    next();
  };
}
