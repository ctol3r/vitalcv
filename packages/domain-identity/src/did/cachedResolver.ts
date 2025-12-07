/**
 * DID Resolver with TTL caches and lightweight metrics.
 * Replaces backend-specific dependencies so the resolver can be
 * shared across runtimes (apps, services, backend).
 */
import type { DIDDocument } from '@domain/identity/contracts';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type DidResolverFn = (did: string) => Promise<DIDDocument | null>;

export interface CachedDIDResolverOptions {
  positiveTtlSeconds?: number;
  negativeTtlSeconds?: number;
  maxEntries?: number;
  resolver?: DidResolverFn;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  ttlSeconds: number;
}

function defaultResolver(did: string): Promise<DIDDocument | null> {
  if (did.startsWith('did:example:')) {
    return Promise.resolve({
      id: did,
      verificationMethod: [
        {
          id: `${did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: did,
          publicKeyMultibase: 'zH3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV',
        },
      ],
    });
  }
  return Promise.resolve(null);
}

/**
 * DID Resolver with caching
 */
export class CachedDIDResolver {
  private readonly positiveCache = new Map<string, CacheEntry<DIDDocument>>();
  private readonly negativeCache = new Map<string, CacheEntry<boolean>>();
  private readonly options: Required<CachedDIDResolverOptions>;
  private metrics = {
    positive: { hits: 0, misses: 0 },
    negative: { hits: 0, misses: 0 },
  };

  constructor(options: CachedDIDResolverOptions = {}) {
    this.options = {
      positiveTtlSeconds: options.positiveTtlSeconds ?? 300,
      negativeTtlSeconds: options.negativeTtlSeconds ?? 60,
      maxEntries: options.maxEntries ?? 1000,
      resolver: options.resolver ?? defaultResolver,
    };
  }

  /**
   * Resolve a DID document using cache + resolver
   */
  async resolve(did: string): Promise<DIDDocument | null> {
    const negativeEntry = this.getFromCache(this.negativeCache, did);
    if (negativeEntry === true) {
      this.metrics.negative.hits++;
      return null;
    } else if (negativeEntry === null) {
      this.metrics.negative.misses++;
    }

    const cachedDoc = this.getFromCache(this.positiveCache, did);
    if (cachedDoc) {
      this.metrics.positive.hits++;
      return cachedDoc;
    } else if (cachedDoc === null) {
      this.metrics.positive.misses++;
    }

    const resolved = await this.options.resolver(did);

    if (resolved) {
      this.setCacheEntry(this.positiveCache, did, resolved, this.options.positiveTtlSeconds);
    } else {
      this.setCacheEntry(this.negativeCache, did, true, this.options.negativeTtlSeconds);
    }

    return resolved;
  }

  /**
   * Expose resolver for manual use/testing
   */
  async resolveDID(did: string): Promise<DIDDocument | null> {
    return this.options.resolver(did);
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(): { positive: CacheMetrics; negative: CacheMetrics } {
    return {
      positive: {
        hits: this.metrics.positive.hits,
        misses: this.metrics.positive.misses,
        size: this.positiveCache.size,
        ttlSeconds: this.options.positiveTtlSeconds,
      },
      negative: {
        hits: this.metrics.negative.hits,
        misses: this.metrics.negative.misses,
        size: this.negativeCache.size,
        ttlSeconds: this.options.negativeTtlSeconds,
      },
    };
  }

  /**
   * Clear both caches
   */
  clearCache(): void {
    this.positiveCache.clear();
    this.negativeCache.clear();
    this.metrics = {
      positive: { hits: 0, misses: 0 },
      negative: { hits: 0, misses: 0 },
    };
  }

  private getFromCache<T>(store: Map<string, CacheEntry<T>>, key: string): T | true | null {
    const entry = store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }

    store.delete(key);
    store.set(key, entry);
    return entry.value;
  }

  private setCacheEntry<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    ttlSeconds: number,
  ): void {
    if (store.size >= this.options.maxEntries && !store.has(key)) {
      const firstKey = store.keys().next().value;
      if (typeof firstKey === 'string') {
        store.delete(firstKey);
      }
    }

    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}

// Global resolver instance
const globalResolver = new CachedDIDResolver();

/**
 * Get the global cached DID resolver
 */
export function getDIDResolver(): CachedDIDResolver {
  return globalResolver;
}
