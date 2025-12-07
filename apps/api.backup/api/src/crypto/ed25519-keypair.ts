/**
 * Ed25519 Key Pair Utilities
 * CRYPTO-001: Key pair generation and management for Ed25519 signatures
 */

import * as nacl from 'tweetnacl';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyHex: string;
  privateKeyHex: string;
}

/**
 * Generate a new Ed25519 key pair
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.sign.keyPair();

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
    publicKeyHex: Buffer.from(keyPair.publicKey).toString('hex'),
    privateKeyHex: Buffer.from(keyPair.secretKey).toString('hex'),
  };
}

/**
 * Generate key pair from seed (deterministic)
 */
export function generateKeyPairFromSeed(seed: Uint8Array): KeyPair {
  if (seed.length !== 32) {
    throw new Error('Seed must be 32 bytes');
  }

  const keyPair = nacl.sign.keyPair.fromSeed(seed);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.secretKey,
    publicKeyHex: Buffer.from(keyPair.publicKey).toString('hex'),
    privateKeyHex: Buffer.from(keyPair.secretKey).toString('hex'),
  };
}

/**
 * Convert raw key pair to Ed25519VerificationKey2020 format
 */
export async function toVerificationKey2020(
  keyPair: KeyPair,
  id: string, // DID URL or verification method identifier
  controller: string // DID of the controller
): Promise<Ed25519VerificationKey2020> {
  return await Ed25519VerificationKey2020.from({
    id,
    controller,
    publicKeyMultibase: `z${Buffer.from(keyPair.publicKey).toString('base64url')}`,
    privateKeyMultibase: keyPair.privateKeyHex
      ? `z${Buffer.from(keyPair.privateKey).toString('base64url')}`
      : undefined,
  });
}

/**
 * Convert hex-encoded keys to key pair
 */
export function fromHex(publicKeyHex: string, privateKeyHex?: string): KeyPair {
  const publicKey = Buffer.from(publicKeyHex, 'hex');

  if (publicKey.length !== 32) {
    throw new Error('Public key must be 32 bytes');
  }

  let privateKey: Uint8Array | undefined;
  if (privateKeyHex) {
    const privKey = Buffer.from(privateKeyHex, 'hex');
    if (privKey.length !== 64) {
      throw new Error('Private key must be 64 bytes');
    }
    privateKey = new Uint8Array(privKey);
  }

  return {
    publicKey: new Uint8Array(publicKey),
    privateKey: privateKey || new Uint8Array(64),
    publicKeyHex,
    privateKeyHex: privateKeyHex || '',
  };
}

/**
 * Generate a key ID (kid) from public key
 */
export function generateKid(publicKey: Uint8Array | string): string {
  const pubKeyBytes = typeof publicKey === 'string'
    ? Buffer.from(publicKey, 'hex')
    : Buffer.from(publicKey);

  // Use first 8 bytes as kid (truncated fingerprint)
  return Buffer.from(pubKeyBytes.slice(0, 8)).toString('hex');
}

