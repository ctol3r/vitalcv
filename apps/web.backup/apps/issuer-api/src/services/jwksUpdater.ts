import { promises as fs } from 'fs';
import path from 'path';
import {
  getPublicJwksPayload,
  PublicJwkWithStatus,
  refreshSigningKeyCache,
} from '../../../../services/identity/signingKeyProvider';

const JWKS_OUTPUT_DIR =
  process.env.JWKS_OUTPUT_DIR || path.join(process.cwd(), 'apps/issuer-api/public/.well-known');
const JWKS_OUTPUT_FILE = path.join(JWKS_OUTPUT_DIR, 'jwks.json');
const JWKS_REFRESH_INTERVAL_MS = Number(process.env.JWKS_REFRESH_INTERVAL_MS || 60_000);

type SerializableJwk = PublicJwkWithStatus;

interface CachedJwks {
  jwks: { keys: SerializableJwk[] };
  version: string;
  lastSynced: number;
}

let cache: CachedJwks | null = null;
let timer: NodeJS.Timeout | null = null;

function serializeKeys(keys: PublicJwkWithStatus[]): SerializableJwk[] {
  return keys.map(key => ({
    ...key,
    kid: key.kid,
    use: key.use || 'sig',
  }));
}

async function writeJwksToDisk(jwks: { keys: SerializableJwk[] }) {
  await fs.mkdir(JWKS_OUTPUT_DIR, { recursive: true });
  await fs.writeFile(JWKS_OUTPUT_FILE, JSON.stringify(jwks, null, 2), 'utf-8');
}

export function getCachedJwks() {
  return cache?.jwks ?? { keys: [] };
}

export async function refreshJwks(options?: { force?: boolean; skipDisk?: boolean }) {
  if (options?.force) {
    cache = null;
  }

  const payload = await getPublicJwksPayload();

  if (!payload.keys.length) {
    throw new Error('JWKS payload is empty.');
  }

  if (cache && !options?.force && cache.version === payload.version) {
    cache.lastSynced = Date.now();
    return cache.jwks;
  }

  const jwks = { keys: serializeKeys(payload.keys) };
  cache = {
    jwks,
    version: payload.version,
    lastSynced: Date.now(),
  };

  if (!options?.skipDisk) {
    await writeJwksToDisk(jwks);
  }

  return jwks;
}

export async function startJwksUpdater() {
  try {
    await refreshSigningKeyCache();
    await refreshJwks({ force: true });
  } catch (error) {
    console.error('[JWKS] Initial sync failed:', error);
  }

  if (timer) {
    timer.unref?.();
    clearInterval(timer);
  }

  timer = setInterval(() => {
    refreshJwks().catch(error => {
      console.error('[JWKS] Periodic refresh failed:', error);
    });
  }, JWKS_REFRESH_INTERVAL_MS);

  timer.unref?.();
}

