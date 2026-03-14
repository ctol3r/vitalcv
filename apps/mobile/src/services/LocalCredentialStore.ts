import * as SecureStore from 'expo-secure-store';
import { exportJWK, generateKeyPair, type JWK } from 'jose';

import { chunkString, decodeJson, encodeJson, sha256Base64Url } from './internal/encoding';
import { publicJwkToDidKey } from './internal/didKey';

const SECURE_STORE_CHUNK_SIZE = 1900;
const KEY_PAIR_STORAGE_KEY = 'wallet:keypair';
const CREDENTIAL_INDEX_STORAGE_KEY = 'wallet:credential:index';
const NPI_STORAGE_KEY = 'wallet:settings:npi';

export type StoredCredentialStatus = 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';

export interface StoredCredential {
  id: string;
  npi: string;
  type: string;
  issuer: string;
  status: StoredCredentialStatus;
  issuedAt: string;
  expiresAt?: string;
  vcJwt: string;
  claims: Record<string, unknown>;
  issuerDid: string;
  proofAlgorithm: string;
}

export interface LocalKeyPair {
  privateKeyJwk: JWK;
  publicKeyJwk: JWK;
  did: string;
  createdAt: string;
}

export interface ApiCredentialRecord {
  credentialId?: string;
  id?: string;
  npi?: string;
  credentialType?: string;
  type?: string;
  issuer?: string;
  issuerId?: string;
  status?: string;
  issuedAt?: string;
  expiresAt?: string;
  vcJwt?: string;
  signature?: string;
  claims?: Record<string, unknown>;
  proofAlgorithm?: string;
}

interface ChunkMetadata {
  chunkCount: number;
}

type SecureStoreAdapter = Pick<
  typeof SecureStore,
  'deleteItemAsync' | 'getItemAsync' | 'setItemAsync'
>;

function normalizeStatus(status: string | undefined): StoredCredentialStatus {
  switch (status?.toUpperCase()) {
    case 'EXPIRED':
    case 'REVOKED':
    case 'SUSPENDED':
      return status.toUpperCase() as StoredCredentialStatus;
    default:
      return 'VALID';
  }
}

