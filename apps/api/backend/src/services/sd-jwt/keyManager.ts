/**
 * Wave 199 — SD-JWT Key Manager
 *
 * Persists ES256 issuer signing keys in Prisma, encrypts private JWK material
 * with AES-256-GCM, and publishes active plus grace-period public lineage.
 */

import { randomUUID } from 'node:crypto';
import type { IssuerSigningKeyState, Prisma } from '@prisma/client';
import { exportJWK, generateKeyPair, importJWK } from 'jose';
import prisma from '../../graphql/prisma_client';
import { deriveKeyFromPassphrase, decryptPhi, encryptPhi } from '../compliance/hipaaGuard';
import { log } from '../../obs/logger';

const DEFAULT_ISSUER_DID = process.env.ISSUER_DID ?? 'did:web:vitalcv.com';
const KEY_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const GRACE_MS = 24 * 60 * 60 * 1_000;

type SigningAlgorithm = 'ES256';

type IssuerSigningKeyRow = Awaited<ReturnType<typeof prisma.issuerSigningKey.findUnique>>;

export interface KeyEntry {
  kid: string;
  issuerDid: string;
  algorithm: SigningAlgorithm;
  state: IssuerSigningKeyState;
  publicKey: CryptoKey;
  publicKeyJwk: Record<string, unknown>;
  privateKey?: CryptoKey;
  createdAt: string;
  activatesAt: string;
  expiresAt: string;
  gracePeriodUntil?: string;
  retiredAt?: string;
  rotatedFromKid?: string;
  lastUsedAt?: string;
}

function coerceJsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as unknown as Record<string, unknown>;
  }

  throw new Error('Issuer signing key JWK payload is malformed');
}

function getIssuerKeyEncryptionKey(): Buffer {
  const secret = process.env.ISSUER_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error('ISSUER_KEY_ENCRYPTION_SECRET is required for SD-JWT signing keys');
  }

  return deriveKeyFromPassphrase(secret);
}

function toPublicJwk(
  publicKeyJwk: Record<string, unknown>,
  kid: string,
  algorithm: SigningAlgorithm,
): Record<string, unknown> {
  return {
    ...publicKeyJwk,
    kid,
    alg: algorithm,
    use: 'sig',
  };
}

async function decryptPrivateKeyJwk(
  encryptedPrivateKeyJwk: string,
  algorithm: SigningAlgorithm,
): Promise<CryptoKey> {
  const decoded = decryptPhi(encryptedPrivateKeyJwk, getIssuerKeyEncryptionKey());
  const privateKeyJwk = JSON.parse(decoded) as Parameters<typeof importJWK>[0];
  return importJWK(privateKeyJwk, algorithm) as Promise<CryptoKey>;
}

async function toKeyEntry(
  row: NonNullable<IssuerSigningKeyRow>,
  includePrivateKey: boolean,
): Promise<KeyEntry> {
  const algorithm = row.algorithm as SigningAlgorithm;
  const publicKeyJwk = coerceJsonObject(row.publicKeyJwk);
  const publicKey = await importJWK(publicKeyJwk as unknown as Parameters<typeof importJWK>[0], algorithm) as CryptoKey;
  const privateKey = includePrivateKey
    ? await decryptPrivateKeyJwk(row.encryptedPrivateKeyJwk, algorithm)
    : undefined;

  return {
    kid: row.kid,
    issuerDid: row.issuerDid,
    algorithm,
    state: row.state,
    publicKey,
    publicKeyJwk,
    privateKey,
    createdAt: row.createdAt.toISOString(),
    activatesAt: row.activatesAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ...(row.graceUntil ? { gracePeriodUntil: row.graceUntil.toISOString() } : {}),
    ...(row.retiredAt ? { retiredAt: row.retiredAt.toISOString() } : {}),
    ...(row.rotatedFromKid ? { rotatedFromKid: row.rotatedFromKid } : {}),
    ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt.toISOString() } : {}),
  };
}

