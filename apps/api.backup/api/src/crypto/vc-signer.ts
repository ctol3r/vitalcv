/**
 * VC Signer Service
 * CRYPTO-001: Replace broken Ed25519 + JSON-LD signature libraries
 *
 * Implements proper Ed25519Signature2020 and DataIntegrityProof using
 * @digitalbazaar/jsonld-signatures with correct JSON-LD canonicalization.
 */

import * as jsonld from 'jsonld';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';

export interface VerifiableCredential {
  '@context': string | string[];
  id?: string;
  type: string | string[];
  issuer: string | { id: string; [key: string]: any };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id?: string;
    [key: string]: any;
  };
  proof?: DataIntegrityProof;
  [key: string]: any;
}

export interface SigningOptions {
  verificationMethod: string; // DID URL or verification method identifier
  keyPair: Ed25519VerificationKey2020;
  suite?: Ed25519Signature2020;
  proofPurpose?: 'assertionMethod' | 'authentication' | 'capabilityDelegation' | 'capabilityInvocation';
  created?: string;
  domain?: string;
  challenge?: string;
}

export interface VerificationResult {
  verified: boolean;
  error?: string;
  proof?: DataIntegrityProof;
}

/**
 * Canonicalize a JSON-LD document using URDNA2015 algorithm
 * This is required before hashing for signature computation
 */
export async function canonicalize(document: any): Promise<string> {
  try {
    // Use URDNA2015 (default) canonicalization algorithm as per W3C spec
    const canonical = await jsonld.canonize(document, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads',
    });
    return canonical;
  } catch (error) {
    throw new Error(`JSON-LD canonicalization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Expand and normalize JSON-LD context
 */
export async function expandContext(document: VerifiableCredential): Promise<any> {
  try {
    const expanded = await jsonld.expand(document);
    return expanded;
  } catch (error) {
    throw new Error(`JSON-LD expansion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sign a Verifiable Credential using Ed25519Signature2020
 *
 * Flow:
 * 1. Expand JSON-LD contexts
 * 2. Canonicalize the document using URDNA2015
 * 3. Create proof suite
 * 4. Sign the canonicalized document
 * 5. Attach proof to credential
 */
export async function signVerifiableCredential(
  credential: VerifiableCredential,
  options: SigningOptions
): Promise<VerifiableCredential> {
  try {
    // Ensure credential has proper context
    if (!credential['@context']) {
      credential['@context'] = [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/data-integrity/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ];
    }

    // Create proof suite
    const suite = options.suite || new Ed25519Signature2020({
      key: options.keyPair,
      verificationMethod: options.verificationMethod,
      proofPurpose: options.proofPurpose || 'assertionMethod',
    });

    // Remove existing proof if present (to avoid signing with stale proof)
    const credentialWithoutProof = { ...credential };
    delete credentialWithoutProof.proof;

    // Sign using jsonld-signatures library
    // This internally handles canonicalization and proof generation
    const signedCredential = await jsonld.sign(credentialWithoutProof, {
      suite,
      purpose: suite.proofPurpose,
      verificationMethod: options.verificationMethod,
      documentLoader: createDocumentLoader(),
    });

    // Add optional proof metadata
    if (options.domain) {
      signedCredential.proof.domain = options.domain;
    }
    if (options.challenge) {
      signedCredential.proof.challenge = options.challenge;
    }

    return signedCredential as VerifiableCredential;
  } catch (error) {
    throw new Error(`VC signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Verify a Verifiable Credential
 *
 * Flow:
 * 1. Resolve verification method from credential proof
 * 2. Expand and canonicalize document
 * 3. Verify signature against canonical form
 * 4. Check expiration dates
 */
export async function verifyVerifiableCredential(
  credential: VerifiableCredential,
  publicKey?: Ed25519VerificationKey2020
): Promise<VerificationResult> {
  try {
    if (!credential.proof) {
      return { verified: false, error: 'Credential has no proof' };
    }

    // Check expiration
    if (credential.expirationDate) {
      const expiration = new Date(credential.expirationDate);
      if (expiration < new Date()) {
        return { verified: false, error: 'Credential has expired' };
      }
    }

    // Check issuance date is valid
    if (credential.issuanceDate) {
      const issuance = new Date(credential.issuanceDate);
      if (isNaN(issuance.getTime())) {
        return { verified: false, error: 'Invalid issuance date' };
      }
    }

    // Verify proof using jsonld-signatures
    const suite = new Ed25519Signature2020();
    const result = await jsonld.verify(credential, {
      suite,
      purpose: suite.proofPurpose,
      documentLoader: createDocumentLoader(),
      // If public key provided, use it for verification
      // Otherwise, resolve from verificationMethod in proof
      ...(publicKey && { publicKey }),
    });

    return {
      verified: result.verified,
      error: result.verified ? undefined : result.error?.message,
      proof: credential.proof,
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a document loader for JSON-LD processing
 * This resolves @context URLs and provides local context documents
 */
function createDocumentLoader(): (url: string) => Promise<any> {
  // Local context cache
  const contexts: Record<string, any> = {
    'https://www.w3.org/2018/credentials/v1': {
      '@context': {
        '@version': 1.1,
        '@protected': true,
        VerifiableCredential: {
          '@id': 'https://www.w3.org/2018/credentials#VerifiableCredential',
          '@context': {
            '@version': 1.1,
            '@protected': true,
            id: '@id',
            type: '@type',
            credentialSubject: 'https://www.w3.org/2018/credentials#credentialSubject',
            issuer: 'https://www.w3.org/2018/credentials#issuer',
            issuanceDate: {
              '@id': 'https://www.w3.org/2018/credentials#issuanceDate',
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            },
            expirationDate: {
              '@id': 'https://www.w3.org/2018/credentials#expirationDate',
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime',
            },
            proof: {
              '@id': 'https://w3id.org/security#proof',
              '@type': '@id',
              '@container': '@graph',
            },
          },
        },
      },
    },
  };

  return async (url: string) => {
    // Check local cache first
    if (contexts[url]) {
      return {
        contextUrl: null,
        document: contexts[url],
        documentUrl: url,
      };
    }

    // For remote contexts, fetch from network
    // In production, consider caching and validation
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch context: ${url}`);
      }
      const document = await response.json();
      return {
        contextUrl: null,
        document,
        documentUrl: url,
      };
    } catch (error) {
      throw new Error(`Document loader failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
}

/**
 * Extract verification method from credential proof
 */
export function getVerificationMethod(credential: VerifiableCredential): string | null {
  if (!credential.proof?.verificationMethod) {
    return null;
  }

  if (typeof credential.proof.verificationMethod === 'string') {
    return credential.proof.verificationMethod;
  }

  if (typeof credential.proof.verificationMethod === 'object' && credential.proof.verificationMethod.id) {
    return credential.proof.verificationMethod.id;
  }

  return null;
}

