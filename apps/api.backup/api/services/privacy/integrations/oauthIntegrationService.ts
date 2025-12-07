/**
 * B237B-DP-014: OAuthIntegrationService
 *
 * Facilitates OAuth 2.0 flows to authorize third-party apps to access data vault.
 * Supports client registration, token issuance, revocation, and logs usage.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface OAuthClientRegistration {
  providerName: string;
  clientId: string;
  clientSecret?: string; // Optional - some providers use PKCE
  redirectUris: string[];
  scopes: string[];
  metadata?: Record<string, any>;
}

export interface AuthorizationRequest {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  codeChallenge?: string; // For PKCE
  codeChallengeMethod?: 'plain' | 'S256';
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
}

export class OAuthIntegrationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Register a new OAuth client
   */
  async registerClient(
    ownerId: string,
    registration: OAuthClientRegistration
  ): Promise<{ connectionId: string; clientId: string }> {
    // Validate redirect URIs
    this.validateRedirectUris(registration.redirectUris);

    // Validate scopes
    this.validateScopes(registration.scopes);

    // Create connection
    const connection = await this.prisma.thirdPartyConnection.create({
      data: {
        ownerId,
        providerName: registration.providerName,
        clientId: registration.clientId,
        clientSecret: registration.clientSecret ? this.encryptSecret(registration.clientSecret) : null,
        scopes: registration.scopes,
        status: 'pending',
        metadata: registration.metadata,
      },
    });

    return {
      connectionId: connection.id,
      clientId: connection.clientId,
    };
  }

  /**
   * Initiate authorization flow
   */
  async initiateAuthorization(
    ownerId: string,
    request: AuthorizationRequest
  ): Promise<{ authorizationCode: string; redirectUri: string }> {
    // Find connection by clientId
    const connection = await this.prisma.thirdPartyConnection.findFirst({
      where: {
        clientId: request.clientId,
        ownerId,
        status: 'active',
      },
    });

    if (!connection) {
      throw new Error('Invalid client or connection not active');
    }

    // Validate redirect URI
    if (!this.isValidRedirectUri(request.redirectUri, connection.metadata as any)) {
      throw new Error('Invalid redirect URI');
    }

    // Validate scopes
    const requestedScopes = new Set(request.scopes);
    const allowedScopes = new Set(connection.scopes);
    const invalidScopes = [...requestedScopes].filter(s => !allowedScopes.has(s));

    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
    }

    // Generate authorization code
    const authorizationCode = this.generateAuthorizationCode(connection.id, request);

    // Store authorization code (in production, use Redis or similar with TTL)
    // For now, we'll store it in metadata
    await this.prisma.thirdPartyConnection.update({
      where: { id: connection.id },
      data: {
        metadata: {
          ...(connection.metadata as any || {}),
          pendingAuthorization: {
            code: authorizationCode,
            redirectUri: request.redirectUri,
            scopes: request.scopes,
            codeChallenge: request.codeChallenge,
            codeChallengeMethod: request.codeChallengeMethod,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          },
        },
      },
    });

    return {
      authorizationCode,
      redirectUri: request.redirectUri,
    };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    authorizationCode: string,
    clientId: string,
    redirectUri: string,
    codeVerifier?: string // For PKCE
  ): Promise<TokenResponse> {
    // Find connection
    const connection = await this.prisma.thirdPartyConnection.findFirst({
      where: { clientId, status: 'active' },
    });

    if (!connection) {
      throw new Error('Invalid client');
    }

    // Verify authorization code
    const pendingAuth = (connection.metadata as any)?.pendingAuthorization;
    if (!pendingAuth || pendingAuth.code !== authorizationCode) {
      throw new Error('Invalid authorization code');
    }

    // Check expiration
    if (new Date(pendingAuth.expiresAt) < new Date()) {
      throw new Error('Authorization code expired');
    }

    // Verify redirect URI
    if (pendingAuth.redirectUri !== redirectUri) {
      throw new Error('Redirect URI mismatch');
    }

    // Verify PKCE if used
    if (pendingAuth.codeChallenge) {
      if (!codeVerifier) {
        throw new Error('Code verifier required for PKCE');
      }

      const method = pendingAuth.codeChallengeMethod || 'plain';
      let expectedChallenge: string;

      if (method === 'S256') {
        expectedChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');
      } else {
        expectedChallenge = codeVerifier;
      }

      if (expectedChallenge !== pendingAuth.codeChallenge) {
        throw new Error('Invalid code verifier');
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(connection.id);
    const refreshToken = this.generateRefreshToken(connection.id);
    const expiresIn = 3600; // 1 hour

    // Store tokens (encrypted)
    await this.prisma.thirdPartyConnection.update({
      where: { id: connection.id },
      data: {
        status: 'active',
        accessToken: this.encryptToken(accessToken),
        refreshToken: this.encryptToken(refreshToken),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        metadata: {
          ...(connection.metadata as any || {}),
          pendingAuthorization: undefined, // Clear pending auth
        },
      },
    });

    // Log token issuance
    await this.prisma.connectionUsageLog.create({
      data: {
        connectionId: connection.id,
        action: 'token_issued',
        recordCount: 0,
        metadata: {
          scopes: pendingAuth.scopes,
          expiresIn,
        },
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      scope: pendingAuth.scopes.join(' '),
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Find connection with matching refresh token
    const connections = await this.prisma.thirdPartyConnection.findMany({
      where: {
        status: 'active',
        refreshToken: { not: null },
      },
    });

    let connection = null;
    for (const conn of connections) {
      if (conn.refreshToken && this.decryptToken(conn.refreshToken) === refreshToken) {
        connection = conn;
        break;
      }
    }

    if (!connection) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(connection.id);
    const newRefreshToken = this.generateRefreshToken(connection.id);
    const expiresIn = 3600;

    await this.prisma.thirdPartyConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: this.encryptToken(accessToken),
        refreshToken: this.encryptToken(newRefreshToken),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: 'Bearer',
      expiresIn,
      scope: connection.scopes.join(' '),
    };
  }

  /**
   * Revoke connection/tokens
   */
  async revokeConnection(connectionId: string, ownerId: string): Promise<void> {
    const connection = await this.prisma.thirdPartyConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    if (connection.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }

    await this.prisma.thirdPartyConnection.update({
      where: { id: connectionId },
      data: {
        status: 'revoked',
        revokedAt: new Date(),
        accessToken: null,
        refreshToken: null,
      },
    });

    // Log revocation
    await this.prisma.connectionUsageLog.create({
      data: {
        connectionId,
        action: 'revoked',
        recordCount: 0,
      },
    });
  }

  /**
   * Validate access token and return connection
   */
  async validateToken(accessToken: string): Promise<{
    connection: any;
    scopes: string[];
  }> {
    const connections = await this.prisma.thirdPartyConnection.findMany({
      where: {
        status: 'active',
        accessToken: { not: null },
      },
    });

    for (const conn of connections) {
      if (conn.accessToken && this.decryptToken(conn.accessToken) === accessToken) {
        // Check expiration
        if (conn.tokenExpiresAt && conn.tokenExpiresAt < new Date()) {
          throw new Error('Token expired');
        }

        return {
          connection: conn,
          scopes: conn.scopes,
        };
      }
    }

    throw new Error('Invalid access token');
  }

  /**
   * Log API usage
   */
  async logUsage(
    connectionId: string,
    action: string,
    recordCount: number = 0,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.prisma.connectionUsageLog.create({
      data: {
        connectionId,
        action,
        recordCount,
        metadata,
      },
    });
  }

  // Helper methods

  private validateRedirectUris(uris: string[]): void {
    for (const uri of uris) {
      try {
        const url = new URL(uri);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
          throw new Error('Redirect URIs must use HTTPS (except localhost)');
        }
      } catch {
        throw new Error(`Invalid redirect URI: ${uri}`);
      }
    }
  }

  private validateScopes(scopes: string[]): void {
    const validScopes = [
      'read:credentials',
      'read:profile',
      'read:all',
      'write:credentials',
      'write:profile',
      'write:all',
    ];

    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }
  }

  private isValidRedirectUri(uri: string, metadata?: any): boolean {
    // In production, check against registered redirect URIs
    // For now, basic validation
    try {
      new URL(uri);
      return true;
    } catch {
      return false;
    }
  }

  private generateAuthorizationCode(connectionId: string, request: AuthorizationRequest): string {
    const data = `${connectionId}:${request.clientId}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  private generateAccessToken(connectionId: string): string {
    const data = `${connectionId}:access:${Date.now()}:${crypto.randomBytes(32).toString('hex')}`;
    return crypto.createHash('sha256').update(data).digest('base64url');
  }

  private generateRefreshToken(connectionId: string): string {
    const data = `${connectionId}:refresh:${Date.now()}:${crypto.randomBytes(32).toString('hex')}`;
    return crypto.createHash('sha256').update(data).digest('base64url');
  }

  private encryptSecret(secret: string): string {
    // In production, use proper encryption (e.g., AWS KMS, HashiCorp Vault)
    // For now, simple base64 encoding (NOT secure for production)
    return Buffer.from(secret).toString('base64');
  }

  private encryptToken(token: string): string {
    // In production, use proper encryption
    return Buffer.from(token).toString('base64');
  }

  private decryptToken(encrypted: string): string {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }
}

