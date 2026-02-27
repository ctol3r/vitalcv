import crypto from 'node:crypto';
import { SignJWT, generateKeyPair } from 'jose';

const ALG = 'ES256';
const ISSUER_DID = 'did:web:issuer.vitalcv.com';

export interface CredentialPayload {
  clinicianName: string;
  npi: string;
  licenseNumber: string;
  credentialType: string;
  issuerDid: string;
  subjectDid: string;
}

export interface SignedCredential {
  jwt: string;
  issuerDid: string;
  issuedAt: string;
  expiresAt: string;
  auditHash: string;
}

// Lazy key pair — generated once per process, reused for all demo requests
let _keyPair: Awaited<ReturnType<typeof generateKeyPair>> | null = null;

async function getDemoKeyPair() {
  if (!_keyPair) {
    _keyPair = await generateKeyPair(ALG, { extractable: true });
  }
  return _keyPair;
}

export async function signCredential(
  payload: CredentialPayload,
): Promise<SignedCredential> {
  const { privateKey } = await getDemoKeyPair();

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 365 * 24 * 60 * 60; // 1 year

  const jwt = await new SignJWT({
    vct: payload.credentialType,
    holderName: payload.clinicianName,
    npi: payload.npi,
    licenseNumber: payload.licenseNumber,
    status: 'valid',
    trustLevel: 'L3',
    methodologyVersion: '2.1.0',
  })
    .setProtectedHeader({ alg: ALG, typ: 'vc+sd-jwt' })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(payload.issuerDid || ISSUER_DID)
    .setSubject(payload.subjectDid || `did:key:${payload.npi}`)
    .setJti(`vc:vitalcv:${crypto.randomUUID()}`)
    .sign(privateKey);

  const issuedAt = new Date(now * 1000).toISOString();
  const expiresAt = new Date(exp * 1000).toISOString();
  const auditHash = crypto
    .createHash('sha256')
    .update(jwt, 'utf8')
    .digest('hex');

  return {
    jwt,
    issuerDid: payload.issuerDid || ISSUER_DID,
    issuedAt,
    expiresAt,
    auditHash,
  };
}
