/**
 * Envelope signing utilities for producers
 * Signs message envelopes with JWS for VC flows
 */

import { SignJWT, jwtVerify, importJWK, exportJWK, generateKeyPair } from 'jose';
import { MessageEnvelope } from './types';

export interface EnvelopeSignerConfig {
  /** Private key for signing (JWK format) */
  privateKey?: any;
  /** Public key for verification (JWK format) */
  publicKey?: any;
  /** Algorithm to use (default: EdDSA) */
  algorithm?: string;
}

/**
 * Envelope signer for producers
 * Signs envelopes with detached JWS
 */
export class EnvelopeSigner {
  private privateKey: any;
  private publicKeyJWK: any;
  private algorithm: string;

  constructor(config?: EnvelopeSignerConfig) {
    this.algorithm = config?.algorithm || 'EdDSA';

    if (config?.privateKey) {
      this.privateKey = config.privateKey;
      this.publicKeyJWK = config.publicKey || config.privateKey;
    } else {
      // Generate keys if not provided (for testing)
      this.initializeKeys();
    }
  }

  private async initializeKeys() {
    const { publicKey, privateKey } = await generateKeyPair('EdDSA');
    this.privateKey = privateKey;
    this.publicKeyJWK = await exportJWK(publicKey);
  }

  /**
   * Sign an envelope with JWS
   */
  async signEnvelope(envelope: MessageEnvelope): Promise<MessageEnvelope & { signature: string }> {
    const payload = {
      sink: envelope.sink,
      payload: envelope.payload,
      timestamp: envelope.timestamp || Date.now(),
    };

    const signature = await new SignJWT(payload)
      .setProtectedHeader({ alg: this.algorithm as any })
      .sign(this.privateKey);

    return {
      ...envelope,
      signature,
      timestamp: envelope.timestamp || Date.now(),
    };
  }

  /**
   * Get public key for verification
   */
  getPublicKey(): any {
    return this.publicKeyJWK;
  }
}

/**
 * Envelope verifier for consumers
 */
export class EnvelopeVerifier {
  private publicKey: any;
  private algorithm: string;

  constructor(publicKeyJWK: any, algorithm: string = 'EdDSA') {
    this.publicKey = publicKeyJWK;
    this.algorithm = algorithm;
  }

  /**
   * Verify envelope signature
   */
  async verifyEnvelope(envelope: MessageEnvelope & { signature: string }): Promise<boolean> {
    if (!envelope.signature) {
      throw new Error('Envelope missing signature');
    }

    try {
      const key = await importJWK(this.publicKey, this.algorithm as any);
      const payload = {
        sink: envelope.sink,
        payload: envelope.payload,
        timestamp: envelope.timestamp || Date.now(),
      };

      await jwtVerify(envelope.signature, key, {
        algorithms: [this.algorithm as any],
      });

      return true;
    } catch (error) {
      throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}

/**
 * Create a signed envelope with allowed_sinks
 */
export async function createSignedEnvelope(
  sink: string,
  payload: unknown,
  allowedSinks: string[],
  signer: EnvelopeSigner
): Promise<MessageEnvelope & { signature: string; allowed_sinks: string[] }> {
  const envelope: MessageEnvelope = {
    sink,
    payload,
    timestamp: Date.now(),
  };

  const signed = await signer.signEnvelope(envelope);

  return {
    ...signed,
    allowed_sinks: allowedSinks,
  };
}