async function touchKeyUsage(kid: string): Promise<void> {
  await prisma.issuerSigningKey.update({
    where: { kid },
    data: { lastUsedAt: new Date() },
  });
}

async function retireExpiredGraceKeys(now: Date): Promise<void> {
  await prisma.issuerSigningKey.updateMany({
    where: {
      state: 'GRACE',
      graceUntil: { lt: now },
      retiredAt: null,
    },
    data: {
      state: 'RETIRED',
      retiredAt: now,
    },
  });
}

async function createPersistedKey(
  issuerDid: string,
  algorithm: SigningAlgorithm,
  rotatedFromKid?: string,
): Promise<KeyEntry> {
  const { privateKey, publicKey } = await generateKeyPair(algorithm, { extractable: true });
  const kid = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + KEY_TTL_MS);
  const publicKeyJwk = await exportJWK(publicKey) as unknown as Record<string, unknown>;
  const privateKeyJwk = await exportJWK(privateKey);

  const row = await prisma.issuerSigningKey.create({
    data: {
      issuerDid,
      kid,
      algorithm,
      publicKeyJwk: toPublicJwk(publicKeyJwk, kid, algorithm) as Prisma.InputJsonObject,
      encryptedPrivateKeyJwk: encryptPhi(
        JSON.stringify(privateKeyJwk),
        getIssuerKeyEncryptionKey(),
      ),
      state: 'ACTIVE',
      createdAt: now,
      activatesAt: now,
      expiresAt,
      rotatedFromKid: rotatedFromKid ?? null,
    },
  });

  log('info', 'sd_jwt_signing_key_created', { issuerDid, kid, algorithm });
  return toKeyEntry(row, true);
}

function validatePinnedKey(
  entry: KeyEntry,
  issuerDid: string,
  algorithm: SigningAlgorithm,
  now: Date,
): void {
  if (entry.issuerDid !== issuerDid) {
    throw new Error(`Pinned kid '${entry.kid}' does not belong to issuer '${issuerDid}'`);
  }

  if (entry.algorithm !== algorithm) {
    throw new Error(`Pinned kid '${entry.kid}' does not match algorithm '${algorithm}'`);
  }

  if (entry.state === 'RETIRED') {
    throw new Error(`Pinned kid '${entry.kid}' is retired`);
  }

  if (entry.gracePeriodUntil && new Date(entry.gracePeriodUntil).getTime() <= now.getTime()) {
    throw new Error(`Pinned kid '${entry.kid}' is outside its grace period`);
  }

  if (new Date(entry.expiresAt).getTime() <= now.getTime() && entry.state !== 'GRACE') {
    throw new Error(`Pinned kid '${entry.kid}' is expired`);
  }
}

