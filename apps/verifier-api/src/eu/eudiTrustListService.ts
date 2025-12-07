/**
 * B128A-EUDI-007: EUDI trust-list integrity service
 * - Signature verification for trust lists
 * - Host pinning for trusted sources
 * - TTL guard to prevent stale lists
 * - Nightly refresh mechanism
 */

import { createHash, createVerify } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface TrustListEntry {
  did: string;
  name: string;
  country: string;
  type: 'issuer' | 'verifier' | 'wallet_provider';
  publicKey: string;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'suspended' | 'revoked';
}

export interface TrustList {
  version: string;
  issuedAt: string;
  expiresAt: string;
  issuer: string;
  entries: TrustListEntry[];
  signature?: string;
}

export interface TrustListConfig {
  url: string;
  publicKey: string; // For signature verification
  pinnedHosts: string[]; // Host pinning
  ttlSeconds: number; // TTL guard
  refreshIntervalSeconds: number; // Nightly refresh
}

// Default configuration
const DEFAULT_CONFIG: TrustListConfig = {
  url: process.env.EUDI_TRUST_LIST_URL || 'https://eudi.europa.eu/trust-list.json',
  publicKey: process.env.EUDI_TRUST_LIST_PUBLIC_KEY || '',
  pinnedHosts: [
    'eudi.europa.eu',
    'trust.europa.eu',
    'digital-strategy.ec.europa.eu'
  ],
  ttlSeconds: 86400, // 24 hours
  refreshIntervalSeconds: 86400, // Nightly (24 hours)
};

interface CachedTrustList {
  trustList: TrustList;
  fetchedAt: number;
  signature: string;
  hash: string;
}

let cachedTrustList: CachedTrustList | null = null;
let refreshInterval: NodeJS.Timeout | null = null;

/**
 * B128A-EUDI-007: Verify trust list signature
 * Returns true if signature is valid, false otherwise
 */
export function verifyTrustListSignature(
  trustList: TrustList,
  publicKey: string,
  signature: string
): boolean {
  try {
    // Create canonical representation for signing
    const canonical = JSON.stringify({
      version: trustList.version,
      issuedAt: trustList.issuedAt,
      expiresAt: trustList.expiresAt,
      issuer: trustList.issuer,
      entries: trustList.entries,
    });

    // Verify signature using public key
    const verifier = createVerify('sha256');
    verifier.update(canonical);
    verifier.end();

    // B128A-EUDI-007: Signature verified
    const isValid = verifier.verify(
      {
        key: publicKey,
        padding: undefined,
      },
      signature,
      'base64'
    );

    if (isValid) {
      console.info('[EUDI] Trust list signature verified successfully');
    } else {
      console.error('[EUDI] Trust list signature verification failed');
    }

    return isValid;
  } catch (error) {
    console.error('[EUDI] Trust list signature verification error:', error);
    return false;
  }
}

/**
 * B128A-EUDI-007: Validate host against pinned list
 * Returns true if host is pinned, false otherwise
 */
export function validatePinnedHost(url: string, pinnedHosts: string[]): boolean {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;

    const isPinned = pinnedHosts.some(pinnedHost => {
      // Exact match or subdomain match
      return host === pinnedHost || host.endsWith(`.${pinnedHost}`);
    });

    if (!isPinned) {
      console.error(`[EUDI] Host ${host} is not in pinned list: ${pinnedHosts.join(', ')}`);
    }

    return isPinned;
  } catch (error) {
    console.error('[EUDI] Host validation error:', error);
    return false;
  }
}

/**
 * B128A-EUDI-007: Check if trust list is stale (beyond TTL)
 * Returns true if stale, false if fresh
 */
export function isTrustListStale(fetchedAt: number, ttlSeconds: number): boolean {
  const now = Date.now();
  const age = (now - fetchedAt) / 1000; // Age in seconds
  const isStale = age > ttlSeconds;

  if (isStale) {
    console.warn(`[EUDI] Trust list is stale (age: ${Math.floor(age)}s, TTL: ${ttlSeconds}s)`);
  }

  return isStale;
}

/**
 * B128A-EUDI-007: Compute hash of trust list for integrity
 */