function resolveString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export class LocalCredentialStore {
  constructor(private readonly secureStore: SecureStoreAdapter = SecureStore) {}

  private credentialStorageKey(credentialId: string): string {
    return `wallet:credential:${credentialId}`;
  }

  private chunkMetadataKey(storageKey: string): string {
    return `${storageKey}:meta`;
  }

  private chunkValueKey(storageKey: string, index: number): string {
    return `${storageKey}:chunk:${index}`;
  }

  private async readJson<T>(key: string): Promise<T | null> {
    const value = await this.secureStore.getItemAsync(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  private async writeJson(key: string, value: unknown): Promise<void> {
    await this.secureStore.setItemAsync(key, JSON.stringify(value));
  }

  private async writeChunked<T>(storageKey: string, value: T): Promise<void> {
    const encoded = encodeJson(value);
    const chunks = chunkString(encoded, SECURE_STORE_CHUNK_SIZE);
    const existingMeta = await this.readJson<ChunkMetadata>(this.chunkMetadataKey(storageKey));

    await this.writeJson(this.chunkMetadataKey(storageKey), { chunkCount: chunks.length });

    for (const [index, chunk] of chunks.entries()) {
      await this.secureStore.setItemAsync(this.chunkValueKey(storageKey, index), chunk);
    }

    for (let index = chunks.length; index < (existingMeta?.chunkCount ?? 0); index += 1) {
      await this.secureStore.deleteItemAsync(this.chunkValueKey(storageKey, index));
    }
  }

  private async readChunked<T>(storageKey: string): Promise<T | null> {
    const meta = await this.readJson<ChunkMetadata>(this.chunkMetadataKey(storageKey));

    if (!meta) {
      return null;
    }

    const chunks: string[] = [];

    for (let index = 0; index < meta.chunkCount; index += 1) {
      const chunk = await this.secureStore.getItemAsync(this.chunkValueKey(storageKey, index));
      if (!chunk) {
        return null;
      }
      chunks.push(chunk);
    }

    return decodeJson<T>(chunks.join(''));
  }

  private async deleteChunked(storageKey: string): Promise<void> {
    const meta = await this.readJson<ChunkMetadata>(this.chunkMetadataKey(storageKey));

    if (!meta) {
      return;
    }

    await this.secureStore.deleteItemAsync(this.chunkMetadataKey(storageKey));

    for (let index = 0; index < meta.chunkCount; index += 1) {
      await this.secureStore.deleteItemAsync(this.chunkValueKey(storageKey, index));
    }
  }

  private async readCredentialIndex(): Promise<string[]> {
    return (await this.readJson<string[]>(CREDENTIAL_INDEX_STORAGE_KEY)) ?? [];
  }

  private async writeCredentialIndex(credentialIds: string[]): Promise<void> {
    await this.writeJson(CREDENTIAL_INDEX_STORAGE_KEY, credentialIds);
  }

  private async normalizeApiCredential(apiCredential: ApiCredentialRecord): Promise<StoredCredential> {
    const claims =
      apiCredential.claims && typeof apiCredential.claims === 'object'
        ? apiCredential.claims
        : {};

    const existingId = resolveString(apiCredential.credentialId) ?? resolveString(apiCredential.id);
    const id =
      existingId ??
      `cred_${(await sha256Base64Url(JSON.stringify(apiCredential))).slice(0, 24)}`;

    const existingCredential = await this.getCredential(id);

    return {
      id,
      npi:
        resolveString(apiCredential.npi) ??
        resolveString(claims.npi) ??
        existingCredential?.npi ??
        '',
      type:
        resolveString(apiCredential.credentialType) ??
        resolveString(apiCredential.type) ??
        resolveString(claims.type) ??
        existingCredential?.type ??
        'VerifiableCredential',
      issuer:
        resolveString(apiCredential.issuer) ??
        existingCredential?.issuer ??
        'unknown-issuer',
      status: normalizeStatus(apiCredential.status),
      issuedAt:
        resolveString(apiCredential.issuedAt) ??
        existingCredential?.issuedAt ??
        new Date().toISOString(),
      ...(resolveString(apiCredential.expiresAt)
        ? { expiresAt: apiCredential.expiresAt }
        : existingCredential?.expiresAt
          ? { expiresAt: existingCredential.expiresAt }
          : {}),
      vcJwt:
        resolveString(apiCredential.vcJwt) ??
        resolveString(apiCredential.signature) ??
        existingCredential?.vcJwt ??
        '',
      claims,
      issuerDid:
        resolveString(apiCredential.issuerId) ??
        resolveString(apiCredential.issuer) ??
        existingCredential?.issuerDid ??
        'did:key:unknown',
      proofAlgorithm:
        resolveString(apiCredential.proofAlgorithm) ??
        existingCredential?.proofAlgorithm ??
        'ES256',
    };
  }

  async getOrCreateKeyPair(): Promise<LocalKeyPair> {
    const existingKeyPair = await this.readChunked<LocalKeyPair>(KEY_PAIR_STORAGE_KEY);
    if (existingKeyPair) {
      return existingKeyPair;
    }

    const { privateKey, publicKey } = await generateKeyPair('ES256', {
      extractable: true,
    });

    const privateKeyJwk = await exportJWK(privateKey);
    const publicKeyJwk = await exportJWK(publicKey);
    const did = publicJwkToDidKey(publicKeyJwk);

    const keyPair: LocalKeyPair = {
      privateKeyJwk,
      publicKeyJwk,
      did,
      createdAt: new Date().toISOString(),
    };

    await this.writeChunked(KEY_PAIR_STORAGE_KEY, keyPair);

    return keyPair;
  }

  async getHolderDid(): Promise<string> {
    const keyPair = await this.getOrCreateKeyPair();
    return keyPair.did;
  }

  async storeCredential(credential: StoredCredential): Promise<void> {
    await this.writeChunked(this.credentialStorageKey(credential.id), credential);

    const credentialIds = await this.readCredentialIndex();
    if (!credentialIds.includes(credential.id)) {
      credentialIds.push(credential.id);
      await this.writeCredentialIndex(credentialIds);
    }
  }

  async listCredentials(): Promise<StoredCredential[]> {
    const credentialIds = await this.readCredentialIndex();
    const credentials = await Promise.all(
      credentialIds.map((credentialId) => this.getCredential(credentialId)),
    );

    return credentials.filter((credential): credential is StoredCredential => credential != null);
  }

  async getCredential(credentialId: string): Promise<StoredCredential | null> {
    return this.readChunked<StoredCredential>(this.credentialStorageKey(credentialId));
  }

  async removeCredential(credentialId: string): Promise<void> {
    await this.deleteChunked(this.credentialStorageKey(credentialId));
    const credentialIds = await this.readCredentialIndex();
    await this.writeCredentialIndex(credentialIds.filter((id) => id !== credentialId));
  }

  async getExpiringCredentials(daysThreshold: number): Promise<StoredCredential[]> {
    const credentials = await this.listCredentials();
    const now = Date.now();
    const latestExpiry = now + daysThreshold * 86_400_000;

    return credentials.filter((credential) => {
      if (!credential.expiresAt) {
        return false;
      }

      const expiry = new Date(credential.expiresAt).getTime();
      return Number.isFinite(expiry) && expiry >= now && expiry <= latestExpiry;
    });
  }

  async syncFromApi(apiCredentials: ApiCredentialRecord[]): Promise<StoredCredential[]> {
    for (const apiCredential of apiCredentials) {
      const normalized = await this.normalizeApiCredential(apiCredential);
      await this.storeCredential(normalized);
    }

    return this.listCredentials();
  }

  async setStoredNpi(npi: string): Promise<void> {
    await this.writeJson(NPI_STORAGE_KEY, { npi });
  }

  async getStoredNpi(): Promise<string | null> {
    const stored = await this.readJson<{ npi?: string }>(NPI_STORAGE_KEY);
    return stored?.npi ?? null;
  }

  async clearAll(options: { preserveKeyPair?: boolean } = {}): Promise<void> {
    const credentialIds = await this.readCredentialIndex();

    await Promise.all(
      credentialIds.map((credentialId) =>
        this.deleteChunked(this.credentialStorageKey(credentialId)),
      ),
    );

    await this.writeCredentialIndex([]);
    await this.secureStore.deleteItemAsync(NPI_STORAGE_KEY);

    if (!options.preserveKeyPair) {
      await this.deleteChunked(KEY_PAIR_STORAGE_KEY);
    }
  }
}

export const localCredentialStore = new LocalCredentialStore();
