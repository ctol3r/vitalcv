/**
 * BiometricAuthIntegration
 * Manages biometric authentication (fingerprint/Face ID/Touch ID)
 * Provides fallback options when biometrics are unavailable
 */

export type BiometricType = 'fingerprint' | 'face' | 'touch' | 'none';

export interface BiometricAvailability {
  available: boolean;
  type: BiometricType;
  supported: boolean;
}

class BiometricAuthIntegration {
  private availability: BiometricAvailability = {
    available: false,
    type: 'none',
    supported: false,
  };

  constructor() {
    if (typeof window === 'undefined') return;
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    // Check for WebAuthn support
    if (typeof window !== 'undefined' && 'PublicKeyCredential' in window) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        this.availability = {
          available,
          type: this.detectBiometricType(),
          supported: true,
        };
      } catch (error) {
        console.warn('Biometric check failed:', error);
        this.availability = {
          available: false,
          type: 'none',
          supported: false,
        };
      }
    }
  }

  private detectBiometricType(): BiometricType {
    if (typeof window === 'undefined') return 'none';

    const ua = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();

    // iOS devices
    if (/iphone|ipad|ipod/.test(ua)) {
      // Check for Face ID (iPhone X and later) or Touch ID
      // This is a simplified check - in production, you'd use device-specific APIs
      return 'face'; // Default to Face ID for newer devices
    }

    // Android devices
    if (/android/.test(ua)) {
      return 'fingerprint'; // Most Android devices support fingerprint
    }

    // macOS
    if (/mac/.test(platform)) {
      return 'touch'; // Touch ID on Mac
    }

    return 'none';
  }

  getAvailability(): BiometricAvailability {
    return { ...this.availability };
  }

  async authenticate(options?: {
    challenge?: string;
    timeout?: number;
  }): Promise<boolean> {
    if (!this.availability.available || !this.availability.supported) {
      return false;
    }

    try {
      // Create credential request
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: this.stringToArrayBuffer(options?.challenge || 'challenge'),
          allowCredentials: [],
          userVerification: 'required',
          timeout: options?.timeout || 60000,
        },
      });

      return credential !== null;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  private stringToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  isAvailable(): boolean {
    return this.availability.available && this.availability.supported;
  }
}

// Export singleton instance
export const biometricAuthIntegration = new BiometricAuthIntegration();

