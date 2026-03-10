/**
 * Wave 197 — Issuer Metadata Resolver
 *
 * Fetches OID4VC / OpenID Connect issuer metadata with stale-while-revalidate caching.
 */

interface IssuerMetadata {
  issuer: string;
  jwks_uri?: string;
  credential_endpoint?: string;
  revocation_endpoint?: string;
  supported_formats?: string[];
  token_endpoint?: string;
  authorization_endpoint?: string;
}

interface CacheEntry {
  metadata: IssuerMetadata;
  fetchedAt: number;
  refreshing: boolean;
}

const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes
const cache = new Map<string, CacheEntry>();

async function doFetch(issuerUri: string): Promise<IssuerMetadata> {
  const base = issuerUri.replace(/\/$/, '');
  const urls = [
    `${base}/.well-known/openid-credential-issuer`,
    `${base}/.well-known/openid-configuration`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const data = (await res.json()) as IssuerMetadata;
        return { ...data, issuer: data.issuer ?? issuerUri };
      }
    } catch {
      // try next URL
    }
  }
  return { issuer: issuerUri };
}

export async function resolveIssuerMetadata(issuerUri: string): Promise<IssuerMetadata> {
  const cached = cache.get(issuerUri);
  const now = Date.now();

  if (cached) {
    const stale = now - cached.fetchedAt > CACHE_TTL_MS;
    if (!stale) return cached.metadata;

    // Stale-while-revalidate: return cached while triggering background refresh
    if (!cached.refreshing) {
      cached.refreshing = true;
      doFetch(issuerUri)
        .then((fresh) => {
          cache.set(issuerUri, { metadata: fresh, fetchedAt: Date.now(), refreshing: false });
        })
        .catch(() => {
          if (cache.has(issuerUri)) {
            cache.get(issuerUri)!.refreshing = false;
          }
        });
    }
    return cached.metadata;
  }

  const metadata = await doFetch(issuerUri);
  cache.set(issuerUri, { metadata, fetchedAt: now, refreshing: false });
  return metadata;
}

export function clearIssuerMetadataCache(issuerUri?: string): void {
  if (issuerUri) {
    cache.delete(issuerUri);
  } else {
    cache.clear();
  }
}
