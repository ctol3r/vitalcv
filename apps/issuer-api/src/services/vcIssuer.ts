import { createHash } from 'node:crypto';
import {
  importJWK,
  jwtVerify,
  SignJWT,
  decodeJwt,
  decodeProtectedHeader,
} from 'jose';
import { getControlledIssuerDID } from '../utils/didGenerator';
import { haipConfig } from '@vitalcv/haip-config';
import { getSigningKeyMaterial, getPublicSigningJwk, parseSigningKeyFingerprint } from './signingKeyProvider';
import type { VitalVC } from '../types/verifierWallet';

type IssuerDidDocument = {
  '@context': 'https://www.w3.org/ns/did/v1';
  id: string;
  verificationMethod: Array<{
    id: string;
    type: 'JsonWebKey2020';
    controller: string;
    publicKeyJwk: {
      crv: 'P-256';
      kty: 'EC';
      x: string;
      y: string;
      alg: 'ES256';
      use: 'sig';
      kid?: string;
    };
  }>;
  assertionMethod: string[];
};

type CredentialProfile = {
  subjectDid: string;
  name: string;
  npi: string;
  specialty: string;
  organizationId?: string;
};

type CredentialStatus = {
  id: string;
  type: 'VitalCredentialStatus';
};

type IssueOptions = {
  credentialStatus?: CredentialStatus;
};

type CredentialPayload = {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: Record<string, unknown>;
  credentialStatus?: CredentialStatus;
};

const VERIFICATION_METHOD_ID = `${getControlledIssuerDID()}#key-1`;
const credentialSequenceBySubject = new Map<string, number>();

function normalizeNpi(input: string, field: string): string {
  const normalized = input.trim();
  if (!/^[0-9]{10}$/.test(normalized)) {
    throw new Error(`${field} must be a 10-digit NPI.`);
  }
  return normalized;
}

function normalizeName(input: string, field: string): string {
  const normalized = input.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function nextSequence(subjectDid: string, npi: string): number {
  const key = `${subjectDid}:${npi}`;
  const next = (credentialSequenceBySubject.get(key) ?? 0) + 1;
  credentialSequenceBySubject.set(key, next);
  return next;
}

function buildCredentialId(subjectDid: string, npi: string): string {
  const sequence = nextSequence(subjectDid, npi);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const seed = `${subjectDid}|${npi}|${sequence}|${nowSeconds}`;
  const credentialDigest = createHash('sha256').update(seed).digest('hex');
  return `${getControlledIssuerDID()}/credentials/clinician/${credentialDigest.slice(0, 32)}`;
}

function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

function parseJwsPayloadObject(token: string): CredentialPayload {
  const payload = decodeJwt(token) as Record<string, unknown>;
  const vc = payload.vc;
  if (!isObject(vc)) {
    throw new Error('VC payload missing vc claim.');
  }

  const required = ['id', 'type', 'issuer', 'issuanceDate', 'credentialSubject', '@context'];
  for (const key of required) {
    if (vc[key] === undefined) {
      throw new Error(`VC missing required claim: ${key}`);
    }
  }

  const contextValue = vc['@context'];
  if (!Array.isArray(contextValue) || contextValue.length === 0) {
    throw new Error('VC @context must be a non-empty array.');
  }

  const vcType = vc.type;
  if (!Array.isArray(vcType) || vcType.length === 0) {
    throw new Error('VC type must be a non-empty array.');
  }

  const credentialStatusInput = vc.credentialStatus;
  const credentialStatus =
    credentialStatusInput === undefined ? undefined : parseCredentialStatus(credentialStatusInput);

  return {
    '@context': contextValue.map((value) => {
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error('VC @context entries must be strings.');
      }
      return value;
    }),
    id: normalizeName(vc.id, 'vc.id'),
    type: vcType.map((value) => {
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error('VC type entries must be strings.');
      }
      return value;
    }),
    issuer: normalizeName(vc.issuer, 'vc.issuer'),
    issuanceDate: normalizeName(vc.issuanceDate, 'vc.issuanceDate'),
    credentialSubject: vc.credentialSubject,
    ...(credentialStatus ? { credentialStatus } : {}),
  };
}

function parseCredentialStatus(input: unknown): CredentialStatus {
  if (!isObject(input)) {
    throw new Error('vc.credentialStatus must be an object.');
  }

  const id = normalizeName(input.id, 'vc.credentialStatus.id');
  const type = normalizeName(input.type, 'vc.credentialStatus.type');

  if (type !== 'VitalCredentialStatus') {
    throw new Error('vc.credentialStatus.type must be "VitalCredentialStatus".');
  }

  return { id, type };
}

