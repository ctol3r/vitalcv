/**
 * B237B-DP-015: SharedAccessToken model & management
 *
 * Service to create, validate, and revoke shared access tokens.
 * Tracks usage and logs access events.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface CreateTokenOptions {
  vaultId: string;
  granteeId?: string; // User ID if sharing with registered user
  granteeEmail?: string; // Email if sharing with external user
  scopes: string[];
  expiryDate?: Date;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: {
    id: string;
    vaultId: string;
    scopes: string[];
    granteeId?: string;
    granteeEmail?: string;
  };
  error?: string;
}

export class SharedAccessTokenService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new shared access token
   */
  async createToken(
    ownerId: string,
    options: CreateTokenOptions
  ): Promise<{ token: string; tokenId: string; expiresAt?: Date }> {
    // Verify vault ownership
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: options.vaultId },
    });

    if (!vault) {
      throw new Error(`Vault not found: ${options.vaultId}`);
    }

    if (vault.ownerId !== ownerId) {
      throw new Error('Unauthorized: You do not own this vault');
    }

    // Validate that either granteeId or granteeEmail is provided
    if (!options.granteeId && !options.granteeEmail) {
      throw new Error('Either granteeId or granteeEmail must be provided');
    }

    // Validate scopes
    this.validateScopes(options.scopes);

    // Generate secure token
    const token = this.generateSecureToken();
    const tokenHash = this.hashToken(token);

    // Create token record
    const tokenRecord = await this.prisma.sharedAccessToken.create({
      data: {
        vaultId: options.vaultId,
        tokenHash,
        granteeId: options.granteeId,
        granteeEmail: options.granteeEmail,
        scopes: options.scopes,
        expiryDate: options.expiryDate,
        status: 'active',
      },
    });

    // Create consent record
    await this.prisma.consentRecord.create({
      data: {
        vaultId: options.vaultId,
        sharedWith: options.granteeId || options.granteeEmail!,
        dataTypes: this.scopesToDataTypes(options.scopes),
        purpose: 'shared_access',
        duration: options.expiryDate ? this.calculateDuration(options.expiryDate) : 'indefinite',
        expiresAt: options.expiryDate,
        status: 'active',
      },
    });

    // Log token creation
    await this.prisma.vaultAuditLog.create({
      data: {
        vaultId: options.vaultId,
        actorId: ownerId,
        action: 'share',
        scope: `token:${tokenRecord.id}`,
        metadata: {
          tokenId: tokenRecord.id,
          granteeId: options.granteeId,
          granteeEmail: options.granteeEmail,
          scopes: options.scopes,
        },
        hash: this.generateAuditHash(options.vaultId, ownerId, 'share', tokenRecord.id),
      },
    });

    return {
      token, // Return plain token only once - client must store it securely
      tokenId: tokenRecord.id,
      expiresAt: options.expiryDate,
    };
  }

  /**
   * Validate a shared access token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    const tokenHash = this.hashToken(token);

    const tokenRecord = await this.prisma.sharedAccessToken.findUnique({
      where: { tokenHash },
      include: { vault: true },
    });

    if (!tokenRecord) {
      return { valid: false, error: 'Invalid token' };
    }

    // Check status
    if (tokenRecord.status !== 'active') {
      return { valid: false, error: `Token is ${tokenRecord.status}` };
    }

    // Check expiration
    if (tokenRecord.expiryDate && tokenRecord.expiryDate < new Date()) {
      // Auto-expire
      await this.prisma.sharedAccessToken.update({
        where: { id: tokenRecord.id },
        data: { status: 'expired' },
      });
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      token: {
        id: tokenRecord.id,
        vaultId: tokenRecord.vaultId,
        scopes: tokenRecord.scopes,
        granteeId: tokenRecord.granteeId || undefined,
        granteeEmail: tokenRecord.granteeEmail || undefined,
      },
    };
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenId: string, ownerId: string): Promise<void> {
    const token = await this.prisma.sharedAccessToken.findUnique({
      where: { id: tokenId },
      include: { vault: true },
    });

    if (!token) {
      throw new Error('Token not found');
    }

    if (token.vault.ownerId !== ownerId) {
      throw new Error('Unauthorized: You do not own this vault');
    }

    await this.prisma.sharedAccessToken.update({
      where: { id: tokenId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    // Update consent record
    await this.prisma.consentRecord.updateMany({
      where: {
        vaultId: token.vaultId,
        sharedWith: token.granteeId || token.granteeEmail!,
        status: 'active',
      },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
      },
    });

    // Log revocation
    await this.prisma.vaultAuditLog.create({
      data: {
        vaultId: token.vaultId,
        actorId: ownerId,
        action: 'revoke_share',
        scope: `token:${tokenId}`,
        hash: this.generateAuditHash(token.vaultId, ownerId, 'revoke_share', tokenId),
      },
    });
  }

  /**
   * Log token usage
   */
  async logUsage(
    tokenId: string,
    action: string,
    recordCount: number = 0,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.prisma.tokenUsageLog.create({
      data: {
        tokenId,
        action,
        recordCount,
        ipAddress: ipAddress ? this.anonymizeIp(ipAddress) : null,
        userAgent: userAgent ? userAgent.substring(0, 200) : null, // Truncate
        metadata,
      },
    });
  }

  /**
   * Check if token has required scope
   */
  hasScope(tokenScopes: string[], requiredScope: string): boolean {
    // Check for exact match or wildcard
    return tokenScopes.includes(requiredScope) || tokenScopes.includes('*');
  }

  // Helper methods

  private generateSecureToken(): string {
    // Generate cryptographically secure random token
    return crypto.randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private validateScopes(scopes: string[]): void {
    const validScopes = [
      'read:credentials',
      'read:profile',
      'read:all',
      'write:credentials',
      'write:profile',
      'write:all',
      '*', // Wildcard for all scopes
    ];

    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }
  }

  private scopesToDataTypes(scopes: string[]): string[] {
    const dataTypes: string[] = [];

    if (scopes.some(s => s.includes('credentials'))) {
      dataTypes.push('credential');
    }
    if (scopes.some(s => s.includes('profile'))) {
      dataTypes.push('profile');
    }
    if (scopes.includes('*') || scopes.some(s => s.includes('all'))) {
      dataTypes.push('credential', 'contract', 'log', 'profile');
    }

    return [...new Set(dataTypes)];
  }

  private calculateDuration(expiryDate: Date): string {
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.ceil(diffDays / 30);
      return `${months} months`;
    } else {
      const years = Math.ceil(diffDays / 365);
      return `${years} years`;
    }
  }

  private anonymizeIp(ip: string): string {
    // Anonymize last octet of IPv4
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
    // For IPv6, anonymize last 64 bits
    return ip;
  }

  private generateAuditHash(
    vaultId: string,
    actorId: string,
    action: string,
    recordId?: string
  ): string {
    const data = `${vaultId}:${actorId}:${action}:${recordId || ''}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

