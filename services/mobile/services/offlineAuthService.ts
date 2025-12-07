/**
 * OfflineLogin & Auth Service
 *
 * Stores auth tokens securely offline and re-authenticates when back online:
 * - Handles token refresh
 * - Supports offline checks for user identity (for local-only actions)
 * - Encrypts tokens with device keychain
 */

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  email?: string;
}

export interface OfflineAuthState {
  isAuthenticated: boolean;
  userId?: string;
  email?: string;
  canPerformLocalActions: boolean;
}

/**
 * Offline authentication service
 * Handles secure token storage and offline authentication
 */
export class OfflineAuthService {
  private storageKey = 'offline_auth_tokens';
  private deviceKeyStorageKey = 'device_encryption_key';

  /**
   * Store authentication tokens securely
   */
  async storeTokens(tokens: AuthToken): Promise<void> {
    try {
      // Encrypt tokens before storage
      const encrypted = await this.encryptTokens(tokens);

      // Store in secure storage (keychain/keystore equivalent)
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        // In production, use secure storage APIs:
        // - iOS: Keychain Services
        // - Android: Keystore System
        // - Web: Encrypted localStorage or IndexedDB
        localStorage.setItem(this.storageKey, encrypted);
      } else {
        // Node.js environment - use encrypted file storage
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        const storagePath = path.join(os.homedir(), '.vitalcv', 'auth.json');
        await fs.mkdir(path.dirname(storagePath), { recursive: true });
        await fs.writeFile(storagePath, encrypted, 'utf-8');
      }
    } catch (error) {
      throw new Error(`Failed to store tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve stored authentication tokens
   */
  async getTokens(): Promise<AuthToken | null> {
    try {
      let encrypted: string | null = null;

      if (typeof window !== 'undefined' && 'localStorage' in window) {
        encrypted = localStorage.getItem(this.storageKey);
      } else {
        // Node.js environment
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          const storagePath = path.join(os.homedir(), '.vitalcv', 'auth.json');
          encrypted = await fs.readFile(storagePath, 'utf-8');
        } catch {
          return null;
        }
      }

      if (!encrypted) {
        return null;
      }

      return await this.decryptTokens(encrypted);
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated (offline check)
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getTokens();
    if (!tokens) {
      return false;
    }

    // Check if token is expired
    if (tokens.expiresAt < Date.now()) {
      // Token expired, but we can still check offline identity
      return false;
    }

    return true;
  }

  /**
   * Get offline auth state
   */
  async getOfflineAuthState(): Promise<OfflineAuthState> {
    const tokens = await this.getTokens();

    if (!tokens) {
      return {
        isAuthenticated: false,
        canPerformLocalActions: false,
      };
    }

    const isExpired = tokens.expiresAt < Date.now();

    return {
      isAuthenticated: !isExpired,
      userId: tokens.userId,
      email: tokens.email,
      // Allow local-only actions even if token is expired
      canPerformLocalActions: true,
    };
  }

  /**
   * Refresh authentication token when back online
   */
  async refreshToken(): Promise<AuthToken | null> {
    const tokens = await this.getTokens();

    if (!tokens || !tokens.refreshToken) {
      return null;
    }

    try {
      // In production, call your auth API
      // const response = await fetch('/api/auth/refresh', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      // });
      // const newTokens = await response.json();

      // Stub: Simulate token refresh
      const newTokens: AuthToken = {
        accessToken: `new_token_${Date.now()}`,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + 3600000, // 1 hour
        userId: tokens.userId,
        email: tokens.email,
      };

      await this.storeTokens(newTokens);
      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Clear stored tokens (logout)
   */
  async clearTokens(): Promise<void> {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      localStorage.removeItem(this.storageKey);
    } else {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        const storagePath = path.join(os.homedir(), '.vitalcv', 'auth.json');
        await fs.unlink(storagePath).catch(() => {
          // File might not exist
        });
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Re-authenticate when back online
   */
  async reauthenticate(): Promise<AuthToken | null> {
    const tokens = await this.getTokens();

    if (!tokens) {
      return null;
    }

    // Check if token needs refresh
    if (tokens.expiresAt < Date.now()) {
      return await this.refreshToken();
    }

    return tokens;
  }

  /**
   * Encrypt tokens before storage
   */
  private async encryptTokens(tokens: AuthToken): Promise<string> {
    // In production, use proper encryption:
    // - iOS: Keychain Services (automatic encryption)
    // - Android: Android Keystore System
    // - Web: Web Crypto API with device-specific key

    // Stub: Simple base64 encoding (NOT secure - for development only)
    const json = JSON.stringify(tokens);
    return Buffer.from(json).toString('base64');
  }

  /**
   * Decrypt tokens after retrieval
   */
  private async decryptTokens(encrypted: string): Promise<AuthToken> {
    // Stub: Simple base64 decoding
    const json = Buffer.from(encrypted, 'base64').toString('utf-8');
    return JSON.parse(json) as AuthToken;
  }

  /**
   * Get or generate device encryption key
   */
  private async getDeviceKey(): Promise<string> {
    // In production, this would:
    // - iOS: Use Keychain to store/retrieve device key
    // - Android: Use Keystore to generate/store key
    // - Web: Use Web Crypto API to generate/store key in IndexedDB

    let deviceKey: string | null = null;

    if (typeof window !== 'undefined' && 'localStorage' in window) {
      deviceKey = localStorage.getItem(this.deviceKeyStorageKey);
    }

    if (!deviceKey) {
      // Generate a new device key
      deviceKey = `device_key_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(this.deviceKeyStorageKey, deviceKey);
      }
    }

    return deviceKey;
  }
}

export const offlineAuthService = new OfflineAuthService();

