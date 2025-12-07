/**
 * JOSE-based VC Signing Service with AWS KMS
 *
 * Implements VC signing using JOSE (JWS) with AWS KMS keys.
 * Supports ES256 (ECDSA P-256), ES384, ES512, and EdDSA algorithms.
 * Private keys never leave KMS.
 *
 * References:
 * - https://www.rfc-editor.org/rfc/rfc7515 (JWS)
 * - https://www.rfc-editor.org/rfc/rfc7517 (JWK)
 * - AWS KMS Sign API: https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html
 */

import {
  GetPublicKeyCommand,
  KMSClient,
  SignCommand,
  type SigningAlgorithmSpec,
} from '@aws-sdk/client-kms';
import { type JWSHeaderParameters } from 'jose';
import type { JWTCredentialPayload, NormalizedCredential } from '../models';
import { denormalizeCredential } from '../models';

export interface IssuerKeyMetadata {
  keyId: string; // KMS Key ID or ARN
  algorithm: 'ES256' | 'ES384' | 'ES512' | 'EdDSA';
  keyArn?: string; // Full ARN if available
  issuerDid?: string; // Issuer DID for verification method
}

export interface SigningOptions {
  issuerKey: IssuerKeyMetadata;
  credential: NormalizedCredential;
  format?: 'jwt' | 'jwt_vc_json' | 'jwt_vc_json_ld';
  additionalClaims?: Record<string, unknown>;
}

export interface SignedCredential {
  credential: string; // JWT string
  format: string;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    jws: string;
  };
}

/**
 * Maps JOSE algorithm names to AWS KMS SigningAlgorithmSpec
 */
function mapAlgorithmToKMS(alg: string): SigningAlgorithmSpec {
  switch (alg) {
    case 'ES256':
      return 'ECDSA_SHA_256';
    case 'ES384':
      return 'ECDSA_SHA_384';
    case 'ES512':
      return 'ECDSA_SHA_512';
    case 'EdDSA':
      return 'ECDSA_SHA_512'; // EdDSA uses Ed25519, but KMS uses ECDSA_SHA_512 for Ed25519
    default:
      throw new Error(`Unsupported algorithm: ${alg}`);
  }
}

/**
 * Gets the JOSE algorithm identifier from KMS algorithm
 */
function getJoseAlgorithm(kmsAlg: SigningAlgorithmSpec): string {
  switch (kmsAlg) {
    case 'ECDSA_SHA_256':
      return 'ES256';
    case 'ECDSA_SHA_384':
      return 'ES384';
    case 'ECDSA_SHA_512':
      return 'ECDSA_SHA_512';
    default:
      throw new Error(`Unsupported KMS algorithm: ${kmsAlg}`);
  }
}

/**
 * JOSE KMS Signer for Verifiable Credentials
 */
export class JoseKmsSigner {
  private readonly kmsClient: KMSClient;
  private readonly defaultRegion: string;

  constructor(region?: string) {
    this.defaultRegion = region || process.env.AWS_REGION || 'us-east-1';
    this.kmsClient = new KMSClient({
      region: this.defaultRegion,
    });
  }

  /**
   * Sign a credential using AWS KMS
   */
  async signCredential(options: SigningOptions): Promise<SignedCredential> {
    const { issuerKey, credential, format = 'jwt_vc_json', additionalClaims = {} } = options;

    // Build JWT payload
    const payload = this.buildJWTPayload(credential, additionalClaims);

    // Create JWT header
    const header: JWSHeaderParameters = {
      alg: issuerKey.algorithm,
      typ: 'JWT',
      kid: issuerKey.keyId,
    };

    // Build the JWT (header.payload)
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const message = `${headerB64}.${payloadB64}`;

    // Sign with KMS
    const signature = await this.signWithKMS(
      issuerKey.keyId,
      issuerKey.algorithm,
      Buffer.from(message, 'utf-8'),
    );

    // Build the complete JWT
    const jws = `${message}.${base64UrlEncode(signature)}`;

    // Build proof object for JSON-LD representation
    const verificationMethod = issuerKey.issuerDid
      ? `${issuerKey.issuerDid}#${issuerKey.keyId}`
      : `did:key:${issuerKey.keyId}`;

    return {
      credential: jws,
      format,
      proof: {
        type: 'JsonWebSignature2020',
        created: new Date().toISOString(),
        verificationMethod,
        jws,
      },
    };
  }

  /**
   * Get public key from KMS for verification
   */
  async getPublicKey(keyId: string): Promise<{ publicKey: string; algorithm: string }> {
    try {
      const command = new GetPublicKeyCommand({
        KeyId: keyId,
      });

      const response = await this.kmsClient.send(command);

      if (!response.PublicKey) {
        throw new Error('KMS did not return a public key');
      }

      const algorithm = response.SigningAlgorithms?.[0] || 'ECDSA_SHA_256';
      const joseAlg = getJoseAlgorithm(algorithm as SigningAlgorithmSpec);

      return {
        publicKey: Buffer.from(response.PublicKey).toString('base64url'),
        algorithm: joseAlg,
      };
    } catch (error) {
      throw new Error(
        `Failed to get public key from KMS: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Sign a message using KMS
   */
  private async signWithKMS(keyId: string, algorithm: string, message: Buffer): Promise<Buffer> {
    try {
      const kmsAlgorithm = mapAlgorithmToKMS(algorithm);

      const command = new SignCommand({
        KeyId: keyId,
        Message: message,
        MessageType: 'RAW',
        SigningAlgorithm: kmsAlgorithm,
      });

      const response = await this.kmsClient.send(command);

      if (!response.Signature) {
        throw new Error('KMS did not return a signature');
      }

      return Buffer.from(response.Signature);
    } catch (error) {
      throw new Error(
        `KMS signing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Build JWT payload from normalized credential
   */
  private buildJWTPayload(
    credential: NormalizedCredential,
    additionalClaims: Record<string, unknown>,
  ): JWTCredentialPayload {
    const subject = Array.isArray(credential.credentialSubject)
      ? credential.credentialSubject[0]?.id
      : credential.credentialSubject.id;

    const now = Math.floor(Date.now() / 1000);
    const nbf = credential.validFrom ? Math.floor(credential.validFrom.getTime() / 1000) : now;
    const exp =
      credential.expirationDate || credential.validUntil
        ? Math.floor((credential.expirationDate || credential.validUntil)!.getTime() / 1000)
        : undefined;

    const vc = denormalizeCredential(credential);

    return {
      iss: credential.issuer.id,
      sub: subject || credential.issuer.id,
      vc: {
        '@context': Array.isArray(vc['@context']) ? vc['@context'] : [vc['@context']],
        type: Array.isArray(vc.type) ? vc.type : [vc.type],
        credentialSubject: vc.credentialSubject,
        ...(vc.credentialStatus && { credentialStatus: vc.credentialStatus }),
        ...(vc.credentialSchema && { credentialSchema: vc.credentialSchema }),
        ...(vc.evidence && { evidence: vc.evidence }),
      },
      jti: credential.id,
      nbf,
      iat: now,
      ...(exp && { exp }),
      ...additionalClaims,
    };
  }
}

/**
 * Base64 URL encoding (RFC 4648 §5)
 */
function base64UrlEncode(data: string | Buffer): string {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Default signer instance (singleton pattern)
 */
let defaultSigner: JoseKmsSigner | null = null;

export function getDefaultSigner(region?: string): JoseKmsSigner {
  if (!defaultSigner) {
    defaultSigner = new JoseKmsSigner(region);
  }
  return defaultSigner;
}
