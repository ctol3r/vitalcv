/**
 * BiometricAuthIntegration (stub)
 *
 * Defines interface for biometric authentication (fingerprint, Face ID):
 * - Stubs implementation for future integration
 * - Includes fallback to offline auth
 * - Provides API for UI to trigger biometrics
 */

import { offlineAuthService } from '../services/offlineAuthService.js';

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  userId?: string;
  token?: string;
}

export interface BiometricAuthOptions {
  prompt?: string;
  fallbackEnabled?: boolean;
  requireConfirmation?: boolean;
}

/**
 * Biometric authentication integration
 * Provides interface for biometric authentication with fallback to offline auth
 */
export class BiometricAuthIntegration {
  /**
   * Check if biometric authentication is available
   */
  async isAvailable(): Promise<boolean> {
    // In production, check:
    // - iOS: LocalAuthentication framework
    // - Android: BiometricPrompt API
    // - Web: WebAuthn API

    if (typeof window === 'undefined') {
      return false;
    }

    // Check WebAuthn support
    if (typeof window.PublicKeyCredential !== 'undefined') {
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Get available biometric types
   */
  async getAvailableTypes(): Promise<Array<'fingerprint' | 'face' | 'iris' | 'voice'>> {
    if (!(await this.isAvailable())) {
      return [];
    }

    // Stub: In production, detect actual available types
    // iOS: Check LAContext.biometryType
    // Android: Check BiometricManager.canAuthenticate()
    // Web: Use WebAuthn with platform authenticator

    const os = this.detectOS();
    if (os === 'ios') {
      // iOS typically has Face ID or Touch ID
      return ['face', 'fingerprint'];
    } else if (os === 'android') {
      return ['fingerprint', 'face'];
    }

    return ['fingerprint'];
  }

  /**
   * Authenticate using biometrics
   */
  async authenticate(
    options: BiometricAuthOptions = {},
  ): Promise<BiometricAuthResult> {
    if (!(await this.isAvailable())) {
      if (options.fallbackEnabled) {
        return this.fallbackToOfflineAuth();
      }
      return {
        success: false,
        error: 'Biometric authentication not available',
      };
    }

    try {
      // Stub: In production, trigger OS biometric prompt
      // iOS: Use LocalAuthentication
      // Android: Use BiometricPrompt
      // Web: Use WebAuthn with platform authenticator

      const result = await this.performBiometricAuth(options);
      return result;
    } catch (error) {
      if (options.fallbackEnabled) {
        return this.fallbackToOfflineAuth();
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
      };
    }
  }

  /**
   * Perform actual biometric authentication (stub)
   */
  private async performBiometricAuth(
    options: BiometricAuthOptions,
  ): Promise<BiometricAuthResult> {
    // Stub implementation
    // In production:
    //
    // iOS (React Native):
    // const result = await LocalAuthentication.authenticateAsync({
    //   promptMessage: options.prompt || 'Authenticate to continue',
    //   fallbackLabel: options.fallbackEnabled ? 'Use passcode' : undefined,
    // });
    //
    // Android (React Native):
    // const result = await LocalAuthentication.authenticateAsync({
    //   promptMessage: options.prompt || 'Authenticate to continue',
    //   fallbackLabel: options.fallbackEnabled ? 'Use password' : undefined,
    // });
    //
    // Web (WebAuthn):
    // const credential = await navigator.credentials.create({
    //   publicKey: {
    //     challenge: new Uint8Array(32),
    //     rp: { name: 'VitalCV' },
    //     user: { id: new Uint8Array(16), name: 'user', displayName: 'User' },
    //     pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    //     authenticatorSelection: { userVerification: 'required' },
    //   },
    // });

    // Simulate authentication
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate success
        resolve({
          success: true,
          userId: 'user_123',
          token: 'biometric_token_' + Date.now(),
        });
      }, 500);
    });
  }

  /**
   * Fallback to offline authentication
   */
  private async fallbackToOfflineAuth(): Promise<BiometricAuthResult> {
    const authState = await offlineAuthService.getOfflineAuthState();

    if (!authState.isAuthenticated && !authState.canPerformLocalActions) {
      return {
        success: false,
        error: 'No offline authentication available',
      };
    }

    return {
      success: true,
      userId: authState.userId,
    };
  }

  /**
   * Detect operating system
   */
  private detectOS(): 'ios' | 'android' | 'web' | 'unknown' {
    if (typeof navigator === 'undefined') {
      return 'unknown';
    }

    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'ios';
    } else if (userAgent.includes('android')) {
      return 'android';
    } else {
      return 'web';
    }
  }

  /**
   * Register biometric credential for a user
   */
  async registerBiometric(userId: string): Promise<boolean> {
    if (!(await this.isAvailable())) {
      return false;
    }

    // Stub: In production, register biometric credential
    // This would typically:
    // 1. Create a WebAuthn credential
    // 2. Store credential ID on server
    // 3. Associate with user account

    console.log(`[Biometric Stub] Registering biometric for user ${userId}`);
    return true;
  }

  /**
   * Deregister biometric credential
   */
  async deregisterBiometric(userId: string): Promise<boolean> {
    // Stub: In production, remove biometric credential
    console.log(`[Biometric Stub] Deregistering biometric for user ${userId}`);
    return true;
  }

  /**
   * Check if user has registered biometric
   */
  async hasRegisteredBiometric(userId: string): Promise<boolean> {
    // Stub: In production, check server for registered credential
    return false;
  }
}

export const biometricAuthIntegration = new BiometricAuthIntegration();

