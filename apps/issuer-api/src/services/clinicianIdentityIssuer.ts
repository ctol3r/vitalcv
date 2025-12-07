/**
 * S72-D1-A-007: VC Issuance Helper for ClinicianIdentityVC
 *
 * Signs and issues ClinicianIdentityCredential verifiable credentials.
 * Uses a single keypair from environment configuration.
 */

import { SignJWT, importJWK, JWK } from 'jose';
import { randomBytes } from 'crypto';
import { getActiveSigningKey } from '../../../../services/identity/signingKeyProvider';

// Issuer configuration
const ISSUER_DID = process.env.ISSUER_DID || 'did:web:issuer.vitalcv.com';
const ISSUER_URL = process.env.PUBLIC_ISSUER_URL || process.env.ISSUER_URL || 'https://vitalcv.ai';

const DEFAULT_SIGNING_ALG = process.env.ISSUER_SIGNING_ALG || 'EdDSA';

async function getSigningMaterial(): Promise<{ kid: string; jwk: JWK; algorithm: string; privateKey: CryptoKey }> {
  const { kid, jwk } = await getActiveSigningKey();
  const algorithm = (jwk.alg as string) || DEFAULT_SIGNING_ALG;
  const privateKey = await importJWK(jwk, algorithm);
  return { kid, jwk, algorithm, privateKey };
}

/**
 * Clinician profile interface
 */
export interface ClinicianProfile {
  did?: string;
  name: string;
  npi: string;
  specialty: string;
}

/**
 * ClinicianIdentityVC interface (matches JSON schema)
 */
export interface ClinicianIdentityVC {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    name: string;
    npi: string;
    specialty: string;
  };
}

/**
 * Issue a ClinicianIdentityCredential
 *
 * @param profile - Clinician profile data
 * @returns Signed VC as JWS (compact serialization)
 */
export async function issueClinicianIdentityVC(profile: ClinicianProfile): Promise<string> {
  // Validate input
  if (!profile.name || profile.name.trim().length === 0) {
    throw new Error('Clinician name is required');
  }
  if (!profile.npi || !/^[0-9]{10}$/.test(profile.npi)) {
    throw new Error('Valid 10-digit NPI is required');
  }
  if (!profile.specialty || profile.specialty.trim().length === 0) {
    throw new Error('Clinician specialty is required');
  }

  // Generate credential ID
  const credentialId = `${ISSUER_URL}/credentials/clinician/${randomBytes(16).toString('hex')}`;

  // Build credential subject DID (use provided or generate placeholder)
  const subjectDid = profile.did || `did:key:z${randomBytes(16).toString('base64url')}`;

  // Build VC payload
  const now = new Date();
  const vc: ClinicianIdentityVC = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1'
    ],
    id: credentialId,
    type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: ISSUER_DID,
    issuanceDate: now.toISOString(),
    credentialSubject: {
      id: subjectDid,
      name: profile.name.trim(),
      npi: profile.npi,
      specialty: profile.specialty.trim(),
    }
  };

  // Sign as JWS (JWT format)
  const { privateKey, kid, algorithm } = await getSigningMaterial();

  const nowSeconds = Math.floor(now.getTime() / 1000);

  const jws = await new SignJWT({ vc })
    .setProtectedHeader({
      alg: algorithm,
      typ: 'JWT',
      kid: kid || 'issuer-key-default'
    })
    .setIssuedAt(nowSeconds)
    .setIssuer(ISSUER_DID)
    .setSubject(subjectDid)
    .setJti(credentialId)
    .sign(privateKey);

  return jws;
}

/**
 * Verify a ClinicianIdentityVC signature
 *
 * @param jws - The signed JWS credential
 * @returns The decoded and verified VC payload
 */
export async function verifyClinicianIdentityVC(jws: string): Promise<ClinicianIdentityVC> {
  const { jwtVerify } = await import('jose');

  const { jwk } = await getActiveSigningKey();
  const { d, ...publicJwk } = jwk;
  const publicKey = await importJWK(publicJwk as JWK, (jwk.alg as string) || DEFAULT_SIGNING_ALG);

  const verified = await jwtVerify(jws, publicKey, {
    algorithms: [(jwk.alg as string) || DEFAULT_SIGNING_ALG],
    issuer: ISSUER_DID,
  });

  if (!verified.payload.vc) {
    throw new Error('Invalid VC: missing vc claim in JWT payload');
  }

  return verified.payload.vc as ClinicianIdentityVC;
}

/**
 * Get the public JWK for verification
 * This can be exposed via a /.well-known/jwks.json endpoint
 */
export async function getPublicJWK(): Promise<JWK> {
  const { jwk } = await getActiveSigningKey();
  const { d, ...publicKey } = jwk;
  return {
    ...publicKey,
    kid: jwk.kid,
  };
}

