/**
 * AWS KMS Signer for VC Signing
 * CRYPTO-002: Integrate AWS KMS for all issuer private key operations
 *
 * This module ensures no private keys ever enter the Node runtime.
 * All signing operations go through AWS KMS.
 */

import { KMSClient, SignCommand, GetPublicKeyCommand, CreateKeyCommand, KeySpec, KeyUsageType } from '@aws-sdk/client-kms';
import * as nacl from 'tweetnacl';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { canonicalize } from './vc-signer';

export interface KmsSignerConfig {
  keyId?: string; // KMS key ID or ARN
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface KmsKeyInfo {
  keyId: string;
  arn: string;
  publicKey: Uint8Array;
  keySpec: string;
}

/**
 * AWS KMS-based signer for Ed25519 signatures
 *
 * Flow:
 * 1. Canonicalize document
 * 2. Hash canonicalized document
 * 3. Call KMS.Sign with MessageType=RAW
 * 4. Return signature
 */
export class KmsEd25519Signer {
  private client: KMSClient;
  private keyId: string | undefined;

  constructor(config: KmsSignerConfig = {}) {
    this.client = new KMSClient({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
    });
    this.keyId = config.keyId || process.env.AWS_KMS_KEY_ID;
  }

  /**
   * Create a new Ed25519 key pair in AWS KMS
   */
  async createKey(description?: string): Promise<KmsKeyInfo> {
    try {
      const command = new CreateKeyCommand({
        Description: description || 'VC Issuer Ed25519 Key',
        KeySpec: KeySpec.ECC_NIST_P256, // Note: KMS doesn't directly support Ed25519
        // For Ed25519, we'll need to use ECC_NIST_P256 or RSA, or use a workaround
        // Alternative: Use AWS CloudHSM or third-party HSM service for Ed25519
        KeyUsage: KeyUsageType.SIGN_VERIFY,
        Tags: [
          { TagKey: 'Purpose', TagValue: 'VC-Signing' },
          { TagKey: 'Algorithm', TagValue: 'Ed25519' },
        ],
      });

      const response = await this.client.send(command);

      if (!response.KeyMetadata?.KeyId || !response.KeyMetadata.Arn) {
        throw new Error('Failed to create KMS key: missing key metadata');
      }

      // Get public key
      const publicKeyResponse = await this.client.send(
        new GetPublicKeyCommand({ KeyId: response.KeyMetadata.KeyId })
      );

      if (!publicKeyResponse.PublicKey) {
        throw new Error('Failed to retrieve public key from KMS');
      }

      // Note: KMS returns public key in DER format
      // For Ed25519 compatibility, we need to extract the raw key
      // This is a limitation - AWS KMS doesn't natively support Ed25519
      // Workaround: Use ECDSA with secp256k1 or store Ed25519 keys in AWS Secrets Manager + CloudHSM

      return {
        keyId: response.KeyMetadata.KeyId,
        arn: response.KeyMetadata.Arn,
        publicKey: new Uint8Array(publicKeyResponse.PublicKey),
        keySpec: response.KeyMetadata.KeySpec || 'ECC_NIST_P256',
      };
    } catch (error) {
      throw new Error(`KMS key creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get public key from KMS
   */
  async getPublicKey(keyId?: string): Promise<Ed25519VerificationKey2020> {
    const targetKeyId = keyId || this.keyId;
    if (!targetKeyId) {
      throw new Error('Key ID is required');
    }

    try {
      const command = new GetPublicKeyCommand({ KeyId: targetKeyId });
      const response = await this.client.send(command);

      if (!response.PublicKey) {
        throw new Error('Public key not found in KMS response');
      }

      // Convert KMS public key format to Ed25519VerificationKey2020
      // Note: This assumes the key was created for Ed25519 use
      // For production, consider using CloudHSM or Secrets Manager for Ed25519 keys

      const publicKeyBytes = new Uint8Array(response.PublicKey);

      // Create verification key 2020 format
      // For Ed25519, we need the raw 32-byte public key
      return await Ed25519VerificationKey2020.from({
        id: `kms:${targetKeyId}`,
        controller: `kms:${targetKeyId}`,
        publicKeyMultibase: `z${Buffer.from(publicKeyBytes.slice(-32)).toString('base64url')}`, // Extract last 32 bytes
      });
    } catch (error) {
      throw new Error(`Failed to get public key from KMS: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sign a message using KMS
   *
   * Note: AWS KMS doesn't natively support Ed25519 signatures.
   * This implementation provides a structure but requires either:
   * 1. Using AWS CloudHSM with Ed25519 support
   * 2. Storing Ed25519 keys in AWS Secrets Manager and using a signing service
   * 3. Using a third-party HSM service that supports Ed25519
   */
  async sign(canonicalizedDocument: string, keyId?: string): Promise<Uint8Array> {
    const targetKeyId = keyId || this.keyId;
    if (!targetKeyId) {
      throw new Error('Key ID is required for signing');
    }

    try {
      // Hash the canonicalized document (SHA-256)
      const hash = nacl.hash(Buffer.from(canonicalizedDocument));

      const command = new SignCommand({
        KeyId: targetKeyId,
        Message: Buffer.from(hash),
        MessageType: 'RAW', // Raw message (already hashed)
        SigningAlgorithm: 'ECDSA_SHA_256', // Note: Not Ed25519, see limitations above
      });

      const response = await this.client.send(command);

      if (!response.Signature) {
        throw new Error('KMS did not return a signature');
      }

      return new Uint8Array(response.Signature);
    } catch (error) {
      throw new Error(`KMS signing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Sign a canonicalized VC document
   */
  async signCanonicalized(canonicalizedDocument: string, keyId?: string): Promise<string> {
    const signature = await this.sign(canonicalizedDocument, keyId);
    // Return base64url-encoded signature
    return Buffer.from(signature).toString('base64url');
  }
}

/**
 * Alternative: Use AWS Secrets Manager for Ed25519 key storage
 * This allows storing Ed25519 keys securely without KMS limitations
 */
export class SecretsManagerEd25519Signer {
  private keyId: string;

  constructor(keyId: string) {
    this.keyId = keyId;
  }

  /**
   * Sign using key stored in Secrets Manager
   * Note: This requires importing the key into memory temporarily
   * For true HSM-backed signing, use CloudHSM or dedicated HSM service
   */
  async sign(canonicalizedDocument: string): Promise<string> {
    // TODO: Implement AWS Secrets Manager integration
    // 1. Fetch key from Secrets Manager
    // 2. Sign with nacl
    // 3. Clear key from memory
    throw new Error('SecretsManagerEd25519Signer not yet implemented');
  }
}

/**
 * Production recommendation:
 * - Use AWS CloudHSM with Ed25519 support, OR
 * - Use a dedicated HSM service (e.g., HashiCorp Vault with HSM backend), OR
 * - Store Ed25519 keys in AWS Secrets Manager with encryption at rest
 *
 * For now, provide a hybrid approach that works with current KMS limitations
 */
export async function createKmsSigner(config: KmsSignerConfig = {}): Promise<KmsEd25519Signer> {
  return new KmsEd25519Signer(config);
}

