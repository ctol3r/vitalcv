/**
 * EncryptionService
 * B237A-DP-003: EncryptionService
 *
 * Provides AES-256 encryption/decryption for vault data.
 * Manages encryption keys via KMS and implements envelope encryption.
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

export interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
}

export interface EncryptedData {
  encrypted: Buffer;
  iv: Buffer;
  tag: Buffer;
  keyId: string;
  encryptedKey?: Buffer; // For envelope encryption
}

export interface KMSConfig {
  provider?: 'aws' | 'azure' | 'gcp' | 'local';
  keyId?: string;
  region?: string;
}

/**
 * EncryptionService handles encryption/decryption with KMS support
 */
export class EncryptionService {
  private kmsConfig: KMSConfig;
  private localKeys: Map<string, Buffer> = new Map();

  constructor(kmsConfig: KMSConfig = { provider: 'local' }) {
    this.kmsConfig = kmsConfig;
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(keyId?: string): Promise<EncryptionKey> {
    const key = crypto.randomBytes(KEY_LENGTH);
    const id = keyId || crypto.randomBytes(16).toString('hex');

    if (this.kmsConfig.provider === 'local') {
      // Store locally (in production, use secure key storage)
      this.localKeys.set(id, key);
    } else {
      // In production, create key in KMS
      // await this.createKMSKey(id);
    }

    return {
      id,
      key,
      algorithm: ALGORITHM,
    };
  }

  /**
   * Get encryption key by ID
   */
  async getKey(keyId: string): Promise<EncryptionKey | null> {
    if (this.kmsConfig.provider === 'local') {
      const key = this.localKeys.get(keyId);
      if (!key) {
        return null;
      }
      return {
        id: keyId,
        key,
        algorithm: ALGORITHM,
      };
    }

    // In production, fetch from KMS
    // return await this.getKMSKey(keyId);
    return null;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  async encrypt(data: Buffer, keyId: string): Promise<EncryptedData> {
    const keyInfo = await this.getKey(keyId);
    if (!keyInfo) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, keyInfo.key, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv,
      tag,
      keyId,
    };
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  async decrypt(encryptedData: EncryptedData): Promise<Buffer> {
    const keyInfo = await this.getKey(encryptedData.keyId);
    if (!keyInfo) {
      throw new Error(`Encryption key not found: ${encryptedData.keyId}`);
    }

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      keyInfo.key,
      encryptedData.iv
    );
    decipher.setAuthTag(encryptedData.tag);

    return Buffer.concat([
      decipher.update(encryptedData.encrypted),
      decipher.final(),
    ]);
  }

  /**
   * Envelope encryption: encrypt data with a data encryption key (DEK),
   * then encrypt the DEK with a key encryption key (KEK) from KMS
   */
  async encryptWithEnvelope(
    data: Buffer,
    kekKeyId: string
  ): Promise<EncryptedData> {
    // Generate a data encryption key (DEK)
    const dek = await this.generateKey();

    // Encrypt data with DEK
    const encrypted = await this.encrypt(data, dek.id);

    // Encrypt DEK with KEK (key encryption key from KMS)
    const kek = await this.getKey(kekKeyId);
    if (!kek) {
      throw new Error(`KEK not found: ${kekKeyId}`);
    }

    const kekIv = crypto.randomBytes(IV_LENGTH);
    const kekCipher = crypto.createCipheriv(ALGORITHM, kek.key, kekIv);
    const encryptedDek = Buffer.concat([
      kekCipher.update(dek.key),
      kekCipher.final(),
    ]);
    const kekTag = kekCipher.getAuthTag();

    // Store encrypted DEK alongside encrypted data
    return {
      ...encrypted,
      encryptedKey: Buffer.concat([kekIv, kekTag, encryptedDek]),
    };
  }

  /**
   * Decrypt data encrypted with envelope encryption
   */
  async decryptWithEnvelope(encryptedData: EncryptedData): Promise<Buffer> {
    if (!encryptedData.encryptedKey) {
      // Fallback to regular decryption
      return this.decrypt(encryptedData);
    }

    // Extract KEK key ID (in production, this would come from KMS metadata)
    const kekKeyId = this.kmsConfig.keyId || encryptedData.keyId;
    const kek = await this.getKey(kekKeyId);
    if (!kek) {
      throw new Error(`KEK not found: ${kekKeyId}`);
    }

    // Decrypt the DEK
    const kekIv = encryptedData.encryptedKey.slice(0, IV_LENGTH);
    const kekTag = encryptedData.encryptedKey.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encryptedDek = encryptedData.encryptedKey.slice(IV_LENGTH + TAG_LENGTH);

    const kekDecipher = crypto.createDecipheriv(ALGORITHM, kek.key, kekIv);
    kekDecipher.setAuthTag(kekTag);
    const dek = Buffer.concat([
      kekDecipher.update(encryptedDek),
      kekDecipher.final(),
    ]);

    // Decrypt data with DEK
    const dekKeyId = crypto.randomBytes(16).toString('hex');
    this.localKeys.set(dekKeyId, dek);

    return this.decrypt({
      ...encryptedData,
      keyId: dekKeyId,
    });
  }

  /**
   * Serialize encrypted data for storage
   */
  serializeEncryptedData(data: EncryptedData): Buffer {
    const parts = [
      Buffer.from(data.keyId, 'utf8'),
      Buffer.from([data.iv.length]),
      data.iv,
      Buffer.from([data.tag.length]),
      data.tag,
      data.encrypted,
    ];

    if (data.encryptedKey) {
      parts.push(Buffer.from([1])); // Flag indicating envelope encryption
      parts.push(data.encryptedKey);
    } else {
      parts.push(Buffer.from([0]));
    }

    return Buffer.concat(parts);
  }

  /**
   * Deserialize encrypted data from storage
   */
  deserializeEncryptedData(buffer: Buffer): EncryptedData {
    let offset = 0;

    // Read keyId
    const keyIdLength = buffer.readUInt8(offset);
    offset += 1;
    const keyId = buffer.slice(offset, offset + keyIdLength).toString('utf8');
    offset += keyIdLength;

    // Read IV
    const ivLength = buffer.readUInt8(offset);
    offset += 1;
    const iv = buffer.slice(offset, offset + ivLength);
    offset += ivLength;

    // Read tag
    const tagLength = buffer.readUInt8(offset);
    offset += 1;
    const tag = buffer.slice(offset, offset + tagLength);
    offset += tagLength;

    // Read envelope encryption flag
    const hasEnvelope = buffer.readUInt8(offset) === 1;
    offset += 1;

    // Read encrypted key if present
    let encryptedKey: Buffer | undefined;
    if (hasEnvelope) {
      const encryptedKeyLength = buffer.length - offset - (buffer.length - offset - IV_LENGTH - TAG_LENGTH);
      encryptedKey = buffer.slice(offset, offset + IV_LENGTH + TAG_LENGTH + (buffer.length - offset - IV_LENGTH - TAG_LENGTH));
      offset += encryptedKey.length;
    }

    // Remaining is encrypted data
    const encrypted = buffer.slice(offset);

    return {
      encrypted,
      iv,
      tag,
      keyId,
      encryptedKey,
    };
  }

  /**
   * Calculate checksum (SHA-256) of encrypted data
   */
  calculateChecksum(encryptedData: EncryptedData): string {
    const serialized = this.serializeEncryptedData(encryptedData);
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }
}

// Singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    const kmsProvider = (process.env.KMS_PROVIDER || 'local') as 'aws' | 'azure' | 'gcp' | 'local';
    const kmsKeyId = process.env.KMS_KEY_ID;
    const kmsRegion = process.env.KMS_REGION;

    encryptionServiceInstance = new EncryptionService({
      provider: kmsProvider,
      keyId: kmsKeyId,
      region: kmsRegion,
    });
  }
  return encryptionServiceInstance;
}
