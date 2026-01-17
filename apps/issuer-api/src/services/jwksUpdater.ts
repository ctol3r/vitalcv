import { getPublicJwksPayload, type PublicJwksPayload } from './signingKeyProvider';

const DEFAULT_JWKS_REFRESH_INTERVAL_MS = 60_000;
const parsedRefreshInterval = Number(
  process.env.ISSUER_JWKS_REFRESH_INTERVAL_MS ||
    process.env.JWKS_REFRESH_INTERVAL_MS ||
    DEFAULT_JWKS_REFRESH_INTERVAL_MS,
);
const JWKS_REFRESH_INTERVAL_MS =
  Number.isFinite(parsedRefreshInterval) && parsedRefreshInterval > 0
    ? parsedRefreshInterval
    : DEFAULT_JWKS_REFRESH_INTERVAL_MS;

let cachedJwks: PublicJwksPayload = {
  version: 'unknown',
  keys: [],
};
let refreshInFlight: Promise<PublicJwksPayload> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;

export function getCachedJwks(): PublicJwksPayload {
  return cachedJwks;
}

export async function refreshJwks(options: { force?: boolean } = {}): Promise<PublicJwksPayload> {
  const { force = false } = options;
  if (!force && cachedJwks.keys.length > 0) {
    return cachedJwks;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = getPublicJwksPayload()
    .then((payload) => {
      cachedJwks = payload;
      return payload;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function startJwksUpdater(): Promise<void> {
  if (refreshTimer) {
    return;
  }

  await refreshJwks({ force: true });

  refreshTimer = setInterval(() => {
    void refreshJwks({ force: true }).catch(() => {});
  }, JWKS_REFRESH_INTERVAL_MS);

  if (typeof refreshTimer.unref === 'function') {
    refreshTimer.unref();
  }
}
