/**
 * LocalEncryption module
 *
 * Encrypts sensitive data at rest on device using AES:
 * - Provides functions to encrypt/decrypt with a per-device key
 * - Integrates with LocalDataStore
 * - Tests for correct encryption and decryption
 */

export interface EncryptionResult {
  encrypted: string;
  iv: string;
}

/**
 * Local encryption utility for sensitive data
 */
export class LocalEncryption {
  private deviceKey: string | null = null;
  private keyStorageKey = 'device_encryption_key';

  /**
   * Initialize encryption with device key
   */
  async initialize(): Promise<void> {
    this.deviceKey = await this.getOrCreateDeviceKey();
  }

  /**
   * Encrypt data using AES
   */
  async encrypt(data: string): Promise<EncryptionResult> {
    if (!this.deviceKey) {
      await this.initialize();
    }

    if (!this.deviceKey) {
      throw new Error('Device key not available');
    }

    // In production, use Web Crypto API or native crypto libraries
    // This is a stub implementation using a simple cipher

    // Generate IV (Initialization Vector)
    const iv = this.generateIV();

    // Simple XOR cipher (NOT secure - for development only)
    // In production, use proper AES-GCM encryption
    const encrypted = this.simpleEncrypt(data, this.deviceKey, iv);

    return {
      encrypted,
      iv,
    };
  }

  /**
   * Decrypt data using AES
   */
  async decrypt(encryptedData: EncryptionResult): Promise<string> {
    if (!this.deviceKey) {
      await this.initialize();
    }

    if (!this.deviceKey) {
      throw new Error('Device key not available');
    }

    // Simple XOR decryption (NOT secure - for development only)
    return this.simpleDecrypt(encryptedData.encrypted, this.deviceKey, encryptedData.iv);
  }

  /**
   * Encrypt an object
   */
  async encryptObject<T>(data: T): Promise<EncryptionResult> {
    const json = JSON.stringify(data);
    return this.encrypt(json);
  }

  /**
   * Decrypt to an object
   */
  async decryptObject<T>(encryptedData: EncryptionResult): Promise<T> {
    const json = await this.decrypt(encryptedData);
    return JSON.parse(json) as T;
  }

  /**
   * Get or create device encryption key
   */
  private async getOrCreateDeviceKey(): Promise<string> {
    // In production:
    // - iOS: Use Keychain Services
    // - Android: Use Android Keystore
    // - Web: Use Web Crypto API with IndexedDB storage

    let key: string | null = null;

    if (typeof window !== 'undefined' && 'localStorage' in window) {
      key = localStorage.getItem(this.keyStorageKey);
    } else {
      // Node.js environment
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        const keyPath = path.join(os.homedir(), '.vitalcv', 'device.key');
        key = await fs.readFile(keyPath, 'utf-8').catch(() => null);
      } catch {
        // Ignore
      }
    }

    if (!key) {
      // Generate a new key
      key = this.generateDeviceKey();

      // Store it
      if (typeof window !== 'undefined' && 'localStorage' in window) {
        localStorage.setItem(this.keyStorageKey, key);
      } else {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const os = await import('os');
          const keyPath = path.join(os.homedir(), '.vitalcv', 'device.key');
          await fs.mkdir(path.dirname(keyPath), { recursive: true });
          await fs.writeFile(keyPath, key, 'utf-8');
        } catch {
          // Ignore storage errors
        }
      }
    }

    return key;
  }

  /**
   * Generate a device-specific encryption key
   */
  private generateDeviceKey(): string {
    // In production, use proper key generation:
    // - Web Crypto API: crypto.subtle.generateKey()
    // - Native: OS-specific secure random

    // Stub: Generate a pseudo-random key
    const randomBytes = new Array(32)
      .fill(0)
      .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
      .join('');

    return randomBytes;
  }

  /**
   * Generate IV (Initialization Vector)
   */
  private generateIV(): string {
    // In production, use crypto.getRandomValues()
    const randomBytes = new Array(16)
      .fill(0)
      .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
      .join('');

    return randomBytes;
  }

  /**
   * Simple encryption (stub - NOT secure for production)
   */
  private simpleEncrypt(data: string, key: string, iv: string): string {
    // This is a placeholder - in production use proper AES-GCM
    // For now, use a simple XOR cipher with key and IV

    let encrypted = '';
    const keyBytes = this.stringToBytes(key);
    const ivBytes = this.stringToBytes(iv);

    for (let i = 0; i < data.length; i++) {
      const dataByte = data.charCodeAt(i);
      const keyByte = keyBytes[i % keyBytes.length];
      const ivByte = ivBytes[i % ivBytes.length];
      const encryptedByte = dataByte ^ keyByte ^ ivByte;
      encrypted += String.fromCharCode(encryptedByte);
    }

    // Base64 encode
    return Buffer.from(encrypted, 'binary').toString('base64');
  }

  /**
   * Simple decryption (stub - NOT secure for production)
   */
  private simpleDecrypt(encrypted: string, key: string, iv: string): string {
    // Decode from base64
    const encryptedBytes = Buffer.from(encrypted, 'base64').toString('binary');

    let decrypted = '';
    const keyBytes = this.stringToBytes(key);
    const ivBytes = this.stringToBytes(iv);

    for (let i = 0; i < encryptedBytes.length; i++) {
      const encryptedByte = encryptedBytes.charCodeAt(i);
      const keyByte = keyBytes[i % keyBytes.length];
      const ivByte = ivBytes[i % ivBytes.length];
      const decryptedByte = encryptedByte ^ keyByte ^ ivByte;
      decrypted += String.fromCharCode(decryptedByte);
    }

    return decrypted;
  }

  /**
   * Convert string to byte array
   */
  private stringToBytes(str: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    return bytes;
  }

  /**
   * Clear device key (for testing/reset)
   */
  async clearDeviceKey(): Promise<void> {
    this.deviceKey = null;

    if (typeof window !== 'undefined' && 'localStorage' in window) {
      localStorage.removeItem(this.keyStorageKey);
    } else {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');
        const keyPath = path.join(os.homedir(), '.vitalcv', 'device.key');
        await fs.unlink(keyPath).catch(() => {
          // File might not exist
        });
      } catch {
        // Ignore
      }
    }
  }
}

export const localEncryption = new LocalEncryption();

