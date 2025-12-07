/**
 * Unified VC Signing Service
 * CRYPTO-001, CRYPTO-002: Integrates JSON-LD signing with KMS support
 *
 * This service provides a unified interface for signing VCs with either:
 * - In-memory Ed25519 keys (development/testing)
 * - AWS KMS-backed signing (production)
 */

import {
  signVerifiableCredential,
  canonicalize,
  VerifiableCredential,
  SigningOptions,
} from '../crypto/vc-signer';
import { generateKeyPair, toVerificationKey2020, KeyPair } from '../crypto/ed25519-keypair';
import { KmsEd25519Signer, KmsKeyInfo } from '../crypto/kms-signer';
import { getKeyManager, ManagedKey } from './keyManager';
import { getAuditService } from './blockchain-audit-service';

export interface SignCredentialRequest {
  credential: VerifiableCredential;
  issuerDid: string;
  verificationMethodId?: string; // Defaults to issuerDid + #key-1
  useKms?: boolean; // Defaults to process.env.USE_KMS_SIGNING === 'true'
  kmsKeyId?: string;
  proofPurpose?: 'assertionMethod' | 'authentication' | 'capabilityDelegation' | 'capabilityInvocation';
  domain?: string;
  challenge?: string;
}

export interface SignCredentialResponse {
  credential: VerifiableCredential;
  proof: any;
  signingMethod: 'kms' | 'local';
}

/**
 * Unified VC Signing Service
 */
export class VCSigningService {
  private kmsSigner: KmsEd25519Signer | null = null;
  private useKms: boolean;

  constructor() {
    // Check if KMS should be used
    this.useKms = process.env.USE_KMS_SIGNING === 'true' || process.env.AWS_KMS_KEY_ID !== undefined;

    if (this.useKms) {
      try {
        this.kmsSigner = new KmsEd25519Signer({
          keyId: process.env.AWS_KMS_KEY_ID,
          region: process.env.AWS_REGION || 'us-east-1',
        });
      } catch (error) {
        console.warn('Failed to initialize KMS signer, falling back to local signing:', error);
        this.useKms = false;
      }
    }
  }

  /**
   * Sign a verifiable credential
   */
  async signCredential(request: SignCredentialRequest): Promise<SignCredentialResponse> {
    const { credential, issuerDid, verificationMethodId, useKms, kmsKeyId, proofPurpose, domain, challenge } = request;

    // Determine verification method ID
    const vmId = verificationMethodId || `${issuerDid}#key-1`;

    // Check if KMS should be used
    const shouldUseKms = useKms ?? this.useKms;

    let signedResult: SignCredentialResponse;
    if (shouldUseKms && this.kmsSigner) {
      signedResult = await this.signWithKms(credential, issuerDid, vmId, kmsKeyId, proofPurpose, domain, challenge);
    } else {
      signedResult = await this.signWithLocalKey(credential, issuerDid, vmId, proofPurpose, domain, challenge);
    }

    // Record audit event on blockchain (fire-and-forget)
    try {
      const auditService = getAuditService();
      const credentialId = credential.id || credential['@id'] || 'unknown';
      const subjectDid = typeof credential.credentialSubject === 'object' && credential.credentialSubject.id
        ? credential.credentialSubject.id
        : 'unknown';

      await auditService.recordIssue(
        credentialId,
        issuerDid,
        {
          credentialType: Array.isArray(credential.type) ? credential.type.join(',') : credential.type,
          subjectDid,
          issuanceDate: credential.issuanceDate,
          expirationDate: credential.expirationDate,
        }
      );
    } catch (error) {
      // Log but don't fail signing if audit fails
      console.error('[VCSigningService] Failed to record audit event:', error);
    }

    return signedResult;
  }

  /**
   * Sign using AWS KMS (no private keys in memory)
   */
  private async signWithKms(
    credential: VerifiableCredential,
    issuerDid: string,
    verificationMethodId: string,
    kmsKeyId?: string,
    proofPurpose?: string,
    domain?: string,
    challenge?: string
  ): Promise<SignCredentialResponse> {
    if (!this.kmsSigner) {
      throw new Error('KMS signer not initialized');
    }

    // Get public key from KMS
    const publicKey = await this.kmsSigner.getPublicKey(kmsKeyId);

    // Canonicalize document
    const canonicalized = await canonicalize(credential);

    // Sign using KMS
    const signature = await this.kmsSigner.signCanonicalized(canonicalized, kmsKeyId);

    // Create proof structure
    const proof = {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      verificationMethod: verificationMethodId,
      proofPurpose: proofPurpose || 'assertionMethod',
      proofValue: signature,
      ...(domain && { domain }),
      ...(challenge && { challenge }),
    };

    // Attach proof to credential
    const signedCredential: VerifiableCredential = {
      ...credential,
      proof,
    };

    return {
      credential: signedCredential,
      proof,
      signingMethod: 'kms',
    };
  }

  /**
   * Sign using local key (development/testing only)
   */
  private async signWithLocalKey(
    credential: VerifiableCredential,
    issuerDid: string,
    verificationMethodId: string,
    proofPurpose?: string,
    domain?: string,
    challenge?: string
  ): Promise<SignCredentialResponse> {
    // Get key from key manager
    const keyManager = getKeyManager();
    const currentKey = keyManager.getCurrentKey();

    if (!currentKey) {
      throw new Error('No signing key available');
    }

    // Convert to Ed25519VerificationKey2020 format
    const keyPair: KeyPair = {
      publicKey: Buffer.from(currentKey.publicKey, 'hex') as unknown as Uint8Array,
      privateKey: Buffer.from(currentKey.secretKey, 'hex') as unknown as Uint8Array,
      publicKeyHex: currentKey.publicKey,
      privateKeyHex: currentKey.secretKey,
    };

    const verificationKey = await toVerificationKey2020(keyPair, verificationMethodId, issuerDid);

    // Sign credential
    const options: SigningOptions = {
      verificationMethod: verificationMethodId,
      keyPair: verificationKey,
      proofPurpose: (proofPurpose as any) || 'assertionMethod',
      domain,
      challenge,
    };

    const signedCredential = await signVerifiableCredential(credential, options);

    return {
      credential: signedCredential,
      proof: signedCredential.proof,
      signingMethod: 'local',
    };
  }

  /**
   * Create a new KMS key for an issuer
   */
  async createKmsKey(description?: string): Promise<KmsKeyInfo> {
    if (!this.kmsSigner) {
      throw new Error('KMS signer not initialized');
    }

    return await this.kmsSigner.createKey(description);
  }

  /**
   * Get public key from KMS
   */
  async getKmsPublicKey(keyId?: string) {
    if (!this.kmsSigner) {
      throw new Error('KMS signer not initialized');
    }

    return await this.kmsSigner.getPublicKey(keyId);
  }
}

// Singleton instance
let signingServiceInstance: VCSigningService | null = null;

export function getSigningService(): VCSigningService {
  if (!signingServiceInstance) {
    signingServiceInstance = new VCSigningService();
  }
  return signingServiceInstance;
}