function arePublicKeysEquivalent(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const normalizedLeft = {
    kty: left.kty,
    crv: left.crv,
    x: left.x,
    y: left.y,
    alg: left.alg,
    use: left.use,
  };
  const normalizedRight = {
    kty: right.kty,
    crv: right.crv,
    x: right.x,
    y: right.y,
    alg: right.alg,
    use: right.use,
  };
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

export function getControlledDidDocument(): IssuerDidDocument {
  const publicKeyJwk = getPublicSigningJwk();
  const did = getControlledIssuerDID();
  return {
    '@context': 'https://www.w3.org/ns/did/v1',
    id: did,
    verificationMethod: [
      {
        id: `${did}#key-1`,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk: {
          crv: publicKeyJwk.crv,
          kty: publicKeyJwk.kty,
          x: publicKeyJwk.x,
          y: publicKeyJwk.y,
          alg: publicKeyJwk.alg,
          use: publicKeyJwk.use,
          kid: publicKeyJwk.kid,
        },
      },
    ],
    assertionMethod: [`${did}#key-1`],
  };
}

export async function resolveIssuerDID(did: string): Promise<IssuerDidDocument> {
  const controlled = getControlledIssuerDID();
  if (did !== controlled) {
    throw new Error(`Unable to resolve issuer DID ${did}.`);
  }
  return getControlledDidDocument();
}

export function verifyControlledIssuerDidDocument(document: IssuerDidDocument): void {
  const expectedDid = getControlledIssuerDID();
  if (document.id !== expectedDid) {
    throw new Error(`Invalid issuer DID ${document.id}; expected ${expectedDid}.`);
  }

  const verificationMethod = document.verificationMethod[0];
  if (!verificationMethod) {
    throw new Error('Issuer DID document missing verificationMethod.');
  }

  if (verificationMethod.id !== `${expectedDid}#key-1`) {
    throw new Error(`Invalid issuer verification method ${verificationMethod.id}.`);
  }

  if (verificationMethod.type !== 'JsonWebKey2020') {
    throw new Error(`Invalid verification method type ${verificationMethod.type}.`);
  }

  if (verificationMethod.controller !== expectedDid) {
    throw new Error(`Invalid verification method controller ${verificationMethod.controller}.`);
  }

  if (!document.assertionMethod.includes(`${expectedDid}#key-1`)) {
    throw new Error('Issuer DID document missing required assertionMethod entry.');
  }

  const publicKey = verificationMethod.publicKeyJwk;
  if (publicKey.kty !== 'EC' || publicKey.crv !== 'P-256') {
    throw new Error('Issuer DID public key must be EC P-256.');
  }

  if (publicKey.alg !== 'ES256' || publicKey.use !== 'sig') {
    throw new Error('Issuer DID public key must use ES256/sig.');
  }
}

export function getIssuerDidDocument(): IssuerDidDocument {
  return getControlledDidDocument();
}

export async function issueClinicianIdentityVC(
  profile: CredentialProfile,
  options: IssueOptions = {},
): Promise<string> {
  const did = getControlledIssuerDID();
  const normalizedName = normalizeName(profile.name, 'name');
  const normalizedNpi = normalizeNpi(profile.npi, 'npi');
  const normalizedSpecialty = normalizeName(profile.specialty, 'specialty');
  const normalizedSubjectDid = normalizeName(profile.subjectDid, 'subjectDid');

  const credentialId = buildCredentialId(normalizedSubjectDid, normalizedNpi);
  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);

  const vcPayload: CredentialPayload = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: credentialId,
    type: ['VerifiableCredential', 'ClinicianIdentityCredential'],
    issuer: did,
    issuanceDate: now.toISOString(),
    credentialSubject: {
      id: normalizedSubjectDid,
      name: normalizedName,
      npi: normalizedNpi,
      specialty: normalizedSpecialty,
      ...(profile.organizationId ? { organizationId: profile.organizationId } : {}),
    },
    ...(options.credentialStatus ? { credentialStatus: options.credentialStatus } : {}),
  };

  const { kid, privateJwk } = getSigningKeyMaterial();
  const privateKey = await importJWK(privateJwk, privateJwk.alg);

  return await new SignJWT({ vc: vcPayload, aud: haipConfig.tokenAudience })
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: kid || VERIFICATION_METHOD_ID,
    })
    .setIssuedAt(nowSeconds)
    .setIssuer(did)
    .setSubject(normalizedSubjectDid)
    .setAudience(haipConfig.tokenAudience)
    .setJti(credentialId)
    .sign(privateKey);
}

export async function validateVitalVC(vcJws: string): Promise<VitalVC> {
  if (typeof vcJws !== 'string' || vcJws.trim().length === 0) {
    throw new Error('VC is required.');
  }

  const header = decodeProtectedHeader(vcJws);
  if (header.alg !== 'ES256') {
    throw new Error('Invalid VC signing algorithm. ES256 required.');
  }

  const expectedKid = `${getControlledIssuerDID()}#key-1`;
  if (header.kid && header.kid !== expectedKid) {
    throw new Error(`VC signing key id must be ${expectedKid}.`);
  }

  const didDocument = await resolveIssuerDID(getControlledIssuerDID());
  verifyControlledIssuerDidDocument(didDocument);

  const didPublicJwk = didDocument.verificationMethod[0]?.publicKeyJwk;
  if (!didPublicJwk) {
    throw new Error('Unable to resolve issuer DID public key.');
  }

  if (!arePublicKeysEquivalent(didPublicJwk, getPublicSigningJwk())) {
    throw new Error('VC public key does not match DID key.');
  }

  const publicKey = await importJWK(didPublicJwk, 'ES256');
  await jwtVerify(vcJws, publicKey, {
    algorithms: ['ES256'],
    issuer: getControlledIssuerDID(),
    audience: haipConfig.tokenAudience,
  });

  const vcObject = parseJwsPayloadObject(vcJws);
  const credential: VitalVC = {
    '@context': vcObject['@context'],
    id: vcObject.id,
    type: vcObject.type,
    issuer: vcObject.issuer,
    issuanceDate: vcObject.issuanceDate,
    credentialSubject: vcObject.credentialSubject as Record<string, string | number | boolean | null>,
    ...(vcObject.credentialStatus ? { credentialStatus: vcObject.credentialStatus } : {}),
  };

  if (credential.issuer !== getControlledIssuerDID()) {
    throw new Error('VC issuer mismatch.');
  }

  if (!credential.type.includes('ClinicianIdentityCredential')) {
    throw new Error('VC type mismatch.');
  }

  if (
    parseSigningKeyFingerprint(didPublicJwk as Record<string, string>) !==
    parseSigningKeyFingerprint(getPublicSigningJwk())
  ) {
    throw new Error('VC public key fingerprint mismatch.');
  }

  return credential;
}
