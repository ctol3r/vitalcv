/**
 * VC Verification Service for JOSE Proofs
 *
 * Verifies JWS-based VC proofs by:
 * - Resolving issuer public keys via DID documents or JWKS
 * - Validating signature, exp/nbf/iat, kid
 * - Ensuring payload matches expected VC schema
 *
 * References:
 * - https://www.w3.org/TR/vc-data-model-2.0/#proofs-signatures
 * - https://www.w3.org/TR/did-core/
 * - https://www.rfc-editor.org/rfc/rfc7517 (JWK Set)
 */

import { GetPublicKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { importJWK, importSPKI, jwtVerify, type KeyLike } from 'jose';
import type { Credential, NormalizedCredential } from '../models';
import { normalizeCredential, validateCredential } from '../models';

export interface VerificationResult {
  valid: boolean;
  credential?: NormalizedCredential;
  errors: string[];
  warnings: string[];
  metadata: {
    issuer?: string;
    subject?: string;
    issuedAt?: Date;
    expiresAt?: Date;
    algorithm?: string;
    keyId?: string;
  };
}

export interface VerificationOptions {
  checkExpiration?: boolean;
  checkNotBefore?: boolean;
  checkStatus?: boolean;
  allowedIssuers?: string[];
  maxAge?: number; // Maximum age in seconds
}

/**
 * Verifies a JWT-encoded verifiable credential
 */
export class JoseVerifier {
  private readonly kmsClient: KMSClient;
  private readonly defaultRegion: string;
  private readonly keyCache: Map<string, { key: KeyLike; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 3600 * 1000; // 1 hour

  constructor(region?: string) {
    this.defaultRegion = region || process.env.AWS_REGION || 'us-east-1';
    this.kmsClient = new KMSClient({
      region: this.defaultRegion,
    });
  }

  /**
   * Verify a credential (JWT string or JSON-LD object)
   */
  async verifyCredential(
    credential: string | Credential,
    options: VerificationOptions = {},
  ): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const opts = {
      checkExpiration: true,
      checkNotBefore: true,
      checkStatus: false,
      ...options,
    };

    try {
      // Handle JWT-encoded credentials
      if (typeof credential === 'string') {
        return this.verifyJWT(credential, opts);
      }

      // Handle JSON-LD credentials
      return this.verifyJSONLD(credential, opts);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        valid: false,
        errors,
        warnings,
        metadata: {},
      };
    }
  }

  /**
   * Verify a JWT-encoded credential
   */
  private async verifyJWT(jwt: string, options: VerificationOptions): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse JWT header to get key ID and algorithm
      const [headerB64] = jwt.split('.');
      if (!headerB64) {
        throw new Error('Invalid JWT format');
      }

      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
      const kid = header.kid as string | undefined;
      const alg = header.alg as string | undefined;

      if (!kid) {
        throw new Error('JWT header missing kid (key ID)');
      }

      if (!alg) {
        throw new Error('JWT header missing alg (algorithm)');
      }

      // Resolve public key
      const publicKey = await this.resolvePublicKey(kid, alg);

      // Verify JWT signature and claims
      const { payload } = await jwtVerify(jwt, publicKey, {
        algorithms: [alg],
      });

      // Extract VC from payload
      if (!payload.vc || typeof payload.vc !== 'object') {
        throw new Error('JWT payload missing vc claim');
      }

      // Validate VC structure
      const vc = validateCredential({
        '@context': payload.vc['@context'] || 'https://www.w3.org/2018/credentials/v2',
        type: payload.vc.type,
        issuer: payload.iss as string,
        issuanceDate:
          typeof payload.iat === 'number'
            ? new Date(payload.iat * 1000).toISOString()
            : new Date().toISOString(),
        credentialSubject: payload.vc.credentialSubject,
        ...(payload.vc.credentialStatus && { credentialStatus: payload.vc.credentialStatus }),
        ...(payload.vc.credentialSchema && { credentialSchema: payload.vc.credentialSchema }),
        ...(payload.vc.evidence && { evidence: payload.vc.evidence }),
      });

      // Normalize for return
      const normalized = normalizeCredential(vc);

      // Check expiration
      if (options.checkExpiration && payload.exp) {
        const exp = new Date(payload.exp * 1000);
        if (exp < new Date()) {
          errors.push(`Credential expired at ${exp.toISOString()}`);
        }
      }

      // Check not before
      if (options.checkNotBefore && payload.nbf) {
        const nbf = new Date(payload.nbf * 1000);
        if (nbf > new Date()) {
          errors.push(`Credential not valid until ${nbf.toISOString()}`);
        }
      }

      // Check issuer allowlist
      if (options.allowedIssuers && !options.allowedIssuers.includes(payload.iss as string)) {
        errors.push(`Issuer ${payload.iss} not in allowed list`);
      }

      // Check max age
      if (options.maxAge && payload.iat) {
        const age = Date.now() / 1000 - payload.iat;
        if (age > options.maxAge) {
          warnings.push(`Credential age (${age}s) exceeds max age (${options.maxAge}s)`);
        }
      }

      // Check status if enabled
      if (options.checkStatus && vc.credentialStatus) {
        // TODO: Implement status list checking
        warnings.push('Status list checking not yet implemented');
      }

      return {
        valid: errors.length === 0,
        credential: normalized,
        errors,
        warnings,
        metadata: {
          issuer: payload.iss as string,
          subject: payload.sub as string,
          issuedAt: payload.iat ? new Date(payload.iat * 1000) : undefined,
          expiresAt: payload.exp ? new Date(payload.exp * 1000) : undefined,
          algorithm: alg,
          keyId: kid,
        },
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        valid: false,
        errors,
        warnings,
        metadata: {},
      };
    }
  }

  /**
   * Verify a JSON-LD credential
   */
  private async verifyJSONLD(
    credential: Credential,
    options: VerificationOptions,
  ): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate structure
      const vc = validateCredential(credential);
      const normalized = normalizeCredential(vc);

      // Check proof
      if (!vc.proof) {
        errors.push('Credential missing proof');
        return {
          valid: false,
          errors,
          warnings,
          metadata: {},
        };
      }

      const proof = Array.isArray(vc.proof) ? vc.proof[0] : vc.proof;

      // Verify JWS proof if present
      if (proof.jws) {
        return this.verifyJWT(proof.jws, options);
      }

      // For other proof types, we'd need additional verification logic
      warnings.push('Non-JWS proof types require additional verification logic');

      // Check expiration
      if (options.checkExpiration && normalized.expirationDate) {
        if (normalized.expirationDate < new Date()) {
          errors.push(`Credential expired at ${normalized.expirationDate.toISOString()}`);
        }
      }

      // Check issuer allowlist
      if (options.allowedIssuers && !options.allowedIssuers.includes(normalized.issuer.id)) {
        errors.push(`Issuer ${normalized.issuer.id} not in allowed list`);
      }

      return {
        valid: errors.length === 0,
        credential: normalized,
        errors,
        warnings,
        metadata: {
          issuer: normalized.issuer.id,
          subject: Array.isArray(normalized.credentialSubject)
            ? normalized.credentialSubject[0]?.id
            : normalized.credentialSubject.id,
          issuedAt: normalized.issuanceDate,
          expiresAt: normalized.expirationDate,
        },
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        valid: false,
        errors,
        warnings,
        metadata: {},
      };
    }
  }

  /**
   * Resolve public key from KMS, DID document, or JWKS
   */
  private async resolvePublicKey(kid: string, alg: string): Promise<KeyLike> {
    // Check cache first
    const cached = this.keyCache.get(kid);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key;
    }

    let publicKey: KeyLike;

    // Try KMS first (if kid looks like a KMS key ID/ARN)
    if (
      kid.startsWith('arn:aws:kms:') ||
      kid.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    ) {
      try {
        publicKey = await this.resolveKMSKey(kid, alg);
      } catch (error) {
        // Fall through to DID/JWKS resolution
        console.warn(`Failed to resolve KMS key ${kid}:`, error);
      }
    }

    // Try DID resolution
    if (!publicKey && kid.includes('did:')) {
      try {
        publicKey = await this.resolveDIDKey(kid, alg);
      } catch (error) {
        console.warn(`Failed to resolve DID key ${kid}:`, error);
      }
    }

    // Try JWKS endpoint
    if (!publicKey && kid.includes('http')) {
      try {
        publicKey = await this.resolveJWKSKey(kid, alg);
      } catch (error) {
        console.warn(`Failed to resolve JWKS key ${kid}:`, error);
      }
    }

    if (!publicKey) {
      throw new Error(`Could not resolve public key for kid: ${kid}`);
    }

    // Cache the key
    this.keyCache.set(kid, {
      key: publicKey,
      expiresAt: Date.now() + this.CACHE_TTL,
    });

    return publicKey;
  }

  /**
   * Resolve public key from AWS KMS
   */
  private async resolveKMSKey(kid: string, alg: string): Promise<KeyLike> {
    const command = new GetPublicKeyCommand({
      KeyId: kid,
    });

    const response = await this.kmsClient.send(command);

    if (!response.PublicKey) {
      throw new Error('KMS did not return a public key');
    }

    // Convert DER to PEM format
    const publicKeyPem = this.derToPem(Buffer.from(response.PublicKey), 'PUBLIC KEY');

    return importSPKI(publicKeyPem, alg);
  }

  /**
   * Resolve public key from DID document
   */
  private async resolveDIDKey(kid: string, alg: string): Promise<KeyLike> {
    // Extract DID and fragment
    const [did, fragment] = kid.split('#');
    if (!did || !fragment) {
      throw new Error(`Invalid DID key ID format: ${kid}`);
    }

    // Resolve DID document
    const resolverUrl =
      process.env.DID_RESOLVER_URL || 'https://resolver.identity.foundation/1.0/identifiers';
    const response = await fetch(`${resolverUrl}/${did}`);

    if (!response.ok) {
      throw new Error(`Failed to resolve DID: ${did}`);
    }

    const didDoc = await response.json();

    // Find verification method
    const vm = didDoc.verificationMethod?.find(
      (vm: any) => vm.id === kid || vm.id.endsWith(`#${fragment}`),
    );

    if (!vm) {
      throw new Error(`Verification method not found in DID document: ${kid}`);
    }

    // Import JWK or PEM
    if (vm.publicKeyJwk) {
      return importJWK(vm.publicKeyJwk, alg);
    }

    if (vm.publicKeyPem) {
      return importSPKI(vm.publicKeyPem, alg);
    }

    throw new Error(`No supported public key format in verification method: ${kid}`);
  }

  /**
   * Resolve public key from JWKS endpoint
   */
  private async resolveJWKSKey(jwksUrl: string, alg: string): Promise<KeyLike> {
    const response = await fetch(jwksUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS from ${jwksUrl}`);
    }

    const jwks = await response.json();

    // Find key matching the algorithm
    const key = jwks.keys?.find((k: any) => k.alg === alg || k.use === 'sig');

    if (!key) {
      throw new Error(`No matching key found in JWKS for algorithm: ${alg}`);
    }

    return importJWK(key, alg);
  }

  /**
   * Convert DER to PEM format
   */
  private derToPem(der: Buffer, type: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
    const base64 = der.toString('base64');
    const chunks = base64.match(/.{1,64}/g) || [];
    return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----\n`;
  }
}

/**
 * Default verifier instance
 */
let defaultVerifier: JoseVerifier | null = null;

export function getDefaultVerifier(region?: string): JoseVerifier {
  if (!defaultVerifier) {
    defaultVerifier = new JoseVerifier(region);
  }
  return defaultVerifier;
}

/**
 * Convenience function to verify a credential
 */
export async function verifyCredential(
  credential: string | Credential,
  options?: VerificationOptions,
): Promise<VerificationResult> {
  const verifier = getDefaultVerifier();
  return verifier.verifyCredential(credential, options);
}