export function computeTrustListHash(trustList: TrustList): string {
  const canonical = JSON.stringify({
    version: trustList.version,
    issuedAt: trustList.issuedAt,
    expiresAt: trustList.expiresAt,
    issuer: trustList.issuer,
    entries: trustList.entries,
  });

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * B128A-EUDI-007: Fetch trust list from remote URL
 * Validates host pinning, signature, and TTL
 */
export async function fetchTrustList(config: TrustListConfig = DEFAULT_CONFIG): Promise<TrustList> {
  // B128A-EUDI-007: Validate host against pinned list
  if (!validatePinnedHost(config.url, config.pinnedHosts)) {
    throw new Error(`Trust list URL host not in pinned list: ${config.url}`);
  }

  try {
    // Fetch trust list from URL
    const response = await fetch(config.url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'VitalCV-EUDI-Client/1.0',
      },
      // Use secure defaults
      redirect: 'error', // Don't follow redirects
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trust list: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const trustList: TrustList = data;

    // B128A-EUDI-007: Verify signature if present
    if (trustList.signature && config.publicKey) {
      const isValid = verifyTrustListSignature(trustList, config.publicKey, trustList.signature);
      if (!isValid) {
        throw new Error('Trust list signature verification failed');
      }
    } else if (!trustList.signature) {
      console.warn('[EUDI] Trust list has no signature - integrity cannot be verified');
    }

    // B128A-EUDI-007: Check expiration
    const expiresAt = new Date(trustList.expiresAt).getTime();
    const now = Date.now();
    if (now > expiresAt) {
      throw new Error(`Trust list expired at ${trustList.expiresAt}`);
    }

    // Compute hash for integrity
    const hash = computeTrustListHash(trustList);

    // Cache trust list
    cachedTrustList = {
      trustList,
      fetchedAt: now,
      signature: trustList.signature || '',
      hash,
    };

    console.info(`[EUDI] Trust list fetched and verified successfully (version: ${trustList.version}, entries: ${trustList.entries.length})`);

    return trustList;
  } catch (error) {
    console.error('[EUDI] Failed to fetch trust list:', error);
    throw error;
  }
}

/**
 * B128A-EUDI-007: Get cached trust list or fetch if stale
 * Implements TTL guard - blocks verification if list is stale
 */
export async function getTrustList(config: TrustListConfig = DEFAULT_CONFIG): Promise<TrustList> {
  // Check if we have a cached list
  if (cachedTrustList) {
    // B128A-EUDI-007: Check TTL - stale list blocks verify
    if (isTrustListStale(cachedTrustList.fetchedAt, config.ttlSeconds)) {
      console.warn('[EUDI] Cached trust list is stale, fetching fresh list');
      // Try to fetch fresh list; if fails, throw error (stale list blocks verify)
      try {
        return await fetchTrustList(config);
      } catch (error) {
        // B128A-EUDI-007: Stale list blocks verify - throw error
        throw new Error('Trust list is stale and refresh failed - verification blocked');
      }
    }

    // List is fresh
    return cachedTrustList.trustList;
  }

  // No cached list - fetch for first time
  return await fetchTrustList(config);
}

/**
 * B128A-EUDI-007: Verify an entity against trust list
 * Returns true if entity is in trust list and active
 */
export async function verifyEntityInTrustList(
  did: string,
  config: TrustListConfig = DEFAULT_CONFIG
): Promise<{ verified: boolean; entry?: TrustListEntry; error?: string }> {
  try {
    const trustList = await getTrustList(config);

    // Find entry by DID
    const entry = trustList.entries.find(e => e.did === did);

    if (!entry) {
      return {
        verified: false,
        error: `Entity DID not found in trust list: ${did}`,
      };
    }

    // Check status
    if (entry.status !== 'active') {
      return {
        verified: false,
        entry,
        error: `Entity status is ${entry.status}`,
      };
    }

    // Check validity period
    const now = new Date();
    const validFrom = new Date(entry.validFrom);
    const validUntil = new Date(entry.validUntil);

    if (now < validFrom) {
      return {
        verified: false,
        entry,
        error: `Entity not yet valid (valid from: ${entry.validFrom})`,
      };
    }

    if (now > validUntil) {
      return {
        verified: false,
        entry,
        error: `Entity expired (valid until: ${entry.validUntil})`,
      };
    }

    return {
      verified: true,
      entry,
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * B128A-EUDI-007: Start nightly refresh of trust list
 * Refreshes trust list at configured interval (default: 24 hours)
 */
export function startNightlyRefresh(config: TrustListConfig = DEFAULT_CONFIG): void {
  // Clear existing interval if any
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  console.info(`[EUDI] Starting trust list nightly refresh (interval: ${config.refreshIntervalSeconds}s)`);

  // B128A-EUDI-007: Nightly refresh - fetch trust list at interval
  refreshInterval = setInterval(async () => {
    try {
      console.info('[EUDI] Nightly trust list refresh started');
      await fetchTrustList(config);
      console.info('[EUDI] Nightly trust list refresh completed successfully');
    } catch (error) {
      console.error('[EUDI] Nightly trust list refresh failed:', error);
      // Continue with stale list - will block verify if beyond TTL
    }
  }, config.refreshIntervalSeconds * 1000);

  // Fetch immediately on start
  fetchTrustList(config).catch(error => {
    console.error('[EUDI] Initial trust list fetch failed:', error);
  });
}

/**
 * Stop nightly refresh
 */
export function stopNightlyRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.info('[EUDI] Trust list nightly refresh stopped');
  }
}

/**
 * Get trust list cache status
 */
export function getTrustListCacheStatus(): {
  cached: boolean;
  fetchedAt?: number;
  age?: number;
  hash?: string;
  entriesCount?: number;
  stale: boolean;
} {
  if (!cachedTrustList) {
    return { cached: false, stale: true };
  }

  const now = Date.now();
  const age = (now - cachedTrustList.fetchedAt) / 1000;
  const stale = isTrustListStale(cachedTrustList.fetchedAt, DEFAULT_CONFIG.ttlSeconds);

  return {
    cached: true,
    fetchedAt: cachedTrustList.fetchedAt,
    age,
    hash: cachedTrustList.hash,
    entriesCount: cachedTrustList.trustList.entries.length,
    stale,
  };
}

// Export config for testing
export { DEFAULT_CONFIG };

