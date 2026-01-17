/**
 * S72-D1-A-007: VC Issuance Helper for ClinicianIdentityVC
 *
 * Signs and issues ClinicianIdentityCredential verifiable credentials.
 * Uses a single keypair from environment configuration.
 */

import { createReceipt } from '@vitalcv/audit-receipts';
import { randomBytes } from 'crypto';
import { importJWK, JWK, SignJWT } from 'jose';
import { getActiveSigningKey } from './signingKeyProvider';
import { allocateStatusListEntry, buildCredentialStatus } from './statusList';

// Issuer configuration
const ISSUER_DID = process.env.ISSUER_DID || 'did:web:issuer.vitalcv.com';
const ISSUER_URL = process.env.PUBLIC_ISSUER_URL || process.env.ISSUER_URL || 'https://vitalcv.ai';

const DEFAULT_SIGNING_ALG = process.env.ISSUER_SIGNING_ALG || 'EdDSA';

type SigningKey = Exclude<Awaited<ReturnType<typeof importJWK>>, Uint8Array>;

async function getSigningMaterial(): Promise<{
  kid: string;
  jwk: JWK;
  algorithm: string;
  privateKey: SigningKey;
}> {
  const { kid, jwk } = await getActiveSigningKey();
  const algorithm = (jwk.alg as string) || DEFAULT_SIGNING_ALG;
  const privateKey = await importJWK(jwk, algorithm);
  if (privateKey instanceof Uint8Array) {
    throw new Error(`ISSUER_SIGNING_JWK must be asymmetric for ${algorithm}`);
  }
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
  holderJkt?: string;
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
  credentialStatus?: Record<string, unknown>;
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

  // Allocate status list index BEFORE signing the VC
  let statusAllocation;
  try {
    statusAllocation = await allocateStatusListEntry(credentialId);
  } catch (error) {
    throw new Error(
      `Failed to allocate status list entry: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }

  // Build credential subject DID (use provided or generate placeholder)
  const subjectDid = profile.did || `did:key:z${randomBytes(16).toString('base64url')}`;

  // Build VC payload with credentialStatus
  const now = new Date();
  const vc: ClinicianIdentityVC = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: credentialId,
    type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: ISSUER_DID,
    issuanceDate: now.toISOString(),
    credentialSubject: {
      id: subjectDid,
      name: profile.name.trim(),
      npi: profile.npi,
      specialty: profile.specialty.trim(),
    },
    credentialStatus: buildCredentialStatus(statusAllocation),
  };

  // Sign as JWS (JWT format)
  const { privateKey, kid, algorithm } = await getSigningMaterial();

  const nowSeconds = Math.floor(now.getTime() / 1000);

  const jwsPayload: Record<string, unknown> = { vc };
  if (profile.holderJkt) {
    jwsPayload.cnf = { jkt: profile.holderJkt };
  }

  const jws = await new SignJWT(jwsPayload)
    .setProtectedHeader({
      alg: algorithm,
      typ: 'JWT',
      kid: kid || 'issuer-key-default',
    })
    .setIssuedAt(nowSeconds)
    .setIssuer(ISSUER_DID)
    .setSubject(subjectDid)
    .setJti(credentialId)
    .sign(privateKey);

  // Generate CREDENTIAL_ISSUED audit receipt
  try {
    await createReceipt(
      'CREDENTIAL_ISSUED',
      { type: 'issuer', id: ISSUER_DID },
      {
        credential_id: credentialId,
        holder_did: subjectDid,
        issuer_did: ISSUER_DID,
      },
      'VALID',
      {
        credential_type: 'ClinicianIdentityCredential',
        status_list_index: statusAllocation.index,
        status_list_id: statusAllocation.listId,
      },
      privateKey,
    );
  } catch (error) {
    // Log but don't fail issuance if receipt generation fails
    console.error('[AUDIT] Failed to generate CREDENTIAL_ISSUED receipt:', error);
  }

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
