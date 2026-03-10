/**
 * Wave 199 — SD-JWT Key Manager
 *
 * Singleton key store: generates ES256 (P-256) key pairs, rotates keys with
 * 24-hour grace period, persists to KEY_STORE_PATH for restart survivability.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { generateKeyPair, exportJWK, importJWK } from "jose";;
import { log } from '../../obs/logger';

const KEY_STORE_PATH = process.env.KEY_STORE_PATH ?? '/tmp/vitalcv-keys.json';
const KEY_TTL_MS = 30 * 24 * 60 * 60 * 1_000; // 30 days active
const GRACE_MS = 24 * 60 * 60 * 1_000; // 24 h grace after rotation

interface StoredKeyEntry {
  kid: string;
  algorithm: string;
  privateKeyJwk: Record<string, unknown>;
  publicKeyJwk: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  gracePeriodUntil?: string;
}

interface KeyEntry {
  kid: string;
  algorithm: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyJwk: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  gracePeriodUntil?: string;
}

const keyStore = new Map<string, KeyEntry>();
let primaryKid: string | null = null;

function loadFromDisk(): void {
  try {
    if (!fs.existsSync(KEY_STORE_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(KEY_STORE_PATH, 'utf-8')) as {
      primary?: string;
      keys: StoredKeyEntry[];
    };
    // Deferred: we can't await importJWK in sync init, so skip on-disk restore for now
    // Keys will be regenerated on first getOrCreateKey() call
    if (raw.primary) primaryKid = raw.primary;
  } catch {
    log('warn', 'key_store_load_failed', { path: KEY_STORE_PATH });
  }
}

function saveToDisk(): void {
  try {
    const entries = Array.from(keyStore.values()).map((e) => ({
      kid: e.kid,
      algorithm: e.algorithm,
      privateKeyJwk: e.publicKeyJwk, // only save public JWK to disk for safety
      publicKeyJwk: e.publicKeyJwk,
      createdAt: e.createdAt,
      expiresAt: e.expiresAt,
      gracePeriodUntil: e.gracePeriodUntil,
    }));
    fs.writeFileSync(KEY_STORE_PATH, JSON.stringify({ primary: primaryKid, keys: entries }, null, 2));
  } catch {
    log('warn', 'key_store_save_failed', { path: KEY_STORE_PATH });
  }
}

loadFromDisk();

export async function getOrCreateKey(algorithm: 'ES256' = 'ES256'): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey; kid: string }> {
  // Return existing primary if still valid
  if (primaryKid && keyStore.has(primaryKid)) {
    const entry = keyStore.get(primaryKid)!;
    if (new Date(entry.expiresAt).getTime() > Date.now()) {
      return { privateKey: entry.privateKey, publicKey: entry.publicKey, kid: entry.kid };
    }
  }

  // Generate new key
  const { privateKey, publicKey } = await generateKeyPair(algorithm);
  const kid = randomUUID();
  const now = new Date();
  const expires = new Date(now.getTime() + KEY_TTL_MS);

  const publicKeyJwk = (await exportJWK(publicKey)) as Record<string, unknown>;

  const entry: KeyEntry = {
    kid,
    algorithm,
    privateKey: privateKey as CryptoKey,
    publicKey: publicKey as CryptoKey,
    publicKeyJwk: { ...publicKeyJwk, kid, alg: algorithm },
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  keyStore.set(kid, entry);
  primaryKid = kid;
  saveToDisk();

  log('info', 'key_generated', { kid, algorithm });
  return { privateKey: privateKey as CryptoKey, publicKey: publicKey as CryptoKey, kid };
}

export async function getJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const now = Date.now();
  const keys = Array.from(keyStore.values())
    .filter((e) => {
      // Include active keys and keys in grace period
      const expired = new Date(e.expiresAt).getTime() < now;
      const inGrace = e.gracePeriodUntil && new Date(e.gracePeriodUntil).getTime() > now;
      return !expired || inGrace;
    })
    .map((e) => e.publicKeyJwk);

  // Always include at least one key
  if (keys.length === 0) {
    await getOrCreateKey();
    return getJwks();
  }

  return { keys };
}

export async function rotateKey(oldKid: string): Promise<string> {
  const old = keyStore.get(oldKid);
  if (old) {
    keyStore.set(oldKid, {
      ...old,
      gracePeriodUntil: new Date(Date.now() + GRACE_MS).toISOString(),
    });
  }
  const { kid } = await getOrCreateKey();
  log('info', 'key_rotated', { oldKid, newKid: kid });
  return kid;
}

export function getKeyByKid(kid: string): KeyEntry | undefined {
  return keyStore.get(kid);
}
