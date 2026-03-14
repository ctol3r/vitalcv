import { SignJWT, importJWK, type JWTPayload } from 'jose';

import {
  localCredentialStore,
  type LocalCredentialStore,
  type StoredCredential,
} from './LocalCredentialStore';
import { isoNow, sha256Base64Url } from './internal/encoding';
import { didKeyToVerificationMethod } from './internal/didKey';

export interface OfflinePresentationRequest {
  credentialIds: string[];
  verifierDid?: string;
  nonce?: string;
  disclosedClaims?: string[];
  expiresInSeconds?: number;
}

export interface OfflinePresentation {
  vpJwt: string;
  holderDid: string;
  credentialIds: string[];
  createdAt: string;
  expiresAt: string;
  qrData: string;
}

export interface SelectiveDisclosureCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  claims: Record<string, unknown>;
  credentialSubject: Record<string, unknown>;
  proof: {
    type: string;
    alg: string;
    jwt: string;
  };
}

function normalizeDisclosedClaims(disclosedClaims: string[]): Set<string> {
  return new Set(disclosedClaims.filter((claim) => claim.length > 0));
}

function isPathDisclosed(path: string, disclosedClaims: Set<string>): boolean {
  return disclosedClaims.has(path);
}

function hasDisclosedDescendant(path: string, disclosedClaims: Set<string>): boolean {
  return Array.from(disclosedClaims).some((claim) => claim.startsWith(`${path}.`));
}

async function applySelectiveDisclosure(
  value: unknown,
  path: string,
  disclosedClaims: Set<string>,
): Promise<unknown> {
  if (path && !isPathDisclosed(path, disclosedClaims) && !hasDisclosedDescendant(path, disclosedClaims)) {
    return `sha256:${await sha256Base64Url(JSON.stringify(value))}`;
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, index) =>
        applySelectiveDisclosure(item, path ? `${path}.${index}` : String(index), disclosedClaims),
      ),
    );
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, nestedValue]) => {
        const nestedPath = path ? `${path}.${key}` : key;
        return [key, await applySelectiveDisclosure(nestedValue, nestedPath, disclosedClaims)] as const;
      }),
    );

    return Object.fromEntries(entries);
  }

  return value;
}

function buildPresentationPayload(
  holderDid: string,
  credentials: SelectiveDisclosureCredential[],
  request: OfflinePresentationRequest,
  createdAtSeconds: number,
  expiresAtSeconds: number,
): JWTPayload {
  const presentationId = `urn:uuid:${crypto.randomUUID()}`;

  return {
    iss: holderDid,
    sub: holderDid,
    ...(request.verifierDid ? { aud: request.verifierDid } : {}),
    ...(request.nonce ? { nonce: request.nonce } : {}),
    iat: createdAtSeconds,
    nbf: createdAtSeconds,
    exp: expiresAtSeconds,
    jti: presentationId,
    vp: {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      id: presentationId,
      holder: holderDid,
      verifiableCredential: credentials,
    },
  };
}

export class OfflinePresentationEngine {
  constructor(
    private readonly credentialStore: LocalCredentialStore = localCredentialStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async loadCredentials(credentialIds: string[]): Promise<StoredCredential[]> {
    const credentials = await Promise.all(
      credentialIds.map((credentialId) => this.credentialStore.getCredential(credentialId)),
    );

    const resolvedCredentials = credentials.filter(
      (credential): credential is StoredCredential => credential != null,
    );

    if (resolvedCredentials.length !== credentialIds.length) {
      throw new Error('One or more credentials were not found in local storage');
    }

    return resolvedCredentials;
  }

  private async toPresentationCredential(
    credential: StoredCredential,
    holderDid: string,
    disclosedClaims?: string[],
  ): Promise<SelectiveDisclosureCredential> {
    const claims =
      disclosedClaims && disclosedClaims.length > 0
        ? ((await applySelectiveDisclosure(
            credential.claims,
            '',
            normalizeDisclosedClaims(disclosedClaims),
          )) as Record<string, unknown>)
        : credential.claims;

    return {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: credential.id,
      type: ['VerifiableCredential', credential.type],
      issuer: credential.issuerDid,
      issuanceDate: credential.issuedAt,
      ...(credential.expiresAt ? { expirationDate: credential.expiresAt } : {}),
      claims,
      credentialSubject: {
        id: holderDid,
        npi: credential.npi,
        ...claims,
      },
      proof: {
        type: 'JsonWebSignature2020',
        alg: credential.proofAlgorithm,
        jwt: credential.vcJwt,
      },
    };
  }

  async createSelectiveDisclosure(
    credentialId: string,
    disclosedClaims: string[],
  ): Promise<SelectiveDisclosureCredential> {
    const credential = await this.credentialStore.getCredential(credentialId);
    if (!credential) {
      throw new Error(`Credential ${credentialId} was not found`);
    }

    const holderDid = await this.credentialStore.getHolderDid();
    return this.toPresentationCredential(credential, holderDid, disclosedClaims);
  }

  async createPresentation(request: OfflinePresentationRequest): Promise<OfflinePresentation> {
    const keyPair = await this.credentialStore.getOrCreateKeyPair();
    const privateKey = await importJWK(keyPair.privateKeyJwk, 'ES256');
    const holderDid = keyPair.did;
    const credentials = await this.loadCredentials(request.credentialIds);
    const presentationCredentials = await Promise.all(
      credentials.map((credential) =>
        this.toPresentationCredential(credential, holderDid, request.disclosedClaims),
      ),
    );

    const createdAtDate = this.clock();
    const createdAtSeconds = Math.floor(createdAtDate.getTime() / 1000);
    const expiresInSeconds = request.expiresInSeconds ?? 300;
    const expiresAtDate = new Date(createdAtDate.getTime() + expiresInSeconds * 1000);
    const expiresAtSeconds = Math.floor(expiresAtDate.getTime() / 1000);
    const payload = buildPresentationPayload(
      holderDid,
      presentationCredentials,
      request,
      createdAtSeconds,
      expiresAtSeconds,
    );
    const verificationMethod = didKeyToVerificationMethod(holderDid);

    const vpJwt = await new SignJWT(payload)
      .setProtectedHeader({
        alg: 'ES256',
        typ: 'JWT',
        kid: verificationMethod,
      })
      .setIssuer(holderDid)
      .setSubject(holderDid)
      .setIssuedAt(createdAtSeconds)
      .setNotBefore(createdAtSeconds)
      .setExpirationTime(expiresAtSeconds)
      .setJti(payload.jti ?? `urn:uuid:${crypto.randomUUID()}`)
      .sign(privateKey);

    const createdAt = isoNow();
    const expiresAt = expiresAtDate.toISOString();

    return {
      vpJwt,
      holderDid,
      credentialIds: request.credentialIds,
      createdAt,
      expiresAt,
      qrData: JSON.stringify({
        vp_token: vpJwt,
        holder: holderDid,
        expiresAt,
        credentialIds: request.credentialIds,
      }),
    };
  }
}

export const offlinePresentationEngine = new OfflinePresentationEngine();