async function findCurrentActiveKey(
  issuerDid: string,
  algorithm: SigningAlgorithm,
  now: Date,
): Promise<KeyEntry | null> {
  const row = await prisma.issuerSigningKey.findFirst({
    where: {
      issuerDid,
      algorithm,
      state: 'ACTIVE',
      retiredAt: null,
      expiresAt: { gt: now },
    },
    orderBy: [
      { activatesAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return row ? toKeyEntry(row, true) : null;
}

async function findExpiredActiveKey(
  issuerDid: string,
  algorithm: SigningAlgorithm,
  now: Date,
): Promise<KeyEntry | null> {
  const row = await prisma.issuerSigningKey.findFirst({
    where: {
      issuerDid,
      algorithm,
      state: 'ACTIVE',
      retiredAt: null,
      expiresAt: { lte: now },
    },
    orderBy: { expiresAt: 'desc' },
  });

  return row ? toKeyEntry(row, true) : null;
}

export async function getOrCreateKey(
  algorithm: SigningAlgorithm = 'ES256',
  opts?: { issuerDid?: string; kid?: string },
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; kid: string }> {
  const issuerDid = opts?.issuerDid ?? DEFAULT_ISSUER_DID;
  const now = new Date();

  await retireExpiredGraceKeys(now);

  if (opts?.kid) {
    const pinnedKey = await getKeyByKid(opts.kid, { includePrivateKey: true });
    if (!pinnedKey || !pinnedKey.privateKey) {
      throw new Error(`Pinned kid '${opts.kid}' is unavailable`);
    }

    validatePinnedKey(pinnedKey, issuerDid, algorithm, now);
    await touchKeyUsage(pinnedKey.kid);
    return {
      privateKey: pinnedKey.privateKey,
      publicKey: pinnedKey.publicKey,
      kid: pinnedKey.kid,
    };
  }

  const activeKey = await findCurrentActiveKey(issuerDid, algorithm, now);
  if (activeKey?.privateKey) {
    await touchKeyUsage(activeKey.kid);
    return {
      privateKey: activeKey.privateKey,
      publicKey: activeKey.publicKey,
      kid: activeKey.kid,
    };
  }

  const expiredKey = await findExpiredActiveKey(issuerDid, algorithm, now);
  if (expiredKey) {
    const rotatedKid = await rotateKey(expiredKey.kid, issuerDid);
    return getOrCreateKey(algorithm, { issuerDid, kid: rotatedKid });
  }

  const createdKey = await createPersistedKey(issuerDid, algorithm);
  await touchKeyUsage(createdKey.kid);
  return {
    privateKey: createdKey.privateKey!,
    publicKey: createdKey.publicKey,
    kid: createdKey.kid,
  };
}

export async function getJwks(
  opts?: { issuerDid?: string },
): Promise<{ keys: Record<string, unknown>[] }> {
  const issuerDid = opts?.issuerDid ?? DEFAULT_ISSUER_DID;
  const now = new Date();

  await retireExpiredGraceKeys(now);

  let rows = await prisma.issuerSigningKey.findMany({
    where: {
      issuerDid,
      retiredAt: null,
      OR: [
        {
          state: 'ACTIVE',
          expiresAt: { gt: now },
        },
        {
          state: 'GRACE',
          graceUntil: { gt: now },
        },
      ],
    },
    orderBy: [
      { state: 'asc' },
      { activatesAt: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  if (rows.length === 0) {
    await createPersistedKey(issuerDid, 'ES256');
    rows = await prisma.issuerSigningKey.findMany({
      where: {
        issuerDid,
        retiredAt: null,
        state: 'ACTIVE',
      },
      orderBy: { activatesAt: 'desc' },
    });
  }

  return {
    keys: rows.map((row) => coerceJsonObject(row.publicKeyJwk)),
  };
}

export async function rotateKey(
  oldKid: string,
  issuerDid = DEFAULT_ISSUER_DID,
): Promise<string> {
  const row = await prisma.issuerSigningKey.findUnique({
    where: { kid: oldKid },
  });

  if (!row) {
    throw new Error(`Signing key '${oldKid}' not found`);
  }

  if (row.issuerDid !== issuerDid) {
    throw new Error(`Signing key '${oldKid}' is not owned by issuer '${issuerDid}'`);
  }

  const now = new Date();
  await retireExpiredGraceKeys(now);

  if (row.state !== 'RETIRED') {
    await prisma.issuerSigningKey.update({
      where: { kid: oldKid },
      data: {
        state: 'GRACE',
        graceUntil: new Date(now.getTime() + GRACE_MS),
      },
    });
  }

  const createdKey = await createPersistedKey(issuerDid, row.algorithm as SigningAlgorithm, oldKid);
  log('info', 'sd_jwt_signing_key_rotated', {
    issuerDid,
    oldKid,
    newKid: createdKey.kid,
  });
  return createdKey.kid;
}

export async function getKeyByKid(
  kid: string,
  opts?: { includePrivateKey?: boolean },
): Promise<KeyEntry | null> {
  const row = await prisma.issuerSigningKey.findUnique({
    where: { kid },
  });

  if (!row) {
    return null;
  }

  return toKeyEntry(row, opts?.includePrivateKey ?? false);
}
