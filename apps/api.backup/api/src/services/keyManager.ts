/**
 * Key Manager Service
 * Tagged: cursor-batch-1101
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Manages Ed25519 signing keys with rotation support
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { generateKeyPair, generateKid } from '../crypto/ed25519-keypair';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';

// Helper to convert public key to JWK format
export function publicKeyToJWK(publicKeyHex: string, kid: string): any {
  const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');
  return {
    kid,
    kty: 'OKP',
    crv: 'Ed25519',
    x: Buffer.from(publicKeyBytes).toString('base64url'),
  };
}

export type JWK = {
  kid: string;
  kty: string;
  crv: string;
  x: string;
};

export interface ManagedKey {
  kid: string;
  publicKey: string;
  secretKey: string;
  createdAt: Date;
  expiresAt?: Date;
  status: 'active' | 'rotated' | 'revoked';
}

export interface KeyStore {
  keys: ManagedKey[];
  currentKeyId: string;
}

export class KeyManager {
  private keyStore: KeyStore;
  private keyStorePath: string;
  private rotationInterval: number; // milliseconds

  constructor(
    keyStorePath: string = './keys/keystore.json',
    rotationInterval: number = 90 * 24 * 60 * 60 * 1000, // 90 days default
  ) {
    this.keyStorePath = keyStorePath;
    this.rotationInterval = rotationInterval;
    this.keyStore = {
      keys: [],
      currentKeyId: '',
    };
  }

  /**
   * Initialize the key manager and load existing keys
   */
  async initialize(): Promise<void> {
    try {
      await this.loadKeyStore();

      if (this.keyStore.keys.length === 0) {
        // No keys exist, generate initial key
        await this.generateNewKey();
      } else {
        // Check if current key needs rotation
        await this.checkRotation();
      }
    } catch (error) {
      console.error('Error initializing KeyManager:', error);
      // Generate fresh key if store is corrupted
      await this.generateNewKey();
    }
  }

  /**
   * Load key store from disk
   */
  private async loadKeyStore(): Promise<void> {
    try {
      const data = await fs.readFile(this.keyStorePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Deserialize dates
      this.keyStore = {
        ...parsed,
        keys: parsed.keys.map((k: any) => ({
          ...k,
          createdAt: new Date(k.createdAt),
          expiresAt: k.expiresAt ? new Date(k.expiresAt) : undefined,
        })),
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, will be created
        return;
      }
      throw error;
    }
  }

  /**
   * Save key store to disk
   */
  private async saveKeyStore(): Promise<void> {
    const dir = path.dirname(this.keyStorePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.keyStorePath,
      JSON.stringify(this.keyStore, null, 2),
      { mode: 0o600 }, // Restrict file permissions
    );
  }

  /**
   * Generate a new signing key
   */
  async generateNewKey(setAsCurrent: boolean = true): Promise<ManagedKey> {
    const keyPair = generateKeyPair();
    const kid = generateKid(keyPair.publicKey);

    const newKey: ManagedKey = {
      kid,
      publicKey: keyPair.publicKey,
      secretKey: keyPair.secretKey,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.rotationInterval),
      status: 'active',
    };

    this.keyStore.keys.push(newKey);

    if (setAsCurrent) {
      this.keyStore.currentKeyId = kid;
    }

    await this.saveKeyStore();
    return newKey;
  }

  /**
   * Get the current active signing key
   */
  getCurrentKey(): ManagedKey | null {
    const key = this.keyStore.keys.find(
      (k) => k.kid === this.keyStore.currentKeyId && k.status === 'active',
    );
    return key || null;
  }

  /**
   * Get a specific key by kid
   */
  getKeyById(kid: string): ManagedKey | null {
    return this.keyStore.keys.find((k) => k.kid === kid) || null;
  }

  /**
   * Get all active keys
   */
  getActiveKeys(): ManagedKey[] {
    return this.keyStore.keys.filter((k) => k.status === 'active');
  }

  /**
   * Get JWKS (JSON Web Key Set) for public keys
   */
  getJWKS(): { keys: JWK[] } {
    const activeKeys = this.getActiveKeys();
    const jwks = activeKeys.map((key) => publicKeyToJWK(key.publicKey, key.kid));

    return { keys: jwks };
  }

  /**
   * Rotate to a new key
   */
  async rotateKey(): Promise<ManagedKey> {
    // Mark current key as rotated
    const currentKey = this.getCurrentKey();
    if (currentKey) {
      currentKey.status = 'rotated';
    }

    // Generate new key and set as current
    const newKey = await this.generateNewKey(true);

    console.log(`Key rotated: ${currentKey?.kid} -> ${newKey.kid}`);

    return newKey;
  }

  /**
   * Check if rotation is needed and rotate if necessary
   */
  async checkRotation(): Promise<void> {
    const currentKey = this.getCurrentKey();

    if (!currentKey) {
      await this.generateNewKey();
      return;
    }

    if (currentKey.expiresAt && currentKey.expiresAt < new Date()) {
      console.log('Current key expired, rotating...');
      await this.rotateKey();
    }
  }

  /**
   * Revoke a key by kid
   */
  async revokeKey(kid: string): Promise<void> {
    const key = this.getKeyById(kid);
    if (key) {
      key.status = 'revoked';
      await this.saveKeyStore();

      // If we revoked the current key, rotate to a new one
      if (kid === this.keyStore.currentKeyId) {
        await this.rotateKey();
      }
    }
  }

  /**
   * Get metadata about key rotation
   */
  getRotationInfo() {
    const currentKey = this.getCurrentKey();

    return {
      currentKeyId: this.keyStore.currentKeyId,
      currentKeyCreatedAt: currentKey?.createdAt,
      currentKeyExpiresAt: currentKey?.expiresAt,
      rotationInterval: this.rotationInterval,
      totalKeys: this.keyStore.keys.length,
      activeKeys: this.getActiveKeys().length,
      rotatedKeys: this.keyStore.keys.filter((k) => k.status === 'rotated').length,
      revokedKeys: this.keyStore.keys.filter((k) => k.status === 'revoked').length,
    };
  }
}

// Singleton instance
let keyManagerInstance: KeyManager | null = null;

export function getKeyManager(): KeyManager {
  if (!keyManagerInstance) {
    const keyStorePath = process.env.KEY_STORE_PATH || './keys/keystore.json';
    const rotationInterval = process.env.KEY_ROTATION_INTERVAL
      ? parseInt(process.env.KEY_ROTATION_INTERVAL)
      : 90 * 24 * 60 * 60 * 1000; // 90 days

    keyManagerInstance = new KeyManager(keyStorePath, rotationInterval);
  }
  return keyManagerInstance;
}

export async function initializeKeyManager(): Promise<KeyManager> {
  const manager = getKeyManager();
  await manager.initialize();
  return manager;
}
